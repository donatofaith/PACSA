import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>) => new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (message: string, code = "ADMIN_ACTION_FAILED") => json({ ok: false, error: message, code });
const clean = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => clean(v).toLowerCase();
function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function makeTemporaryPassword() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?"; const bytes = crypto.getRandomValues(new Uint8Array(16)); const randomPart = Array.from(bytes, b => chars[b % chars.length]).join(""); return `Aa1!${randomPart}`; }

async function sendEmail(args: { name: string; email: string; password: string; expiresAt: string }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("PACSA_EMAIL_FROM");
  const senderName = Deno.env.get("PACSA_EMAIL_FROM_NAME") || "PACSA";
  const siteUrl = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");
  if (!apiKey || !senderEmail) return false;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" }, body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: [{ name: args.name || "Administrator", email: args.email }], subject: "PACSA Admin Portal Access", htmlContent: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#5B21B6;color:white;padding:22px;text-align:center"><h2 style="margin:0">PACSA Admin Portal</h2></div><div style="padding:24px;line-height:1.6"><p>Dear <strong>${args.name}</strong>,</p><p>You have been added as a PACSA Administrator.</p><p><strong>Email:</strong> ${args.email}<br><strong>Temporary Password:</strong> ${args.password}</p><p>This temporary password expires in 24 hours. You will be required to create your own strong password after signing in.</p><p><a href="${siteUrl}/admin-login.html" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;padding:11px 16px;border-radius:9px">Open Admin Portal</a></p></div></div>` }) });
  return response.ok;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", "METHOD_NOT_ALLOWED");
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return fail("Server configuration is incomplete.", "SERVER_CONFIG");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return fail("Authentication is required.", "AUTH_REQUIRED");

    const adminClient = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: caller, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !caller?.user) return fail("Invalid or expired session.", "INVALID_SESSION");

    const { data: actingAdmin, error: roleError } = await adminClient.from("admins").select("id,fullname,email,role,status,auth_user_id").eq("auth_user_id", caller.user.id).maybeSingle();
    if (roleError || !actingAdmin || norm(actingAdmin.status || "active") !== "active" || !["admin", "super_admin"].includes(norm(actingAdmin.role))) {
      return fail("Active Admin access is required.", "ADMIN_REQUIRED");
    }
    const actorRole = norm(actingAdmin.role) === "super_admin" ? "super_admin" : "admin";
    const body = await req.json();
    const action = norm(body?.action || "create");

    if (action === "delete") {
      const adminId = clean(body?.admin_id);
      if (!adminId) return fail("Choose an administrator to delete.", "ADMIN_ID_REQUIRED");
      const { data: target, error: targetError } = await adminClient.from("admins").select("id,fullname,email,role,status,auth_user_id").eq("id", adminId).maybeSingle();
      if (targetError || !target) return fail("Administrator not found.", "ADMIN_NOT_FOUND");
      if (norm(target.role) === "super_admin") return fail("The Super Admin account cannot be deleted.", "SUPER_ADMIN_PROTECTED");
      if (clean(target.auth_user_id) === caller.user.id) return fail("You cannot delete your own account.", "SELF_DELETE_BLOCKED");
      if (target.auth_user_id) { const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target.auth_user_id); if (authDeleteError) return fail(`Could not remove the Admin login: ${authDeleteError.message}`, "AUTH_DELETE_FAILED"); }
      const { error: rowDeleteError } = await adminClient.from("admins").delete().eq("id", target.id);
      if (rowDeleteError) return fail(`Login was removed, but the Admin record could not be deleted: ${rowDeleteError.message}`, "ROW_DELETE_FAILED");
      await adminClient.from("audit_logs").insert({ actor_user_id: caller.user.id, actor_role: actorRole, action: "delete_admin", entity_type: "admins", entity_id: String(target.id), details: { fullname: target.fullname, email: target.email } });
      return json({ ok: true, message: `${target.fullname || target.email || "Administrator"} was deleted successfully.` });
    }

    if (action === "set_status") {
      const adminId = clean(body?.admin_id); const status = norm(body?.status);
      if (!adminId || !["active", "inactive"].includes(status)) return fail("Administrator and a valid status are required.", "INVALID_STATUS_REQUEST");
      const { data: target } = await adminClient.from("admins").select("id,fullname,email,role,auth_user_id").eq("id", adminId).maybeSingle();
      if (!target) return fail("Administrator not found.", "ADMIN_NOT_FOUND");
      if (norm(target.role) === "super_admin") return fail("The Super Admin account cannot be deactivated.", "SUPER_ADMIN_PROTECTED");
      if (clean(target.auth_user_id) === caller.user.id) return fail("You cannot deactivate your own account.", "SELF_STATUS_BLOCKED");
      const { error } = await adminClient.from("admins").update({ status }).eq("id", adminId); if (error) return fail(error.message, "STATUS_UPDATE_FAILED");
      await adminClient.from("audit_logs").insert({ actor_user_id: caller.user.id, actor_role: actorRole, action: status === "active" ? "activate_admin" : "deactivate_admin", entity_type: "admins", entity_id: String(target.id), details: { fullname: target.fullname, email: target.email } });
      return json({ ok: true, message: `Administrator ${status === "active" ? "activated" : "deactivated"} successfully.` });
    }

    if (action !== "create") return fail("Unknown administrator action.", "UNKNOWN_ACTION");
    const fullname = clean(body?.fullname); const email = norm(body?.email);
    if (!fullname || !email) return fail("Full name and email are required.", "MISSING_FIELDS");
    if (!isEmail(email)) return fail("Enter a valid email address.", "INVALID_EMAIL");
    const { data: existingAdmin } = await adminClient.from("admins").select("id").ilike("email", email).maybeSingle();
    if (existingAdmin) return fail("This email is already registered as an Admin. Delete or update that Admin record first.", "ADMIN_EMAIL_EXISTS");
    const { data: teacherMatch } = await adminClient.from("Teachers").select("id").ilike("email", email).maybeSingle();
    const { data: studentMatch } = await adminClient.from("students").select("id").ilike("email", email).maybeSingle();
    if (teacherMatch || studentMatch) return fail("This email is already registered to another PACSA user.", "PACSA_EMAIL_EXISTS");

    const password = makeTemporaryPassword();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "admin", temporary_password: true, temporary_password_expires_at: expiresAt } });
    if (createError || !created?.user) { const text = createError?.message || "Could not create Admin login."; if (norm(text).includes("already") || norm(text).includes("registered")) return fail("This email already has a Supabase login. Use another email or remove the old test login from Authentication first.", "AUTH_EMAIL_EXISTS"); return fail(text, "AUTH_CREATE_FAILED"); }

    const { data: inserted, error: insertError } = await adminClient.from("admins").insert({ fullname, email, status: "active", role: "admin", auth_user_id: created.user.id }).select("id").single();
    if (insertError) { await adminClient.auth.admin.deleteUser(created.user.id); return fail(insertError.message || "Could not create Admin record.", "ADMIN_ROW_CREATE_FAILED"); }
    const emailSent = await sendEmail({ name: fullname, email, password, expiresAt });
    await adminClient.from("audit_logs").insert({ actor_user_id: caller.user.id, actor_role: actorRole, action: "create_admin", entity_type: "admins", entity_id: String(inserted?.id ?? ""), details: { fullname, email, email_sent: emailSent } });
    return json({ ok: true, temporary_password_expires_at: expiresAt, email_sent: emailSent, message: emailSent ? "Administrator created and login details were emailed securely." : "Administrator created, but the credential email could not be sent. Use Forgot Password on the Admin login page for this email." });
  } catch (error) {
    console.error("create-admin-user:", error);
    return fail(error instanceof Error ? error.message : "Unexpected server error.", "UNEXPECTED_ERROR");
  }
});