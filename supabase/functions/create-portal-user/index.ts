import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (message: string, status = 200) =>
  json({ ok: false, error: message, status }, 200);

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
const clean = (value: unknown) => String(value ?? "").trim();

const makeTemporaryPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("") + "9a!";
};

function escapeHtml(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendCredentialEmail(args: {
  role: string;
  email: string;
  name: string;
  recordId: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresAt: string;
}) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("PACSA_EMAIL_FROM");
  const senderName = Deno.env.get("PACSA_EMAIL_FROM_NAME") || "PACSA Portal";

  if (!brevoApiKey || !senderEmail) {
    return { sent: false, reason: "Brevo email secrets are not configured." };
  }

  const roleTitle = args.role === "teacher" ? "Teacher" : "Student";
  const portalName = `${roleTitle} Portal`;
  const safeName = escapeHtml(args.name || roleTitle);
  const safeId = escapeHtml(args.recordId);
  const safeEmail = escapeHtml(args.email);
  const safePassword = escapeHtml(args.temporaryPassword);
  const safeLogin = escapeHtml(args.loginUrl);
  const safeExpiry = escapeHtml(new Date(args.expiresAt).toLocaleString());

  const subject = `PACSA ${portalName} Access`;
  const textContent =
    `Dear ${args.name || roleTitle},\n\n` +
    `Your PACSA ${portalName} access has been created.\n\n` +
    `${roleTitle} ID: ${args.recordId}\n` +
    `Email: ${args.email}\n` +
    `Temporary Password: ${args.temporaryPassword}\n` +
    `Login: ${args.loginUrl}\n\n` +
    `This temporary password expires in 24 hours. After logging in, change your password.\n\n` +
    `PACSA\nBecoming Leaders Through Righteousness`;

  const htmlContent = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f7f7fb;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;padding:24px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
            <div style="background:#5B21B6;color:#ffffff;text-align:center;padding:24px;">
              <h1 style="margin:0;font-size:23px;">PACSA ${portalName} Access</h1>
              <p style="margin:8px 0 0;font-size:14px;">Becoming Leaders Through Righteousness</p>
            </div>
            <div style="padding:26px;line-height:1.6;">
              <p>Dear <strong>${safeName}</strong>,</p>
              <p>Your PACSA ${portalName} account has been created.</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:18px 0;">
                <p style="margin:0 0 8px;"><strong>${roleTitle} ID:</strong> ${safeId}</p>
                <p style="margin:0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
                <p style="margin:0 0 8px;"><strong>Temporary Password:</strong> ${safePassword}</p>
                <p style="margin:0;"><strong>Expires:</strong> ${safeExpiry}</p>
              </div>
              <p>This temporary password expires in <strong>24 hours</strong>. After logging in, change your password.</p>
              <p style="margin:22px 0;">
                <a href="${safeLogin}" style="display:inline-block;background:#5B21B6;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">
                  Open ${portalName}
                </a>
              </p>
              <p>PACSA<br><strong>Becoming Leaders Through Righteousness</strong></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ name: args.name || roleTitle, email: args.email }],
      subject,
      htmlContent,
      textContent,
      tags: ["portal", args.role, "temporary-password"],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("Credential email failed:", text);
    return { sent: false, reason: text || "Brevo rejected the email." };
  }

  return { sent: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return fail("Server configuration is incomplete.", 500);

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return fail("Authentication is required.", 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !callerData?.user) return fail("Invalid or expired Admin session.", 401);

    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .select("id, status, auth_user_id")
      .eq("auth_user_id", callerData.user.id)
      .maybeSingle();

    if (adminError) return fail("Could not verify Admin access.", 500);
    if (!admin || norm(admin.status || "active") !== "active") return fail("Admin access is required.", 403);

    const body = await req.json();
    const role = norm(body?.role);
    const recordId = clean(body?.record_id);
    const email = norm(body?.email);

    if (!["student", "teacher"].includes(role)) return fail("Role must be student or teacher.", 400);
    if (!recordId || !email) return fail("Record ID and email are required.", 400);

    const config = role === "student"
      ? { table: "students", idColumn: "student_id", metadataKey: "student_id", profileSelect: "student_id, first_name, last_name, email, auth_user_id, portal_status, status", loginPage: "student-login.html", hasStatusColumn: true }
      : { table: "Teachers", idColumn: "teacher_id", metadataKey: "teacher_id", profileSelect: "teacher_id, first_name, last_name, email, auth_user_id, portal_status", loginPage: "teacher-login.html", hasStatusColumn: false };

    const { data: record, error: recordError } = await adminClient
      .from(config.table)
      .select(config.profileSelect)
      .eq(config.idColumn, recordId)
      .maybeSingle();

    if (recordError) return fail(`Could not load the ${role} record. ${recordError.message || ""}`.trim(), 500);
    if (!record) return fail(`No ${role} record matches that ID.`, 404);
    if (norm(record.email) !== email) return fail(`The email does not match the ${role} record. Update the profile first.`, 400);
    if (config.hasStatusColumn && norm(record.status || "active") !== "active") return fail(`This ${role} record is inactive.`, 400);
    if (norm(record.portal_status || "active") === "inactive") return fail(`This ${role} portal account is inactive.`, 400);

    const siteUrl = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");
    const loginUrl = `${siteUrl}/${config.loginPage}`;
    const temporaryPassword = makeTemporaryPassword();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const metadata = {
      role,
      [config.metadataKey]: recordId,
      provisioned_by_admin: true,
      temporary_password: true,
      temporary_password_expires_at: expiresAt,
    };

    let authUserId = clean(record.auth_user_id);

    if (authUserId) {
      const { error: resetError } = await adminClient.auth.admin.updateUserById(authUserId, {
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (resetError) return fail(resetError.message || "Could not reset Portal password.", 400);
    } else {
      const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (createError) return fail(createError.message || "Could not create Portal access.", 400);
      authUserId = createdData?.user?.id || "";
    }

    if (authUserId) {
      await adminClient
        .from(config.table)
        .update({ auth_user_id: authUserId, portal_status: "active" })
        .eq(config.idColumn, recordId);
    }

    const name = `${clean(record.first_name)} ${clean(record.last_name)}`.trim() || role;
    const emailResult = await sendCredentialEmail({
      role,
      email,
      name,
      recordId,
      temporaryPassword,
      loginUrl,
      expiresAt,
    });

    return json({
      ok: true,
      temporary_password_created: true,
      temporary_password: temporaryPassword,
      temporary_password_expires_at: expiresAt,
      auth_user_id: authUserId || null,
      portal_status: "active",
      login_url: loginUrl,
      email_sent: emailResult.sent,
      email_warning: emailResult.sent ? null : emailResult.reason,
      message:
        `${role.toUpperCase()} Portal access created.\n\nID: ${recordId}\nEMAIL: ${email}\nTEMPORARY PASSWORD: ${temporaryPassword}\nEXPIRES: ${new Date(expiresAt).toLocaleString()}\nLOGIN: ${loginUrl}\n\n${emailResult.sent ? "The details were also sent by email." : "Email could not be sent, so copy these details manually."}`,
    });
  } catch (error) {
    console.error("create-portal-user error:", error);
    return fail(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
