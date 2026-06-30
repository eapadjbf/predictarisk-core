import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ShieldAlert, Loader2, AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { SECTORS, JOB_TITLES, FREE_TIER_LIMIT_MESSAGE } from "@/lib/constants";

export default function Register() {
  const [, setLocation] = useLocation();
  const { session, loading } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [sector, setSector] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && session) setLocation("/");
  }, [loading, session, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!jobTitle) {
      setError("Please select your job title.");
      return;
    }
    if (!sector) {
      setError("Please select your sector.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptTerms) {
      setError("You must accept the Terms of Service to continue.");
      return;
    }

    setSubmitting(true);

    const orgName = organisation.trim();

    const { data: hasCapacity, error: rpcError } = await supabase.rpc("org_has_free_capacity", {
      org: orgName,
    });

    if (!rpcError && hasCapacity === false) {
      setError(FREE_TIER_LIMIT_MESSAGE);
      setSubmitting(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          organisation_name: orgName,
          job_title: jobTitle,
          sector,
          role: "user",
          plan: "free",
        },
      },
    });

    if (signUpError) {
      // Always log the raw Supabase error so failures are debuggable instead of
      // silent. The profile row is created by a DB trigger (handle_new_user) that
      // runs in the same transaction as the auth.users insert, so a profile
      // failure surfaces here as a sign-up error.
      // eslint-disable-next-line no-console
      console.error("Supabase sign-up failed:", signUpError);
      const msg = signUpError.message ?? "";
      if (/ORG_FREE_LIMIT_REACHED/i.test(msg)) {
        setError(FREE_TIER_LIMIT_MESSAGE);
      } else if (/database error/i.test(msg)) {
        // A trigger raised an exception (or the DB setup is missing). The most
        // common cause is the free-tier limit; surface the raw error too so a
        // genuine setup problem isn't hidden behind the limit message.
        setError(
          `${FREE_TIER_LIMIT_MESSAGE} — if this is unexpected, the server reported: "${msg}".`,
        );
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
      setSubmitting(false);
      return;
    }

    // When email confirmation is disabled, sign-up returns an active session, so
    // we can verify the trigger actually created the profile row and surface a
    // clear error instead of "succeeding" with no profile. When confirmation is
    // required there is no session yet (RLS would block the read), so we rely on
    // the DB trigger and skip this check.
    if (signUpData.session && signUpData.user) {
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", signUpData.user.id)
        .maybeSingle();

      if (profileError) {
        // eslint-disable-next-line no-console
        console.error("Profile verification failed after sign-up:", profileError);
        setError(
          `Your account was created but your profile could not be read: ${profileError.message}. Please contact info@cyberguardsys.com.`,
        );
        setSubmitting(false);
        return;
      }

      if (!profileRow) {
        // eslint-disable-next-line no-console
        console.error(
          "Profile row was not created after sign-up for user",
          signUpData.user.id,
        );
        setError(
          "Your account was created but your profile was not saved. The database setup (profiles trigger) may be missing — please contact info@cyberguardsys.com.",
        );
        setSubmitting(false);
        return;
      }
    }

    setSuccess(true);
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-6 selection:bg-primary/30">
        <div className="w-full max-w-md border border-border bg-card p-8 text-center">
          <MailCheck className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold tracking-widest uppercase mb-2">Check Your Email</h1>
          <p className="text-sm text-muted-foreground mb-6">
            We've sent a verification link to <span className="text-foreground">{email.trim()}</span>.
            Confirm your email to activate your account, then sign in.
          </p>
          <Link
            href="/login"
            className="inline-block bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full bg-background border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none";
  const labelClass = "text-[10px] text-muted-foreground tracking-widest uppercase";

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-6 selection:bg-primary/30">
      <div className="w-full max-w-lg my-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <span className="text-primary font-bold text-xl tracking-widest">CYBERGUARD.SYS</span>
        </div>

        <div className="border border-border bg-card p-8">
          <div className="space-y-1 mb-6 border-b border-border pb-4">
            <p className="text-[10px] text-primary tracking-widest uppercase">Request Access</p>
            <h1 className="text-lg font-bold tracking-widest uppercase">Create Operator Account</h1>
          </div>

          {error && (
            <div data-testid="register-error" className="mb-4 flex items-start gap-2 border border-primary/40 bg-primary/5 p-3 text-xs text-primary">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>First Name</label>
                <input data-testid="input-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Last Name</label>
                <input data-testid="input-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Work Email</label>
              <input data-testid="input-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@organisation.com" />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Organisation</label>
              <input data-testid="input-organisation" required value={organisation} onChange={(e) => setOrganisation(e.target.value)} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Job Title</label>
                <select data-testid="select-job-title" required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {JOB_TITLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Sector</label>
                <select data-testid="select-sector" required value={sector} onChange={(e) => setSector(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Password</label>
                <input data-testid="input-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Min. 8 characters" />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Confirm Password</label>
                <input data-testid="input-confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
              <input
                data-testid="checkbox-terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 accent-[hsl(var(--primary))]"
              />
              <span>
                I accept the Terms of Service and Privacy Policy, and consent to the processing of
                security event data for analysis.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              data-testid="btn-register"
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Already have access?{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
