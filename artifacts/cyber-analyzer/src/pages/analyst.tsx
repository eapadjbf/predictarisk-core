import { useTwinAnalysis, TwinShell, TwinLoading, TwinAnalyst } from "@/components/TwinInsights";
import { useAuth } from "@/lib/auth";
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Search } from "lucide-react";

export default function AnalystDashboard() {
  const { profile, signOut } = useAuth();
  const twin = useTwinAnalysis();
  if (twin.loading) return <TwinLoading />;
  if (twin.data) return <TwinShell label="ANALYST VIEW" twinUrl={twin.data.twinUrl}><TwinAnalyst d={twin.data} /></TwinShell>;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <span className="text-primary font-bold tracking-widest">PREDICTARISK</span>
            <span className="text-muted-foreground text-xs ml-2">// ANALYST VIEW</span>
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Open Alerts", value: "12", icon: AlertTriangle, color: "text-red-400" },
            { label: "In Analysis", value: "5", icon: Clock, color: "text-yellow-400" },
            { label: "Resolved Today", value: "8", icon: CheckCircle, color: "text-emerald-400" },
            { label: "Assigned to Me", value: "4", icon: Search, color: "text-primary" },
          ].map((stat) => (
            <div key={stat.label} className="border border-border bg-card p-4 space-y-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Alert Queue */}
        <div className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[10px] text-primary tracking-widest uppercase">Alert Queue</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { id: "EVT-001", severity: "CRITICAL", type: "Ransomware", status: "Open", time: "2m ago" },
              { id: "EVT-002", severity: "HIGH", type: "Phishing", status: "In Analysis", time: "15m ago" },
              { id: "EVT-003", severity: "MEDIUM", type: "Brute Force", status: "Open", time: "1h ago" },
              { id: "EVT-004", severity: "LOW", type: "Port Scan", status: "Open", time: "2h ago" },
            ].map((alert) => (
              <div key={alert.id} className="px-4 py-3 flex items-center justify-between hover:bg-secondary/30 cursor-pointer">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{alert.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    alert.severity === "CRITICAL" ? "bg-red-500/20 text-red-400" :
                    alert.severity === "HIGH" ? "bg-orange-500/20 text-orange-400" :
                    alert.severity === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>{alert.severity}</span>
                  <span className="text-sm">{alert.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{alert.status}</span>
                  <span className="text-xs text-muted-foreground">{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
