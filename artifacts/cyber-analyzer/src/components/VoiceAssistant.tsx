import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, MicOff, X, Send, Bot, Loader2,
  Volume2, VolumeX, MessageSquare, FileDown, Radio,
  ChevronRight, ShieldAlert, DollarSign, ShieldCheck,
  TrendingUp, CalendarDays, FileText,
} from "lucide-react";
import type { CyberAnalysis } from "@workspace/api-zod";
import { generatePDFReport, type ReportType } from "@/lib/generateReport";

// ─── Types ───────────────────────────────────────────────────────────────────
type VoiceState =
  | "idle" | "greeting" | "listening" | "processing"
  | "answering" | "followup" | "followup-listening" | "goodbye";

type TopicType = "critical" | "financial" | "controls" | "recurring" | "forecast" | "summary";

interface AnswerData {
  question: string;
  answer: string;
  topic: TopicType;
  timestamp: Date;
}

interface VoiceAssistantProps { analysis: CyberAnalysis; }

// ─── Browser SpeechRecognition types ─────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { readonly length: number; [i: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { readonly isFinal: boolean; [i: number]: { transcript: string }; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const CONTINUE_WORDS = ["yes", "continue", "another", "more", "sure", "ok", "yeah", "yep", "go ahead", "please", "absolutely", "of course"];
const STOP_WORDS = ["no", "that's all", "that is all", "done", "stop", "bye", "goodbye", "nothing", "enough", "close", "finished", "end", "exit", "quit"];
const REPORT_WORDS = ["report", "pdf", "generate", "download", "export", "file"];

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Click mic to start", greeting: "Preparing...", listening: "Listening...",
  processing: "Analyzing...", answering: "Speaking...", followup: "Asking follow-up...",
  "followup-listening": "Listening for response...", goodbye: "Closing...",
};

const SEV_COLOR: Record<string, string> = {
  Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#cc0000",
};

const REPORT_TYPES: { type: ReportType; label: string; description: string; icon: React.ElementType; color: string }[] = [
  { type: "critical", label: "Critical Events Report", description: "Critical & high severity events, financial impact, and mitigation controls", icon: ShieldAlert, color: "#cc0000" },
  { type: "financial", label: "Financial Impact Report", description: "Full financial exposure analysis with min/avg/max loss estimates", icon: DollarSign, color: "#f97316" },
  { type: "recurring", label: "Recurring Events Report", description: "Top most frequent events with occurrence statistics", icon: TrendingUp, color: "#3b82f6" },
  { type: "full", label: "Full Report", description: "Complete analysis — all sections included", icon: FileText, color: "#8b5cf6" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildContext(a: CyberAnalysis) {
  return {
    orgType: a.orgType, totalEvents: a.totalEvents, riskScore: a.riskScore,
    riskLevel: a.riskLevel, executiveSummary: a.executiveSummary,
    topEvents: a.topEvents, exploitProbabilities: a.exploitProbabilities,
    lossPotentials: a.lossPotentials,
  };
}
function matchesKeywords(text: string, words: string[]): boolean {
  const t = text.toLowerCase(); return words.some((w) => t.includes(w));
}
function detectTopic(q: string): TopicType {
  const l = q.toLowerCase();
  if (/(critical|severe|high risk|exploit|most dangerous|risky|threat|attack)/.test(l)) return "critical";
  if (/(cost|financ|loss|impact|euro|money|damage|expensive|budget)/.test(l)) return "financial";
  if (/(control|mitigat|measure|recommend|fix|protect|defend|prevent|implement|action)/.test(l)) return "controls";
  if (/(recurring|frequent|most common|top event|most occur|often|repeat)/.test(l)) return "recurring";
  if (/(forecast|trend|future|next|predict|15 day|30 day|coming)/.test(l)) return "forecast";
  return "summary";
}

// ─── Severity badge ───────────────────────────────────────────────────────────
function SevBadge({ level }: { level: string }) {
  const c = SEV_COLOR[level] ?? "#666";
  return (
    <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase"
      style={{ color: c, backgroundColor: c + "20", border: `1px solid ${c}40` }}>
      {level}
    </span>
  );
}

// ─── Answer Panel (right-side drawer) ────────────────────────────────────────
function AnswerPanel({
  data, analysis, onClose, onReport,
}: {
  data: AnswerData;
  analysis: CyberAnalysis;
  onClose: () => void;
  onReport: (type: ReportType) => void;
}) {
  const [tab, setTab] = useState<"results" | "reports">("results");

  const criticalEvents = analysis.exploitProbabilities
    .filter((e) => e.severity === "Critical" || e.severity === "High")
    .sort((a, b) => b.probability - a.probability);

  const topRecurring = [...analysis.topEvents].sort((a, b) => b.count - a.count).slice(0, 10);
  const topCosts = [...analysis.lossPotentials].sort((a, b) => b.maxLossEur - a.maxLossEur).slice(0, 10);
  const topTrends = [...(analysis.eventTrends ?? [])].sort((a, b) => b.probability30d - a.probability30d);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-[560px] z-50 flex flex-col bg-background border-l border-border shadow-2xl font-mono"
        style={{ boxShadow: "-4px 0 40px rgba(204,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="border-b border-border px-4 py-3 bg-card shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] tracking-widest uppercase text-primary mb-1">Query Result</p>
              <p className="text-xs font-bold text-foreground leading-relaxed line-clamp-2">
                "{data.question}"
              </p>
            </div>
            <button onClick={onClose}
              className="shrink-0 w-7 h-7 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3">
            {(["results", "reports"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-[10px] tracking-widest uppercase transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}>
                {t === "results" ? "Results" : "Generate Report"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Results tab ── */}
          {tab === "results" && (
            <div className="p-4 space-y-4">

              {/* AI answer text */}
              <div className="border border-border bg-card/60 p-3">
                <p className="text-[9px] tracking-widest uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Bot className="w-3 h-3 text-primary" />AI Summary
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{data.answer}</p>
              </div>

              {/* ── CRITICAL topic ── */}
              {(data.topic === "critical" || data.topic === "summary") && criticalEvents.length > 0 && (
                <div className="border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 flex items-center gap-2 bg-secondary/30">
                    <ShieldAlert className="w-3 h-3 text-primary" />
                    <p className="text-[10px] tracking-widest uppercase font-bold">Critical & High Events</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Event</th>
                        <th className="text-center px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Severity</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Prob.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criticalEvents.map((e, i) => {
                        const cost = analysis.lossPotentials.find((l) => l.eventType === e.eventType);
                        return (
                          <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                            <td className="px-3 py-2">
                              <p className="font-bold truncate max-w-[200px]">{e.eventType}</p>
                              {cost && (
                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                  Max: €{cost.maxLossEur.toLocaleString("en-US")}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center"><SevBadge level={e.severity} /></td>
                            <td className="px-3 py-2 text-right font-bold font-mono"
                              style={{ color: SEV_COLOR[e.severity] ?? "#cc0000" }}>
                              {(e.probability * 100).toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── FINANCIAL topic ── */}
              {(data.topic === "financial") && (
                <div className="border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 flex items-center gap-2 bg-secondary/30">
                    <DollarSign className="w-3 h-3 text-primary" />
                    <p className="text-[10px] tracking-widest uppercase font-bold">Financial Impact</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Event</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Avg (€)</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Max (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCosts.map((l, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-bold truncate max-w-[200px]">{l.eventType}</td>
                          <td className="px-3 py-2 text-right font-mono">{l.avgLossEur.toLocaleString("en-US")}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-primary">{l.maxLossEur.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── CONTROLS topic ── */}
              {(data.topic === "controls") && (
                <div className="space-y-3">
                  {analysis.controls.map((ctrl, i) => {
                    const prob = analysis.exploitProbabilities.find((p) => p.eventType === ctrl.eventType);
                    return (
                      <div key={i} className="border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-bold">{ctrl.eventType}</p>
                          {prob && <SevBadge level={prob.severity} />}
                        </div>
                        <ul className="space-y-1 mb-2">
                          {ctrl.measures.map((m, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                              <span className="text-primary mt-0.5 shrink-0">›</span>{m}
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-border/50">
                          {ctrl.frameworks.map((fw, j) => (
                            <span key={j} className="px-1.5 py-0.5 text-[9px] tracking-widest uppercase border border-border text-muted-foreground">{fw}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── RECURRING topic ── */}
              {(data.topic === "recurring") && (
                <div className="border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 flex items-center gap-2 bg-secondary/30">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <p className="text-[10px] tracking-widest uppercase font-bold">Most Recurring Events</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">#</th>
                        <th className="text-left px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Event</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Count</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRecurring.map((e, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-bold text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-bold">{e.eventType}</td>
                          <td className="px-3 py-2 text-right font-mono text-primary">{e.count.toLocaleString("en-US")}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{e.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── FORECAST topic ── */}
              {(data.topic === "forecast") && topTrends.length > 0 && (
                <div className="border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 flex items-center gap-2 bg-secondary/30">
                    <CalendarDays className="w-3 h-3 text-primary" />
                    <p className="text-[10px] tracking-widest uppercase font-bold">15/30-Day Forecast</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Event</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">15d</th>
                        <th className="text-right px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">30d</th>
                        <th className="text-center px-3 py-2 text-[9px] tracking-widest uppercase text-muted-foreground">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTrends.map((t, i) => {
                        const c = t.trend === "rising" ? "#cc0000" : t.trend === "falling" ? "#22c55e" : "#f59e0b";
                        return (
                          <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                            <td className="px-3 py-2 font-bold truncate max-w-[180px]">{t.eventType}</td>
                            <td className="px-3 py-2 text-right font-mono text-blue-400">{(t.probability15d * 100).toFixed(0)}%</td>
                            <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: c }}>{(t.probability30d * 100).toFixed(0)}%</td>
                            <td className="px-3 py-2 text-center text-[9px] font-bold uppercase tracking-widest" style={{ color: c }}>{t.trend}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Quick report button */}
              <button onClick={() => setTab("reports")}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-border hover:border-primary text-xs text-muted-foreground hover:text-primary transition-colors">
                <span className="tracking-widest uppercase">Generate a PDF report on this topic</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── Reports tab ── */}
          {tab === "reports" && (
            <div className="p-4 space-y-3">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground">
                Choose which type of PDF report to generate and download
              </p>
              {REPORT_TYPES.map((rt) => {
                const Icon = rt.icon;
                return (
                  <button key={rt.type} onClick={() => { onReport(rt.type); onClose(); }}
                    className="w-full flex items-start gap-3 p-4 border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left group">
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center border mt-0.5 transition-colors"
                      style={{ borderColor: rt.color + "60", backgroundColor: rt.color + "15" }}>
                      <Icon className="w-4 h-4" style={{ color: rt.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold group-hover:text-primary transition-colors">{rt.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{rt.description}</p>
                    </div>
                    <FileDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VoiceAssistant({ analysis }: VoiceAssistantProps) {
  const [open, setOpen] = useState(false);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [answerPanel, setAnswerPanel] = useState<AnswerData | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ttsEnabledRef = useRef(ttsEnabled);
  const voiceStateRef = useRef(voiceState);

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionLog, interimTranscript]);

  const pushLog = useCallback((text: string) => {
    setSessionLog((prev) => [...prev, text]);
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    if (!ttsEnabledRef.current) { setTimeout(() => onDone?.(), 80); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US"; utter.rate = 1.05; utter.pitch = 1;
    let safeguard: ReturnType<typeof setTimeout>;
    utter.onstart = () => {
      safeguard = setTimeout(() => onDone?.(), Math.max((text.length / 15) * 1000, 1500) + 3000);
    };
    utter.onend = () => { clearTimeout(safeguard); onDone?.(); };
    utter.onerror = () => { clearTimeout(safeguard); onDone?.(); };
    window.speechSynthesis.speak(utter);
  }, []);

  const stopAll = useCallback(() => {
    recognitionRef.current?.abort(); recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setVoiceState("idle"); setInterimTranscript("");
  }, []);

  // ── Report generation ─────────────────────────────────────────────────────
  const handleGenerateReport = useCallback((type: ReportType = "full", fromVoice = false) => {
    pushLog(`› Generating ${type} PDF report…`);
    try {
      generatePDFReport(analysis, type);
      const label = REPORT_TYPES.find((r) => r.type === type)?.label ?? "Report";
      setReportSuccess(label);
      setTimeout(() => setReportSuccess(null), 4000);
      pushLog(`✓ ${label} saved to downloads.`);
      if (fromVoice) {
        speak("Report generated and saved. Would you like to ask another question, or is that all?",
          () => startFollowupListening());
      }
    } catch {
      pushLog("✗ Error generating PDF. Please try again.");
    }
  }, [analysis, speak]);

  // ── Follow-up listening ────────────────────────────────────────────────────
  const startFollowupListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceState("followup-listening"); setInterimTranscript("");
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 3;
    recognitionRef.current = rec;
    let handled = false;
    rec.onresult = (e) => { if (handled) return; handled = true; handleFollowupResponse(e.results[0]?.[0]?.transcript ?? ""); };
    rec.onerror = () => { if (!handled) { handled = true; handleFollowupResponse(""); } };
    rec.onend = () => { if (!handled) { handled = true; handleFollowupResponse(""); } };
    rec.start();
  }, []);

  const handleFollowupResponse = useCallback((transcript: string) => {
    const t = transcript.trim().toLowerCase();
    if (matchesKeywords(t, REPORT_WORDS)) { setVoiceState("processing"); handleGenerateReport("full", true); return; }
    if (!t || matchesKeywords(t, STOP_WORDS)) {
      setVoiceState("goodbye");
      pushLog("─ Session ended. Click the microphone to start again.");
      speak("Goodbye! Click the microphone whenever you need assistance.", () => { setVoiceState("idle"); setInterimTranscript(""); });
      return;
    }
    if (matchesKeywords(t, CONTINUE_WORDS)) {
      setVoiceState("greeting");
      speak("Sure! What would you like to know?", () => startMainListening());
      return;
    }
    processQuestion(transcript);
  }, [speak, handleGenerateReport, pushLog]);

  // ── Main listening ─────────────────────────────────────────────────────────
  const startMainListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceState("listening"); setInterimTranscript("");
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    let finalTranscript = ""; let handled = false;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
      }
      if (final) finalTranscript = final;
      setInterimTranscript(final || interim);
    };
    rec.onerror = (e) => {
      if (handled) return; handled = true; setInterimTranscript("");
      if (e.error === "no-speech") { setVoiceState("idle"); pushLog("No speech detected. Try again."); }
      else setVoiceState("idle");
    };
    rec.onend = () => {
      if (handled) return; handled = true; setInterimTranscript("");
      if (finalTranscript.trim()) processQuestion(finalTranscript.trim());
      else { setVoiceState("idle"); pushLog("No speech detected. Try again."); }
    };
    rec.start();
  }, []);

  // ── Process question ───────────────────────────────────────────────────────
  const processQuestion = useCallback(async (question: string) => {
    const q = question.trim(); if (!q) return;
    if (matchesKeywords(q, REPORT_WORDS)) {
      pushLog(`› You asked: ${q}`);
      setInputText(""); setInterimTranscript(""); setVoiceState("processing");
      handleGenerateReport("full", voiceStateRef.current !== "idle");
      return;
    }
    pushLog(`› You asked: ${q}`);
    setInputText(""); setInterimTranscript(""); setVoiceState("processing");
    try {
      const resp = await fetch("/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: buildContext(analysis) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Request failed");
      const answer: string = data.answer ?? "No answer received.";
      const topic = detectTopic(q);
      setAnswerPanel({ question: q, answer, topic, timestamp: new Date() });
      pushLog(`✓ Results panel opened.`);
      const wasVoice = voiceStateRef.current === "processing";
      if (wasVoice) {
        setVoiceState("answering");
        const echo = q.length > 60 ? q.slice(0, 57) + "…" : q;
        speak(`You asked: ${echo}. I've opened the results panel.`, () => {
          setVoiceState("followup");
          speak("Would you like to ask another question, or is that all?", () => startFollowupListening());
        });
      } else {
        setVoiceState("idle");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      pushLog(`✗ Error: ${msg}`);
      setVoiceState("idle");
    }
  }, [analysis, speak, handleGenerateReport, pushLog, startFollowupListening]);

  // ── Mic button ─────────────────────────────────────────────────────────────
  const handleMicClick = useCallback(() => {
    if (voiceState !== "idle") { stopAll(); return; }
    if (!open) setOpen(true);
    if (sessionLog.length === 0) pushLog(`CyberGuard AI — ${analysis.orgType} | Risk ${analysis.riskScore}/100 (${analysis.riskLevel})`);
    setVoiceState("greeting");
    speak("How can I help you?", () => startMainListening());
  }, [voiceState, open, sessionLog.length, analysis, speak, stopAll, pushLog, startMainListening]);

  const handleTextSubmit = useCallback(() => {
    const q = inputText.trim(); if (!q || voiceState === "processing") return;
    stopAll(); processQuestion(q);
  }, [inputText, voiceState, stopAll, processQuestion]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); }
  };

  // Init log on open
  useEffect(() => {
    if (open && sessionLog.length === 0)
      pushLog(`CyberGuard AI — ${analysis.orgType} | Risk ${analysis.riskScore}/100 (${analysis.riskLevel})\nClick the microphone or type a question.`);
  }, [open]);

  const isVoiceActive = voiceState !== "idle";
  const isListeningState = voiceState === "listening" || voiceState === "followup-listening";
  const isProcessing = voiceState === "processing";

  return (
    <>
      {/* ── Answer data panel ── */}
      {answerPanel && (
        <AnswerPanel
          data={answerPanel}
          analysis={analysis}
          onClose={() => setAnswerPanel(null)}
          onReport={(type) => handleGenerateReport(type, false)}
        />
      )}

      {/* ── Report success toast ── */}
      {reportSuccess && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-card border border-primary/60 text-xs font-mono shadow-lg">
          <FileDown className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground">{reportSuccess} saved to downloads</span>
        </div>
      )}

      {/* ── Floating trigger ── */}
      <button
        data-testid="btn-voice-assistant"
        onClick={() => { if (isVoiceActive) { stopAll(); return; } setOpen((o) => !o); }}
        title={isVoiceActive ? "Stop voice session" : "AI Voice Assistant"}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center shadow-lg transition-all ${
          isVoiceActive ? "bg-primary text-primary-foreground animate-pulse"
            : open ? "bg-primary text-primary-foreground"
            : "bg-card border border-border hover:border-primary text-muted-foreground hover:text-primary"
        }`}
      >
        {isListeningState ? <Radio className="w-5 h-5" />
          : isVoiceActive ? <Loader2 className="w-5 h-5 animate-spin" />
          : open ? <X className="w-5 h-5" />
          : <MessageSquare className="w-5 h-5" />}
        {!open && !isVoiceActive && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
          </span>
        )}
      </button>

      {/* ── Voice panel ── */}
      {open && (
        <div
          data-testid="voice-assistant-panel"
          className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[520px] flex flex-col border border-border bg-background shadow-2xl font-mono"
          style={{ boxShadow: "0 0 40px rgba(204,0,0,0.15)" }}
        >
          {/* Header */}
          <div className="border-b border-border px-4 py-2.5 flex items-center justify-between bg-card shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold tracking-widest uppercase text-primary">AI Analyst</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isVoiceActive ? "bg-primary animate-pulse" : "bg-emerald-500"}`} />
              {isVoiceActive && <span className="text-[10px] tracking-widest text-primary uppercase">{STATE_LABEL[voiceState]}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleGenerateReport("full", false)}
                data-testid="btn-generate-report"
                title="Generate Full PDF Report"
                className="text-muted-foreground hover:text-primary transition-colors">
                <FileDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setTtsEnabled((t) => !t); window.speechSynthesis?.cancel(); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={ttsEnabled ? "Disable voice output" : "Enable voice output"}>
                {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { stopAll(); setOpen(false); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Voice visualizer */}
          {isVoiceActive && (
            <div className="border-b border-border px-4 py-2 bg-primary/5 flex items-center gap-3 shrink-0">
              <div className={`flex items-end gap-0.5 h-5 ${isListeningState ? "" : "opacity-40"}`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`w-1 bg-primary transition-all ${isListeningState ? "animate-pulse" : ""}`}
                    style={{ height: isListeningState ? `${Math.random() * 14 + 4}px` : "4px", animationDelay: `${i * 80}ms`, animationDuration: `${400 + i * 60}ms` }} />
                ))}
              </div>
              <span className="text-[10px] tracking-widest uppercase text-primary">{STATE_LABEL[voiceState]}</span>
              <button onClick={stopAll} className="ml-auto text-[10px] text-muted-foreground hover:text-primary tracking-widest uppercase">Stop</button>
            </div>
          )}

          {/* Session log — terminal style */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-black/20">
            {sessionLog.map((line, i) => (
              <p key={i} className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap"
                style={{ color: line.startsWith("›") ? "#e5e7eb" : line.startsWith("✓") ? "#22c55e" : line.startsWith("✗") ? "#cc0000" : "hsl(var(--muted-foreground))" }}>
                {line}
              </p>
            ))}
            {isProcessing && (
              <p className="text-[10px] font-mono flex items-center gap-1.5 text-primary">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />Analyzing…
              </p>
            )}
            {interimTranscript && (
              <p className="text-[10px] font-mono italic text-primary/70">"{interimTranscript}"</p>
            )}
            {answerPanel && (
              <button onClick={() => setOpen(false)}
                className="mt-2 w-full flex items-center justify-between px-2 py-1.5 border border-primary/40 bg-primary/10 text-[10px] tracking-widest uppercase text-primary hover:bg-primary/20 transition-colors">
                <span>View results panel</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            <div ref={logEndRef} />
          </div>

          {/* Quick questions */}
          {sessionLog.length <= 1 && voiceState === "idle" && (
            <div className="px-3 pb-2 shrink-0 border-t border-border pt-2">
              <p className="text-[9px] tracking-widest uppercase text-muted-foreground mb-1.5">Quick questions</p>
              <div className="flex flex-wrap gap-1">
                {[
                  "What are the most critical events?",
                  "What is the financial impact?",
                  "Which controls should I prioritize?",
                  "Show event forecast",
                ].map((q, i) => (
                  <button key={i} onClick={() => processQuestion(q)}
                    className="px-2 py-1 text-[10px] border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="border-t border-border p-3 flex items-center gap-2 shrink-0 bg-card">
            {speechSupported && (
              <button data-testid="btn-mic" onClick={handleMicClick}
                title={isVoiceActive ? "Stop session" : "Start voice session"}
                className={`w-8 h-8 flex items-center justify-center shrink-0 border transition-all ${
                  isListeningState ? "border-primary bg-primary/20 text-primary animate-pulse"
                    : isVoiceActive ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}>
                {isVoiceActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <input ref={inputRef} data-testid="input-question" type="text"
              value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={isListeningState ? "Listening…" : isVoiceActive ? STATE_LABEL[voiceState] : "Type or speak a question…"}
              disabled={isProcessing}
              className="flex-1 bg-secondary border border-border text-foreground text-xs px-3 py-2 outline-none focus:border-primary disabled:opacity-50 placeholder:text-muted-foreground/50"
            />
            <button data-testid="btn-send" onClick={handleTextSubmit}
              disabled={!inputText.trim() || isProcessing}
              className="w-8 h-8 flex items-center justify-center shrink-0 bg-primary text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
