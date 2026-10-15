import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export interface AuthedUser {
  id: string;
  role: string;
  sector: string;
  organisation: string;
}

const rawUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const anonKey = (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY)?.trim();

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
      .select("role, status, sector, organisation_name")
      .eq("id", u.user.id)
      .maybeSingle();
    if (pErr) {
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
      organisation: String(p.organisation_name ?? ""),
    } satisfies AuthedUser;
    next();
  } catch {
    res.status(500).json({ error: "Could not verify permissions." });
  }
}
