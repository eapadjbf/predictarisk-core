import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ShieldAlert,
  Loader2,
  Building2,
  Users,
  UserCheck,
  Crown,
  LogOut,
  Ban,
  ArrowUpCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "@/lib/auth";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { profile, signOut } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [analysesByUser, setAnalysesByUser] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: profiles, error: pErr }, { data: analyses }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("analyses").select("user_id"),
    ]);

    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    for (const a of (analyses as { user_id: string }[] | null) ?? []) {
      counts[a.user_id] = (counts[a.user_id] ?? 0) + 1;
    }
    setAnalysesByUser(counts);
    setRows((profiles as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const orgs = new Set(rows.map((r) => r.organisation_name));
    return {
      orgs: orgs.size,
      users: rows.length,
      free: rows.filter((r) => r.plan === "free").length,
      paid: rows.filter((r) => r.plan === "paid").length,
    };
  }, [rows]);

  const handleSuspendToggle = async (row: Profile) => {
    setBusyId(row.id);
    const nextStatus = row.status === "suspended" ? "active" : "suspended";
    const { error: e } = await supabase
      .from("profiles")
      .update({ status: nextStatus })
      .eq("id", row.id);
    if (e) setError(e.message);
    await load();
    setBusyId(null);
  };

  const handleUpgrade = async (row: Profile) => {
    setBusyId(row.id);
    const { error: e } = await supabase
      .from("profiles")
      .update({ plan: "paid" })
      .eq("id", row.id);
    if (e) setError(e.message);
    await load();
    setBusyId(null);
  };

  const handleDelete = async (row: Profile) => {
    if (
      !window.confirm(
        `Delete ${row.email}? This permanently removes their profile and their login, so they can no longer sign in.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const resp = await fetch(`/api/admin/users/${row.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to delete the user.");
        return;
      }
    } catch {
      setError("Failed to reach the server. Please try again.");
      return;
    } finally {
      setBusyId(null);
    }
    await load();
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const cards = [
    { label: "Organisations", value: summary.orgs, icon: Building2 },
    { label: "Total Users", value: summary.users, icon: Users },
    { label: "Free Users", value: summary.free, icon: UserCheck },
    { label: "Paid Users", value: summary.paid, icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-mono selection:bg-primary/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="flex h-14 items-center px-6 gap-3">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span className="text-primary font-bold tracking-widest text-sm uppercase">PREDICTARISK</span>
          <span className="text-[10px] text-muted-foreground tracking-widest uppercase border-l border-border pl-3">
            Admin Console
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-[10px] text-muted-foreground tracking-wide hidden sm:inline">
              {profile?.first_name} {profile?.last_name}
            </span>
            <button
              onClick={() => setLocation("/")}
              data-testid="btn-back-app"
              className="text-[10px] text-muted-foreground hover:text-primary tracking-widest uppercase"
            >
              App
            </button>
            <button
              onClick={async () => {
                await signOut();
                setLocation("/login");
              }}
              data-testid="btn-logout"
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary tracking-widest uppercase"
            >
              <LogOut className="w-3 h-3" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-6xl space-y-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <p className="text-[10px] text-primary tracking-widest uppercase">Tenant Management</p>
            <h1 className="text-xl font-bold tracking-widest uppercase">Admin Dashboard</h1>
          </div>
          <button
            onClick={() => void load()}
            data-testid="btn-refresh"
            className="flex items-center gap-2 border border-border px-3 py-2 text-[10px] tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {error && (
          <div className="border border-primary/40 bg-primary/5 p-3 text-xs text-primary">{error}</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <p className="text-[9px] text-muted-foreground tracking-widest uppercase">{c.label}</p>
                </div>
                <p className="text-2xl font-bold tracking-tight" data-testid={`stat-${c.label}`}>{c.value}</p>
              </div>
            );
          })}
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Organisations & Users</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[9px] text-muted-foreground tracking-widest uppercase">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Organisation</th>
                    <th className="px-4 py-3 font-medium">Sector</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Registered</th>
                    <th className="px-4 py-3 font-medium">Last Login</th>
                    <th className="px-4 py-3 font-medium text-center">Analyses</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40" data-testid={`row-${r.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold">{r.first_name} {r.last_name}</div>
                        <div className="text-[10px] text-muted-foreground">{r.email}</div>
                        <div className="text-[9px] text-muted-foreground tracking-wide uppercase">
                          {r.job_title}{r.role === "admin" && <span className="text-primary ml-1">· Admin</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">{r.organisation_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.sector}</td>
                      <td className="px-4 py-3">
                        <span className={r.plan === "paid" ? "text-emerald-400" : "text-muted-foreground"}>
                          {r.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={r.status === "suspended" ? "text-primary" : "text-emerald-400"}>
                          {(r.status ?? "active").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.last_login)}</td>
                      <td className="px-4 py-3 text-center">{analysesByUser[r.id] ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSuspendToggle(r)}
                            disabled={busyId === r.id}
                            title={r.status === "suspended" ? "Reactivate" : "Suspend"}
                            data-testid={`btn-suspend-${r.id}`}
                            className="p-1.5 border border-border hover:border-primary hover:text-primary text-muted-foreground transition-colors disabled:opacity-40"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleUpgrade(r)}
                            disabled={busyId === r.id || r.plan === "paid"}
                            title="Upgrade to Paid"
                            data-testid={`btn-upgrade-${r.id}`}
                            className="p-1.5 border border-border hover:border-emerald-400 hover:text-emerald-400 text-muted-foreground transition-colors disabled:opacity-40"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={busyId === r.id || r.id === profile?.id}
                            title="Delete profile"
                            data-testid={`btn-delete-${r.id}`}
                            className="p-1.5 border border-border hover:border-primary hover:text-primary text-muted-foreground transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border px-4 py-2 text-[9px] text-muted-foreground tracking-wide">
            Note: Delete fully removes the user — both their profile and their underlying auth login —
            so any active session is revoked and they can no longer sign in.
          </div>
        </div>
      </main>
    </div>
  );
}
