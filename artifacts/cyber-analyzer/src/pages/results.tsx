import { useApp } from "@/lib/context";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  ShieldAlert, Activity, TrendingUp, AlertTriangle, DollarSign,
  ShieldCheck, RotateCcw, ChevronRight, Calendar, Filter, X,
  List, ChevronDown, CalendarDays, TrendingDown, Minus,
  ArrowUp, ArrowRight, ArrowDown,
} from "lucide-react";
import type { RawEvent } from "@workspace/api-zod/src/generated/types";
import VoiceAssistant from "@/components/VoiceAssistant";

type SeverityKey = "Low" | "Medium" | "High" | "Critical";
const SEV_COLOR: Record<SeverityKey, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#f97316",
  Critical: "#cc0000",
};
const SEV_BG: Record<SeverityKey, string> = {
  Low: "rgba(34,197,94,0.12)",
  Medium: "rgba(245,158,11,0.12)",
  High: "rgba(249,115,22,0.12)",
  Critical: "rgba(204,0,0,0.12)",
};

const NAV_ITEMS = [
  { id: "overview", label: "Ops Overview", icon: Activity },
  { id: "recurring", label: "Top 10 Recurring", icon: TrendingUp },
  { id: "critical", label: "Top 10 Critical", icon: AlertTriangle },
  { id: "cost", label: "Top 10 Cost", icon: DollarSign },
  { id: "controls", label: "Controls", icon: ShieldCheck },
  { id: "forecast", label: "Forecast 15-30d", icon: CalendarDays },
  { id: "events", label: "Event Log", icon: List },
];

const TREND_META = {
  rising: { label: "Rising", color: "#cc0000", Icon: ArrowUp },
  stable: { label: "Stable", color: "#f59e0b", Icon: ArrowRight },
  falling: { label: "Falling", color: "#22c55e", Icon: ArrowDown },
};

const CONF_COLOR: Record<string, string> = {
  High: "#22c55e",
  Medium: "#f59e0b",
  Low: "#f97316",
};

const QUICK_PERIODS = [
  { label: "All", days: null },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
  { label: "1 Year", days: 365 },
  { label: "Custom", days: -1 },
];

const PAGE_SIZE = 50;

function SeverityBadge({ level }: { level: string }) {
  const color = SEV_COLOR[level as SeverityKey] ?? "#666";
  const bg = SEV_BG[level as SeverityKey] ?? "rgba(102,102,102,0.12)";
  return (
    <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
      style={{ color, backgroundColor: bg, border: `1px solid ${color}30` }}>
      {level}
    </span>
  );
}

function StatCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: string; sub?: string; accent?: string; icon: React.ElementType;
}) {
  return (
    <div className="border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4" style={{ color: accent ?? "hsl(var(--muted-foreground))" }} />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono" style={{ color: accent ?? "hsl(var(--foreground))" }}>
          {value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1 tracking-wide">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-2 mb-4">
      <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">{children}</h2>
    </div>
  );
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function Results() {
  const { analysisResult, reset } = useApp();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  // Filter state
  const [quickPeriod, setQuickPeriod] = useState<number | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set());
  const [eventPage, setEventPage] = useState(0);

  if (!analysisResult) {
    setLocation("/");
    return null;
  }

  const {
    orgType, totalEvents, analyzedAt, riskScore, riskLevel,
    executiveSummary, topEvents, exploitProbabilities, controls,
    lossPotentials, rawEvents = [], eventTrends = [],
  } = analysisResult;

  // Detect year-mode: all dates look like "YYYY-01-01"
  const isYearMode = useMemo(() => {
    const dates = (rawEvents ?? []).map((e) => e.date).filter(Boolean) as string[];
    if (dates.length === 0) return false;
    return dates.every((d) => /^\d{4}-01-01$/.test(d));
  }, [rawEvents]);

  // All unique years from the data — always computed, not just in year-mode
  const availableYears = useMemo(() => {
    const years = new Set(
      (rawEvents ?? []).map((e) => e.date?.slice(0, 4)).filter((y) => y && /^\d{4}$/.test(y)) as string[]
    );
    return Array.from(years).sort();
  }, [rawEvents]);

  // Active date range (only used when no years are selected and not year-mode)
  const activeDateRange = useMemo(() => {
    if (selectedYears.size > 0) return { from: null, to: null };
    if (isYearMode) return { from: null, to: null };
    if (quickPeriod === null) return { from: null, to: null };
    if (quickPeriod === -1) return { from: customFrom || null, to: customTo || null };
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - quickPeriod);
    return { from: toISODate(from), to: toISODate(to) };
  }, [selectedYears, isYearMode, quickPeriod, customFrom, customTo]);

  const hasDateFilter =
    selectedYears.size > 0 || activeDateRange.from !== null || activeDateRange.to !== null;
  const hasTypeFilter = selectedTypes.size > 0;
  const isFiltered = hasDateFilter || hasTypeFilter;

  const allEventTypes = useMemo(() => {
    const types = new Set(rawEvents.map((e) => e.eventType).filter(Boolean));
    return Array.from(types).sort();
  }, [rawEvents]);

  const filteredRawEvents = useMemo(() => {
    return rawEvents.filter((e) => {
      // Year filter takes priority over date range
      if (selectedYears.size > 0) {
        if (!e.date) return false;
        if (!selectedYears.has(e.date.slice(0, 4))) return false;
      } else if (activeDateRange.from || activeDateRange.to) {
        if (!e.date) return false;
        if (activeDateRange.from && e.date < activeDateRange.from) return false;
        if (activeDateRange.to && e.date > activeDateRange.to) return false;
      }
      if (hasTypeFilter && !selectedTypes.has(e.eventType)) return false;
      return true;
    });
  }, [rawEvents, selectedYears, hasTypeFilter, activeDateRange, selectedTypes]);

  const computedTopEvents = useMemo(() => {
    if (!isFiltered || filteredRawEvents.length === 0) return topEvents;
    const counts: Record<string, number> = {};
    for (const e of filteredRawEvents) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }
    const total = filteredRawEvents.length;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([eventType, count]) => ({
        eventType,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));
  }, [isFiltered, filteredRawEvents, topEvents]);

  // Auto-group timeline: day → month → year depending on data density
  const { timelineData, timelineGroupBy } = useMemo(() => {
    if (rawEvents.length === 0) return { timelineData: [], timelineGroupBy: "day" as const };
    const eventsWithDates = filteredRawEvents.filter((e) => e.date);
    if (eventsWithDates.length === 0) return { timelineData: [], timelineGroupBy: "day" as const };

    // Count by raw date first
    const countByDate: Record<string, number> = {};
    for (const e of eventsWithDates) {
      const d = isYearMode ? e.date!.slice(0, 4) : e.date!;
      countByDate[d] = (countByDate[d] ?? 0) + 1;
    }

    const uniqueCount = Object.keys(countByDate).length;
    // Choose grouping based on density
    const groupBy: "day" | "month" | "year" =
      isYearMode ? "year" : uniqueCount > 200 ? "year" : uniqueCount > 31 ? "month" : "day";

    if (groupBy === "day" || isYearMode) {
      return {
        timelineData: Object.entries(countByDate)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({ date, count })),
        timelineGroupBy: groupBy,
      };
    }

    // Re-group by month or year
    const grouped: Record<string, number> = {};
    for (const [date, count] of Object.entries(countByDate)) {
      const key = groupBy === "year" ? date.slice(0, 4) : date.slice(0, 7);
      grouped[key] = (grouped[key] ?? 0) + count;
    }
    return {
      timelineData: Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count })),
      timelineGroupBy: groupBy,
    };
  }, [filteredRawEvents, rawEvents.length, isYearMode]);

  // Normalize an event-type string for case/whitespace-insensitive matching
  // between AI-generated arrays and the raw Excel data
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

  // Set of event types actually present in the currently-filtered raw events.
  // null = no filter, use AI arrays as-is.
  const activeTypeSet = useMemo(() => {
    if (!isFiltered) return null;
    const s = new Set<string>();
    for (const e of filteredRawEvents) {
      if (e.eventType) s.add(norm(e.eventType));
    }
    return s;
  }, [isFiltered, filteredRawEvents]);

  // Bidirectional fuzzy match: handles AI naming like "Zero-Day Exploit"
  // vs raw Excel "Zero-day", "Phishing Attack" vs "Phishing", etc.
  const matchesAnyRawType = (aiType: string, rawTypes: Set<string>): boolean => {
    const a = norm(aiType);
    if (rawTypes.has(a)) return true;
    for (const raw of rawTypes) {
      if (!raw) continue;
      if (a.includes(raw) || raw.includes(a)) return true;
    }
    return false;
  };

  // Narrow AI arrays by types present in the filtered raw events.
  // Falls back to the full AI dataset if no matches — so the user always sees
  // useful threat-landscape numbers (Max Impact / Top Threat) even when the
  // AI used different naming than the source Excel column.
  const filteredExploitProbabilities = useMemo(() => {
    if (!activeTypeSet || activeTypeSet.size === 0) return exploitProbabilities;
    const filtered = exploitProbabilities.filter((p) => matchesAnyRawType(p.eventType, activeTypeSet));
    return filtered.length > 0 ? filtered : exploitProbabilities;
  }, [exploitProbabilities, activeTypeSet]);

  const filteredLossPotentials = useMemo(() => {
    if (!activeTypeSet || activeTypeSet.size === 0) return lossPotentials;
    const filtered = lossPotentials.filter((l) => matchesAnyRawType(l.eventType, activeTypeSet));
    return filtered.length > 0 ? filtered : lossPotentials;
  }, [lossPotentials, activeTypeSet]);

  const top10Recurring = computedTopEvents.slice(0, 10);
  const top10Critical = [...filteredExploitProbabilities].sort((a, b) => b.probability - a.probability).slice(0, 10);
  const top10Cost = [...filteredLossPotentials].sort((a, b) => b.maxLossEur - a.maxLossEur).slice(0, 10);

  const topThreat = top10Critical[0]?.eventType ?? "N/A";
  const maxLoss = filteredLossPotentials.reduce((max, l) => Math.max(max, l.maxLossEur), 0);

  // Label shown on stat cards summarising the active type / year filter
  const typeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedYears.size > 0) {
      parts.push(
        selectedYears.size === 1
          ? Array.from(selectedYears)[0]
          : `${selectedYears.size} years`
      );
    }
    if (hasTypeFilter) {
      parts.push(
        selectedTypes.size === 1
          ? Array.from(selectedTypes)[0]
          : `${selectedTypes.size} types`
      );
    }
    return parts.length > 0 ? `[${parts.join(" · ")}]` : null;
  }, [selectedYears, hasTypeFilter, selectedTypes]);
  const riskAccent = SEV_COLOR[riskLevel as SeverityKey] ?? "#cc0000";
  const updatedAt = new Date(analyzedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const displayCount = isFiltered ? filteredRawEvents.length : totalEvents;
  const pagedEvents = filteredRawEvents.slice(eventPage * PAGE_SIZE, (eventPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredRawEvents.length / PAGE_SIZE);

  const clearFilters = () => {
    setQuickPeriod(null);
    setCustomFrom("");
    setCustomTo("");
    setSelectedTypes(new Set());
    setSelectedYears(new Set());
    setEventPage(0);
  };

  const toggleYear = (year: string) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
    setEventPage(0);
  };

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    setEventPage(0);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-mono">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-primary font-bold text-sm tracking-widest">CYBERGUARD.SYS</span>
          </div>
          <p className="text-[9px] text-muted-foreground tracking-widest uppercase pl-6">Analyzer v2.0</p>
        </div>
        <div className="p-3 border-b border-border">
          <p className="text-[9px] text-muted-foreground tracking-widest uppercase mb-1">Sector</p>
          <p className="text-xs font-bold text-primary tracking-wide uppercase">{orgType}</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="text-[9px] text-muted-foreground tracking-widest uppercase mb-2 px-2">Navigation</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} data-testid={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 text-xs transition-colors text-left ${
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border-l-2 border-transparent"
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="tracking-wide">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button data-testid="btn-nova-analise" onClick={() => { reset(); setLocation("/"); }}
            className="w-full flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground hover:text-primary transition-colors">
            <RotateCcw className="w-3 h-3" />
            <span className="tracking-wide">New Analysis</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold tracking-widest uppercase">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "Analysis"}
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wide">
              {orgType} — {isFiltered ? `${displayCount} of ${totalEvents}` : displayCount.toLocaleString("en-US")} events
              {isFiltered && <span className="text-primary ml-1">[filtered]</span>}
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
            <span>Last analysis: </span>
            <span className="text-foreground font-bold">{updatedAt} UTC</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="border-b border-border px-6 py-2 flex items-center gap-3 shrink-0 bg-card/40">
          <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />

          {availableYears.length > 1 ? (
            /* ── Year buttons — shown whenever data spans multiple years ── */
            <div className="flex items-center gap-1 flex-wrap">
              <button
                data-testid="period-All"
                onClick={() => { setSelectedYears(new Set()); setQuickPeriod(null); setEventPage(0); }}
                className={`px-2 py-1 text-[10px] tracking-widest uppercase transition-colors ${
                  selectedYears.size === 0
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground border border-border hover:border-primary/50"
                }`}
              >
                All
              </button>
              {availableYears.map((year) => (
                <button key={year}
                  data-testid={`period-${year}`}
                  onClick={() => toggleYear(year)}
                  className={`px-2 py-1 text-[10px] tracking-widest uppercase transition-colors ${
                    selectedYears.has(year)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground border border-border hover:border-primary/50"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : (
            /* ── Standard relative-period filter (no multi-year data) ── */
            <>
              <div className="flex items-center gap-1">
                {QUICK_PERIODS.map((p) => {
                  const isActive = quickPeriod === p.days;
                  return (
                    <button key={p.label}
                      data-testid={`period-${p.label}`}
                      onClick={() => { setQuickPeriod(p.days); setEventPage(0); }}
                      className={`px-2 py-1 text-[10px] tracking-widest uppercase transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground border border-border hover:border-primary/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              {quickPeriod === -1 && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setEventPage(0); }}
                    data-testid="input-date-from"
                    className="bg-secondary border border-border text-foreground text-[10px] px-2 py-1 outline-none focus:border-primary"
                  />
                  <span className="text-muted-foreground text-[10px]">—</span>
                  <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setEventPage(0); }}
                    data-testid="input-date-to"
                    className="bg-secondary border border-border text-foreground text-[10px] px-2 py-1 outline-none focus:border-primary"
                  />
                </div>
              )}
            </>
          )}

          {allEventTypes.length > 0 && (
            <div className="relative">
              <button data-testid="btn-type-filter"
                onClick={() => setTypeFilterOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-2 py-1 text-[10px] tracking-widest uppercase border transition-colors ${
                  hasTypeFilter
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <Filter className="w-3 h-3" />
                Type{hasTypeFilter ? ` (${selectedTypes.size})` : ""}
                <ChevronDown className="w-3 h-3" />
              </button>

              {typeFilterOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border min-w-[220px] max-h-64 overflow-y-auto shadow-lg">
                  <div className="p-2 border-b border-border flex items-center justify-between">
                    <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Filter by Type</span>
                    <button onClick={() => { setSelectedTypes(new Set()); setEventPage(0); }}
                      className="text-[10px] text-primary hover:underline">Clear</button>
                  </div>
                  {allEventTypes.map((t) => (
                    <label key={t} className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary cursor-pointer">
                      <input type="checkbox" checked={selectedTypes.has(t)} onChange={() => toggleType(t)}
                        className="accent-primary w-3 h-3" />
                      <span className="text-xs truncate">{t}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {isFiltered && (
            <button data-testid="btn-clear-filters" onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-primary border border-primary/40 hover:bg-primary/10 transition-colors uppercase tracking-widest ml-auto">
              <X className="w-3 h-3" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" onClick={() => typeFilterOpen && setTypeFilterOpen(false)}>

          {/* ─── OPS OVERVIEW ─── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Events" value={displayCount.toLocaleString("en-US")}
                  sub={isFiltered ? `of ${totalEvents.toLocaleString("en-US")} total` : "events processed"}
                  icon={Activity} accent="#3b82f6" />
                <StatCard label="Risk Score" value={`${riskScore}/100`}
                  sub={riskLevel} icon={ShieldAlert} accent={riskAccent} />
                <StatCard label="Top Threat"
                  value={topThreat.length > 16 ? topThreat.slice(0, 16) + "…" : topThreat}
                  sub={typeFilterLabel ? typeFilterLabel : "highest probability"}
                  icon={AlertTriangle} accent={SEV_COLOR["Critical"]} />
                <StatCard label="Max Impact" value={`€${(maxLoss / 1000).toFixed(0)}k`}
                  sub={typeFilterLabel ? typeFilterLabel : "maximum potential loss"}
                  icon={DollarSign} accent={SEV_COLOR["High"]} />
              </div>

              {timelineData.length > 1 && (
                <div className="border border-border bg-card p-4">
                  <SectionHeader>
                    Event Timeline
                    {" — by "}
                    {timelineGroupBy === "year" ? "Year" : timelineGroupBy === "month" ? "Month" : "Day"}
                    {isFiltered ? " (filtered)" : ""}
                  </SectionHeader>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }}
                          tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval="preserveStartEnd" />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }}
                          tickLine={false} axisLine={false} width={30} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 11, fontFamily: "monospace" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(v: number) => [`${v} events`, "Occurrences"]}
                        />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-border bg-card p-4">
                  <SectionHeader>Top Recurring Events{isFiltered ? " (filtered)" : ""}</SectionHeader>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10Recurring.slice(0, 7)} layout="vertical"
                        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="eventType" type="category" width={130}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                          tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 11, fontFamily: "monospace" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(v: number) => [`${v} events`, "Occurrences"]} />
                        <Bar dataKey="count" maxBarSize={16} radius={0}>
                          {top10Recurring.slice(0, 7).map((_, i) => (
                            <Cell key={i} fill="hsl(var(--primary))" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border border-border bg-card p-4">
                  <SectionHeader>Exploit Probability</SectionHeader>
                  <div className="space-y-3">
                    {top10Critical.slice(0, 7).map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs truncate max-w-[180px]">{p.eventType}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <SeverityBadge level={p.severity} />
                            <span className="text-xs font-bold font-mono" style={{ color: SEV_COLOR[p.severity as SeverityKey] }}>
                              {(p.probability * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1 w-full bg-secondary">
                          <div className="h-full transition-all"
                            style={{ width: `${p.probability * 100}%`, backgroundColor: SEV_COLOR[p.severity as SeverityKey] ?? "#cc0000" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-border bg-card p-4">
                <SectionHeader>Executive Summary</SectionHeader>
                <p className="text-sm leading-relaxed text-muted-foreground">{executiveSummary}</p>
              </div>
            </div>
          )}

          {/* ─── TOP 10 RECURRING ─── */}
          {activeTab === "recurring" && (
            <div className="space-y-4">
              {isFiltered && (
                <div className="border border-primary/30 bg-primary/5 px-4 py-2 text-[10px] tracking-wide text-primary uppercase">
                  Filter active — showing recurrence from {filteredRawEvents.length} filtered events
                </div>
              )}
              <div className="border border-border bg-card p-4">
                <SectionHeader>Top 10 Most Recurring{isFiltered ? " (filtered)" : ""}</SectionHeader>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top10Recurring} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <XAxis type="number"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                        tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                      <YAxis dataKey="eventType" type="category" width={160}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                        tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 11, fontFamily: "monospace" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(v: number, _n, { payload }) => [`${v} events (${payload.percentage?.toFixed(1)}%)`, "Occurrences"]} />
                      <Bar dataKey="count" maxBarSize={20} radius={0}>
                        {top10Recurring.map((_, i) => (
                          <Cell key={i} fill="hsl(var(--primary))" opacity={1 - i * 0.06} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-border bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground w-8">#</th>
                      <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Event Type</th>
                      <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Occurrences</th>
                      <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">% Total</th>
                      <th className="p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Recurring.map((e, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                        data-testid={`row-recurring-${i}`}>
                        <td className="p-3 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-bold">{e.eventType}</td>
                        <td className="p-3 text-right font-mono text-primary">{e.count.toLocaleString("en-US")}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{e.percentage.toFixed(1)}%</td>
                        <td className="p-3 w-40">
                          <div className="h-1 w-full bg-secondary">
                            <div className="h-full bg-primary" style={{ width: `${Math.min(e.percentage * 2, 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TOP 10 CRITICAL ─── */}
          {activeTab === "critical" && (
            <div className="border border-border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground w-8">#</th>
                    <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Event Type</th>
                    <th className="text-center p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Severity</th>
                    <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Prob.</th>
                    <th className="p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {top10Critical.map((p, i) => {
                    const color = SEV_COLOR[p.severity as SeverityKey] ?? "#cc0000";
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                        data-testid={`row-critical-${i}`}>
                        <td className="p-3 font-bold" style={{ color }}>{i + 1}</td>
                        <td className="p-3">
                          <p className="font-bold">{p.eventType}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed max-w-sm">{p.rationale}</p>
                        </td>
                        <td className="p-3 text-center"><SeverityBadge level={p.severity} /></td>
                        <td className="p-3 text-right font-mono font-bold" style={{ color }}>
                          {(p.probability * 100).toFixed(0)}%
                        </td>
                        <td className="p-3 w-36">
                          <div className="h-1 w-full bg-secondary">
                            <div className="h-full" style={{ width: `${p.probability * 100}%`, backgroundColor: color }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── TOP 10 COST ─── */}
          {activeTab === "cost" && (
            <div className="space-y-4">
              <div className="border border-border bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground w-8">#</th>
                      <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Event Type</th>
                      <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Min (€)</th>
                      <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Avg (€)</th>
                      <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Max (€)</th>
                      <th className="p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Impact Areas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Cost.map((l, i) => {
                      const maxVal = top10Cost[0]?.maxLossEur ?? 1;
                      const pct = (l.maxLossEur / maxVal) * 100;
                      const color = pct > 75 ? SEV_COLOR["Critical"] : pct > 50 ? SEV_COLOR["High"] : pct > 25 ? SEV_COLOR["Medium"] : SEV_COLOR["Low"];
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                          data-testid={`row-cost-${i}`}>
                          <td className="p-3 font-bold" style={{ color }}>{i + 1}</td>
                          <td className="p-3">
                            <p className="font-bold">{l.eventType}</p>
                            <div className="mt-1 h-0.5 w-full bg-secondary">
                              <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-muted-foreground">{l.minLossEur.toLocaleString("en-US")}</td>
                          <td className="p-3 text-right font-mono">{l.avgLossEur.toLocaleString("en-US")}</td>
                          <td className="p-3 text-right font-mono font-bold" style={{ color }}>{l.maxLossEur.toLocaleString("en-US")}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {l.impactAreas.map((area, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 text-[9px] tracking-wider uppercase bg-secondary text-muted-foreground">{area}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["Critical", "High", "Medium"] as SeverityKey[]).map((sev) => {
                  const relevant = top10Cost.filter((_, i) => {
                    const maxVal = top10Cost[0]?.maxLossEur ?? 1;
                    const pct = (top10Cost[i].maxLossEur / maxVal) * 100;
                    if (sev === "Critical") return pct > 75;
                    if (sev === "High") return pct > 50 && pct <= 75;
                    return pct > 25 && pct <= 50;
                  });
                  const total = relevant.reduce((s, l) => s + l.avgLossEur, 0);
                  if (total === 0) return null;
                  return (
                    <div key={sev} className="border border-border bg-card p-4">
                      <SeverityBadge level={sev} />
                      <p className="text-lg font-bold font-mono mt-2" style={{ color: SEV_COLOR[sev] }}>
                        €{total.toLocaleString("en-US")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 tracking-wide uppercase">
                        Avg exposure — {relevant.length} event(s)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── CONTROLS ─── */}
          {activeTab === "controls" && (
            <div className="space-y-3">
              {controls.map((ctrl, i) => {
                const prob = exploitProbabilities.find((p) => p.eventType === ctrl.eventType);
                return (
                  <div key={i} className="border border-border bg-card p-4" data-testid={`row-control-${i}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">{String(i + 1).padStart(2, "0")}</span>
                        <h3 className="text-sm font-bold tracking-wide">{ctrl.eventType}</h3>
                      </div>
                      {prob && (
                        <div className="flex items-center gap-2 shrink-0">
                          <SeverityBadge level={prob.severity} />
                          <span className="text-xs font-mono" style={{ color: SEV_COLOR[prob.severity as SeverityKey] }}>
                            {(prob.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">Recommended Measures</p>
                        <ul className="space-y-1">
                          {ctrl.measures.map((m, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="text-primary mt-0.5 shrink-0">›</span>{m}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">Frameworks</p>
                        <div className="flex flex-wrap gap-1">
                          {ctrl.frameworks.map((fw, idx) => (
                            <span key={idx} className="px-2 py-1 text-[10px] tracking-widest uppercase border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">{fw}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── FORECAST ─── */}
          {activeTab === "forecast" && (
            <div className="space-y-5">
              {eventTrends.length === 0 ? (
                <div className="border border-border bg-card p-12 text-center">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Forecast data not available. Re-run the analysis to generate forecasts.</p>
                </div>
              ) : (
                <>
                  {/* ── Summary stats ── */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                      label="Events Forecast"
                      value={String(eventTrends.length)}
                      sub="event types analysed"
                      icon={CalendarDays}
                      accent="#3b82f6"
                    />
                    <StatCard
                      label="Max 15-Day Prob."
                      value={`${(Math.max(...eventTrends.map((t) => t.probability15d)) * 100).toFixed(0)}%`}
                      sub={eventTrends.find((t) => t.probability15d === Math.max(...eventTrends.map((x) => x.probability15d)))?.eventType?.slice(0, 20) ?? ""}
                      icon={AlertTriangle}
                      accent="#cc0000"
                    />
                    <StatCard
                      label="Max 30-Day Prob."
                      value={`${(Math.max(...eventTrends.map((t) => t.probability30d)) * 100).toFixed(0)}%`}
                      sub={eventTrends.find((t) => t.probability30d === Math.max(...eventTrends.map((x) => x.probability30d)))?.eventType?.slice(0, 20) ?? ""}
                      icon={TrendingUp}
                      accent="#f97316"
                    />
                    <StatCard
                      label="Rising Threats"
                      value={String(eventTrends.filter((t) => t.trend === "rising").length)}
                      sub={`of ${eventTrends.length} tracked event types`}
                      icon={ArrowUp}
                      accent="#cc0000"
                    />
                  </div>

                  {/* ── Probability chart ── */}
                  <div className="border border-border bg-card p-4">
                    <SectionHeader>Recurrence Probability — Next 15 vs 30 Days</SectionHeader>
                    <div style={{ height: `${Math.max(200, eventTrends.length * 44)}px` }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[...eventTrends]
                            .sort((a, b) => b.probability30d - a.probability30d)
                            .map((t) => ({
                              name: t.eventType.length > 28 ? t.eventType.slice(0, 28) + "…" : t.eventType,
                              "15 Days": parseFloat((t.probability15d * 100).toFixed(1)),
                              "30 Days": parseFloat((t.probability30d * 100).toFixed(1)),
                              trend: t.trend,
                            }))}
                          layout="vertical"
                          margin={{ top: 0, right: 50, left: 8, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis
                            type="number" domain={[0, 100]} unit="%"
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9, fontFamily: "monospace" }}
                            tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }}
                          />
                          <YAxis
                            dataKey="name" type="category" width={180}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "monospace" }}
                            tickLine={false} axisLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 0, fontSize: 11, fontFamily: "monospace" }}
                            formatter={(v: number, name: string) => [`${v}%`, name]}
                          />
                          <Bar dataKey="15 Days" fill="#3b82f6" maxBarSize={12} radius={0} />
                          <Bar dataKey="30 Days" fill="#cc0000" maxBarSize={12} radius={0} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-blue-500" />
                        <span className="text-[10px] tracking-widest uppercase text-muted-foreground">15-Day Probability</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-primary" />
                        <span className="text-[10px] tracking-widest uppercase text-muted-foreground">30-Day Probability</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Event cards grid ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {[...eventTrends]
                      .sort((a, b) => b.probability30d - a.probability30d)
                      .map((t, i) => {
                        const trendMeta = TREND_META[t.trend as keyof typeof TREND_META] ?? TREND_META.stable;
                        const TrendIcon = trendMeta.Icon;
                        const prob = exploitProbabilities.find((p) => p.eventType === t.eventType);
                        return (
                          <div key={i} className="border border-border bg-card p-4 space-y-3"
                            style={{ borderLeftColor: trendMeta.color, borderLeftWidth: 2 }}>
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{t.eventType}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold tracking-widest uppercase"
                                    style={{ color: trendMeta.color }}>
                                    <TrendIcon className="w-3 h-3" />
                                    {trendMeta.label}
                                  </span>
                                  <span className="text-muted-foreground/40 text-[10px]">•</span>
                                  <span className="text-[10px] tracking-widest uppercase font-bold"
                                    style={{ color: CONF_COLOR[t.confidenceLevel] ?? "#f59e0b" }}>
                                    {t.confidenceLevel} confidence
                                  </span>
                                  {prob && (
                                    <>
                                      <span className="text-muted-foreground/40 text-[10px]">•</span>
                                      <SeverityBadge level={prob.severity} />
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-lg font-bold font-mono" style={{ color: trendMeta.color }}>
                                  {(t.probability30d * 100).toFixed(0)}%
                                </p>
                                <p className="text-[9px] tracking-widest uppercase text-muted-foreground">30-day prob.</p>
                              </div>
                            </div>

                            {/* Probability bars */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] tracking-widest uppercase text-muted-foreground w-12 shrink-0">15 days</span>
                                <div className="flex-1 h-1.5 bg-secondary">
                                  <div className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${t.probability15d * 100}%` }} />
                                </div>
                                <span className="text-[10px] font-mono font-bold text-blue-400 w-10 text-right shrink-0">
                                  {(t.probability15d * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] tracking-widest uppercase text-muted-foreground w-12 shrink-0">30 days</span>
                                <div className="flex-1 h-1.5 bg-secondary">
                                  <div className="h-full transition-all"
                                    style={{ width: `${t.probability30d * 100}%`, backgroundColor: trendMeta.color }} />
                                </div>
                                <span className="text-[10px] font-mono font-bold w-10 text-right shrink-0"
                                  style={{ color: trendMeta.color }}>
                                  {(t.probability30d * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>

                            {/* Meta row */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                              <div>
                                <p className="text-[9px] tracking-widest uppercase text-muted-foreground">Avg Interval</p>
                                <p className="text-xs font-mono font-bold mt-0.5">
                                  {t.avgIntervalDays < 1
                                    ? `${(t.avgIntervalDays * 24).toFixed(0)}h`
                                    : `${t.avgIntervalDays.toFixed(1)}d`}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] tracking-widest uppercase text-muted-foreground">Last Seen</p>
                                <p className="text-xs font-mono mt-0.5">
                                  {t.lastOccurrence ?? <span className="text-muted-foreground/40">unknown</span>}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] tracking-widest uppercase text-muted-foreground">Est. Next</p>
                                <p className="text-xs font-mono mt-0.5" style={{ color: trendMeta.color }}>
                                  {t.forecastDate ?? <span className="text-muted-foreground/40">N/A</span>}
                                </p>
                              </div>
                            </div>

                            {/* Reasoning */}
                            <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                              {t.reasoning}
                            </p>
                          </div>
                        );
                      })}
                  </div>

                  {/* ── Full table ── */}
                  <div className="border border-border bg-card">
                    <div className="border-b border-border px-4 py-2 bg-secondary/30">
                      <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-bold">Forecast Summary Table</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40">
                          <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground">#</th>
                          <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Event Type</th>
                          <th className="text-center p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Trend</th>
                          <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">15-Day</th>
                          <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">30-Day</th>
                          <th className="text-right p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Avg Interval</th>
                          <th className="text-center p-3 text-[10px] tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Confidence</th>
                          <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground hidden xl:table-cell">Est. Next</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...eventTrends]
                          .sort((a, b) => b.probability30d - a.probability30d)
                          .map((t, i) => {
                            const trendMeta = TREND_META[t.trend as keyof typeof TREND_META] ?? TREND_META.stable;
                            const TrendIcon = trendMeta.Icon;
                            return (
                              <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                                <td className="p-3 font-bold text-muted-foreground">{i + 1}</td>
                                <td className="p-3 font-bold max-w-xs">
                                  <span className="truncate block">{t.eventType}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold tracking-widest uppercase"
                                    style={{ color: trendMeta.color }}>
                                    <TrendIcon className="w-3 h-3" />
                                    {trendMeta.label}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-blue-400">
                                  {(t.probability15d * 100).toFixed(0)}%
                                </td>
                                <td className="p-3 text-right font-mono font-bold" style={{ color: trendMeta.color }}>
                                  {(t.probability30d * 100).toFixed(0)}%
                                </td>
                                <td className="p-3 text-right font-mono text-muted-foreground">
                                  {t.avgIntervalDays < 1 ? `${(t.avgIntervalDays * 24).toFixed(0)}h` : `${t.avgIntervalDays.toFixed(1)}d`}
                                </td>
                                <td className="p-3 text-center hidden lg:table-cell">
                                  <span className="text-[10px] font-bold tracking-widest uppercase"
                                    style={{ color: CONF_COLOR[t.confidenceLevel] ?? "#f59e0b" }}>
                                    {t.confidenceLevel}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-muted-foreground hidden xl:table-cell">
                                  {t.forecastDate ?? "—"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── EVENT LOG ─── */}
          {activeTab === "events" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {filteredRawEvents.length.toLocaleString("en-US")} event(s)
                  {isFiltered && ` filtered from ${totalEvents.toLocaleString("en-US")}`}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => setEventPage((p) => Math.max(0, p - 1))} disabled={eventPage === 0}
                      className="px-2 py-1 border border-border disabled:opacity-30 hover:border-primary transition-colors">
                      ‹
                    </button>
                    <span className="text-muted-foreground">{eventPage + 1} / {totalPages}</span>
                    <button onClick={() => setEventPage((p) => Math.min(totalPages - 1, p + 1))} disabled={eventPage >= totalPages - 1}
                      className="px-2 py-1 border border-border disabled:opacity-30 hover:border-primary transition-colors">
                      ›
                    </button>
                  </div>
                )}
              </div>

              {filteredRawEvents.length === 0 ? (
                <div className="border border-border bg-card p-12 text-center">
                  <p className="text-muted-foreground text-sm">No events found with the selected filters.</p>
                  <button onClick={clearFilters} className="mt-3 text-xs text-primary hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="border border-border bg-card">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground w-28">Date</th>
                        <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground">Event Type</th>
                        <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground hidden md:table-cell">Category</th>
                        <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Severity</th>
                        <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground hidden lg:table-cell">Source</th>
                        <th className="text-left p-3 text-[10px] tracking-widest uppercase text-muted-foreground hidden xl:table-cell">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedEvents.map((e: RawEvent, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                          data-testid={`row-event-${i}`}>
                          <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                            {e.date
                              ? isYearMode ? e.date.slice(0, 4) : e.date
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="p-3 font-bold max-w-xs truncate">{e.eventType}</td>
                          <td className="p-3 text-muted-foreground hidden md:table-cell">{e.category ?? "—"}</td>
                          <td className="p-3 hidden lg:table-cell">
                            {e.severity ? (
                              <SeverityBadge level={e.severity} />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground hidden lg:table-cell">{e.source ?? "—"}</td>
                          <td className="p-3 text-muted-foreground hidden xl:table-cell max-w-xs truncate">
                            {e.description ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 text-xs">
                  <button onClick={() => setEventPage(0)} disabled={eventPage === 0}
                    className="px-2 py-1 border border-border disabled:opacity-30 hover:border-primary transition-colors">«</button>
                  <button onClick={() => setEventPage((p) => Math.max(0, p - 1))} disabled={eventPage === 0}
                    className="px-2 py-1 border border-border disabled:opacity-30 hover:border-primary transition-colors">‹</button>
                  <span className="text-muted-foreground px-3">Page {eventPage + 1} of {totalPages}</span>
                  <button onClick={() => setEventPage((p) => Math.min(totalPages - 1, p + 1))} disabled={eventPage >= totalPages - 1}
                    className="px-2 py-1 border border-border disabled:opacity-30 hover:border-primary transition-colors">›</button>
                  <button onClick={() => setEventPage(totalPages - 1)} disabled={eventPage >= totalPages - 1}
                    className="px-2 py-1 border border-border disabled:opacity-30 hover:border-primary transition-colors">»</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Voice Assistant — floating */}
      <VoiceAssistant analysis={analysisResult} />
    </div>
  );
}
