import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export interface AuthedUser {
  id: string;
  role: string;
  sector: string;
  organisation: string;
}

// Os Secrets podem estar guardados trocados: distinguir URL e chave pelo valor.
const envVals = [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL, process.env.SUPABASE_ANON_KEY, process.env.VITE_SUPABASE_ANON_KEY]
  .map((v) => v?.trim())
  .filter((v): v is string => !!v);
const rawUrl = envVals.find((v) => /^https?:\/\//i.test(v));
const anonKey = envVals.find((v) => !/^https?:\/\//i.test(v));


/**
 * Exige sessão Supabase válida (Authorization: Bearer <access_token>) e conta ativa.
 * Usa só a chave pública (anon) com o token do próprio utilizador: valida o token no
 * Supabase Auth e lê o perfil dele sob as regras RLS. Não precisa de service-role.
 * Deixa o utilizador em res.locals.user.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!rawUrl || !anonKey) {
    res.status(503).json({ error: "Authentication is not configured on the server." });
    return;
  }
  const m = (req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/i);
  if (!m) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const token = m[1].trim();
  try {
    const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await client.auth.getUser(token);
    if (uErr || !u?.user) {
      res.status(401).json({ error: "Invalid or expired session." });
      return;
    }
    const { data: p, error: pErr } = await client
      .from("profiles")
      .select("*")
      .eq("id", u.user.id)
      .maybeSingle();
    if (pErr) {
      console.error("requireUser: profile read failed:", pErr.code, pErr.message);
      res.status(500).json({ error: "Could not verify permissions." });
      return;
    }
    if (!p || p.status === "suspended") {
      res.status(403).json({ error: "Account not allowed." });
      return;
    }
    res.locals.user = {
      id: u.user.id,
      role: String(p.role ?? ""),
      sector: String(p.sector ?? ""),
      organisation: String(p.organisation_name ?? p.organization_name ?? p.organisation ?? p.organization ?? p.company ?? ""),
    } satisfies AuthedUser;
    next();
  } catch (err) {
    console.error("requireUser failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Could not verify permissions." });
  }
}
