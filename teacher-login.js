// ============================================
// PACSA TEACHER LOGIN
// ============================================


// ===============================
// PASSWORD SHOW / HIDE
// ===============================

const togglePassword =
    document.getElementById("togglePassword");

const passwordInput =
    document.getElementById("password");

if (togglePassword && passwordInput) {

    togglePassword.addEventListener("click", function () {

        if (passwordInput.type === "password") {

            passwordInput.type = "text";
            togglePassword.textContent = "🙈";

        } else {

            passwordInput.type = "password";
            togglePassword.textContent = "👁";

        }

    });

}


// ===============================
// TEACHER LOGIN
// ===============================

const loginForm =
    document.getElementById("teacherLoginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function (e) {

        e.preventDefault();


        const teacherId =
            document.getElementById("teacherId")
                .value
                .trim();

        const password =
            document.getElementById("password")
                .value
                .trim();


        if (!teacherId || !password) {

            alert(
                "Please enter Teacher ID and Password."
            );

            return;
        }


        const loginButton =
            loginForm.querySelector(".login-btn");


        if (loginButton) {

            loginButton.disabled = true;
            loginButton.textContent = "Logging in...";

        }


        try {

            // ============================================
            // FIND TEACHER
            // ============================================

            const {
                data: teachers,
                error: teacherError
            } =
                await supabaseClient
                    .from("Teachers")
                    .select("*");


            if (teacherError) {

                console.error(
                    "Teacher lookup error:",
                    teacherError
                );

                alert(
                    "Could not connect to the teacher records.\n\n" +
                    teacherError.message
                );

                return;
            }


            const teacher =
                (teachers || []).find(row => {

                    return String(row.teacher_id || "")
                        .trim()
                        .toUpperCase()
                        ===
                        teacherId.toUpperCase();

                });


            if (!teacher) {

                alert(
                    "Teacher ID was not found."
                );

                return;
            }


            // ============================================
            // CHECK PASSWORD
            // ============================================

            if (
                String(teacher.password || "").trim()
                !==
                password
            ) {

                alert(
                    "Password is incorrect."
                );

                return;
            }


            // ============================================
            // LOAD SUBJECT ASSIGNMENTS
            // ============================================

            const {
                data: assignments,
                error: assignmentError
            } =
                await supabaseClient
                    .from("teacher_assignments")
                    .select("*")
                    .eq(
                        "teacher_id",
                        teacher.teacher_id
                    );


            if (assignmentError) {

                console.error(
                    "Assignment lookup error:",
                    assignmentError
                );

                alert(
                    "Teacher account found, but subject assignments could not be loaded.\n\n" +
                    assignmentError.message
                );

                return;
            }


            // ============================================
            // LOAD CLASS TEACHER ASSIGNMENTS
            // ============================================

            const {
                data: classTeacherAssignments,
                error: classTeacherError
            } =
                await supabaseClient
                    .from("class_teacher_assignments")
                    .select("*")
                    .eq(
                        "teacher_id",
                        teacher.teacher_id
                    );


            if (classTeacherError) {

                console.error(
                    "Class teacher assignment lookup error:",
                    classTeacherError
                );

                alert(
                    "Teacher account found, but class teacher assignment could not be loaded.\n\n" +
                    classTeacherError.message
                );

                return;
            }


            // ============================================
            // REQUIRE AT LEAST ONE RESPONSIBILITY
            // ============================================

            const hasSubjectAssignments =
                assignments &&
                assignments.length > 0;

            const hasClassTeacherAssignments =
                classTeacherAssignments &&
                classTeacherAssignments.length > 0;


            if (
                !hasSubjectAssignments &&
                !hasClassTeacherAssignments
            ) {

                alert(
                    "Your teacher account has no class, subject, or class teacher assignment yet.\n\n" +
                    "Please contact the school administrator."
                );

                return;
            }


            // ============================================
            // SAVE LOGIN DATA
            // ============================================

            localStorage.setItem(
                "teacher",
                JSON.stringify(teacher)
            );


            localStorage.setItem(
                "teacherAssignments",
                JSON.stringify(assignments || [])
            );


            localStorage.setItem(
                "classTeacherAssignments",
                JSON.stringify(
                    classTeacherAssignments || []
                )
            );


            console.log(
                "Teacher login successful:",
                teacher
            );


            console.log(
                "Subject assignments:",
                assignments
            );


            console.log(
                "Class teacher assignments:",
                classTeacherAssignments
            );


            // ============================================
            // GO TO DASHBOARD
            // ============================================

            window.location.href =
                "teacher-dashboard.html";


        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            alert(
                "Connection Error:\n\n" +
                error.message
            );

        } finally {

            if (loginButton) {

                loginButton.disabled = false;
                loginButton.textContent = "Login";

            }

        }

    });

}