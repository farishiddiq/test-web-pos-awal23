import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { setBackend, toApiError } from './backend';
import { createSupabaseBackend, isSupabaseConfigured, supabase } from './supabase';
import { DEMO_USER } from './demo/constants';
import type { DemoBackend, DemoStage } from './demo/backend';
import { storage } from '@/lib/util';

export type SessionStatus = 'booting' | 'signed-out' | 'ready' | 'error';

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

interface SessionValue {
  status: SessionStatus;
  mode: 'supabase' | 'demo' | null;
  user: SessionUser | null;
  demoStage: DemoStage | null;
  recovery: boolean;
  supabaseReady: boolean;
  bootError: string | null;
  retryBoot(): void;
  startDemo(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  resetDemo(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);
const MODE_KEY = 'possir.mode';

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('booting');
  const [mode, setMode] = useState<'supabase' | 'demo' | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [demoStage, setDemoStage] = useState<DemoStage | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const demoRef = useRef<DemoBackend | null>(null);

  const applySupabaseSession = useCallback((session: Session | null) => {
    if (session) {
      setBackend(createSupabaseBackend());
      setUser({
        id: session.user.id,
        email: session.user.email ?? null,
        name: (session.user.user_metadata?.full_name as string | undefined) ?? null,
      });
      setMode('supabase');
      setStatus('ready');
    } else {
      setBackend(null);
      setUser(null);
      setMode(null);
      setStatus('signed-out');
    }
  }, []);

  const bootDemo = useCallback(async () => {
    setStatus('booting');
    setBootError(null);
    setDemoStage('engine');
    try {
      const { createDemoBackend } = await import('./demo/backend');
      const demo = await createDemoBackend(setDemoStage);
      demoRef.current = demo;
      setBackend(demo);
      storage.set(MODE_KEY, 'demo');
      setUser({ id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name });
      setMode('demo');
      setStatus('ready');
    } catch (error) {
      // Mode demo tidak dihapus: gangguan sesaat (sinyal, memori) cukup dicoba lagi
      const err = toApiError(error);
      setDemoStage(null);
      setMode('demo');
      setBootError(err.message);
      setStatus('error');
      throw err;
    }
  }, []);

  useEffect(() => {
    if (storage.get<string | null>(MODE_KEY, null) === 'demo') {
      bootDemo().catch(() => undefined);
      return;
    }
    if (!isSupabaseConfigured) {
      setStatus('signed-out');
      return;
    }
    const sb = supabase();
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (active) applySupabaseSession(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') queryClient.clear();
      applySupabaseSession(session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [applySupabaseSession, bootDemo, queryClient]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      mode,
      user,
      demoStage,
      recovery,
      supabaseReady: isSupabaseConfigured,
      bootError,
      retryBoot: () => {
        bootDemo().catch(() => undefined);
      },
      startDemo: async () => {
        queryClient.clear();
        await bootDemo();
      },
      signIn: async (email, password) => {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) throw toApiError(translateAuthError(error.message));
      },
      signUp: async (email, password, name) => {
        const { data, error } = await supabase().auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw toApiError(translateAuthError(error.message));
        return { needsConfirmation: !data.session };
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/atur-sandi`,
        });
        if (error) throw toApiError(translateAuthError(error.message));
      },
      updatePassword: async (password) => {
        const { error } = await supabase().auth.updateUser({ password });
        if (error) throw toApiError(translateAuthError(error.message));
        setRecovery(false);
      },
      signOut: async () => {
        queryClient.clear();
        if (mode === 'demo') {
          storage.remove(MODE_KEY);
          setBackend(null);
          setUser(null);
          setMode(null);
          setBootError(null);
          setStatus('signed-out');
          return;
        }
        await supabase().auth.signOut();
      },
      resetDemo: async () => {
        await demoRef.current?.reset();
        storage.set(MODE_KEY, 'demo');
        window.location.assign('/');
      },
    }),
    [status, mode, user, demoStage, recovery, bootError, bootDemo, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession harus di dalam SessionProvider');
  return ctx;
}

function translateAuthError(message: string): Error {
  const map: Array<[RegExp, string]> = [
    [/Invalid login credentials/i, 'Username atau kata sandi salah.'],
    [/Email not confirmed/i, 'Email belum dikonfirmasi. Cek kotak masuk (atau folder spam) lalu klik tautannya.'],
    [/User already registered/i, 'Username ini sudah dipakai. Pilih username lain, atau masuk kalau ini akunmu.'],
    [/Password should be at least/i, 'Kata sandi minimal 6 karakter.'],
    [/rate limit|too many/i, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'],
    [/Unable to validate email|invalid email/i, 'Username tidak valid.'],
    [/same password/i, 'Kata sandi baru harus berbeda dari yang lama.'],
  ];
  for (const [pattern, text] of map) if (pattern.test(message)) return new Error(text);
  return new Error(message);
}
