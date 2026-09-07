const $ = id => document.getElementById(id);


const norm = value =>
    String(value ?? "")
        .trim()
        .toLowerCase();


const dashboardUrl = () =>
    new URL(
        "student-dashboard.html",
        window.location.href
    ).href;


const resetUrl = () =>
    new URL(
        "student-reset-password.html",
        window.location.href
    ).href;


/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    text,
    type = "error"
) {

    const box =
        $("loginMessage");

    if (!box) return;

    box.textContent =
        text;

    box.className =
        `login-message ${type}`;
}


function clearMessage() {

    const box =
        $("loginMessage");

    if (!box) return;

    box.textContent = "";

    box.className =
        "login-message";
}


/* =====================================================
   PASSWORD
===================================================== */

$("togglePassword")
    ?.addEventListener(
        "click",
        () => {

            const input =
                $("password");

            if (!input) return;


            const hidden =
                input.type ===
                "password";


            input.type =
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


/* =====================================================
   LOGIN
===================================================== */

$("studentLoginForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();


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
                    "Enter your registered email and password."
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
                        "Student login failed."
                    );
                }


                /*
                    Secure authenticated RPC.

                    Student gets only their own record.
                */

                const {
                    data: studentRows,
                    error: studentError
                } =
                    await supabaseClient
                        .rpc(
                            "pacsa_get_my_student"
                        );


                if (studentError)
                    throw studentError;


                const student =
                    Array.isArray(
                        studentRows
                    )
                        ? studentRows[0]
                        : studentRows;


                if (!student) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This account is not linked to a PACSA student."
                    );
                }


                if (
                    norm(
                        student.email
                    )
                    !==
                    norm(email)
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This email does not match the student record."
                    );
                }


                if (
                    norm(
                        student.status ||
                        "active"
                    )
                    !== "active"
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "Your student record is inactive."
                    );
                }


                if (
                    norm(
                        student.portal_status
                    )
                    !== "active"
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "Verify your email before logging in."
                    );
                }


                localStorage.setItem(
                    "student",
                    JSON.stringify(
                        student
                    )
                );


                window.location.replace(
                    dashboardUrl()
                );


            } catch (error) {

                console.error(
                    "Student login:",
                    error
                );


                const text =
                    norm(
                        error?.message
                    );


                if (
                    text.includes(
                        "invalid login credentials"
                    )
                ) {

                    showMessage(
                        "Invalid email or password."
                    );


                } else if (
                    text.includes(
                        "email not confirmed"
                    )
                ) {

                    showMessage(
                        "Verify your email before logging in."
                    );


                } else {

                    showMessage(
                        error?.message ||
                        "Could not login."
                    );
                }


            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Login";
            }
        }
    );


/* =====================================================
   FORGOT PASSWORD
===================================================== */

$("forgotPasswordLink")
    ?.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            clearMessage();


            const email =
                $("email")
                    .value
                    .trim()
                    .toLowerCase();


            if (!email) {

                showMessage(
                    "Enter your registered email first."
                );

                return;
            }


            try {

                /*
                    Safe anonymous RPC.
                    Returns only true/false.
                */

                const {
                    data: canReset,
                    error: checkError
                } =
                    await supabaseClient
                        .rpc(
                            "pacsa_student_reset_check",
                            {
                                p_email:
                                    email
                            }
                        );


                if (checkError)
                    throw checkError;


                if (!canReset) {

                    showMessage(
                        "An active Student Portal account was not found for this email."
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
                                    resetUrl()
                            }
                        );


                if (error)
                    throw error;


                showMessage(
                    "Password reset link sent. Check your email.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Student password reset:",
                    error
                );


                showMessage(
                    error?.message ||
                    "Could not send password reset email."
                );
            }
        }
    );