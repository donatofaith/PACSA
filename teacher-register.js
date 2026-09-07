const $ = id => document.getElementById(id);

let pendingTeacherEmail = "";
let pendingTeacherId = "";


const norm = value =>
    String(value ?? "")
        .trim()
        .toLowerCase();


const loginUrl = () =>
    new URL(
        "teacher-login.html",
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
        $("registerMessage");

    if (!box) return;

    box.textContent =
        text;

    box.className =
        `message ${type}`;
}


function clearMessage() {

    const box =
        $("registerMessage");

    if (!box) return;

    box.textContent = "";

    box.className =
        "message";
}


/* =====================================================
   PASSWORD TOGGLE
===================================================== */

function setupToggle(
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
    ) return;


    button.addEventListener(
        "click",
        () => {

            const hidden =
                input.type ===
                "password";


            input.type =
                hidden
                    ? "text"
                    : "password";


            button.textContent =
                hidden
                    ? "🙈"
                    : "👁";
        }
    );
}


setupToggle(
    "password",
    "togglePassword"
);


setupToggle(
    "confirmPassword",
    "toggleConfirmPassword"
);


/* =====================================================
   RESEND BUTTON
===================================================== */

function showResend() {

    const button =
        $("resendVerificationBtn");

    if (button)
        button.style.display =
            "block";
}


function hideResend() {

    const button =
        $("resendVerificationBtn");

    if (button)
        button.style.display =
            "none";
}


/* =====================================================
   SAFE ACTIVATION CHECK
===================================================== */

async function checkTeacher(
    teacherId,
    email
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .rpc(
                "pacsa_teacher_activation_check",
                {
                    p_teacher_id:
                        teacherId,

                    p_email:
                        email
                }
            );


    if (error)
        throw error;


    return Array.isArray(data)
        ? data[0]
        : data;
}


/* =====================================================
   RESEND
===================================================== */

async function resendVerification() {

    if (
        !pendingTeacherEmail ||
        !pendingTeacherId
    ) {

        showMessage(
            "Enter your Teacher ID and registered email first."
        );

        return;
    }


    const teacher =
        await checkTeacher(
            pendingTeacherId,
            pendingTeacherEmail
        );


    if (!teacher) {

        showMessage(
            "Teacher ID and email do not match."
        );

        return;
    }


    if (
        norm(
            teacher.portal_status
        ) === "active"
    ) {

        showMessage(
            "Your teacher account is already active. Please login.",
            "success"
        );

        hideResend();

        return;
    }


    const button =
        $("resendVerificationBtn");


    button.disabled =
        true;

    button.textContent =
        "Sending...";


    try {

        const { error } =
            await supabaseClient
                .auth
                .resend({

                    type:
                        "signup",

                    email:
                        pendingTeacherEmail,

                    options: {

                        emailRedirectTo:
                            loginUrl()
                    }
                });


        if (error)
            throw error;


        showMessage(
            "Verification email sent. Check your inbox and spam folder.",
            "success"
        );


    } catch (error) {

        console.error(error);


        showMessage(
            error?.message ||
            "Could not resend verification email."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            "Resend Verification Email";
    }
}


$("resendVerificationBtn")
    ?.addEventListener(
        "click",
        resendVerification
    );


/* =====================================================
   ACTIVATE
===================================================== */

$("teacherRegisterForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();
            hideResend();


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
                $("password").value;


            const confirmPassword =
                $("confirmPassword").value;


            const button =
                $("registerBtn");


            if (
                !teacherId ||
                !email
            ) {

                showMessage(
                    "Enter your Teacher ID and registered email."
                );

                return;
            }


            if (
                password.length < 8
            ) {

                showMessage(
                    "Password must contain at least 8 characters."
                );

                return;
            }


            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Checking teacher...";


            try {

                const teacher =
                    await checkTeacher(
                        teacherId,
                        email
                    );


                if (!teacher) {

                    showMessage(
                        "Teacher ID and registered email do not match."
                    );

                    return;
                }


                pendingTeacherId =
                    teacherId;

                pendingTeacherEmail =
                    email;


                const status =
                    norm(
                        teacher.portal_status
                    );


                if (
                    status === "active"
                ) {

                    showMessage(
                        "Your teacher account is already active. Please login.",
                        "success"
                    );

                    return;
                }


                if (
                    status ===
                    "pending_verification"
                ) {

                    showMessage(
                        "Your account is waiting for email verification. Check your inbox or resend the verification email."
                    );

                    showResend();

                    return;
                }


                button.textContent =
                    "Creating account...";


                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .auth
                        .signUp({

                            email,
                            password,

                            options: {

                                emailRedirectTo:
                                    loginUrl(),

                                data: {

                                    teacher_id:
                                        teacher.teacher_id,

                                    role:
                                        "teacher"
                                }
                            }
                        });


                if (error)
                    throw error;


                $("password").value =
                    "";

                $("confirmPassword").value =
                    "";


                if (data?.session) {

                    showMessage(
                        "Teacher account created and active. You can now login.",
                        "success"
                    );

                    return;
                }


                showMessage(
                    "Account created successfully. Check your email and verify your account before logging in.",
                    "success"
                );


                showResend();


            } catch (error) {

                console.error(
                    "Teacher activation:",
                    error
                );


                showMessage(
                    error?.message ||
                    "Could not activate teacher account."
                );


            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Activate Account";
            }
        }
    );