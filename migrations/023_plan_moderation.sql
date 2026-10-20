-- Open Plans - Admins can moderate plans and chats
-- Why: admins could read every plan and chat but change nothing; events_update_creator is
-- creator-only, so restrict_event_edits()' is_admin() bypass was never reachable. These
-- SECURITY DEFINER functions give admins cancel / restore / edit / feature / remove member /
-- hide message / purge, each permission-checked and written to admin_audit_log.
-- Chats: admins no longer read messages directly; admin_get_chat() asks for a reason and writes
-- admin_access_log first. Hidden messages disappear for members.
-- Needs 020 and 022. Safe to re-run.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Replaces 016's version: no blanket admin branch, and hidden messages are left out.
DROP POLICY IF EXISTS "messages_select_approved" ON public.messages;
CREATE POLICY "messages_select_approved" ON public.messages FOR SELECT
  USING (
    hidden_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = messages.event_id
        AND e.deleted_at IS NULL
        AND e.date_time > now() - interval '6 hours'
        AND (e.creator_id = auth.uid() OR public.is_event_member(e.id))
    )
  );

CREATE OR REPLACE FUNCTION public.admin_get_chat(p_event_id UUID, p_reason TEXT)
RETURNS TABLE (id UUID, user_id UUID, text TEXT, created_at TIMESTAMPTZ, hidden_at TIMESTAMPTZ, hidden_reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
BEGIN
  PERFORM public.admin_require('chat.read');
  INSERT INTO public.admin_access_log (actor_id, resource, target_id, reason)
  VALUES (auth.uid(), 'chat', p_event_id::TEXT, v_reason);
  RETURN QUERY
  SELECT m.id, m.user_id, m.text, m.created_at, m.hidden_at, m.hidden_reason
  FROM public.messages m
  WHERE m.event_id = p_event_id
  ORDER BY m.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_chat(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_chat(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_hide_message(p_message_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_msg RECORD;
BEGIN
  PERFORM public.admin_require('chat.moderate');
  SELECT id, event_id, user_id, text INTO v_msg FROM public.messages WHERE id = p_message_id AND hidden_at IS NULL FOR UPDATE;
  IF v_msg.id IS NULL THEN
    RAISE EXCEPTION 'That message is already hidden or gone.';
  END IF;
  UPDATE public.messages SET hidden_at = now(), hidden_by = auth.uid(), hidden_reason = v_reason WHERE id = p_message_id;
  PERFORM public.admin_log('message.hide', 'message', p_message_id::TEXT, v_reason,
    jsonb_build_object('text', v_msg.text, 'user_id', v_msg.user_id), NULL, jsonb_build_object('eventId', v_msg.event_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_hide_message(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_hide_message(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_event(p_event_id UUID, p_reason TEXT, p_message TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_told INT;
BEGIN
  PERFORM public.admin_require('events.moderate');
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'This plan is already cancelled.';
  END IF;
  v_told := public.admin_cancel_event_internal(p_event_id, v_reason,
    coalesce(NULLIF(btrim(coalesce(p_message, '')), ''), 'Open Plans cancelled this plan. Look for another plan nearby.'));
  PERFORM public.admin_log('event.cancel', 'event', p_event_id::TEXT, v_reason, NULL, jsonb_build_object('notified', v_told));
  RETURN v_told;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_cancel_event(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_event(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_restore_event(p_event_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_event RECORD;
BEGIN
  PERFORM public.admin_require('events.moderate');
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL OR v_event.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Only a cancelled plan can be restored.';
  END IF;
  IF v_event.date_time <= now() THEN
    RAISE EXCEPTION 'This plan''s start time has passed, so it can''t be restored.';
  END IF;
  UPDATE public.events SET deleted_at = NULL, cancelled_by = NULL, cancel_reason = NULL WHERE id = p_event_id;
  PERFORM public.admin_log('event.restore', 'event', p_event_id::TEXT, v_reason,
    jsonb_build_object('deleted_at', v_event.deleted_at, 'cancel_reason', v_event.cancel_reason), NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_restore_event(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_event(UUID, TEXT) TO authenticated;

-- Edits any text field and the group size. validate_event() still applies.
CREATE OR REPLACE FUNCTION public.admin_update_event(
  p_event_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_area TEXT,
  p_exact_location TEXT,
  p_location_note TEXT,
  p_max_people INT,
  p_women_only BOOLEAN,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_old RECORD;
  v_going INT;
BEGIN
  PERFORM public.admin_require('events.moderate');
  SELECT title, description, area, exact_location, location_note, max_people, women_only
  INTO v_old FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That plan no longer exists.';
  END IF;
  SELECT count(*) + 1 INTO v_going FROM public.join_requests WHERE event_id = p_event_id AND status = 'approved';
  IF p_max_people IS NOT NULL AND p_max_people < v_going THEN
    RAISE EXCEPTION '% people are already going, so the group can''t be smaller than that.', v_going;
  END IF;

  UPDATE public.events
  SET title = btrim(p_title),
      description = coalesce(btrim(p_description), ''),
      area = btrim(p_area),
      exact_location = btrim(p_exact_location),
      location_note = NULLIF(btrim(coalesce(p_location_note, '')), ''),
      max_people = p_max_people,
      women_only = coalesce(p_women_only, false)
  WHERE id = p_event_id;

  PERFORM public.admin_log('event.edit', 'event', p_event_id::TEXT, v_reason, to_jsonb(v_old),
    jsonb_build_object('title', btrim(p_title), 'description', p_description, 'area', btrim(p_area), 'exact_location', btrim(p_exact_location),
      'location_note', p_location_note, 'max_people', p_max_people, 'women_only', p_women_only));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN, TEXT) TO authenticated;

-- "Feature on Home" uses the existing events.pinned column.
CREATE OR REPLACE FUNCTION public.admin_set_featured(p_event_id UUID, p_featured BOOLEAN, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
BEGIN
  PERFORM public.admin_require('events.moderate');
  UPDATE public.events SET pinned = p_featured WHERE id = p_event_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a live plan can be featured.';
  END IF;
  PERFORM public.admin_log(CASE WHEN p_featured THEN 'event.feature' ELSE 'event.unfeature' END, 'event', p_event_id::TEXT, v_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_featured(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_featured(UUID, BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_member(p_event_id UUID, p_user_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
BEGIN
  PERFORM public.admin_require('events.moderate');
  PERFORM set_config('toogether.admin_action', 'on', true);
  UPDATE public.join_requests SET status = 'removed'
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'They aren''t going to this plan.';
  END IF;
  UPDATE public.member_reports SET resolved_at = now(), resolution = 'removed', resolved_by = auth.uid()
  WHERE event_id = p_event_id AND reported_id = p_user_id AND resolved_at IS NULL;
  PERFORM public.admin_log('event.remove_member', 'user', p_user_id::TEXT, v_reason, NULL, NULL, jsonb_build_object('eventId', p_event_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_member(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_member(UUID, UUID, TEXT) TO authenticated;

-- Permanently deletes a cancelled plan (cascades to requests, chat, reports, notifications' rows
-- keep their text). Archived plans are members' history and can't be purged here.
CREATE OR REPLACE FUNCTION public.admin_purge_event(p_event_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT := public.admin_check_reason(p_reason);
  v_event RECORD;
BEGIN
  PERFORM public.admin_require('events.purge');
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'That plan no longer exists.';
  END IF;
  IF v_event.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Only cancelled plans can be deleted for good.';
  END IF;
  PERFORM public.admin_log('event.purge', 'event', p_event_id::TEXT, v_reason, to_jsonb(v_event), NULL);
  DELETE FROM public.events WHERE id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_purge_event(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_event(UUID, TEXT) TO authenticated;
