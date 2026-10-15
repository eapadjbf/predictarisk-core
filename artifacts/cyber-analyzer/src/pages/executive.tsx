import { useTwinAnalysis, TwinShell, TwinLoading, TwinExecutive } from "@/components/TwinInsights";
import { useAuth } from "@/lib/auth";
import { ShieldAlert, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";

export default function ExecutiveDashboard() {
  const { profile, signOut } = useAuth();
  const twin = useTwinAnalysis();
  if (twin.loading) return <TwinLoading />;
  if (twin.data) return <TwinShell label="EXECUTIVE VIEW" twinUrl={twin.data.twinUrl}><TwinExecutive d={twin.data} /></TwinShell>;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-primary font-bold tracking-widest">PREDICTARISK</span>
            <span className="text-muted-foreground text-xs ml-2">// EXECUTIVE VIEW</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{profile?.first_name} {profile?.last_name}</span>
            <button onClick={signOut} className="text-xs text-primary hover:underline">Sign out</button>
          </div>
        </div>

        {/* Sample data notice */}
        <div data-testid="sample-data-banner" className="border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300">
          <span className="font-bold tracking-widest">SAMPLE DATA</span> — the figures on this screen are illustrative and are not calculated from your organisation's data.
        </div>

        {/* Executive Summary */}
        <div className="border border-primary/30 bg-primary/5 p-4">
          <p className="text-[10px] text-primary tracking-widest uppercase mb-2">Executive Summary</p>
          <p className="text-sm text-muted-foreground">This month your organisation detected <span className="text-foreground font-bold">17 security incidents</span>, with a total estimated financial impact of <span className="text-red-400 font-bold">€42,500</span>. Compliance posture improved by <span className="text-emerald-400 font-bold">+4%</span> vs last month.</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Financial Risk", value: "€42,500", sub: "This month", trend: "down" },
            { label: "Overall Security Score", value: "74 / 100", sub: "+4 vs last month", trend: "up" },
            { label: "Regulatory Compliance", value: "74.5%", sub: "Avg across frameworks", trend: "up" },
          ].map((kpi) => (
            <div key={kpi.label} className="border border-border bg-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground tracking-widest uppercase">{kpi.label}</p>
                {kpi.trend === "up" ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              </div>
              <p className="text-3xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Regulatory & Risk */}
        <div className="grid grid-cols-2 gap-4">

          <div className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] text-primary tracking-widest uppercase">Regulatory Status</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { name: "ISO 27001", status: "Compliant" },
                { name: "NIS2", status: "At Risk" },
                { name: "GDPR", status: "Compliant" },
                { name: "DORA", status: "Non-Compliant" },
              ].map((reg) => (
                <div key={reg.name} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm">{reg.name}</span>
                  <div className="flex items-center gap-2">
                    {reg.status === "Compliant" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : reg.status === "At Risk" ? <CheckCircle className="w-4 h-4 text-yellow-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className={`text-xs ${reg.status === "Compliant" ? "text-emerald-400" : reg.status === "At Risk" ? "text-yellow-400" : "text-red-400"}`}>{reg.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] text-primary tracking-widest uppercase">Top Business Risks</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { risk: "Ransomware Attack", impact: "€180,000", probability: "Medium" },
                { risk: "Data Breach", impact: "€95,000", probability: "Low" },
                { risk: "Supply Chain Attack", impact: "€220,000", probability: "Low" },
                { risk: "Insider Threat", impact: "€45,000", probability: "Medium" },
              ].map((item) => (
                <div key={item.risk} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{item.risk}</span>
                    <span className="text-red-400 font-bold text-xs">{item.impact}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Probability: {item.probability}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
