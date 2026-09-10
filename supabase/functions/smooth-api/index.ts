import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const fail = (message: string, status = 400) =>
  json({ ok: false, error: message }, status);

const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) => clean(value).toLowerCase();

function escapeHtml(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server configuration is incomplete.");
  }

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { ok: false, response: fail("Authentication is required.", 401) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: callerData, error: callerError } =
    await adminClient.auth.getUser(token);

  if (callerError || !callerData?.user) {
    return { ok: false, response: fail("Invalid or expired Admin session.", 401) };
  }

  const { data: admin, error: adminError } = await adminClient
    .from("admins")
    .select("id, status, auth_user_id")
    .eq("auth_user_id", callerData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error("Admin lookup failed:", adminError);
    return { ok: false, response: fail("Could not verify Admin access.", 500) };
  }

  if (!admin || norm(admin.status || "active") !== "active") {
    return { ok: false, response: fail("Admin access is required.", 403) };
  }

  return { ok: true, adminClient };
}

function buildAdmissionEmail(params: {
  fullName: string;
  email: string;
  className: string;
  studentId: string;
  loginUrl: string;
}) {
  const safeName = escapeHtml(params.fullName || "Applicant");
  const safeClass = escapeHtml(params.className || "your admitted class");
  const safeStudentId = escapeHtml(params.studentId || "Pending");
  const safeLoginUrl = escapeHtml(params.loginUrl);

  const subject = "PACSA Admission Notice";

  const textContent =
    `Dear ${params.fullName || "Applicant"},\n\n` +
    `Congratulations. Your application to PACSA has been approved.\n\n` +
    `Admitted Class: ${params.className || "--"}\n` +
    `Student ID: ${params.studentId || "--"}\n\n` +
    `Student Portal: ${params.loginUrl}\n\n` +
    `The school administrator will provide your portal access details if they have not already been sent.\n\n` +
    `PACSA\nBecoming Leaders Through Righteousness`;

  const htmlContent = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f7f7fb;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;padding:24px;">
          <div style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
            <div style="background:#5B21B6;color:#ffffff;padding:24px;text-align:center;">
              <h1 style="margin:0;font-size:24px;">PACSA Admission Notice</h1>
              <p style="margin:8px 0 0;font-size:14px;">Becoming Leaders Through Righteousness</p>
            </div>

            <div style="padding:26px;line-height:1.6;">
              <p>Dear <strong>${safeName}</strong>,</p>

              <p>
                Congratulations. Your application to <strong>PACSA</strong> has been approved.
              </p>

              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 8px;"><strong>Admitted Class:</strong> ${safeClass}</p>
                <p style="margin:0;"><strong>Student ID:</strong> ${safeStudentId}</p>
              </div>

              <p>
                You can visit the Student Portal here:
              </p>

              <p style="margin:22px 0;">
                <a href="${safeLoginUrl}" style="display:inline-block;background:#5B21B6;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">
                  Open Student Portal
                </a>
              </p>

              <p style="font-size:14px;color:#6b7280;">
                The school administrator will provide your portal access details if they have not already been sent.
              </p>

              <p style="margin-top:24px;">
                PACSA<br>
                <strong>Becoming Leaders Through Righteousness</strong>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, textContent, htmlContent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("Method not allowed.", 405);
  }

  try {
    const verification = await verifyAdmin(req);

    if (!verification.ok) {
      return verification.response;
    }

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("PACSA_EMAIL_FROM");
    const senderName = Deno.env.get("PACSA_EMAIL_FROM_NAME") || "PACSA Admissions";
    const siteUrl = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");

    if (!brevoApiKey) {
      return fail("Brevo API key is not configured.", 500);
    }

    if (!senderEmail || !isValidEmail(senderEmail)) {
      return fail("PACSA sender email is not configured correctly.", 500);
    }

    const body = await req.json();

    const email = clean(body?.email);
    const fullName = clean(body?.full_name) || "Applicant";
    const className = clean(body?.class);
    const studentId = clean(body?.student_id);
    const applicationId = clean(body?.application_id);
    const loginUrl = `${siteUrl}/student-login.html`;

    if (!email || !isValidEmail(email)) {
      return fail("A valid applicant email is required.", 400);
    }

    if (!applicationId) {
      return fail("Application ID is required.", 400);
    }

    const { subject, textContent, htmlContent } = buildAdmissionEmail({
      fullName,
      email,
      className,
      studentId,
      loginUrl,
    });

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            name: fullName,
            email,
          },
        ],
        subject,
        htmlContent,
        textContent,
        tags: ["admission", "application-approved"],
        headers: {
          "X-PACSA-Application-ID": applicationId,
        },
      }),
    });

    const responseText = await brevoResponse.text();
    let responseBody: Record<string, unknown> = {};

    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      responseBody = { raw: responseText };
    }

    if (!brevoResponse.ok) {
      console.error("Brevo email failed:", responseBody);
      return fail(
        String(responseBody?.message || "Could not send admission email."),
        brevoResponse.status,
      );
    }

    return json({
      ok: true,
      sent: true,
      provider: "brevo",
      message_id: responseBody?.messageId || null,
      recipient: email,
    });
  } catch (error) {
    console.error("smooth-api error:", error);

    return fail(
      error instanceof Error ? error.message : "Unexpected server error.",
      500,
    );
  }
});
