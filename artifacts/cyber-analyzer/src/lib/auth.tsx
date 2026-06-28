import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  organisation_name: string;
  job_title: string;
  sector: string;
  role: string;
  plan: string;
  status: string;
  org_user_count: number | null;
  last_login: string | null;
  created_at: string;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  profileError: string | null;
  suspendedMessage: string | null;
  clearSuspendedMessage: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const SUSPENDED_MESSAGE =
  "Your account has been suspended. Please contact your administrator for assistance.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      setLoading(true);
      setProfileError(null);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        // The profile read failed (most commonly a misconfigured Row Level
        // Security policy on the profiles table). Surface it instead of
        // silently treating the user as a non-admin, which would bounce them
        // off /admin with no explanation. Run artifacts/cyber-analyzer/
        // supabase-setup.sql to (re)create the correct policies.
        // eslint-disable-next-line no-console
        console.error("Failed to load profile:", error);
        setProfileError(error.message);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (data && data.status === "suspended") {
        setSuspendedMessage(SUSPENDED_MESSAGE);
        await supabase.auth.signOut();
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile((data as Profile) ?? null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to refresh profile:", error);
      setProfileError(error.message);
      return;
    }
    setProfileError(null);
    setProfile((data as Profile) ?? null);
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const clearSuspendedMessage = useCallback(() => setSuspendedMessage(null), []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isAdmin: profile?.role === "admin",
        profileError,
        suspendedMessage,
        clearSuspendedMessage,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
