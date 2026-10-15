import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { TwinUnavailableError } from "../twin/connector";
import { buildHealthcareAnalysis } from "../twin/service";
import { createTwinTicket } from "../twin/ticket";
import { requireUser, type AuthedUser } from "../lib/requireUser";

/**
 * Análise Healthcare alimentada diretamente pelo Digital Twin (sem Excel).
 *  - GET /twin/healthcare-analysis : servidor-a-servidor (X-Api-Key = PREDICTA_API_KEY); 503 sem chave.
 *  - GET /me/healthcare-analysis   : utilizadores com sessão, só setor Healthcare e organização
 *                                    permitida (TWIN_ALLOWED_ORGS, separadas por vírgula); 403 caso contrário.
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

function requireTwinOrg(_req: Request, res: Response, next: NextFunction): void {
  const allowed = (process.env.TWIN_ALLOWED_ORGS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) { res.status(503).json({ error: "disabled" }); return; }
  const u = res.locals.user as AuthedUser;
  if (u.sector !== "Healthcare" || !allowed.includes(u.organisation.trim().toLowerCase())) {
    res.status(403).json({ error: "No Digital Twin is connected to this account." });
    return;
  }
  next();
}

async function respond(res: Response): Promise<void> {
  try {
    res.json(await buildHealthcareAnalysis());
  } catch (err) {
    if (err instanceof TwinUnavailableError) { res.status(502).json({ error: "twin unavailable" }); return; }
    res.status(500).json({ error: "internal error" });
  }
}

router.get("/twin/healthcare-analysis", requireKey, (_req, res) => respond(res));
router.get("/me/healthcare-analysis", requireUser, requireTwinOrg, (_req, res) => respond(res));

router.post("/me/twin-link", requireUser, requireTwinOrg, (_req, res) => {
  const base = (process.env.TWIN_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const ticket = createTwinTicket((res.locals.user as AuthedUser).id);
  if (!/^https:\/\//.test(base) || !ticket) { res.status(503).json({ error: "disabled" }); return; }
  res.setHeader("Cache-Control", "no-store");
  res.json({ url: `${base}/api/sso?t=${encodeURIComponent(ticket)}` });
});

export default router;
