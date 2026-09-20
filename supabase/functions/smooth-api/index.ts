import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);
const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) => clean(value).toLowerCase();
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
function escapeHtml(value: unknown) {
  return clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function getServerClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAdmin(req: Request) {
  const adminClient = getServerClient();
  if (!adminClient) return { ok: false, response: fail("Server configuration is incomplete.", 500) };
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, response: fail("Authentication is required.", 401) };
  const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
  if (callerError || !callerData?.user) return { ok: false, response: fail("Invalid or expired Admin session.", 401) };
  const { data: admin, error: adminError } = await adminClient.from("admins").select("id,status,auth_user_id").eq("auth_user_id", callerData.user.id).maybeSingle();
  if (adminError) return { ok: false, response: fail("Could not verify Admin access.", 500) };
  if (!admin || norm(admin.status || "active") !== "active") return { ok: false, response: fail("Admin access is required.", 403) };
  return { ok: true, adminClient, caller: callerData.user };
}

async function sendBrevoEmail(args: {
  to: { name: string; email: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
  tags: string[];
  headers?: Record<string, string>;
}) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("PACSA_EMAIL_FROM");
  const senderName = Deno.env.get("PACSA_EMAIL_FROM_NAME") || "PACSA Admissions";
  if (!brevoApiKey) throw new Error("Brevo API key is not configured.");
  if (!senderEmail || !isValidEmail(senderEmail)) throw new Error("PACSA sender email is not configured correctly.");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "api-key": brevoApiKey, "content-type": "application/json" },
    body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, ...args }),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text }; }
  if (!response.ok) throw new Error(String(body?.message || "Could not send email."));
  return body;
}

function buildAdmissionEmail(params: {
  fullName: string;
  className: string;
  studentId: string;
  loginUrl: string;
  temporaryPassword: string;
  expiresAt: string;
}) {
  const safeName = escapeHtml(params.fullName || "Applicant");
  const safeClass = escapeHtml(params.className || "--");
  const safeStudentId = escapeHtml(params.studentId || "--");
  const safeLoginUrl = escapeHtml(params.loginUrl);
  const safePassword = escapeHtml(params.temporaryPassword || "Provided by Admin");
  const safeExpiry = params.expiresAt ? escapeHtml(new Date(params.expiresAt).toLocaleString()) : "24 hours";
  const subject = "PACSA Admission Notice and Portal Access";
  const textContent =
    `Dear ${params.fullName || "Applicant"},\n\n` +
    `Congratulations. Your application to PACSA has been approved.\n\n` +
    `Admitted Class: ${params.className || "--"}\n` +
    `Student ID: ${params.studentId || "--"}\n` +
    `Portal Login: ${params.loginUrl}\n` +
    `Temporary Password: ${params.temporaryPassword || "Provided by Admin"}\n` +
    `Expires: ${params.expiresAt ? new Date(params.expiresAt).toLocaleString() : "24 hours"}\n\n` +
    `Use the temporary password to log in to the Student Portal, then change your password.\n\n` +
    `PACSA\nBecoming Leaders Through Righteousness`;
  const htmlContent = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f7fb;font-family:Arial,sans-serif;color:#1f2937;"><div style="max-width:640px;margin:0 auto;padding:24px;"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;"><div style="background:#5B21B6;color:#fff;text-align:center;padding:24px;"><h1 style="margin:0;font-size:23px;">PACSA Admission Notice</h1><p style="margin:8px 0 0;font-size:14px;">Becoming Leaders Through Righteousness</p></div><div style="padding:26px;line-height:1.6;"><p>Dear <strong>${safeName}</strong>,</p><p>Congratulations. Your application to <strong>PACSA</strong> has been approved.</p><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:18px 0;"><p style="margin:0 0 8px;"><strong>Admitted Class:</strong> ${safeClass}</p><p style="margin:0 0 8px;"><strong>Student ID:</strong> ${safeStudentId}</p><p style="margin:0 0 8px;"><strong>Temporary Password:</strong> ${safePassword}</p><p style="margin:0;"><strong>Expires:</strong> ${safeExpiry}</p></div><p>Use this temporary password to log in to the Student Portal, then change your password.</p><p style="margin:22px 0;"><a href="${safeLoginUrl}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">Open Student Portal</a></p><p>PACSA<br><strong>Becoming Leaders Through Righteousness</strong></p></div></div></div></body></html>`;
  return { subject, textContent, htmlContent };
}

function buildNewApplicationEmail(params: { fullName: string; applicantEmail: string; parentName: string; phone: string; className: string; applicationsUrl: string; }) {
  const subject = "New PACSA Admission Application";
  const textContent = `A new PACSA admission application has been submitted.\n\nApplicant: ${params.fullName || "--"}\nClass: ${params.className || "--"}\nParent/Guardian: ${params.parentName || "--"}\nPhone: ${params.phone || "--"}\nEmail: ${params.applicantEmail || "--"}\n\nOpen Applications: ${params.applicationsUrl}`;
  const htmlContent = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f7fb;font-family:Arial,sans-serif;color:#1f2937;"><div style="max-width:640px;margin:0 auto;padding:24px;"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;"><div style="background:#5B21B6;color:#fff;text-align:center;padding:22px;"><h1 style="margin:0;font-size:22px;">New Admission Application</h1><p style="margin:8px 0 0;font-size:14px;">PACSA School Management System</p></div><div style="padding:24px;line-height:1.6;"><p>A new admission application has been submitted.</p><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:18px 0;"><p><strong>Applicant:</strong> ${escapeHtml(params.fullName||"--")}</p><p><strong>Class:</strong> ${escapeHtml(params.className||"--")}</p><p><strong>Parent/Guardian:</strong> ${escapeHtml(params.parentName||"--")}</p><p><strong>Phone:</strong> ${escapeHtml(params.phone||"--")}</p><p><strong>Email:</strong> ${escapeHtml(params.applicantEmail||"--")}</p></div><p><a href="${escapeHtml(params.applicationsUrl)}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">Review Application</a></p></div></div></div></body></html>`;
  return { subject, textContent, htmlContent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);
  try {
    const siteUrl = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");
    const body = await req.json();
    const type = norm(body?.type || body?.event || "admission_approved");

    if (type === "new_application") {
      const adminEmail = clean(Deno.env.get("PACSA_ADMIN_EMAIL")) || clean(Deno.env.get("PACSA_EMAIL_FROM"));
      if (!isValidEmail(adminEmail)) return fail("PACSA admin notification email is not configured correctly.", 500);

      const applicationId = clean(body?.application_id);
      if (!applicationId) return fail("Application ID is required.", 400);

      const serverClient = getServerClient();
      if (!serverClient) return fail("Server configuration is incomplete.", 500);

      // Never trust applicant identity/profile fields supplied by the browser.
      // The application id is only a lookup key; notification content is loaded
      // from the database using the server credential.
      const { data: application, error: applicationError } = await serverClient
        .from("applications")
        .select("id,first_name,last_name,full_name,email,class,parent_name,phone,status")
        .eq("id", applicationId)
        .maybeSingle();

      if (applicationError) return fail("Could not verify the submitted application.", 500);
      if (!application) return fail("Application not found.", 404);

      const applicantName =
        clean(application.full_name) ||
        [clean(application.first_name), clean(application.last_name)].filter(Boolean).join(" ") ||
        "Applicant";

      const email = buildNewApplicationEmail({
        fullName: applicantName,
        applicantEmail: clean(application.email),
        className: clean(application.class),
        parentName: clean(application.parent_name),
        phone: clean(application.phone),
        applicationsUrl: `${siteUrl}/applications.html`,
      });

      const responseBody = await sendBrevoEmail({
        to: [{ name: "PACSA Admin", email: adminEmail }],
        ...email,
        tags: ["application", "new-application", "admin-notice"],
        headers: { "X-PACSA-Application-ID": applicationId },
      });

      return json({ ok: true, sent: true, type, provider: "brevo", message_id: responseBody?.messageId || null, recipient: adminEmail });
    }

    const verification = await verifyAdmin(req);
    if (!verification.ok) return verification.response;

    const applicationId = clean(body?.application_id);
    const studentId = clean(body?.student_id);
    if (!applicationId) return fail("Application ID is required.", 400);
    if (!studentId) return fail("Student ID is required.", 400);

    // The authenticated Admin chooses the action, but the server determines the
    // target identity from PACSA records rather than trusting browser-supplied
    // email/name/class values.
    const { data: application, error: applicationError } = await verification.adminClient
      .from("applications")
      .select("id,first_name,last_name,full_name,email,class,status")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) return fail("Could not verify the application.", 500);
    if (!application) return fail("Application not found.", 404);

    const { data: student, error: studentError } = await verification.adminClient
      .from("students")
      .select("student_id,first_name,last_name,email,class,status,portal_status")
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentError) return fail("Could not verify the student.", 500);
    if (!student) return fail("Student not found.", 404);

    const applicantEmail = norm(application.email);
    if (!applicantEmail || !isValidEmail(applicantEmail)) return fail("The application does not have a valid email.", 400);
    if (norm(student.email) !== applicantEmail) return fail("The student record does not match this application.", 409);

    const applicantName =
      clean(application.full_name) ||
      [clean(application.first_name), clean(application.last_name)].filter(Boolean).join(" ") ||
      [clean(student.first_name), clean(student.last_name)].filter(Boolean).join(" ") ||
      "Applicant";

    const email = buildAdmissionEmail({
      fullName: applicantName,
      className: clean(student.class) || clean(application.class),
      studentId: clean(student.student_id),
      loginUrl: `${siteUrl}/student-login.html`,
      temporaryPassword: clean(body?.temporary_password),
      expiresAt: clean(body?.temporary_password_expires_at),
    });

    const responseBody = await sendBrevoEmail({
      to: [{ name: applicantName, email: applicantEmail }],
      ...email,
      tags: ["admission", "application-approved", "portal-access"],
      headers: { "X-PACSA-Application-ID": applicationId },
    });

    return json({ ok: true, sent: true, type, provider: "brevo", message_id: responseBody?.messageId || null, recipient: applicantEmail });
  } catch (error) {
    console.error("smooth-api error:", error);
    return fail(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
