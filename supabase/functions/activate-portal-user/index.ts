import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = (Deno.env.get("PACSA_SITE_URL") || "https://pacsa.vercel.app").replace(/\/$/, "");
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);
const clean = (value: unknown) => String(value ?? "").trim();
const norm = (value: unknown) => clean(value).toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function getClients() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRoleKey || !anonKey) return null;

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const publicAuth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { admin, publicAuth };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  try {
    const clients = getClients();
    if (!clients) return fail("Server configuration is incomplete.", 500);

    const body = await req.json();
    const action = norm(body?.action || "check");
    const role = norm(body?.role);
    const recordId = clean(body?.record_id).toUpperCase();
    const email = norm(body?.email);

    if (!["student", "teacher"].includes(role)) return fail("Role must be student or teacher.");
    if (!recordId || !isEmail(email)) return fail("A valid PACSA ID and registered email are required.");

    const config = role === "student"
      ? {
          table: "students",
          idColumn: "student_id",
          idSelect: "student_id",
          metadataKey: "student_id",
          statusColumn: "status",
          loginPage: "student-login.html",
        }
      : {
          table: "Teachers",
          idColumn: "teacher_id",
          idSelect: "teacher_id",
          metadataKey: "teacher_id",
          statusColumn: null,
          loginPage: "teacher-login.html",
        };

    const selectColumns = [
      config.idSelect,
      "email",
      "portal_status",
      ...(config.statusColumn ? [config.statusColumn] : []),
    ].join(",");

    const { data: record, error: recordError } = await clients.admin
      .from(config.table)
      .select(selectColumns)
      .eq(config.idColumn, recordId)
      .maybeSingle();

    if (recordError) return fail("Could not verify this PACSA record.", 500);

    // Do not reveal whether an ID exists unless the registered email matches too.
    if (!record || norm(record.email) !== email) {
      return fail(`${role === "student" ? "Student" : "Teacher"} ID and registered email do not match.`, 404);
    }

    if (config.statusColumn && norm(record[config.statusColumn] || "active") !== "active") {
      return fail("This PACSA record is inactive.", 403);
    }

    const portalStatus = norm(record.portal_status || "not_activated");

    if (action === "check") {
      return json({
        ok: true,
        portal_status: portalStatus,
        record_id: clean(record[config.idSelect]),
      });
    }

    if (action !== "signup") return fail("Unknown activation action.");
    if (portalStatus === "active") return fail("This Portal account is already active. Please log in.", 409);

    const password = clean(body?.password);
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return fail("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.");
    }

    const siteUrl = allowedOrigin;
    const redirectTo = `${siteUrl}/${config.loginPage}`;

    const { data: signUpData, error: signUpError } = await clients.publicAuth.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          role,
          [config.metadataKey]: clean(record[config.idSelect]),
        },
      },
    });

    if (signUpError) return fail(signUpError.message || "Could not create Portal account.", 400);

    return json({
      ok: true,
      account_created: Boolean(signUpData?.user),
      email_verification_required: !signUpData?.session,
      message: signUpData?.session
        ? "Portal account created. You can now log in."
        : "Portal account created. Check your email and verify the account before logging in.",
    });
  } catch (error) {
    console.error("activate-portal-user:", error);
    return fail(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
