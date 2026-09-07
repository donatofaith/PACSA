const $ = id =>
    document.getElementById(id);


/* =========================================
   URL HELPERS
========================================= */

function getStudentLoginUrl() {

    return new URL(
        "student-login.html",
        window.location.href
    ).href;
}


function getStudentDashboardUrl() {

    return new URL(
        "student-dashboard.html",
        window.location.href
    ).href;
}


/* =========================================
   PASSWORD TOGGLE
========================================= */

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


/* =========================================
   LOGIN
========================================= */

$("studentLoginForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


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


            hideMessage();


            button.disabled =
                true;

            button.textContent =
                "Logging in...";


            try {

                /*
                    Sign in using Supabase Auth.
                */

                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .auth
                        .signInWithPassword({

                            email,

                            password
                        });


                if (error) {

                    throw error;
                }


                if (
                    !data.user
                ) {

                    throw new Error(
                        "Login failed."
                    );
                }


                /*
                    Ensure this Auth user is
                    linked to a PACSA student.
                */

                const {
                    data: student,
                    error: studentError
                } =
                    await supabaseClient
                        .from("students")
                        .select("*")
                        .eq(
                            "auth_user_id",
                            data.user.id
                        )
                        .maybeSingle();


                if (studentError) {

                    throw studentError;
                }


                if (!student) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This account is not linked to a PACSA student record."
                    );
                }


                if (
                    String(
                        student.status ||
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
                        "Your student record is inactive. Contact the school administrator."
                    );
                }


                /*
                    Once verified and logged in,
                    activate the student portal.
                */

                if (
                    student.portal_status ===
                    "pending_verification"
                ) {

                    const {
                        error: updateError
                    } =
                        await supabaseClient
                            .from("students")
                            .update({

                                portal_status:
                                    "active"

                            })
                            .eq(
                                "student_id",
                                student.student_id
                            );


                    if (updateError) {

                        console.error(
                            "Portal status update error:",
                            updateError
                        );
                    }


                    student.portal_status =
                        "active";
                }


                /*
                    Keep current dashboard compatibility.
                */

                localStorage.setItem(
                    "student",
                    JSON.stringify(
                        student
                    )
                );


                window.location.href =
                    getStudentDashboardUrl();


            } catch (error) {

                console.error(
                    "Student login error:",
                    error
                );


                showMessage(
                    getLoginErrorMessage(
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


/* =========================================
   FORGOT PASSWORD
========================================= */

$("forgotPasswordLink")
    ?.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            const email =
                $("email")
                    .value
                    .trim()
                    .toLowerCase();


            if (!email) {

                showMessage(
                    "Enter your email address first, then click Forgot Password."
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
                                    getStudentLoginUrl()

                            }
                        );


                if (error) {

                    throw error;
                }


                alert(
                    "Password reset email sent. Check your inbox."
                );


            } catch (error) {

                console.error(
                    "Password reset error:",
                    error
                );


                showMessage(
                    error?.message ||
                    "Could not send password reset email."
                );
            }
        }
    );


/* =========================================
   EXISTING AUTH SESSION
========================================= */

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
                data: student
            } =
                await supabaseClient
                    .from("students")
                    .select(
                        "student_id,status"
                    )
                    .eq(
                        "auth_user_id",
                        user.id
                    )
                    .maybeSingle();


            if (
                student &&
                String(
                    student.status ||
                    "active"
                )
                    .toLowerCase()
                ===
                "active"
            ) {

                window.location.href =
                    getStudentDashboardUrl();
            }

        } catch (error) {

            console.error(
                "Existing session check error:",
                error
            );
        }
    }
);


/* =========================================
   MESSAGE
========================================= */

function showMessage(text) {

    const message =
        $("loginMessage");


    message.textContent =
        text;


    message.className =
        "login-message error";
}


function hideMessage() {

    const message =
        $("loginMessage");


    message.textContent =
        "";


    message.className =
        "login-message";
}


/* =========================================
   FRIENDLY ERRORS
========================================= */

function getLoginErrorMessage(
    error
) {

    const text =
        String(
            error?.message || ""
        )
            .toLowerCase();


    if (
        text.includes(
            "email not confirmed"
        )
    ) {

        return "Verify your email before logging in.";
    }


    if (
        text.includes(
            "invalid login credentials"
        )
    ) {

        return "Invalid email or password.";
    }


    return (
        error?.message ||
        "Could not login."
    );
}