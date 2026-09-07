const $ = id => document.getElementById(id);

const norm = value =>
    String(value ?? "")
        .trim()
        .toLowerCase();


const dashboardUrl = () =>
    new URL(
        "teacher-dashboard.html",
        window.location.href
    ).href;


const resetUrl = () =>
    new URL(
        "reset-password.html",
        window.location.href
    ).href;


/* =====================================================
   MESSAGES
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
   PASSWORD TOGGLE
===================================================== */

$("togglePassword")
    ?.addEventListener(
        "click",
        () => {

            const input =
                $("password");

            if (!input) return;


            const hidden =
                input.type === "password";


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

$("teacherLoginForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearMessage();


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


            const button =
                $("loginBtn");


            if (
                !teacherId ||
                !email ||
                !password
            ) {

                showMessage(
                    "Enter your Teacher ID, registered email and password."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Logging in...";


            try {

                /*
                    Authenticate first.

                    We do NOT ask the Teachers table
                    for the teacher's email.
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


                if (authError)
                    throw authError;


                if (!authData?.user) {

                    throw new Error(
                        "Teacher login failed."
                    );
                }


                /*
                    Now that the user is authenticated,
                    securely fetch ONLY their own
                    Teacher record.
                */

                const {
                    data: teacherRows,
                    error: teacherError
                } =
                    await supabaseClient
                        .rpc(
                            "pacsa_get_my_teacher"
                        );


                if (teacherError)
                    throw teacherError;


                const teacher =
                    Array.isArray(
                        teacherRows
                    )
                        ? teacherRows[0]
                        : teacherRows;


                if (!teacher) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This account is not linked to a PACSA teacher."
                    );
                }


                /*
                    Confirm Teacher ID entered on
                    login page matches authenticated
                    teacher.
                */

                if (
                    String(
                        teacher.teacher_id
                    )
                    .trim()
                    .toUpperCase()
                    !==
                    teacherId
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "Teacher ID does not match this account."
                    );
                }


                if (
                    norm(
                        teacher.email
                    )
                    !==
                    norm(email)
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "Registered email does not match this Teacher ID."
                    );
                }


                if (
                    norm(
                        teacher.portal_status
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


                /*
                    RLS now protects these tables.
                    Teacher will only receive their
                    own assignments.
                */

                const [
                    subjectResponse,
                    classResponse
                ] =
                    await Promise.all([

                        supabaseClient
                            .from(
                                "teacher_assignments"
                            )
                            .select("*"),

                        supabaseClient
                            .from(
                                "class_teacher_assignments"
                            )
                            .select("*")
                    ]);


                if (
                    subjectResponse.error
                ) {

                    throw subjectResponse.error;
                }


                if (
                    classResponse.error
                ) {

                    throw classResponse.error;
                }


                const assignments =
                    subjectResponse.data || [];


                const classAssignments =
                    classResponse.data || [];


                if (
                    !assignments.length &&
                    !classAssignments.length
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "No teaching responsibility has been assigned to this teacher."
                    );
                }


                localStorage.setItem(
                    "teacher",
                    JSON.stringify(
                        teacher
                    )
                );


                localStorage.setItem(
                    "teacherAssignments",
                    JSON.stringify(
                        assignments
                    )
                );


                localStorage.setItem(
                    "classTeacherAssignments",
                    JSON.stringify(
                        classAssignments
                    )
                );


                window.location.replace(
                    dashboardUrl()
                );


            } catch (error) {

                console.error(
                    "Teacher login:",
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
                        "Incorrect Teacher ID, email or password."
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
                        "Could not login to the Teacher Portal."
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


            if (
                !teacherId ||
                !email
            ) {

                showMessage(
                    "Enter your Teacher ID and registered email first."
                );

                return;
            }


            try {

                /*
                    Safe pre-login activation check.

                    This checks ID + email without
                    exposing the Teachers table.
                */

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


                const teacher =
                    Array.isArray(data)
                        ? data[0]
                        : data;


                if (!teacher) {

                    showMessage(
                        "Teacher ID and registered email do not match."
                    );

                    return;
                }


                if (
                    norm(
                        teacher.portal_status
                    )
                    !== "active"
                ) {

                    showMessage(
                        "This Teacher Portal account is not active yet."
                    );

                    return;
                }


                const {
                    error: resetError
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


                if (resetError)
                    throw resetError;


                showMessage(
                    "Password reset link sent. Check your email.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Teacher password reset:",
                    error
                );


                showMessage(
                    error?.message ||
                    "Could not send password reset email."
                );
            }
        }
    );