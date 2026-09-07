const $ = id =>
    document.getElementById(id);


/* =========================================
   URL HELPERS
========================================= */

function getTeacherLoginUrl() {

    return new URL(
        "teacher-login.html",
        window.location.href
    ).href;
}


function getTeacherDashboardUrl() {

    return new URL(
        "teacher-dashboard.html",
        window.location.href
    ).href;
}


/* =========================================
   NORMALIZE
========================================= */

function normalize(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();
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
   FIND TEACHER BY ID
========================================= */

async function getTeacherById(
    teacherId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("Teachers")
            .select(`
                id,
                teacher_id,
                fullname,
                first_name,
                last_name,
                email,
                phone,
                subject,
                class,
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
   LOGIN
========================================= */

$("teacherLoginForm")
    ?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const teacherId =
                $("teacherId")
                    .value
                    .trim();


            const password =
                $("password")
                    .value;


            const button =
                $("loginBtn");


            hideMessage();


            if (
                !teacherId ||
                !password
            ) {

                showMessage(
                    "Enter your Teacher ID and password."
                );

                return;
            }


            button.disabled =
                true;

            button.textContent =
                "Logging in...";


            try {

                /*
                    STEP 1:
                    Find PACSA teacher record.
                */

                const teacher =
                    await getTeacherById(
                        teacherId
                    );


                if (!teacher) {

                    throw new Error(
                        "Teacher ID was not found."
                    );
                }


                /*
                    Teacher must already have activated
                    the Supabase Auth account.
                */

                if (
                    !teacher.auth_user_id
                ) {

                    throw new Error(
                        "Your Teacher Portal account has not been activated yet. Click Activate Account first."
                    );
                }


                if (!teacher.email) {

                    throw new Error(
                        "No email address is registered for this teacher. Contact the administrator."
                    );
                }


                /*
                    STEP 2:
                    Supabase Auth login.

                    Teacher enters Teacher ID,
                    but Auth securely uses the
                    registered teacher email.
                */

                const {
                    data: authData,
                    error: authError
                } =
                    await supabaseClient
                        .auth
                        .signInWithPassword({

                            email:
                                teacher.email
                                    .trim()
                                    .toLowerCase(),

                            password

                        });


                if (authError) {

                    throw authError;
                }


                const authUser =
                    authData?.user;


                if (!authUser) {

                    throw new Error(
                        "Teacher login failed."
                    );
                }


                /*
                    STEP 3:
                    Very important security check.

                    Auth user must match the Auth ID
                    stored against this Teacher ID.
                */

                if (
                    String(
                        teacher.auth_user_id
                    )
                    !==
                    String(
                        authUser.id
                    )
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "This login does not match the selected teacher account."
                    );
                }


                /*
                    STEP 4:
                    Load subject assignments.
                */

                const {
                    data: assignments,
                    error: assignmentError
                } =
                    await supabaseClient
                        .from(
                            "teacher_assignments"
                        )
                        .select("*")
                        .eq(
                            "teacher_id",
                            teacher.teacher_id
                        );


                if (assignmentError) {

                    throw assignmentError;
                }


                /*
                    STEP 5:
                    Load class teacher assignments.
                */

                const {
                    data: classAssignments,
                    error: classError
                } =
                    await supabaseClient
                        .from(
                            "class_teacher_assignments"
                        )
                        .select("*")
                        .eq(
                            "teacher_id",
                            teacher.teacher_id
                        );


                if (classError) {

                    throw classError;
                }


                /*
                    Teacher needs at least one role.
                */

                const hasSubjectRole =
                    Array.isArray(
                        assignments
                    )
                    &&
                    assignments.length > 0;


                const hasClassRole =
                    Array.isArray(
                        classAssignments
                    )
                    &&
                    classAssignments.length > 0;


                if (
                    !hasSubjectRole &&
                    !hasClassRole
                ) {

                    await supabaseClient
                        .auth
                        .signOut();


                    throw new Error(
                        "Your teacher account has no subject or class-teacher assignment. Contact the administrator."
                    );
                }


                /*
                    STEP 6:
                    Activate portal after successful
                    verified login.
                */

                if (
                    teacher.portal_status ===
                    "pending_verification"
                ) {

                    const {
                        error: portalError
                    } =
                        await supabaseClient
                            .from("Teachers")
                            .update({

                                portal_status:
                                    "active"

                            })
                            .eq(
                                "teacher_id",
                                teacher.teacher_id
                            );


                    if (!portalError) {

                        teacher.portal_status =
                            "active";

                    } else {

                        console.error(
                            "Teacher portal status update:",
                            portalError
                        );
                    }
                }


                /*
                    Keep existing Teacher Dashboard
                    compatible for now.

                    Dashboard security will be upgraded
                    immediately after this login works.
                */

                localStorage.setItem(
                    "teacher",
                    JSON.stringify(
                        teacher
                    )
                );


                localStorage.setItem(
                    "teacherAssignments",
                    JSON.stringify(
                        assignments || []
                    )
                );


                localStorage.setItem(
                    "classTeacherAssignments",
                    JSON.stringify(
                        classAssignments || []
                    )
                );


                window.location.href =
                    getTeacherDashboardUrl();


            } catch (error) {

                console.error(
                    "Teacher login error:",
                    error
                );


                showMessage(
                    getFriendlyError(
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


            hideMessage();


            const teacherId =
                $("teacherId")
                    .value
                    .trim();


            if (!teacherId) {

                showMessage(
                    "Enter your Teacher ID first, then click Forgot Password."
                );

                return;
            }


            try {

                const teacher =
                    await getTeacherById(
                        teacherId
                    );


                if (
                    !teacher ||
                    !teacher.email
                ) {

                    showMessage(
                        "Teacher account or registered email was not found."
                    );

                    return;
                }


                if (
                    !teacher.auth_user_id
                ) {

                    showMessage(
                        "This Teacher Portal account has not been activated yet."
                    );

                    return;
                }


                const {
                    error
                } =
                    await supabaseClient
                        .auth
                        .resetPasswordForEmail(
                            teacher.email
                                .trim()
                                .toLowerCase(),
                            {

                                redirectTo:
                                    getTeacherLoginUrl()

                            }
                        );


                if (error) {

                    throw error;
                }


                showSuccess(
                    "Password reset email sent. Check your registered email."
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


/* =========================================
   EXISTING SESSION
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


            /*
                Determine whether this Supabase
                session belongs to a teacher.
            */

            const {
                data: teacher
            } =
                await supabaseClient
                    .from("Teachers")
                    .select(
                        "teacher_id"
                    )
                    .eq(
                        "auth_user_id",
                        user.id
                    )
                    .maybeSingle();


            if (teacher) {

                window.location.href =
                    getTeacherDashboardUrl();
            }

        } catch (error) {

            console.error(
                "Teacher session check:",
                error
            );
        }
    }
);


/* =========================================
   MESSAGES
========================================= */

function showMessage(text) {

    const message =
        $("loginMessage");


    message.textContent =
        text;


    message.className =
        "login-message error";
}


function showSuccess(text) {

    const message =
        $("loginMessage");


    message.textContent =
        text;


    message.className =
        "login-message success";
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

function getFriendlyError(error) {

    const text =
        normalize(
            error?.message
        );


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

        return "Incorrect Teacher ID or password.";
    }


    return (
        error?.message ||
        "Could not login to the Teacher Portal."
    );
}