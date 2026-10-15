import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export interface TwinData {
  twinSummary: { assets: number; criticalToLifeAssets: number; openAlerts: number; openAlertsOnCriticalToLife: number };
  analysis: {
    reviewStatus: string;
    threats: { threatId: string; label: string; count: number; share: number }[];
    rankedControls: { controlId: string; title: string; recommendation: string; tier: "critical" | "standard"; mappings: { framework: string; ref: string }[] }[];
    frameworkExposure: { framework: string; name: string; pressureIndex: number; requirementsUnderPressure: number; requirementsInLibrary: number }[];
    disclaimer: string;
  };
  topPredictedFailures: { assetId: number; name: string; department: string; criticalToLife: boolean; failureProbability30d: number; failureProbability90d: number; mainFactor: string | null }[];
  notes: string[];
}

/** Análise real do Digital Twin para contas Healthcare ligadas. Para as restantes, data = null. */
export function useTwinAnalysis(): { loading: boolean; data: TwinData | null } {
  const [state, setState] = useState<{ loading: boolean; data: TwinData | null }>({ loading: true, data: null });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (!token) throw new Error("no session");
        const res = await fetch("/api/me/healthcare-analysis", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as TwinData;
        if (active) setState({ loading: false, data: json });
      } catch {
        if (active) setState({ loading: false, data: null });
      }
    })();
    return () => { active = false; };
  }, []);
  return state;
}

export function TwinLoading() {
  return <div className="min-h-screen bg-background text-muted-foreground font-mono p-6 text-sm">Loading…</div>;
}

export function TwinShell({ label, children }: { label: string; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-primary font-bold tracking-widest">CYBERGUARD.SYS</span>
            <span className="text-muted-foreground text-xs ml-2">// {label}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{profile?.first_name} {profile?.last_name}</span>
            <button onClick={signOut} className="text-xs text-primary hover:underline">Sign out</button>
          </div>
        </div>
        <div data-testid="twin-live-banner" className="border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          <span className="font-bold tracking-widest">LIVE DATA</span> — computed from your Digital Twin. Regulatory references and threat mappings are drafts pending legal and biomedical review.
        </div>
        {children}
      </div>
    </div>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[10px] text-primary tracking-widest uppercase">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Kpis({ d }: { d: TwinData }) {
  const s = d.twinSummary;
  const items = [
    { label: "Assets monitored", value: s.assets, color: "text-primary" },
    { label: "Life-critical assets", value: s.criticalToLifeAssets, color: "text-red-400" },
    { label: "Open alerts", value: s.openAlerts, color: "text-yellow-400" },
    { label: "Alerts on life-critical devices", value: s.openAlertsOnCriticalToLife, color: "text-red-400" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((k) => (
        <div key={k.label} className="border border-border bg-card p-4 space-y-2">
          <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase">{k.label}</p>
        </div>
      ))}
    </div>
  );
}

function Threats({ d }: { d: TwinData }) {
  return (
    <Card title="Threats inferred from asset posture">
      <div className="divide-y divide-border">
        {d.analysis.threats.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">No open threats.</p>}
        {d.analysis.threats.map((t) => (
          <div key={t.threatId} className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm">{t.label}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.count} alerts · {pct(t.share)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Exposure({ d }: { d: TwinData }) {
  return (
    <Card title="Regulatory exposure (relative)" sub="Inferred from open alerts. This is not a compliance score.">
      <div className="divide-y divide-border">
        {d.analysis.frameworkExposure.map((f) => (
          <div key={f.framework} className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm">{f.name}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {f.requirementsUnderPressure}/{f.requirementsInLibrary} clauses · {f.pressureIndex.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <p className="px-4 py-3 text-[10px] text-muted-foreground border-t border-border">{d.analysis.disclaimer}</p>
    </Card>
  );
}

function Controls({ d, limit = 6 }: { d: TwinData; limit?: number }) {
  return (
    <Card title="Priority controls" sub="First-line controls against high-criticality threats come first.">
      <div className="divide-y divide-border">
        {d.analysis.rankedControls.slice(0, limit).map((c) => (
          <div key={c.controlId} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 border ${c.tier === "critical" ? "text-red-400 border-red-500/40 bg-red-500/10" : "text-muted-foreground border-border"}`}>
                {c.tier === "critical" ? "CRITICAL" : "STANDARD"}
              </span>
              <span className="text-sm">{c.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.recommendation}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.mappings.map((m) => (
                <span key={`${m.framework}-${m.ref}`} className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground">{m.framework} {m.ref}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Failures({ d }: { d: TwinData }) {
  return (
    <Card title="Highest predicted failure risk" sub="Life-critical devices first · Weibull model from the Digital Twin">
      <div className="divide-y divide-border">
        {d.topPredictedFailures.map((p) => (
          <div key={p.assetId} className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{p.name}</span>
                {p.criticalToLife && <Heart className="w-3 h-3 text-red-400" />}
              </div>
              <p className="text-[10px] text-muted-foreground">{p.department}{p.mainFactor ? ` · ${p.mainFactor}` : ""}</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">{pct(p.failureProbability30d)} <span className="text-muted-foreground font-normal">30d</span></p>
              <p className="text-muted-foreground">{pct(p.failureProbability90d)} 90d</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TwinExecutive({ d }: { d: TwinData }) {
  const s = d.twinSummary;
  return (
    <>
      <div className="border border-primary/30 bg-primary/5 p-4">
        <p className="text-[10px] text-primary tracking-widest uppercase mb-2">Executive Summary</p>
        <p className="text-sm text-muted-foreground">
          Your Digital Twin monitors <span className="text-foreground font-bold">{s.assets} assets</span>, of which{" "}
          <span className="text-foreground font-bold">{s.criticalToLifeAssets}</span> are life-critical.{" "}
          There are <span className="text-yellow-400 font-bold">{s.openAlerts} open alerts</span>,{" "}
          <span className="text-red-400 font-bold">{s.openAlertsOnCriticalToLife}</span> of them on life-critical devices.
        </p>
      </div>
      <Kpis d={d} />
      <div className="grid md:grid-cols-2 gap-4">
        <Exposure d={d} />
        <Threats d={d} />
      </div>
      <Failures d={d} />
    </>
  );
}

export function TwinCISO({ d }: { d: TwinData }) {
  return (
    <>
      <Kpis d={d} />
      <div className="grid md:grid-cols-2 gap-4">
        <Threats d={d} />
        <Exposure d={d} />
      </div>
      <Controls d={d} />
    </>
  );
}

export function TwinAnalyst({ d }: { d: TwinData }) {
  return (
    <>
      <Kpis d={d} />
      <div className="grid md:grid-cols-2 gap-4">
        <Failures d={d} />
        <Threats d={d} />
      </div>
    </>
  );
}
