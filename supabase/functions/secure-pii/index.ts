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

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function getEncryptionKey() {
  const raw = clean(Deno.env.get("PACSA_PII_ENCRYPTION_KEY"));
  if (!raw) throw new Error("PACSA PII encryption key is not configured.");
  const keyBytes = decodeBase64(raw);
  if (keyBytes.length !== 32) throw new Error("PACSA PII encryption key must decode to exactly 32 bytes.");
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptNin(nin: string) {
  if (!/^\d{11}$/.test(nin)) throw new Error("NIN must be exactly 11 digits.");
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(nin);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return {
    encrypted: `v1.${encodeBase64(iv)}.${encodeBase64(encrypted)}`,
    last4: nin.slice(-4),
  };
}

function isAtLeastNineYearsOld(dateString: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const birthDate = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
  return age >= 9;
}

function serverClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("Server configuration is incomplete.");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin(req: Request, adminClient: ReturnType<typeof createClient>) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false as const, response: fail("Authentication is required.", 401) };
  const { data: caller, error: callerError } = await adminClient.auth.getUser(token);
  if (callerError || !caller?.user) return { ok: false as const, response: fail("Invalid or expired Admin session.", 401) };
  const { data: admin, error: adminError } = await adminClient
    .from("admins")
    .select("id,status,role,auth_user_id")
    .eq("auth_user_id", caller.user.id)
    .maybeSingle();
  if (adminError) return { ok: false as const, response: fail("Could not verify Admin access.", 500) };
  if (!admin || norm(admin.status || "active") !== "active" || !["admin", "super_admin"].includes(norm(admin.role || "admin"))) {
    return { ok: false as const, response: fail("Active Admin access is required.", 403) };
  }
  return { ok: true as const, user: caller.user, admin };
}

async function submitApplication(body: any, adminClient: ReturnType<typeof createClient>) {
  const app = body?.application || body || {};
  const firstName = clean(app.first_name);
  const lastName = clean(app.last_name);
  const fullName = clean(app.full_name) || [firstName, lastName].filter(Boolean).join(" ");
  const dateOfBirth = clean(app.date_of_birth);
  const email = norm(app.email);
  const nin = clean(app.nin).replace(/\D/g, "");

  if (!firstName || !lastName || !fullName) return fail("First name and last name are required.");
  if (!isAtLeastNineYearsOld(dateOfBirth)) return fail("Applicant must be at least 9 years old.");
  if (!isEmail(email)) return fail("A valid email address is required.");
  if (!/^\d{11}$/.test(nin)) return fail("NIN must be exactly 11 digits.");

  const protectedNin = await encryptNin(nin);
  const payload = {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    date_of_birth: dateOfBirth,
    gender: clean(app.gender),
    class: clean(app.class),
    parent_name: clean(app.parent_name),
    phone: clean(app.phone),
    email,
    address: clean(app.address),
    previous_school: clean(app.previous_school),
    additional_information: clean(app.additional_information),
    status: "pending",
    nin: null,
    nin_encrypted: protectedNin.encrypted,
    nin_last4: protectedNin.last4,
  };

  const { data, error } = await adminClient
    .from("applications")
    .insert(payload)
    .select("id,first_name,last_name,full_name,email,class,parent_name,phone,status,created_at,nin_last4")
    .single();

  if (error) return fail(error.message || "Could not submit application.", 400);
  return json({ ok: true, application: data });
}

async function saveStudentNin(req: Request, body: any, adminClient: ReturnType<typeof createClient>) {
  const auth = await requireAdmin(req, adminClient);
  if (!auth.ok) return auth.response;
  const studentId = clean(body?.student_id);
  const nin = clean(body?.nin).replace(/\D/g, "");
  if (!studentId) return fail("Student ID is required.");
  if (!/^\d{11}$/.test(nin)) return fail("NIN must be exactly 11 digits.");

  const protectedNin = await encryptNin(nin);
  const { error } = await adminClient
    .from("students")
    .update({ nin: null, nin_encrypted: protectedNin.encrypted, nin_last4: protectedNin.last4 })
    .eq("student_id", studentId);

  if (error) return fail(error.message || "Could not protect student NIN.", 400);
  return json({ ok: true, nin_last4: protectedNin.last4 });
}

async function migrateLegacyNin(req: Request, adminClient: ReturnType<typeof createClient>) {
  const auth = await requireAdmin(req, adminClient);
  if (!auth.ok) return auth.response;

  let applicationsMigrated = 0;
  let studentsMigrated = 0;

  const { data: apps, error: appsError } = await adminClient
    .from("applications")
    .select("id,nin")
    .not("nin", "is", null)
    .neq("nin", "")
    .limit(500);
  if (appsError) return fail(appsError.message || "Could not load legacy application NIN values.", 500);

  for (const row of apps || []) {
    const nin = clean(row.nin).replace(/\D/g, "");
    if (!/^\d{11}$/.test(nin)) continue;
    const protectedNin = await encryptNin(nin);
    const { error } = await adminClient
      .from("applications")
      .update({ nin: null, nin_encrypted: protectedNin.encrypted, nin_last4: protectedNin.last4 })
      .eq("id", row.id);
    if (!error) applicationsMigrated++;
  }

  const { data: students, error: studentsError } = await adminClient
    .from("students")
    .select("student_id,nin")
    .not("nin", "is", null)
    .neq("nin", "")
    .limit(500);
  if (studentsError) return fail(studentsError.message || "Could not load legacy student NIN values.", 500);

  for (const row of students || []) {
    const nin = clean(row.nin).replace(/\D/g, "");
    if (!/^\d{11}$/.test(nin)) continue;
    const protectedNin = await encryptNin(nin);
    const { error } = await adminClient
      .from("students")
      .update({ nin: null, nin_encrypted: protectedNin.encrypted, nin_last4: protectedNin.last4 })
      .eq("student_id", row.student_id);
    if (!error) studentsMigrated++;
  }

  return json({ ok: true, applications_migrated: applicationsMigrated, students_migrated: studentsMigrated });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  try {
    const body = await req.json();
    const action = norm(body?.action || "submit_application");
    const adminClient = serverClient();

    if (action === "submit_application") return await submitApplication(body, adminClient);
    if (action === "save_student_nin") return await saveStudentNin(req, body, adminClient);
    if (action === "migrate_legacy_nin") return await migrateLegacyNin(req, adminClient);
    return fail("Unknown secure PII action.", 400);
  } catch (error) {
    console.error("secure-pii:", error);
    return fail(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
