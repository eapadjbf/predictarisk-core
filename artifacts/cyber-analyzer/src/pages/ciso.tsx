import { useTwinAnalysis, TwinShell, TwinLoading, TwinCISO } from "@/components/TwinInsights";
import { useAuth } from "@/lib/auth";
import { ShieldAlert, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Users } from "lucide-react";

export default function CISODashboard() {
  const { profile, signOut } = useAuth();
  const twin = useTwinAnalysis();
  if (twin.loading) return <TwinLoading />;
  if (twin.data) return <TwinShell label="CISO VIEW"><TwinCISO d={twin.data} /></TwinShell>;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-primary font-bold tracking-widest">PREDICTARISK</span>
            <span className="text-muted-foreground text-xs ml-2">// CISO VIEW</span>
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

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Security Score", value: "74/100", trend: "up", color: "text-emerald-400" },
            { label: "Financial Impact", value: "€42,500", trend: "down", color: "text-red-400" },
            { label: "Active Incidents", value: "17", trend: "down", color: "text-yellow-400" },
            { label: "Team Utilization", value: "87%", trend: "up", color: "text-primary" },
          ].map((kpi) => (
            <div key={kpi.label} className="border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                {kpi.trend === "up" ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Compliance + Financial Impact */}
        <div className="grid grid-cols-2 gap-4">
          
          <div className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] text-primary tracking-widest uppercase">Compliance Status</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { framework: "ISO 27001", score: 82 },
                { framework: "NIS2", score: 67 },
                { framework: "GDPR", score: 91 },
                { framework: "DORA", score: 58 },
              ].map((f) => (
                <div key={f.framework} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{f.framework}</span>
                    <span className={f.score >= 80 ? "text-emerald-400" : f.score >= 60 ? "text-yellow-400" : "text-red-400"}>{f.score}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full">
                    <div className={`h-full rounded-full ${f.score >= 80 ? "bg-emerald-400" : f.score >= 60 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${f.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] text-primary tracking-widest uppercase">Financial Impact by Incident Type</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { type: "Ransomware", impact: "€18,200", incidents: 2 },
                { type: "Data Breach", impact: "€12,500", incidents: 1 },
                { type: "Phishing", impact: "€7,800", incidents: 5 },
                { type: "DDoS", impact: "€4,000", incidents: 3 },
              ].map((item) => (
                <div key={item.type} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{item.type}</p>
                    <p className="text-[10px] text-muted-foreground">{item.incidents} incidents</p>
                  </div>
                  <span className="text-red-400 font-bold text-sm">{item.impact}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
