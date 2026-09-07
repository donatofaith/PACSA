const $ = id =>
    document.getElementById(id);


/* =========================================
   STATE
========================================= */

let pendingTeacherEmail = "";


/* =========================================
   HELPERS
========================================= */

function normalize(value) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();
}


function getTeacherLoginUrl() {

    return new URL(
        "teacher-login.html",
        window.location.href
    ).href;
}


/* =========================================
   PASSWORD TOGGLES
========================================= */

function setupPasswordToggle(
    inputId,
    buttonId
) {

    const input =
        $(inputId);


    const button =
        $(buttonId);


    if (
        !input ||
        !button
    ) {

        return;
    }


    button.addEventListener(
        "click",
        () => {

            if (
                input.type ===
                "password"
            ) {

                input.type =
                    "text";


                button.textContent =
                    "🙈";


                button.setAttribute(
                    "aria-label",
                    "Hide password"
                );


            } else {

                input.type =
                    "password";


                button.textContent =
                    "👁";


                button.setAttribute(
                    "aria-label",
                    "Show password"
                );
            }
        }
    );
}


setupPasswordToggle(
    "password",
    "togglePassword"
);


setupPasswordToggle(
    "confirmPassword",
    "toggleConfirmPassword"
);


/* =========================================
   MESSAGES
========================================= */

function showMessage(
    text,
    type = "error"
) {

    const message =
        $("registerMessage");


    if (!message) {

        return;
    }


    message.textContent =
        text;


    message.className =
        `message ${type}`;
}


function clearMessage() {

    const message =
        $("registerMessage");


    if (!message) {

        return;
    }


    message.textContent =
        "";


    message.className =
        "message";
}


/* =========================================
   RESEND BUTTON
========================================= */

function showResendButton() {

    const button =
        $("resendVerificationBtn");


    if (button) {

        button.style.display =
            "block";
    }
}


function hideResendButton() {

    const button =
        $("resendVerificationBtn");


    if (button) {

        button.style.display =
            "none";
    }
}


/* =========================================
   FIND TEACHER
========================================= */

async function findTeacher(
    teacherId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("Teachers")
            .select(`
                teacher_id,
                email,
                auth_user_id,
                portal_status
            `)
            .eq(
                "teacher_id",
                teacherId
            )
            .maybeSingle();


    if (error) {

        throw error;
    }


    return data;
}


/* =========================================
   RESEND VERIFICATION EMAIL
========================================= */

async function resendVerificationEmail() {

    if (
        !pendingTeacherEmail
    ) {

        showMessage(
            "Enter your Teacher ID and registered email first.",
            "error"
        );


        return;
    }


    const button =
        $("resendVerificationBtn");


    if (button) {

        button.disabled =
            true;


        button.textContent =
            "Sending...";
    }


    try {

        const {
            error
        } =
            await supabaseClient
                .auth
                .resend({

                    type:
                        "signup",

                    email:
                        pendingTeacherEmail,

                    options: {

                        emailRedirectTo:
                            getTeacherLoginUrl()

                    }

                });


        if (error) {

            throw error;
        }


        showMessage(
            "Verification email sent. Check your inbox and spam folder.",
            "success"
        );


    } catch (error) {

        console.error(
            "Verification resend error:",
            error
        );


        const text =
            normalize(
                error?.message
            );


        if (
            text.includes(
                "rate"
            )
        ) {

            showMessage(
                "Please wait before requesting another verification email.",
                "error"
            );


        } else {

            showMessage(
                error?.message ||
                "Could not resend verification email.",
                "error"
            );
        }


    } finally {

        if (button) {

            button.disabled =
                false;


            button.textContent =
                "Resend Verification Email";
        }
    }
}


/* =========================================
   RESEND EVENT
========================================= */

$("resendVerificationBtn")
    ?.addEventListener(
        "click",
        resendVerificationEmail
    );


/* =========================================
   ACTIVATION FORM
========================================= */

$("teacherRegisterForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            clearMessage();


            hideResendButton();


            const teacherId =
                $("teacherId")
                    .value
                    .trim()
                    .toUpperCase();


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


            /* =====================================
               VALIDATION
            ===================================== */

            if (
                !teacherId ||
                !email
            ) {

                showMessage(
                    "Enter your Teacher ID and registered email.",
                    "error"
                );


                return;
            }


            if (
                !password ||
                !confirmPassword
            ) {

                showMessage(
                    "Enter and confirm your password.",
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


            button.disabled =
                true;


            button.textContent =
                "Checking teacher...";


            try {

                /* =====================================
                   STEP 1
                   FIND TEACHER CREATED BY ADMIN
                ===================================== */

                const teacher =
                    await findTeacher(
                        teacherId
                    );


                if (!teacher) {

                    showMessage(
                        "Teacher ID was not found. Contact the administrator.",
                        "error"
                    );


                    return;
                }


                /* =====================================
                   STEP 2
                   VERIFY EMAIL
                ===================================== */

                if (
                    !teacher.email ||

                    normalize(
                        teacher.email
                    )
                    !==
                    normalize(
                        email
                    )
                ) {

                    showMessage(
                        "The email does not match the email registered for this Teacher ID.",
                        "error"
                    );


                    return;
                }


                pendingTeacherEmail =
                    email;


                const status =
                    normalize(
                        teacher.portal_status
                    );


                /* =====================================
                   STEP 3
                   ACCOUNT ALREADY ACTIVE
                ===================================== */

                if (
                    status ===
                    "active"
                ) {

                    showMessage(
                        "Your teacher account is already active. Please proceed to login.",
                        "success"
                    );


                    return;
                }


                /* =====================================
                   STEP 4
                   WAITING FOR EMAIL VERIFICATION
                ===================================== */

                if (
                    status ===
                    "pending_verification"
                ) {

                    showMessage(
                        "Your account has already been created and is waiting for email verification. Check your inbox or resend the verification email.",
                        "error"
                    );


                    showResendButton();


                    return;
                }


                /* =====================================
                   STEP 5
                   FIRST-TIME ACTIVATION
                ===================================== */

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
                                    getTeacherLoginUrl(),

                                data: {

                                    teacher_id:
                                        teacher.teacher_id,

                                    role:
                                        "teacher"

                                }
                            }
                        });


                if (authError) {

                    throw authError;
                }


                /*
                    IMPORTANT:

                    Do NOT manually save
                    authData.user.id into Teachers.

                    The database trigger we created
                    handles the real auth.users UUID.
                */


                if (
                    authData?.session
                ) {

                    console.warn(
                        "Signup returned a session. Confirm Email may be disabled in Supabase."
                    );
                }


                $("password").value =
                    "";


                $("confirmPassword").value =
                    "";


                showMessage(
                    "Account created successfully. Check your email and click the verification link before logging in.",
                    "success"
                );


                showResendButton();


            } catch (error) {

                console.error(
                    "Teacher activation error:",
                    error
                );


                const text =
                    normalize(
                        error?.message
                    );


                if (
                    text.includes(
                        "confirmation email"
                    )
                ) {

                    showMessage(
                        "The account was created, but the verification email could not be sent. Use Resend Verification Email.",
                        "error"
                    );


                    showResendButton();


                } else if (

                    text.includes(
                        "rate limit"
                    )

                    ||

                    text.includes(
                        "email rate"
                    )

                ) {

                    showMessage(
                        "Too many email requests were made. Please wait before trying again.",
                        "error"
                    );


                    showResendButton();


                } else {

                    showMessage(
                        error?.message ||
                        "Could not activate teacher account.",
                        "error"
                    );
                }


            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Activate Account";
            }
        }
    );