// PACSA TEACHER DASHBOARD

let currentEditingResult = null;
let resultsCache = [];


// ==============================
// GRADE CALCULATION
// ==============================

function getGrade(total) {

    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";

    return "F";
}


// ==============================
// LOGOUT
// ==============================

function logout() {

    localStorage.removeItem("teacher");

    window.location.href = "teacher-login.html";
}


// ==============================
// CALCULATE EDIT PREVIEW
// ==============================

function updateEditPreview() {

    const caInput = document.getElementById("editCA");
    const examInput = document.getElementById("editExam");

    const totalInput = document.getElementById("editTotal");
    const gradeInput = document.getElementById("editGrade");

    const ca = Number(caInput.value) || 0;
    const exam = Number(examInput.value) || 0;

    const total = ca + exam;
    const grade = getGrade(total);

    totalInput.value = total;
    gradeInput.value = grade;
}


// ==============================
// OPEN EDIT PANEL
// ==============================

function openEdit(result) {

    currentEditingResult = result;

    document.getElementById("editStudentName").textContent =
        result.studentName || "--";

    document.getElementById("editStudentId").textContent =
        result.student_id || "--";

    document.getElementById("editSubject").textContent =
        result.subject || "--";

    document.getElementById("editCA").value =
        result.ca ?? 0;

    document.getElementById("editExam").value =
        result.exam ?? 0;

    document.getElementById("editMessage").textContent = "";

    updateEditPreview();

    document.getElementById("editPanel").classList.add("show");

    document.getElementById("editPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ==============================
// CANCEL EDIT
// ==============================

function cancelEdit() {

    currentEditingResult = null;

    document.getElementById("editPanel").classList.remove("show");

    document.getElementById("editMessage").textContent = "";
}


// ==============================
// SAVE RESULT
// ==============================

async function saveResult() {

    if (!currentEditingResult) {
        return;
    }

    const ca = Number(document.getElementById("editCA").value);
    const exam = Number(document.getElementById("editExam").value);

    const message = document.getElementById("editMessage");
    const saveButton = document.getElementById("saveBtn");

    // Validate CA

    if (!Number.isFinite(ca) || ca < 0 || ca > 40) {

        message.textContent =
            "CA mark must be between 0 and 40.";

        return;
    }


    // Validate Exam

    if (!Number.isFinite(exam) || exam < 0 || exam > 60) {

        message.textContent =
            "Exam mark must be between 0 and 60.";

        return;
    }


    const total = ca + exam;
    const grade = getGrade(total);


    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    message.textContent = "";


    try {

        const updateData = {
            ca: ca,
            exam: exam,
            total: total,
            grade: grade
        };


        let query = supabaseClient
            .from("results")
            .update(updateData);


        // Use the result ID when available.

        if (currentEditingResult.id) {

            query = query.eq(
                "id",
                currentEditingResult.id
            );

        } else {

            query = query
                .eq(
                    "student_id",
                    currentEditingResult.student_id
                )
                .eq(
                    "subject",
                    currentEditingResult.subject
                );
        }


        const { error } = await query;


        if (error) {
            throw error;
        }


        message.textContent =
            "Result updated successfully.";


        await loadTeacherData();


        setTimeout(() => {
            cancelEdit();
        }, 700);


    } catch (error) {

        console.error("Error updating result:", error);

        message.textContent =
            "Could not update result: " +
            error.message;

    } finally {

        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}


// ==============================
// LOAD TEACHER DATA
// ==============================

async function loadTeacherData() {

    const teacherData =
        localStorage.getItem("teacher");


    // No teacher logged in

    if (!teacherData) {

        window.location.href =
            "teacher-login.html";

        return;
    }


    let teacher;

    try {

        teacher = JSON.parse(teacherData);

    } catch (error) {

        console.error(
            "Invalid teacher data:",
            error
        );

        localStorage.removeItem("teacher");

        window.location.href =
            "teacher-login.html";

        return;
    }


    // ==============================
    // TEACHER INFORMATION
    // ==============================

    const teacherName =
        teacher.fullname ||
        teacher.name ||
        "--";

    const teacherId =
        teacher.teacher_id ||
        teacher.id ||
        "--";

    const teacherSubject =
        teacher.subject ||
        "--";

    const teacherClass =
        teacher.class ||
        "--";


    document.getElementById("teacherName").textContent =
        teacherName;

    document.getElementById("teacherId").textContent =
        teacherId;

    document.getElementById("teacherSubject").textContent =
        teacherSubject;

    document.getElementById("teacherClass").textContent =
        teacherClass;


    document.getElementById("teacherCardName").textContent =
        teacherName;

    document.getElementById("subjectCard").textContent =
        teacherSubject;

    document.getElementById("classCard").textContent =
        teacherClass;


    // ==============================
    // GET RESULTS
    // ==============================

    const resultsTable =
        document.getElementById("resultsTable");


    resultsTable.innerHTML = `
        <tr>
            <td colspan="7">
                Loading results...
            </td>
        </tr>
    `;


    try {

        const resultsResponse =
            await supabaseClient
                .from("results")
                .select("*")
                .order("student_id", {
                    ascending: true
                });


        if (resultsResponse.error) {
            throw resultsResponse.error;
        }


        const studentsResponse =
            await supabaseClient
                .from("students")
                .select("*");


        if (studentsResponse.error) {
            throw studentsResponse.error;
        }


        const results =
            resultsResponse.data || [];

        const students =
            studentsResponse.data || [];


        // ==============================
        // CREATE STUDENT MAP
        // ==============================

        const studentMap = {};

        students.forEach(student => {

            studentMap[
                String(student.student_id)
            ] = student;

        });


        // ==============================
        // FILTER TEACHER SUBJECT
        // ==============================

        const teacherSubjectLower =
            String(teacherSubject)
                .trim()
                .toLowerCase();


        const filteredResults =
            results.filter(result => {

                const resultSubject =
                    String(result.subject || "")
                        .trim()
                        .toLowerCase();

                return (
                    resultSubject ===
                    teacherSubjectLower
                );

            });


        // ==============================
        // NO RESULTS
        // ==============================

        if (filteredResults.length === 0) {

            resultsCache = [];

            resultsTable.innerHTML = `
                <tr>
                    <td colspan="7">
                        No results found for ${teacherSubject}.
                    </td>
                </tr>
            `;

            return;
        }


        // ==============================
        // STORE EXACT RESULTS
        // ==============================

        resultsCache =
            filteredResults.map(result => {

                const student =
                    studentMap[
                        String(result.student_id)
                    ];


                return {
                    ...result,

                    studentName:
                        student?.fullname ||
                        student?.full_name ||
                        student?.name ||
                        result.student_name ||
                        "--"
                };

            });


        // ==============================
        // DISPLAY RESULTS
        // ==============================

        resultsTable.innerHTML = "";


        resultsCache.forEach((result, index) => {

            const ca =
                Number(result.ca) || 0;

            const exam =
                Number(result.exam) || 0;

            const total =
                Number(result.total);

            const calculatedTotal =
                Number.isFinite(total)
                    ? total
                    : ca + exam;

            const grade =
                result.grade ||
                getGrade(calculatedTotal);


            const resultClass =
                grade === "F"
                    ? "fail"
                    : "pass";


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${escapeHtml(
                        result.student_id || "--"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        result.studentName || "--"
                    )}
                </td>

                <td>
                    ${ca}
                </td>

                <td>
                    ${exam}
                </td>

                <td class="total ${resultClass}">
                    ${calculatedTotal}
                </td>

                <td class="grade ${resultClass}">
                    ${escapeHtml(grade)}
                </td>

                <td>
                    <button
                        type="button"
                        class="edit-btn edit-result-btn"
                        data-index="${index}"
                    >
                        Edit
                    </button>
                </td>
            `;


            resultsTable.appendChild(row);

        });


        // ==============================
        // EDIT BUTTONS
        // ==============================

        const editButtons =
            document.querySelectorAll(
                ".edit-result-btn"
            );


        editButtons.forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    const index =
                        Number(
                            this.dataset.index
                        );


                    const selectedResult =
                        resultsCache[index];


                    if (selectedResult) {
                        openEdit(
                            selectedResult
                        );
                    }

                }
            );

        });


    } catch (error) {

        console.error(
            "Error loading teacher data:",
            error
        );

        resultsCache = [];

        resultsTable.innerHTML = `
            <tr>
                <td colspan="7">
                    Error loading results:
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

    }
}


// ==============================
// SAFE HTML TEXT
// ==============================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==============================
// PAGE EVENTS
// ==============================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        document
            .getElementById("logoutBtn")
            .addEventListener(
                "click",
                logout
            );


        document
            .getElementById("saveBtn")
            .addEventListener(
                "click",
                saveResult
            );


        document
            .getElementById("cancelBtn")
            .addEventListener(
                "click",
                cancelEdit
            );


        document
            .getElementById("editCA")
            .addEventListener(
                "input",
                updateEditPreview
            );


        document
            .getElementById("editExam")
            .addEventListener(
                "input",
                updateEditPreview
            );


        loadTeacherData();

    }
);