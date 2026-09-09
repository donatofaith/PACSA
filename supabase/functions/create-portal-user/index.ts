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

const fail = (message: string, status = 200) =>
  json({ ok: false, error: message, status }, 200);

const norm = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const makeTemporaryPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("") + "9a!";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("Method not allowed.", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return fail("Server configuration is incomplete.", 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return fail("Authentication is required.", 401);
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: callerData,
      error: callerError,
    } = await adminClient.auth.getUser(token);

    if (callerError || !callerData?.user) {
      return fail("Invalid or expired Admin session.", 401);
    }

    const caller = callerData.user;

    const {
      data: admin,
      error: adminError,
    } = await adminClient
      .from("admins")
      .select("id, status, auth_user_id")
      .eq("auth_user_id", caller.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin lookup failed:", adminError);
      return fail("Could not verify Admin access.", 500);
    }

    if (!admin || norm(admin.status || "active") !== "active") {
      return fail("Admin access is required.", 403);
    }

    const body = await req.json();

    const role = norm(body?.role);
    const recordId = String(body?.record_id ?? "").trim();
    const email = norm(body?.email);

    if (!["student", "teacher"].includes(role)) {
      return fail("Role must be student or teacher.", 400);
    }

    if (!recordId || !email) {
      return fail("Record ID and email are required.", 400);
    }

    const config = role === "student"
      ? {
          table: "students",
          idColumn: "student_id",
          metadataKey: "student_id",
          redirectPage: "student-reset-password.html",
          profileSelect: "student_id, email, auth_user_id, portal_status, status",
          refreshedSelect: "student_id, auth_user_id, portal_status",
          hasStatusColumn: true,
        }
      : {
          table: "Teachers",
          idColumn: "teacher_id",
          metadataKey: "teacher_id",
          redirectPage: "reset-password.html",
          profileSelect: "teacher_id, email, auth_user_id, portal_status",
          refreshedSelect: "teacher_id, auth_user_id, portal_status",
          hasStatusColumn: false,
        };

    const {
      data: record,
      error: recordError,
    } = await adminClient
      .from(config.table)
      .select(config.profileSelect)
      .eq(config.idColumn, recordId)
      .maybeSingle();

    if (recordError) {
      console.error("Profile lookup failed:", recordError);
      return fail(
        `Could not load the ${role} record. ${recordError.message || ""}`.trim(),
        500,
      );
    }

    if (!record) {
      return fail(`No ${role} record matches that ID.`, 404);
    }

    if (norm(record.email) !== email) {
      return fail(`The email does not match the ${role} record. Update the profile first.`, 400);
    }

    if (config.hasStatusColumn && norm(record.status || "active") !== "active") {
      return fail(`This ${role} record is inactive.`, 400);
    }

    if (norm(record.portal_status || "active") === "inactive") {
      return fail(`This ${role} portal account is inactive.`, 400);
    }

    const siteUrl = (
      Deno.env.get("PACSA_SITE_URL") ||
      "https://pacsa.vercel.app"
    ).replace(/\/$/, "");

    const loginPage = role === "student"
      ? "student-login.html"
      : "teacher-login.html";

    const redirectTo = `${siteUrl}/${config.redirectPage}`;
    const loginUrl = `${siteUrl}/${loginPage}`;

    if (record.auth_user_id) {
      const temporaryPassword = makeTemporaryPassword();

      const { error: resetError } = await adminClient.auth.admin.updateUserById(
        record.auth_user_id,
        {
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            role,
            [config.metadataKey]: recordId,
            provisioned_by_admin: true,
            temporary_password_reset: true,
          },
        },
      );

      if (resetError) {
        console.error("Temporary password reset failed:", resetError);
        return fail(resetError.message || "Could not reset Portal password.", 400);
      }

      return json({
        ok: true,
        already_linked: true,
        temporary_password_created: true,
        password_reset: true,
        temporary_password: temporaryPassword,
        login_url: loginUrl,
        auth_user_id: record.auth_user_id,
        portal_status: record.portal_status || null,
        message:
          `A new temporary password was created for this ${role}.\n\n${role.toUpperCase()} EMAIL: ${email}\nTEMPORARY PASSWORD: ${temporaryPassword}\nLOGIN: ${loginUrl}\n\nGive this password to the ${role} securely, then have them log in and change it.`,
      });
    }

    const {
      data: inviteData,
      error: inviteError,
    } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          role,
          [config.metadataKey]: recordId,
          provisioned_by_admin: true,
        },
      },
    );

    if (!inviteError) {
      const {
        data: refreshed,
      } = await adminClient
        .from(config.table)
        .select(config.refreshedSelect)
        .eq(config.idColumn, recordId)
        .maybeSingle();

      return json({
        ok: true,
        invited: true,
        auth_user_id: inviteData?.user?.id || null,
        linked: Boolean(refreshed?.auth_user_id),
        portal_status: refreshed?.portal_status || null,
        login_url: loginUrl,
        message:
          `Portal invitation sent to ${email}. The ${role} should use the email link to set a password.`,
      });
    }

    const inviteMessage = norm(inviteError.message);

    if (
      inviteMessage.includes("already") ||
      inviteMessage.includes("registered") ||
      inviteMessage.includes("exists")
    ) {
      return fail(
        "An Auth account already exists for this email but the PACSA profile is not linked. Review this account in Supabase Auth, or use the student's/teacher's activation flow to link it.",
        409,
      );
    }

    console.error("Invite email failed, creating temporary password account instead:", inviteError);

    const temporaryPassword = makeTemporaryPassword();

    const {
      data: createdData,
      error: createError,
    } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        role,
        [config.metadataKey]: recordId,
        provisioned_by_admin: true,
        temporary_password: true,
      },
    });

    if (createError) {
      const createMessage = norm(createError.message);

      if (
        createMessage.includes("already") ||
        createMessage.includes("registered") ||
        createMessage.includes("exists")
      ) {
        return fail(
          "An Auth account already exists for this email but the PACSA profile is not linked. Review this account in Supabase Auth, or use the student's/teacher's activation flow to link it.",
          409,
        );
      }

      console.error("Temporary account creation failed:", createError);
      return fail(createError.message || "Could not create Portal access.", 400);
    }

    const {
      data: refreshed,
    } = await adminClient
      .from(config.table)
      .select(config.refreshedSelect)
      .eq(config.idColumn, recordId)
      .maybeSingle();

    return json({
      ok: true,
      invited: false,
      temporary_password_created: true,
      auth_user_id: createdData?.user?.id || null,
      linked: Boolean(refreshed?.auth_user_id),
      portal_status: refreshed?.portal_status || null,
      temporary_password: temporaryPassword,
      login_url: loginUrl,
      message:
        `Email invitation could not be sent, so Portal access was created with a temporary password.\n\n${role.toUpperCase()} EMAIL: ${email}\nTEMPORARY PASSWORD: ${temporaryPassword}\nLOGIN: ${loginUrl}\n\nGive this password to the ${role} securely, then have them log in and change it.`,
    });
  } catch (error) {
    console.error("create-portal-user error:", error);

    return fail(
      error instanceof Error
        ? error.message
        : "Unexpected server error.",
      500,
    );
  }
});
