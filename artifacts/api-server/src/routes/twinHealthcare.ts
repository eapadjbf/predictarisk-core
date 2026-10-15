import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { analyzeForSector } from "../sectors/engine";
import { healthcare } from "../sectors/healthcare";
import { twin, TwinUnavailableError } from "../twin/connector";
import { alertToEvent } from "../twin/mapping";

/**
 * Análise Healthcare alimentada diretamente pelo Digital Twin (sem Excel).
 * Chamada servidor-a-servidor pelo dashboard hospitalar: X-Api-Key = PREDICTA_API_KEY.
 * Desligada por defeito (503 sem PREDICTA_API_KEY).
 */
const router: IRouter = Router();
const sha = (s: string) => createHash("sha256").update(s).digest();

function requireKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.PREDICTA_API_KEY;
  if (!expected) { res.status(503).json({ error: "disabled" }); return; }
  if (!timingSafeEqual(sha(req.header("x-api-key") ?? ""), sha(expected))) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

router.get("/twin/healthcare-analysis", requireKey, async (_req, res): Promise<void> => {
  try {
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

    res.json({
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
    });
  } catch (err) {
    if (err instanceof TwinUnavailableError) { res.status(502).json({ error: "twin unavailable" }); return; }
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
