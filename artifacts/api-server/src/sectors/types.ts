/**
 * Sector profile: o motor é genérico, cada setor é DADOS.
 * Acrescentar um setor = escrever um ficheiro que cumpre SectorProfile.
 */

export type Market = "EU" | "US" | "GLOBAL";
export type ReviewStatus = "draft" | "expert_reviewed" | "legal_reviewed";

export interface Framework {
  id: string; // ex.: "NIS2"
  name: string;
  market: Market;
  /** Quando se aplica (texto curto, mostrado ao utilizador). */
  applicability: string;
  /** Fonte oficial do texto. */
  sourceUrl?: string;
}

export interface ControlMapping {
  framework: string; // Framework.id
  /** Referência à cláusula, ex.: "Art. 21(2)(c)". */
  ref: string;
}

export interface Control {
  id: string; // ex.: "HC-BACKUP"
  title: string;
  /** Recomendação concreta e acionável. */
  recommendation: string;
  mappings: ControlMapping[];
}

export interface Threat {
  id: string;
  label: string;
  /** Palavras-chave (minúsculas, sem acentos) para classificar eventos do Excel. */
  keywords: string[];
  /**
   * Peso de impacto na segurança do doente/serviço crítico, 0..1.
   * Julgamento de especialista — a calibrar com o hospital piloto.
   */
  criticalityWeight: number;
  /** Controlos que mitigam esta ameaça, por ordem de prioridade. */
  controls: string[];
  /** Onde o dano se materializa neste setor. */
  impactAreas: string[];
}

export interface SectorProfile {
  sector: string; // ex.: "Healthcare"
  version: string;
  reviewStatus: ReviewStatus;
  /** Quanto a criticalidade (vida/serviço essencial) pesa na prioridade: 0..2. */
  criticalityEmphasis: number;
  frameworks: Framework[];
  threats: Threat[];
  controls: Control[];
  notes?: string[];
}
