const $ = id => document.getElementById(id);
const norm = value => String(value ?? "").trim().toLowerCase();

const teacherDashboardUrl = () => new URL("teacher-dashboard.html", window.location.href).href;
const adminDashboardUrl = () => new URL("admin-dashboard.html", window.location.href).href;
const resetUrl = () => new URL("reset-password.html", window.location.href).href;
const ADMIN_SESSION_KEY = "pacsa_admin_login_verified";

function showMessage(text, type = "error") {
    const box = $("loginMessage");
    if (!box) return;
    box.textContent = text;
    box.className = `login-message ${type}`;
}
function clearMessage() {
    const box = $("loginMessage");
    if (!box) return;
    box.textContent = "";
    box.className = "login-message";
}

$("togglePassword")?.addEventListener("click", () => {
    const input = $("password");
    if (!input) return;
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    $("togglePassword").textContent = hidden ? "🙈" : "👁";
});

$("teacherLoginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();

    const teacherId = $("teacherId").value.trim().toUpperCase();
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    const button = $("loginBtn");

    if (!email || !password) {
        showMessage("Enter your email and password.");
        return;
    }

    button.disabled = true;
    button.textContent = "Logging in...";

    try {
        const { data: authData, error: authError } =
            await supabaseClient.auth.signInWithPassword({ email, password });

        if (authError) throw authError;
        if (!authData?.user) throw new Error("Login failed.");

        /*
         * ONE STAFF LOGIN:
         * Admin identity is determined server-side from the authenticated
         * Supabase user. The browser never decides who is an Admin.
         */
        let adminRole = null;
        try {
            const { data: role, error: roleError } =
                await supabaseClient.rpc("pacsa_get_my_admin_role");
            if (roleError) throw roleError;
            adminRole = norm(role);
        } catch (roleError) {
            console.error("Staff role verification failed:", roleError);
            await supabaseClient.auth.signOut();
            throw new Error("Could not securely verify your PACSA role. Please try again.");
        }

        if (adminRole === "admin" || adminRole === "super_admin") {
            const { data: adminRows, error: adminError } =
                await supabaseClient.rpc("pacsa_get_my_admin");

            if (adminError) throw adminError;

            const admin = Array.isArray(adminRows) ? adminRows[0] : adminRows;

            if (!admin || norm(admin.status || "active") !== "active") {
                await supabaseClient.auth.signOut();
                throw new Error("This Admin account is inactive.");
            }

            sessionStorage.setItem(
                ADMIN_SESSION_KEY,
                JSON.stringify({
                    userId: authData.user.id,
                    verifiedAt: Date.now()
                })
            );

            window.location.replace(adminDashboardUrl());
            return;
        }

        /*
         * Not an Admin: now require the Teacher identity fields and
         * resolve the authenticated user to exactly one PACSA Teacher.
         */
        if (!teacherId) {
            await supabaseClient.auth.signOut();
            throw new Error("Enter your Teacher ID to access the Teacher Portal.");
        }

        const { data: teacherRows, error: teacherError } =
            await supabaseClient.rpc("pacsa_get_my_teacher");

        if (teacherError) throw teacherError;

        const teacher = Array.isArray(teacherRows) ? teacherRows[0] : teacherRows;

        if (!teacher) {
            await supabaseClient.auth.signOut();
            throw new Error("This account is not linked to a PACSA teacher.");
        }

        if (
            String(teacher.teacher_id).trim().toUpperCase() !== teacherId
        ) {
            await supabaseClient.auth.signOut();
            throw new Error("Teacher ID does not match this account.");
        }

        if (norm(teacher.email) !== norm(email)) {
            await supabaseClient.auth.signOut();
            throw new Error("Registered email does not match this Teacher ID.");
        }

        if (norm(teacher.portal_status) !== "active") {
            await supabaseClient.auth.signOut();
            throw new Error("Verify your email before logging in.");
        }

        const [subjectResponse, classResponse] = await Promise.all([
            supabaseClient.from("teacher_assignments").select("*"),
            supabaseClient.from("class_teacher_assignments").select("*")
        ]);

        if (subjectResponse.error) throw subjectResponse.error;
        if (classResponse.error) throw classResponse.error;

        const assignments = subjectResponse.data || [];
        const classAssignments = classResponse.data || [];

        if (!assignments.length && !classAssignments.length) {
            await supabaseClient.auth.signOut();
            throw new Error("No teaching responsibility has been assigned to this teacher.");
        }

        window.location.replace(teacherDashboardUrl());

    } catch (error) {
        console.error("Staff login:", error);
        const text = norm(error?.message);

        if (text.includes("invalid login credentials")) {
            showMessage("Incorrect email or password.");
        } else if (text.includes("email not confirmed")) {
            showMessage("Verify your email before logging in.");
        } else {
            showMessage(error?.message || "Could not login to the Staff Portal.");
        }
    } finally {
        button.disabled = false;
        button.textContent = "Login";
    }
});

$("forgotPasswordLink")?.addEventListener("click", async event => {
    event.preventDefault();
    clearMessage();

    const email = $("email").value.trim().toLowerCase();
    if (!email) {
        showMessage("Enter your registered email first.");
        return;
    }

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl()
        });
        if (error) throw error;

        showMessage(
            "If this email belongs to a PACSA account, a password reset email will be sent.",
            "success"
        );
    } catch (error) {
        console.error("Password reset:", error);
        showMessage(error?.message || "Could not send password reset email.");
    }
});