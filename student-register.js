const $ = id =>
    document.getElementById(id);


/* =========================================
   REDIRECT URL
========================================= */

function getStudentLoginUrl() {

    return new URL(
        "student-login.html",
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

            const input =
                $("password");

            if (
                input.type ===
                "password"
            ) {

                input.type =
                    "text";

                $("togglePassword")
                    .textContent =
                    "🙈";

            } else {

                input.type =
                    "password";

                $("togglePassword")
                    .textContent =
                    "👁";
            }
        }
    );


/* =========================================
   REGISTER
========================================= */

$("studentRegisterForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const studentId =
                $("studentId")
                    .value
                    .trim();


            const email =
                $("email")
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                $("password")
                    .value;


            const confirmPassword =
                $("confirmPassword")
                    .value;


            const button =
                $("registerBtn");


            clearMessage();


            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match.",
                    "error"
                );

                return;
            }


            if (
                password.length < 8
            ) {

                showMessage(
                    "Password must contain at least 8 characters.",
                    "error"
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Checking student...";


            try {

                /*
                    Verify that the Student ID exists
                    and the email matches the school record.
                */

                const {
                    data: student,
                    error: studentError
                } =
                    await supabaseClient
                        .from("students")
                        .select(`
                            student_id,
                            first_name,
                            last_name,
                            email,
                            status,
                            auth_user_id,
                            portal_status
                        `)
                        .eq(
                            "student_id",
                            studentId
                        )
                        .maybeSingle();


                if (studentError) {

                    throw studentError;
                }


                if (!student) {

                    showMessage(
                        "Student ID was not found. Contact the school administrator.",
                        "error"
                    );

                    return;
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

                    showMessage(
                        "This student record is currently inactive.",
                        "error"
                    );

                    return;
                }


                if (
                    !student.email ||
                    student.email
                        .trim()
                        .toLowerCase()
                    !== email
                ) {

                    showMessage(
                        "The email does not match the email registered for this Student ID.",
                        "error"
                    );

                    return;
                }


                if (
                    student.auth_user_id
                ) {

                    showMessage(
                        "This student account has already been activated. Please login instead.",
                        "error"
                    );

                    return;
                }


                button.textContent =
                    "Creating account...";


                const {
                    data: authData,
                    error: authError
                } =
                    await supabaseClient
                        .auth
                        .signUp({

                            email,

                            password,

                            options: {

                                emailRedirectTo:
                                    getStudentLoginUrl(),

                                data: {

                                    student_id:
                                        student.student_id,

                                    role:
                                        "student"
                                }
                            }
                        });


                if (authError) {

                    throw authError;
                }


                if (
                    !authData.user
                ) {

                    throw new Error(
                        "Could not create the student account."
                    );
                }


                /*
                    Link Supabase Auth account
                    to PACSA student record.
                */

                const {
                    error: linkError
                } =
                    await supabaseClient
                        .from("students")
                        .update({

                            auth_user_id:
                                authData.user.id,

                            portal_status:
                                "pending_verification"

                        })
                        .eq(
                            "student_id",
                            student.student_id
                        );


                if (linkError) {

                    throw linkError;
                }


                $("studentRegisterForm")
                    .reset();


                showMessage(
                    "Account created successfully. Check your email and click the verification link before logging in.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Student registration error:",
                    error
                );


                let message =
                    error?.message ||
                    "Could not activate account.";


                if (
                    message
                        .toLowerCase()
                        .includes(
                            "already registered"
                        )
                ) {

                    message =
                        "This email already has an account. Try logging in instead.";
                }


                showMessage(
                    message,
                    "error"
                );

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Activate Account";
            }
        }
    );


/* =========================================
   MESSAGES
========================================= */

function showMessage(
    text,
    type
) {

    const message =
        $("registerMessage");


    message.textContent =
        text;


    message.className =
        `message ${type}`;
}


function clearMessage() {

    const message =
        $("registerMessage");


    message.textContent =
        "";


    message.className =
        "message";
}