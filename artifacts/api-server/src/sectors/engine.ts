import type { Market, SectorProfile } from "./types";

export interface InputEvent {
  eventType: string;
  description?: string | null;
  /**
   * Ameaça já conhecida (ex.: fonte estruturada como o Digital Twin).
   * string = usar esta ameaça sem classificar por palavras-chave;
   * null = o evento não é uma ameaça (higiene operacional) e fica fora da análise.
   */
  threatId?: string | null;
}

export interface ThreatSummary {
  threatId: string;
  label: string;
  count: number;
  share: number; // 0..1 sobre eventos totais
}

export interface RankedControl {
  controlId: string;
  title: string;
  recommendation: string;
  /** "critical" = primeira linha contra ameaça de alta criticidade observada; fica sempre acima de "standard". */
  tier: "critical" | "standard";
  score: number; // dentro do nível, maior = mais urgente
  because: string[]; // ameaças que o justificam
  mappings: { framework: string; ref: string }[];
}

export interface FrameworkExposure {
  framework: string;
  name: string;
  market: Market;
  requirementsInLibrary: number;
  requirementsUnderPressure: number;
  /** Índice RELATIVO 0..1 (não é pontuação de conformidade): média da pressão normalizada por cláusula. */
  pressureIndex: number;
  /** Cláusulas por pressão decrescente (só as com pressão > 0). */
  refsByPressure: { ref: string; pressure: number }[];
}

export interface SectorAnalysis {
  sector: string;
  profileVersion: string;
  reviewStatus: string;
  totalEvents: number;
  /** Eventos excluídos por não serem ameaças (threatId === null). */
  nonThreatEvents: number;
  threats: ThreatSummary[];
  unclassified: { count: number; share: number; examples: string[] };
  rankedControls: RankedControl[];
  frameworkExposure: FrameworkExposure[];
  disclaimer: string;
}

const DISCLAIMER =
  "Exposição inferida a partir dos eventos fornecidos; não mede a conformidade efetivamente implementada. " +
  "Referências regulatórias em rascunho, sujeitas a validação jurídica.";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordHit(text: string, kw: string): boolean {
  // Palavras curtas exigem fronteira de palavra (evita "ehr" dentro de "there").
  if (kw.length <= 4) return new RegExp(`\\b${kw}\\b`).test(text);
  return text.includes(kw);
}

export function classifyEvent(profile: SectorProfile, ev: InputEvent): string | null {
  if (typeof ev.threatId === "string") {
    return profile.threats.some((t) => t.id === ev.threatId) ? ev.threatId : null;
  }
  const text = normalize(`${ev.eventType} ${ev.description ?? ""}`);
  let best: { id: string; hits: number; weight: number } | null = null;
  for (const t of profile.threats) {
    const hits = t.keywords.filter((k) => keywordHit(text, normalize(k))).length;
    if (hits === 0) continue;
    if (!best || hits > best.hits || (hits === best.hits && t.criticalityWeight > best.weight)) {
      best = { id: t.id, hits, weight: t.criticalityWeight };
    }
  }
  return best?.id ?? null;
}

export function analyzeForSector(
  profile: SectorProfile,
  events: InputEvent[],
  markets: Market[] = ["EU", "GLOBAL"],
): SectorAnalysis {
  const nonThreat = events.filter((e) => e.threatId === null).length;
  events = events.filter((e) => e.threatId !== null);
  const total = events.length;
  const counts = new Map<string, number>();
  const unclassifiedExamples: string[] = [];
  let unclassified = 0;

  for (const ev of events) {
    const id = classifyEvent(profile, ev);
    if (!id) {
      unclassified++;
      if (unclassifiedExamples.length < 5 && !unclassifiedExamples.includes(ev.eventType)) {
        unclassifiedExamples.push(ev.eventType);
      }
    } else counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const threats: ThreatSummary[] = profile.threats
    .filter((t) => counts.has(t.id))
    .map((t) => ({ threatId: t.id, label: t.label, count: counts.get(t.id)!, share: total ? counts.get(t.id)! / total : 0 }))
    .sort((a, b) => b.count - a.count);

  // Prioridade de controlos: partilha da ameaça × (1 + ênfase × criticidade) × posição na lista.
  const CRITICAL_WEIGHT = 0.8; // ameaça de alta criticidade
  const FIRST_LINE = 2; // nº de controlos de primeira linha
  const criticalControls = new Set<string>();
  const scores = new Map<string, { score: number; because: Set<string> }>();
  for (const th of threats) {
    const def = profile.threats.find((t) => t.id === th.threatId)!;
    const w = th.share * (1 + profile.criticalityEmphasis * def.criticalityWeight);
    def.controls.forEach((cid, idx) => {
      if (def.criticalityWeight >= CRITICAL_WEIGHT && idx < FIRST_LINE) criticalControls.add(cid);
      const s = scores.get(cid) ?? { score: 0, because: new Set<string>() };
      s.score += w / (1 + 0.2 * idx);
      s.because.add(def.label);
      scores.set(cid, s);
    });
  }

  const activeFrameworks = profile.frameworks.filter((f) => markets.includes(f.market));
  const activeIds = new Set(activeFrameworks.map((f) => f.id));

  const rankedControls: RankedControl[] = [...scores.entries()]
    .map(([cid, s]) => {
      const c = profile.controls.find((x) => x.id === cid)!;
      return {
        controlId: cid,
        title: c.title,
        recommendation: c.recommendation,
        tier: (criticalControls.has(cid) ? "critical" : "standard") as "critical" | "standard",
        score: Math.round(s.score * 1000) / 1000,
        because: [...s.because],
        mappings: c.mappings.filter((m) => activeIds.has(m.framework)),
      };
    })
    .sort((a, b) => (a.tier === b.tier ? b.score - a.score : a.tier === "critical" ? -1 : 1));

  // Pressão por cláusula = soma das pontuações dos controlos mapeados a essa cláusula.
  const refPressure = new Map<string, Map<string, number>>();
  for (const rc of rankedControls) {
    const seen = new Set<string>();
    for (const m of rc.mappings) {
      const key = `${m.framework}\u0000${m.ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!refPressure.has(m.framework)) refPressure.set(m.framework, new Map());
      const mm = refPressure.get(m.framework)!;
      mm.set(m.ref, (mm.get(m.ref) ?? 0) + rc.score);
    }
  }
  let maxPressure = 0;
  for (const mm of refPressure.values()) for (const v of mm.values()) maxPressure = Math.max(maxPressure, v);

  const frameworkExposure: FrameworkExposure[] = activeFrameworks.map((f) => {
    const all = new Set<string>();
    for (const c of profile.controls) for (const m of c.mappings) if (m.framework === f.id) all.add(m.ref);
    const mm = refPressure.get(f.id) ?? new Map<string, number>();
    const norm = (v: number) => (maxPressure ? v / maxPressure : 0);
    const refsByPressure = [...mm.entries()]
      .map(([ref, v]) => ({ ref, pressure: Math.round(norm(v) * 1000) / 1000 }))
      .sort((x, y) => y.pressure - x.pressure);
    const sum = [...mm.values()].reduce((x, y) => x + norm(y), 0);
    return {
      framework: f.id,
      name: f.name,
      market: f.market,
      requirementsInLibrary: all.size,
      requirementsUnderPressure: mm.size,
      pressureIndex: all.size ? Math.round((sum / all.size) * 1000) / 1000 : 0,
      refsByPressure,
    };
  });

  return {
    sector: profile.sector,
    profileVersion: profile.version,
    reviewStatus: profile.reviewStatus,
    totalEvents: total,
    nonThreatEvents: nonThreat,
    threats,
    unclassified: { count: unclassified, share: total ? unclassified / total : 0, examples: unclassifiedExamples },
    rankedControls,
    frameworkExposure,
    disclaimer: DISCLAIMER,
  };
}
