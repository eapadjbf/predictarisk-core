/**
 * Conector do Digital Twin Hospitalar (leitura). Usa as rotas /api/export/v1/*.
 * Variáveis: TWIN_BASE_URL (ex.: https://digital-twin-monitor.replit.app), TWIN_EXPORT_KEY.
 */
export interface TwinAsset {
  id: number; name: string; type: string; department: string; status: string;
  lifeCycleStatus: string; criticalToLife: boolean;
}
export interface TwinAlert {
  id: number; assetId: number; type: string; severity: string; title: string;
  criticalToLife: boolean; resolved: boolean; createdAt: string | null;
}
export interface TwinPrediction {
  assetId: number; failureProbability30d: number; failureProbability90d: number;
  hazardScore: number; topFactors: { label: string; direction: string }[];
  modelVersion: string; dataQuality: string; confidenceLevel: number;
}

export class TwinUnavailableError extends Error {}

interface Envelope<T> { items: T[]; nextSince: string | null }

async function get<T>(path: string, params: Record<string, string>): Promise<Envelope<T>> {
  const base = process.env.TWIN_BASE_URL;
  const key = process.env.TWIN_EXPORT_KEY;
  if (!base || !key) throw new TwinUnavailableError("twin not configured");
  const url = new URL(`/api/export/v1/${path}`, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-Api-Key": key }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new TwinUnavailableError("twin unreachable");
  }
  if (!res.ok) throw new TwinUnavailableError(`twin responded ${res.status}`);
  return (await res.json()) as Envelope<T>;
}

/** Segue nextSince até esgotar (máx. maxPages páginas de 500). */
async function getAll<T>(path: string, sinceParam: string, base: Record<string, string>, maxPages = 10): Promise<T[]> {
  const out: T[] = [];
  let since: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page: Envelope<T> = await get<T>(path, { ...base, limit: "500", ...(since ? { [sinceParam]: since } : {}) });
    out.push(...page.items);
    if (!page.nextSince || page.nextSince === since) break;
    since = page.nextSince;
  }
  return out;
}

export const twin = {
  assets: () => getAll<TwinAsset>("assets", "updatedSince", {}),
  openAlerts: () => getAll<TwinAlert>("alerts", "since", { resolved: "false" }),
  latestPredictions: async () => (await get<TwinPrediction>("risk-predictions/latest", {})).items,
};
