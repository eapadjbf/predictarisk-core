import { Router } from "express";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "../lib/supabaseAdmin";

const router = Router();

function getBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Fully deletes a user: removes their profile row AND their underlying Supabase
 * auth login, which also revokes any active sessions so they can no longer log
 * in. Admin-only — the caller must present a valid access token belonging to an
 * admin profile.
 */
router.delete("/admin/users/:id", async (req, res) => {
  const log = req.log;
  const targetId = req.params.id;

  if (!isSupabaseAdminConfigured()) {
    log.error("SUPABASE_SERVICE_ROLE_KEY or Supabase URL is not configured");
    res.status(503).json({ error: "User management is not configured on the server." });
    return;
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const admin = getSupabaseAdmin();

  // 1. Identify the caller from their access token.
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }
  const callerId = callerData.user.id;

  // 2. Verify the caller is an active admin (authoritative server-side check).
  const { data: callerProfile, error: profileErr } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", callerId)
    .maybeSingle();

  if (profileErr) {
    log.error({ err: profileErr }, "Failed to load caller profile");
    res.status(500).json({ error: "Could not verify permissions." });
    return;
  }

  if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status === "suspended") {
    res.status(403).json({ error: "Admin privileges are required." });
    return;
  }

  // 3. Disallow self-deletion to avoid an admin locking themselves out.
  if (targetId === callerId) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  // 4. Delete the profile row first (idempotent — fine if it is already gone).
  const { error: deleteProfileErr } = await admin.from("profiles").delete().eq("id", targetId);
  if (deleteProfileErr) {
    log.error({ err: deleteProfileErr, targetId }, "Failed to delete profile row");
    res.status(500).json({ error: "Failed to delete the user's profile." });
    return;
  }

  // 5. Delete the auth user. This removes the login and revokes active sessions.
  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(targetId);
  if (deleteAuthErr) {
    // Treat an already-missing auth user as success so the operation is idempotent.
    const status = (deleteAuthErr as { status?: number }).status;
    if (status !== 404) {
      log.error({ err: deleteAuthErr, targetId }, "Failed to delete auth user");
      res.status(500).json({
        error: "The profile was removed but the login could not be fully deleted. Please retry.",
      });
      return;
    }
  }

  log.info({ targetId, by: callerId }, "User fully deleted (profile + auth login)");
  res.json({ ok: true, id: targetId });
});

export default router;
