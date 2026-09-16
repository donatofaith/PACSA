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

const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);
const clean = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => clean(v).toLowerCase();

function makeTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => chars[b % chars.length]).join("") + "Aa!";
}

async function sendEmail(args: { name: string; email: string; password: string; expiresAt: string }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("PACSA_EMAIL_FROM");
  const senderName = Deno.env.get("PACSA_EMAIL_FROM_NAME") || "PACSA";
  const siteUrl = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");
  if (!apiKey || !senderEmail) return false;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ name: args.name || "Administrator", email: args.email }],
      subject: "PACSA Admin Portal Access",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
          <div style="background:#5B21B6;color:white;padding:22px;text-align:center"><h2 style="margin:0">PACSA Admin Portal</h2></div>
          <div style="padding:24px;line-height:1.6">
            <p>Dear <strong>${args.name}</strong>,</p>
            <p>You have been added as a PACSA Administrator.</p>
            <p><strong>Email:</strong> ${args.email}<br><strong>Temporary Password:</strong> ${args.password}</p>
            <p>This temporary password expires in 24 hours. Change it after signing in.</p>
            <p><a href="${siteUrl}/admin-login.html" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;padding:11px 16px;border-radius:9px">Open Admin Portal</a></p>
          </div>
        </div>`,
    }),
  });
  return response.ok;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return fail("Server configuration is incomplete.", 500);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return fail("Authentication is required.", 401);

    const adminClient = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: caller } = await adminClient.auth.getUser(token);
    if (!caller?.user) return fail("Invalid or expired session.", 401);

    const { data: superAdmin, error: roleError } = await adminClient
      .from("admins")
      .select("id,role,status")
      .eq("auth_user_id", caller.user.id)
      .maybeSingle();

    if (roleError || !superAdmin || norm(superAdmin.status || "active") !== "active" || norm(superAdmin.role) !== "super_admin") {
      return fail("Super Admin access is required.", 403);
    }

    const body = await req.json();
    const fullname = clean(body?.fullname);
    const email = norm(body?.email);
    if (!fullname || !email) return fail("Full name and email are required.");

    const { data: existingAdmin } = await adminClient.from("admins").select("id").ilike("email", email).maybeSingle();
    if (existingAdmin) return fail("This email is already an Admin account.");

    const { data: teacherMatch } = await adminClient.from("Teachers").select("id").ilike("email", email).maybeSingle();
    const { data: studentMatch } = await adminClient.from("students").select("id").ilike("email", email).maybeSingle();
    if (teacherMatch || studentMatch) return fail("This email is already registered to another PACSA user.");

    const password = makeTemporaryPassword();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        temporary_password: true,
        temporary_password_expires_at: expiresAt,
      },
    });
    if (createError || !created?.user) return fail(createError?.message || "Could not create Admin login.");

    const { error: insertError } = await adminClient.from("admins").insert({
      fullname,
      email,
      status: "active",
      role: "admin",
      auth_user_id: created.user.id,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return fail(insertError.message || "Could not create Admin record.");
    }

    const emailSent = await sendEmail({ name: fullname, email, password, expiresAt });

    return json({
      ok: true,
      temporary_password: password,
      temporary_password_expires_at: expiresAt,
      email_sent: emailSent,
      message: emailSent ? "Admin created and credentials emailed." : "Admin created. Copy the temporary password manually.",
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
