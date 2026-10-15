import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ShieldAlert, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { session, loading, profile, suspendedMessage, clearSuspendedMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) {
      const roleRoutes: Record<string, string> = {
        admin: "/admin",
        analyst: "/analyst",
        ciso: "/ciso",
        executive: "/executive",
      };
      setLocation(roleRoutes[profile.role] ?? "/");
    }
  }, [loading, session, profile, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    clearSuspendedMessage();
    setSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    if (data.user) {
      void supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    // Role redirect handled by useEffect after profile loads
  };

  const handleReset = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Enter your email address above, then click 'Forgot password?'.");
      return;
    }
    setResetting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    });
    setResetting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setInfo("Password reset instructions have been sent to your email.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-6 selection:bg-primary/30">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <span className="text-primary font-bold text-xl tracking-widest">PREDICTARISK</span>
        </div>

        <div className="border border-border bg-card p-8">
          <div className="space-y-1 mb-6 border-b border-border pb-4">
            <p className="text-[10px] text-primary tracking-widest uppercase">Secure Access</p>
            <h1 className="text-lg font-bold tracking-widest uppercase">Operator Login</h1>
          </div>

          {suspendedMessage && (
            <div className="mb-4 flex items-start gap-2 border border-primary/40 bg-primary/5 p-3 text-xs text-primary">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{suspendedMessage}</span>
            </div>
          )}

          {error && (
            <div data-testid="login-error" className="mb-4 flex items-start gap-2 border border-primary/40 bg-primary/5 p-3 text-xs text-primary">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mb-4 flex items-start gap-2 border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Work Email</label>
              <input
                type="email"
                required
                data-testid="input-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="operator@organisation.com"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground tracking-widest uppercase">Password</label>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="text-[10px] text-muted-foreground hover:text-primary tracking-wide disabled:opacity-50"
                >
                  {resetting ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <input
                type="password"
                required
                data-testid="input-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="btn-login"
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              No access yet?{" "}
              <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                Request access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
