const $ = id =>
    document.getElementById(id);


const norm = value =>
    String(value ?? "")
        .trim()
        .toLowerCase();


const PACSA_ADMIN_SESSION_KEY =
    "pacsa_admin_login_verified";


function getAdminDashboardUrl() {

    return new URL(
        "admin-dashboard.html",
        window.location.href
    ).href;
}


function getAdminResetUrl() {

    return new URL(
        "admin-reset-password.html",
        window.location.href
    ).href;
}


/* ========================================
   PASSWORD TOGGLE
======================================== */

$("togglePassword")
    ?.addEventListener(
        "click",
        () => {

            const password =
                $("password");


            const hidden =
                password.type ===
                "password";


            password.type =
                hidden
                    ? "text"
                    : "password";


            $("togglePassword")
                .textContent =
                hidden
                    ? "🙈"
                    : "👁";
        }
    );


/* ========================================
   ADMIN LOGIN
======================================== */

$("loginForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            hideMessage();


            const email =
                $("email")
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                $("password").value;


            const button =
                $("loginBtn");


            if (
                !email ||
                !password
            ) {

                showMessage(
                    "Enter your Admin email and password."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Logging in...";


            try {

                const {
                    data: authData,
                    error: authError
                } =
                    await supabaseClient
                        .auth
                        .signInWithPassword({
                            email,
                            password
                        });


                if (authError)
                    throw authError;


                if (!authData?.user) {

                    throw new Error(
                        "Admin login failed."
                    );
                }


                const {
                    data: adminRows,
                    error: adminError
                } =
                    await supabaseClient
                        .rpc(
                            "pacsa_get_my_admin"
                        );


                if (adminError)
                    throw adminError;


                const admin =
                    Array.isArray(
                        adminRows
                    )
                        ? adminRows[0]
                        : adminRows;


                if (!admin) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This account does not have Admin access."
                    );
                }


                if (
                    norm(
                        admin.status ||
                        "active"
                    )
                    !== "active"
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This Admin account is inactive."
                    );
                }


                /*
                    Require an explicit Admin login in this
                    browser tab/session. Supabase may remember
                    an Auth session, but that alone must not
                    silently reopen the Admin portal.
                */

                sessionStorage.setItem(
                    PACSA_ADMIN_SESSION_KEY,
                    JSON.stringify({
                        userId:
                            authData.user.id,
                        verifiedAt:
                            Date.now()
                    })
                );


                localStorage.setItem(
                    "admin",
                    JSON.stringify(
                        admin
                    )
                );


                window.location.replace(
                    getAdminDashboardUrl()
                );


            } catch (error) {

                sessionStorage.removeItem(
                    PACSA_ADMIN_SESSION_KEY
                );


                console.error(
                    "Admin login error:",
                    error
                );


                showMessage(
                    friendlyError(
                        error
                    )
                );


            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Login";
            }
        }
    );


/* ========================================
   FORGOT PASSWORD
======================================== */

$("forgotPasswordLink")
    ?.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            hideMessage();


            const email =
                $("email")
                    .value
                    .trim()
                    .toLowerCase();


            if (!email) {

                showMessage(
                    "Enter your Admin email first."
                );

                return;
            }


            try {

                const {
                    error
                } =
                    await supabaseClient
                        .auth
                        .resetPasswordForEmail(
                            email,
                            {
                                redirectTo:
                                    getAdminResetUrl()
                            }
                        );


                if (error)
                    throw error;


                showSuccess(
                    "If this email belongs to an Admin account, a password reset email will be sent."
                );


            } catch (error) {

                console.error(
                    "Admin password reset error:",
                    error
                );


                showMessage(
                    error?.message ||
                    "Could not send password reset email."
                );
            }
        }
    );


/* ========================================
   REQUIRE FRESH LOGIN ON LOGIN PAGE
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        sessionStorage.removeItem(
            PACSA_ADMIN_SESSION_KEY
        );

        localStorage.removeItem(
            "admin"
        );


        try {

            const {
                data
            } =
                await supabaseClient
                    .auth
                    .getSession();


            if (
                data?.session
            ) {

                await supabaseClient
                    .auth
                    .signOut();
            }


        } catch (error) {

            console.error(
                "Admin stale-session cleanup:",
                error
            );
        }
    }
);


/* ========================================
   MESSAGES
======================================== */

function showMessage(
    text
) {

    const box =
        $("loginMessage");


    if (!box)
        return;


    box.textContent =
        text;


    box.className =
        "login-message error";
}


function showSuccess(
    text
) {

    const box =
        $("loginMessage");


    if (!box)
        return;


    box.textContent =
        text;


    box.className =
        "login-message success";
}


function hideMessage() {

    const box =
        $("loginMessage");


    if (!box)
        return;


    box.textContent =
        "";


    box.className =
        "login-message";
}


/* ========================================
   FRIENDLY ERRORS
======================================== */

function friendlyError(
    error
) {

    const text =
        norm(
            error?.message
        );


    if (
        text.includes(
            "invalid login credentials"
        )
    ) {

        return "Invalid Admin email or password.";
    }


    if (
        text.includes(
            "email not confirmed"
        )
    ) {

        return "Verify the Admin email before logging in.";
    }


    return (
        error?.message ||
        "Could not login to the Admin Portal."
    );
}