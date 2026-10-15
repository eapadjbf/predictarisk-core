import { analyzeForSector } from "../sectors/engine";
import { healthcare } from "../sectors/healthcare";
import { twin } from "./connector";
import { alertToEvent } from "./mapping";

/** Análise Healthcare completa alimentada pelo Digital Twin (lança TwinUnavailableError se falhar). */
export async function buildHealthcareAnalysis() {
  const [assets, alerts, predictions] = await Promise.all([
    twin.assets(), twin.openAlerts(), twin.latestPredictions(),
  ]);
  const analysis = analyzeForSector(healthcare, alerts.map(alertToEvent));
  const byId = new Map(assets.map((a) => [a.id, a]));

  // Prioridade clínica: dispositivos críticos para a vida primeiro, depois probabilidade a 30 dias.
  const topPredictedFailures = predictions
    .map((p) => ({ p, a: byId.get(p.assetId) }))
    .filter((x) => x.a)
    .sort((x, y) =>
      Number(y.a!.criticalToLife) - Number(x.a!.criticalToLife) ||
      y.p.failureProbability30d - x.p.failureProbability30d)
    .slice(0, 5)
    .map(({ p, a }) => ({
      assetId: p.assetId, name: a!.name, department: a!.department,
      criticalToLife: a!.criticalToLife, failureProbability30d: p.failureProbability30d,
      failureProbability90d: p.failureProbability90d, mainFactor: p.topFactors[0]?.label ?? null,
      modelVersion: p.modelVersion, dataQuality: p.dataQuality,
    }));

  return {
    generatedAt: new Date().toISOString(),
    source: "digital-twin",
    twinSummary: {
      assets: assets.length,
      criticalToLifeAssets: assets.filter((a) => a.criticalToLife).length,
      openAlerts: alerts.length,
      openAlertsOnCriticalToLife: alerts.filter((a) => a.criticalToLife).length,
    },
    analysis,
    topPredictedFailures,
    notes: [
      "Os alertas do Twin descrevem postura e saúde dos ativos, não ataques; ransomware, phishing e acessos indevidos vêm de outras fontes.",
      "Mapeamento alerta→ameaça em rascunho, a validar com engenharia biomédica.",
    ],
  };
}
