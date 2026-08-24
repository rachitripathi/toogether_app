import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase';

export type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const CHECK_DELAY_MS = 450;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '');
}

// Live-checks the given username against profiles.username (UNIQUE at the DB level —
// see migrations/001_create_core_schema.sql) as the user types, debounced so we don't
// fire a query on every keystroke. This is a friendly preview only; the DB constraint
// stays the real backstop against a same-instant race between two people.
export function useUsernameAvailability(rawUsername: string, currentUsername?: string): UsernameAvailability {
  const [status, setStatus] = useState<UsernameAvailability>('idle');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const username = normalizeUsername(rawUsername);

    if (!username) {
      setStatus('idle');
      return;
    }

    if (currentUsername && username === normalizeUsername(currentUsername)) {
      setStatus('available');
      return;
    }

    if (!USERNAME_PATTERN.test(username)) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => {
      supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
        .then(({ data, error }) => {
          if (requestId !== requestIdRef.current) return; // superseded by a newer keystroke
          if (error) {
            setStatus('idle');
            return;
          }
          setStatus(data ? 'taken' : 'available');
        });
    }, CHECK_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [rawUsername, currentUsername]);

  return status;
}
