import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client authenticated with the service-role key.
 * The service-role key bypasses RLS and can manage auth users, so it must only
 * ever live on the server and never be sent to the browser.
 *
 * Throws if the required configuration is missing so callers can surface a
 * clear error instead of failing silently.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!rawUrl) {
    throw new Error(
      "Missing Supabase URL. Set SUPABASE_URL (or VITE_SUPABASE_URL) for the API server.",
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. It is required for server-side user management.",
    );
  }

  if (!client) {
    const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
    client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(rawUrl && serviceRoleKey);
}
