import type { InputEvent } from "../sectors/engine";
import type { TwinAlert } from "./connector";

/**
 * Tipo de alerta do Twin -> ameaça do perfil Healthcare.
 * string = ameaça; null = higiene operacional (fora da análise de ameaças).
 * RASCUNHO: a validar com engenharia biomédica.
 */
export const TWIN_ALERT_TO_THREAT: Record<string, string | null> = {
  firmware_outdated: "legacy_vuln_exploit",
  end_of_life: "legacy_vuln_exploit",
  security_vulnerability: "legacy_vuln_exploit",
  offline: "system_outage",
  connectivity_lost: "system_outage",
  critical_failure: "system_outage",
  maintenance_expired: null,
  calibration_due: null,
};

export function alertToEvent(a: TwinAlert): InputEvent {
  // Tipo desconhecido (novo no Twin): sem threatId, cai na classificação por palavras-chave.
  const mapped = a.type in TWIN_ALERT_TO_THREAT ? TWIN_ALERT_TO_THREAT[a.type] : undefined;
  return { eventType: a.type, description: a.title, ...(mapped !== undefined ? { threatId: mapped } : {}) };
}
