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

document
.getElementById("teacherLoginForm")
.addEventListener("submit", async function(e) {

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

        alert("Please enter Teacher ID and Password.");

        return;
    }


    try {

        console.log("Searching for teacher:", teacherId);


        // GET ALL TEACHERS
        const { data, error } =
        await supabaseClient
        .from("Teachers")
        .select("*");


        console.log("ALL TEACHERS:", data);
        console.log("SUPABASE ERROR:", error);


        // CHECK FOR SUPABASE ERROR

        if (error) {

            console.error(error);

            alert(
                "Supabase Error:\n\n" +
                error.message
            );

            return;
        }


        // CHECK IF TABLE IS EMPTY

        if (!data || data.length === 0) {

            alert(
                "The Teachers table returned no records."
            );

            return;
        }


        // FIND TEACHER
        // Ignore spaces and capital/lowercase differences

        const teacher =
        data.find(function(row) {

            return String(row.teacher_id)
            .trim()
            .toUpperCase()
            ===
            teacherId.toUpperCase();

        });


        console.log("FOUND TEACHER:", teacher);


        // TEACHER NOT FOUND

        if (!teacher) {

            alert(
                "Teacher ID was not found.\n\n" +
                "You entered: " +
                teacherId +
                "\n\n" +
                "Teacher IDs found in Supabase:\n" +
                data.map(row => row.teacher_id).join(", ")
            );

            return;
        }


        // CHECK PASSWORD

        if (
            String(teacher.password).trim()
            !==
            password
        ) {

            alert("Password is incorrect.");

            return;
        }


        // ===============================
        // LOGIN SUCCESSFUL
        // ===============================

        localStorage.setItem(
            "teacher",
            JSON.stringify(teacher)
        );


        console.log(
            "Teacher login successful:",
            teacher
        );


        alert(
            "Teacher Login Successful!"
        );


        // GO TO TEACHER DASHBOARD

        window.location.href =
        "teacher-dashboard.html";


    } catch (err) {

        console.error(
            "LOGIN ERROR:",
            err
        );

        alert(
            "Connection Error:\n\n" +
            err.message
        );

    }

});