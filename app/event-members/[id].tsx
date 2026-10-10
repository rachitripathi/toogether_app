import { useEffect, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AvatarBubble } from '@/components/AvatarBubble';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { PlanClosedScreen } from '@/components/PlanClosedScreen';
import { useApp } from '@/providers/AppProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useKeyboardOverlap } from '@/hooks/useKeyboardHeight';
import { isEventArchived } from '@/lib/eventTime';
import { cleanMultiline } from '@/lib/profileFields';
import { supabase } from '@/utils/supabase';
import { REPORT_REASON_LIMITS, type MemberReport, type User } from '@/lib/types';

const mapReportRow = (row: any): MemberReport => ({
  id: row.id,
  eventId: row.event_id,
  reporterId: row.reporter_id,
  reportedId: row.reported_id,
  reason: row.reason,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
  resolution: row.resolution,
});

const timeAgo = (iso: string) => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// Everyone in a plan (host + approved members), opened from the chat header and the plan page.
// Anyone here can report anyone else here; the host can remove members, and sees reports about
// them (who, why, when) with Remove / Dismiss right on the member. Reports are written only by
// report_member() / resolve_member_reports() (migration 018); RLS decides which reports this
// user can read, so the host never sees reports about themselves.
export default function EventMembersScreen() {
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? '';
  const {
    currentUser,
    getEventById,
    getUserById,
    getRequestStatus,
    isLoadingEvents,
    removeMember,
    reportMember,
    resolveMemberReports,
  } = useApp();
  const [reports, setReports] = useState<MemberReport[]>([]);
  const [reportTarget, setReportTarget] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const [reportError, setReportError] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const { ref: keyboardOverlapRef, onLayout: onKeyboardOverlapLayout, overlap: keyboardOverlap } = useKeyboardOverlap();

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const load = () =>
      supabase
        .from('member_reports')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) console.error('Error fetching reports:', error);
          else setReports((data ?? []).map(mapReportRow));
        });
    load();
    const channel = supabase
      .channel(`member-reports-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_reports', filter: `event_id=eq.${eventId}` }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  useEffect(() => {
    if (!reportTarget) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setReportTarget(null);
      return true;
    });
    return () => subscription.remove();
  }, [reportTarget]);

  const event = getEventById(eventId);
  if (!event) {
    return isLoadingEvents ? null : <PlanClosedScreen />;
  }
  if (isEventArchived(event)) {
    return <PlanClosedScreen event={event} />;
  }

  const isHost = currentUser?.id === event.creatorId;
  const isMember = getRequestStatus(event.id) === 'approved';
  if (!currentUser || (!isHost && !isMember)) {
    return <PlanClosedScreen />;
  }

  const host = getUserById(event.creatorId);
  const members = event.approvedUserIds.map((userId) => getUserById(userId)).filter((user): user is User => !!user);
  const people = [...(host ? [host] : []), ...members];
  const openReportsAbout = (userId: string) => reports.filter((report) => report.reportedId === userId && !report.resolvedAt);
  const iReported = (userId: string) =>
    reports.some((report) => report.reporterId === currentUser.id && report.reportedId === userId && !report.resolvedAt);

  const openReport = (user: User) => {
    setReason('');
    setReportError('');
    setReportTarget(user);
  };

  const submitReport = async () => {
    if (!reportTarget || isSubmittingReport) return;
    const cleaned = cleanMultiline(reason);
    if (cleaned.length < REPORT_REASON_LIMITS.min) {
      setReportError(`Please describe what happened (at least ${REPORT_REASON_LIMITS.min} characters).`);
      return;
    }
    setIsSubmittingReport(true);
    try {
      await reportMember(event.id, reportTarget.id, cleaned);
      setReportTarget(null);
      Alert.alert(
        'Report sent',
        reportTarget.id === event.creatorId
          ? 'Thanks. The Toogether team will review it.'
          : 'Thanks. The host can see your report and decide what to do.'
      );
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not send the report. Try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const confirmRemove = (member: User, viaReports: boolean) =>
    Alert.alert(
      `Remove ${member.name.split(' ')[0]}?`,
      "They'll lose access to the chat and the plan's details, and won't be able to request this plan again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyUserId(member.id);
            try {
              if (viaReports) await resolveMemberReports(event.id, member.id, true);
              else await removeMember(event.id, member.id);
            } catch (err) {
              Alert.alert('Could not remove', err instanceof Error ? err.message : 'Please try again.');
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ]
    );

  const dismissReports = async (member: User) => {
    setBusyUserId(member.id);
    try {
      await resolveMemberReports(event.id, member.id, false);
    } catch (err) {
      Alert.alert('Could not dismiss', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          ...shadow.card,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Members</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5, fontWeight: '700' }}>
            {event.emoji} {event.title} · {people.length} {people.length === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 4, paddingBottom: 4 }}>
          <Icon name="shield-checkmark-outline" size={16} color={colors.muted} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
            {isHost
              ? 'Reports about your members show up here. You can remove someone or dismiss the report.'
              : "If someone makes you uncomfortable, report them. The host sees reports about members; reports about the host go to the Toogether team."}
          </Text>
        </View>

        {people.map((person) => {
          const isMe = person.id === currentUser.id;
          const isPersonHost = person.id === event.creatorId;
          const personReports = isHost && !isPersonHost ? openReportsAbout(person.id) : [];
          const busy = busyUserId === person.id;

          return (
            <View key={person.id} style={{ backgroundColor: colors.card, borderRadius: 22, overflow: 'hidden', ...shadow.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <Pressable onPress={() => router.push(`/user/${person.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <AvatarBubble user={person} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 15, flexShrink: 1 }}>
                        {person.name}
                      </Text>
                      {person.verified ? <VerifiedBadge size={13} /> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isPersonHost ? (
                        <View style={{ backgroundColor: colors.status.info.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: colors.status.info.text, fontSize: 11, fontWeight: '800' }}>Host</Text>
                        </View>
                      ) : null}
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5, flexShrink: 1 }}>
                        {isMe ? 'You' : `@${person.username}`}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {!isMe ? (
                  iReported(person.id) ? (
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800' }}>Reported</Text>
                  ) : (
                    <Pressable
                      onPress={() => openReport(person)}
                      hitSlop={6}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface }}
                    >
                      <Icon name="flag-outline" size={14} color={colors.muted} />
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12.5 }}>Report</Text>
                    </Pressable>
                  )
                ) : null}
                {isHost && !isPersonHost && !personReports.length ? (
                  <Pressable
                    onPress={() => confirmRemove(person, false)}
                    disabled={busy}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.solid.decline, opacity: busy ? 0.5 : 1 }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              {personReports.length ? (
                <View style={{ backgroundColor: colors.status.danger.bg, padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="flag-outline" size={15} color={colors.status.danger.text} />
                    <Text style={{ color: colors.status.danger.text, fontWeight: '900', fontSize: 13 }}>
                      Reported by {personReports.length} {personReports.length === 1 ? 'person' : 'people'}
                    </Text>
                  </View>
                  {personReports.map((report) => {
                    const reporter = getUserById(report.reporterId);
                    return (
                      <View key={report.id} style={{ backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 4 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                          {reporter?.name ?? 'A member'} · <Text style={{ color: colors.muted, fontWeight: '600' }}>{timeAgo(report.createdAt)}</Text>
                        </Text>
                        <Text style={{ color: colors.text, fontSize: 13.5, lineHeight: 19 }}>“{report.reason}”</Text>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => dismissReports(person)}
                      disabled={busy}
                      style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800' }}>Dismiss</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemove(person, true)}
                      disabled={busy}
                      style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: colors.solid.decline, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Remove from plan</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* In-screen overlay, not a <Modal>, so it can rise above the keyboard on Android (see the
          Keyboard note in docs/FUNCTIONALITY.md). */}
      {reportTarget ? (
        <View
          ref={keyboardOverlapRef}
          onLayout={onKeyboardOverlapLayout}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
            paddingBottom: keyboardOverlap,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setReportTarget(null)} />
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900', flex: 1 }}>Report {reportTarget.name.split(' ')[0]}</Text>
              <Pressable onPress={() => setReportTarget(null)} hitSlop={10}>
                <Icon name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <KeyboardAwareScrollView padForKeyboard={false} contentContainerStyle={{ gap: 14, paddingBottom: Math.max(insets.bottom, 8) }}>
              <Text style={{ color: colors.muted, lineHeight: 20 }}>
                {reportTarget.id === event.creatorId
                  ? "This goes to the Toogether team, not the host. Tell us what happened."
                  : "The host will see this report and your name, and can remove them from the plan. Tell them what happened."}
              </Text>
              <FormField
                label="Reason"
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  if (reportError) setReportError('');
                }}
                placeholder="What happened?"
                multiline
                maxLength={REPORT_REASON_LIMITS.max}
                error={reportError || undefined}
              />
              <GradientButton
                label={isSubmittingReport ? 'Sending…' : 'Send report'}
                onPress={submitReport}
                disabled={isSubmittingReport}
                fullWidth
              />
            </KeyboardAwareScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}
