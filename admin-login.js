const $ = id =>
    document.getElementById(id);


function getAdminDashboardUrl() {

    return new URL(
        "admin-dashboard.html",
        window.location.href
    ).href;
}


function getAdminLoginUrl() {

    return new URL(
        "admin-login.html",
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


            if (
                password.type ===
                "password"
            ) {

                password.type =
                    "text";

                $("togglePassword")
                    .textContent =
                    "🙈";

            } else {

                password.type =
                    "password";

                $("togglePassword")
                    .textContent =
                    "👁";
            }
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
                $("password")
                    .value;


            const button =
                $("loginBtn");


            button.disabled =
                true;


            button.textContent =
                "Logging in...";


            try {

                /*
                    1. Login through Supabase Auth
                */

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


                if (
                    authError
                ) {

                    throw authError;
                }


                const user =
                    authData?.user;


                if (!user) {

                    throw new Error(
                        "Admin login failed."
                    );
                }


                /*
                    2. Confirm this Auth user
                       is actually an Admin.
                */

                const {
                    data: admin,
                    error: adminError
                } =
                    await supabaseClient
                        .from("admins")
                        .select("*")
                        .eq(
                            "auth_user_id",
                            user.id
                        )
                        .maybeSingle();


                if (
                    adminError
                ) {

                    throw adminError;
                }


                if (!admin) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This account does not have Admin access."
                    );
                }


                if (
                    String(
                        admin.status ||
                        "active"
                    )
                        .trim()
                        .toLowerCase()
                    !==
                    "active"
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This Admin account is inactive."
                    );
                }


                /*
                    Compatibility only.
                    Security comes from Supabase Auth,
                    not localStorage.
                */

                localStorage.setItem(
                    "admin",
                    JSON.stringify(
                        admin
                    )
                );


                window.location.href =
                    getAdminDashboardUrl();


            } catch (error) {

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

                /*
                    Only send reset if this
                    email belongs to an Admin.
                */

                const {
                    data: admin,
                    error: adminError
                } =
                    await supabaseClient
                        .from("admins")
                        .select("email")
                        .eq(
                            "email",
                            email
                        )
                        .maybeSingle();


                if (
                    adminError
                ) {

                    throw adminError;
                }


                if (!admin) {

                    showMessage(
                        "Admin account was not found."
                    );

                    return;
                }


                const {
                    error
                } =
                    await supabaseClient
                        .auth
                        .resetPasswordForEmail(
                            email,
                            {

                                redirectTo:
                                    getAdminLoginUrl()

                            }
                        );


                if (error) {

                    throw error;
                }


                showSuccess(
                    "Password reset email sent."
                );


            } catch (error) {

                console.error(
                    "Admin password reset error:",
                    error
                );


                showMessage(
                    error?.message ||
                    "Could not send reset email."
                );
            }
        }
    );


/* ========================================
   EXISTING ADMIN SESSION
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            const {
                data
            } =
                await supabaseClient
                    .auth
                    .getSession();


            const user =
                data?.session?.user;


            if (!user) {

                return;
            }


            const {
                data: admin
            } =
                await supabaseClient
                    .from("admins")
                    .select(
                        "id,status"
                    )
                    .eq(
                        "auth_user_id",
                        user.id
                    )
                    .maybeSingle();


            if (
                admin &&
                String(
                    admin.status ||
                    "active"
                )
                    .trim()
                    .toLowerCase()
                ===
                "active"
            ) {

                window.location.href =
                    getAdminDashboardUrl();
            }


        } catch (error) {

            console.error(
                "Admin session check error:",
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

    $("loginMessage")
        .textContent =
        text;


    $("loginMessage")
        .className =
        "login-message error";
}


function showSuccess(
    text
) {

    $("loginMessage")
        .textContent =
        text;


    $("loginMessage")
        .className =
        "login-message success";
}


function hideMessage() {

    $("loginMessage")
        .textContent =
        "";


    $("loginMessage")
        .className =
        "login-message";
}


function friendlyError(
    error
) {

    const text =
        String(
            error?.message ||
            ""
        )
            .toLowerCase();


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