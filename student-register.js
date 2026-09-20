const $ = id => document.getElementById(id);

let pendingEmail = "";
let pendingStudentId = "";


const norm = value =>
    String(value ?? "")
        .trim()
        .toLowerCase();


const loginUrl = () =>
    new URL(
        "student-login.html",
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
   PASSWORD TOGGLES
===================================================== */

function setupToggle(
    inputId,
    toggleId
) {

    const input =
        $(inputId);

    const toggle =
        $(toggleId);


    if (
        !input ||
        !toggle
    ) return;


    toggle.addEventListener(
        "click",
        () => {

            const hidden =
                input.type ===
                "password";


            input.type =
                hidden
                    ? "text"
                    : "password";


            toggle.textContent =
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
   RESEND
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
   SAFE STUDENT CHECK
===================================================== */

async function checkStudent(
    studentId,
    email
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .functions
            .invoke(
                "activate-portal-user",
                {
                    body: {
                        action: "check",
                        role: "student",
                        record_id: studentId,
                        email
                    }
                }
            );


    if (error)
        throw error;

    if (!data?.ok)
        throw new Error(
            data?.error ||
            "Could not verify this Student record."
        );


    return {
        student_id: data.record_id,
        portal_status: data.portal_status,
        student_status: "active"
    };
}


/* =====================================================
   RESEND EMAIL
===================================================== */

async function resendVerification() {

    if (
        !pendingEmail ||
        !pendingStudentId
    ) {

        showMessage(
            "Enter your Student ID and registered email first."
        );

        return;
    }


    const student =
        await checkStudent(
            pendingStudentId,
            pendingEmail
        );


    if (!student) {

        showMessage(
            "Student ID and registered email do not match."
        );

        return;
    }


    if (
        norm(
            student.portal_status
        ) === "active"
    ) {

        showMessage(
            "Your Student Portal account is already active. Please login.",
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
                        pendingEmail,

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

$("studentRegisterForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();
            hideResend();


            const studentId =
                $("studentId")
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
                !studentId ||
                !email
            ) {

                showMessage(
                    "Enter your Student ID and registered email."
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
                "Checking student...";


            try {

                const student =
                    await checkStudent(
                        studentId,
                        email
                    );


                if (!student) {

                    showMessage(
                        "Student ID and registered email do not match."
                    );

                    return;
                }


                if (
                    norm(
                        student.student_status
                    )
                    !== "active"
                ) {

                    showMessage(
                        "This student record is inactive."
                    );

                    return;
                }


                pendingEmail =
                    email;

                pendingStudentId =
                    studentId;


                const status =
                    norm(
                        student.portal_status
                    );


                if (
                    status === "active"
                ) {

                    showMessage(
                        "Your Student Portal account is already active. Please login.",
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
                        .functions
                        .invoke(
                            "activate-portal-user",
                            {
                                body: {
                                    action: "signup",
                                    role: "student",
                                    record_id: student.student_id,
                                    email,
                                    password
                                }
                            }
                        );


                if (error)
                    throw error;

                if (!data?.ok)
                    throw new Error(
                        data?.error ||
                        "Could not activate the Student Portal account."
                    );


                $("password").value =
                    "";

                $("confirmPassword").value =
                    "";


                showMessage(
                    data?.message ||
                    "Account created successfully. Check your email and verify your account before logging in.",
                    "success"
                );


                if (data?.email_verification_required) {
                    showResend();
                }


            } catch (error) {

                console.error(
                    "Student activation:",
                    error
                );


                const text =
                    norm(
                        error?.message
                    );


                if (
                    text.includes(
                        "error sending"
                    )
                    ||
                    text.includes(
                        "confirmation email"
                    )
                ) {

                    showMessage(
                        "The confirmation email could not be sent. This will require the production email setup before deployment.",
                        "error"
                    );


                } else {

                    showMessage(
                        error?.message ||
                        "Could not activate the Student Portal account."
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