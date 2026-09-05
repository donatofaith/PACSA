// ============================================
// PACSA TEACHER DASHBOARD
// ============================================


let currentEditingResult = null;

let resultsCache = [];

let studentsCache = [];

let teacher = null;

let teacherAssignments = [];

let selectedAssignment = null;



// ============================================
// GRADE
// ============================================

function getGrade(total) {

    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";

    return "F";
}



// ============================================
// NORMALIZE
// ============================================

function normalize(value) {

    return String(value || "")
        .trim()
        .toLowerCase();

}



// ============================================
// LOGOUT
// ============================================

function logout() {

    localStorage.removeItem("teacher");

    localStorage.removeItem("teacherAssignments");

    window.location.href =
        "teacher-login.html";

}



// ============================================
// CALCULATE RESULT
// ============================================

function calculateResult(
    caId,
    examId,
    totalId,
    gradeId
) {

    const ca =
        Number(
            document.getElementById(caId).value
        ) || 0;


    const exam =
        Number(
            document.getElementById(examId).value
        ) || 0;


    const total =
        ca + exam;


    document.getElementById(totalId).value =
        total;


    document.getElementById(gradeId).value =
        getGrade(total);

}



// ============================================
// EDIT PREVIEW
// ============================================

function updateEditPreview() {

    calculateResult(
        "editCA",
        "editExam",
        "editTotal",
        "editGrade"
    );

}



// ============================================
// NEW RESULT PREVIEW
// ============================================

function updateResultPreview() {

    calculateResult(
        "resultCA",
        "resultExam",
        "resultTotal",
        "resultGrade"
    );

}



// ============================================
// RENDER ASSIGNMENTS
// ============================================

function renderAssignments() {

    const select =
        document.getElementById(
            "resultAssignment"
        );


    select.innerHTML =
        `<option value="">
            Select Class & Subject
        </option>`;


    teacherAssignments.forEach(
        (assignment, index) => {

            const option =
                document.createElement("option");


            option.value =
                String(index);


            option.textContent =
                `${assignment.class} — ${assignment.subject}`;


            select.appendChild(option);

        }
    );


    if (teacherAssignments.length === 1) {

        select.value = "0";

        handleAssignmentChange();

    }

}



// ============================================
// ASSIGNMENT CHANGED
// ============================================

function handleAssignmentChange() {

    const select =
        document.getElementById(
            "resultAssignment"
        );


    const index =
        Number(select.value);


    if (
        select.value === ""
        ||
        !teacherAssignments[index]
    ) {

        selectedAssignment = null;

        studentsCache = [];

        resetStudentSelect();

        return;

    }


    selectedAssignment =
        teacherAssignments[index];


    loadStudentsForResult();

}



// ============================================
// RESET STUDENT SELECT
// ============================================

function resetStudentSelect() {

    const select =
        document.getElementById(
            "resultStudent"
        );


    select.innerHTML =
        `<option value="">
            Select Student
        </option>`;

}



// ============================================
// OPEN RESULT ENTRY
// ============================================

function openResultEntry() {

    const panel =
        document.getElementById(
            "resultEntryPanel"
        );


    panel.classList.add("show");


    document.getElementById(
        "resultMessage"
    ).textContent = "";


    renderAssignments();


    panel.scrollIntoView({

        behavior: "smooth",

        block: "start"

    });

}



// ============================================
// CLOSE RESULT ENTRY
// ============================================

function closeResultEntry() {

    document
        .getElementById("resultEntryPanel")
        .classList.remove("show");


    document.getElementById(
        "resultAssignment"
    ).value = "";


    document.getElementById(
        "resultStudent"
    ).value = "";


    document.getElementById(
        "resultTerm"
    ).value = "";


    document.getElementById(
        "resultCA"
    ).value = "";


    document.getElementById(
        "resultExam"
    ).value = "";


    document.getElementById(
        "resultTotal"
    ).value = "";


    document.getElementById(
        "resultGrade"
    ).value = "";


    document.getElementById(
        "resultMessage"
    ).textContent = "";


    selectedAssignment = null;

}



// ============================================
// LOAD STUDENTS FOR SELECTED CLASS
// ============================================

async function loadStudentsForResult() {

    const select =
        document.getElementById(
            "resultStudent"
        );


    if (!selectedAssignment) {

        resetStudentSelect();

        return;

    }


    select.innerHTML =
        `<option value="">
            Loading students...
        </option>`;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("students")
            .select(
                "student_id, first_name, last_name, fullname, class"
            )
            .order(
                "student_id",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Student loading error:",
            error
        );


        select.innerHTML =
            `<option value="">
                Could not load students
            </option>`;


        return;

    }


    const selectedClass =
        normalize(
            selectedAssignment.class
        );


    studentsCache =
        (data || []).filter(student => {

            return normalize(
                student.class
            ) === selectedClass;

        });


    select.innerHTML =
        `<option value="">
            Select Student
        </option>`;


    studentsCache.forEach(student => {

        const name =
            `${student.first_name || ""} ${student.last_name || ""}`
                .trim()
            ||
            student.fullname
            ||
            "Unnamed Student";


        const option =
            document.createElement("option");


        option.value =
            student.student_id;


        option.textContent =
            `${student.student_id} - ${name}`;


        select.appendChild(option);

    });


    if (studentsCache.length === 0) {

        select.innerHTML =
            `<option value="">
                No students found in this class
            </option>`;

    }

}



// ============================================
// CHECK WHETHER ASSIGNMENT BELONGS TO TEACHER
// ============================================

function teacherHasAssignment(
    className,
    subjectName
) {

    return teacherAssignments.some(
        assignment => {

            return (
                normalize(
                    assignment.class
                )
                ===
                normalize(className)

                &&

                normalize(
                    assignment.subject
                )
                ===
                normalize(subjectName)
            );

        }
    );

}



// ============================================
// SUBMIT NEW RESULT
// ============================================

async function submitResult() {

    const assignmentSelect =
        document.getElementById(
            "resultAssignment"
        );


    const studentId =
        document.getElementById(
            "resultStudent"
        ).value;


    const term =
        document.getElementById(
            "resultTerm"
        ).value;


    const ca =
        Number(
            document.getElementById(
                "resultCA"
            ).value
        );


    const exam =
        Number(
            document.getElementById(
                "resultExam"
            ).value
        );


    const message =
        document.getElementById(
            "resultMessage"
        );


    const button =
        document.getElementById(
            "submitResultBtn"
        );


    // ============================================
    // VALIDATION
    // ============================================

    if (
        assignmentSelect.value === ""
        ||
        !selectedAssignment
    ) {

        message.textContent =
            "Please select a class and subject assignment.";

        return;

    }


    if (!studentId) {

        message.textContent =
            "Please select a student.";

        return;

    }


    if (!term) {

        message.textContent =
            "Please select a term.";

        return;

    }


    if (
        !Number.isFinite(ca)
        ||
        ca < 0
        ||
        ca > 40
    ) {

        message.textContent =
            "CA mark must be between 0 and 40.";

        return;

    }


    if (
        !Number.isFinite(exam)
        ||
        exam < 0
        ||
        exam > 60
    ) {

        message.textContent =
            "Exam mark must be between 0 and 60.";

        return;

    }


    const assignmentClass =
        selectedAssignment.class;


    const assignmentSubject =
        selectedAssignment.subject;


    // ============================================
    // SECURITY CHECK
    // ============================================

    if (
        !teacherHasAssignment(
            assignmentClass,
            assignmentSubject
        )
    ) {

        message.textContent =
            "You are not assigned to this class and subject.";

        return;

    }


    // ============================================
    // CHECK STUDENT CLASS
    // ============================================

    const student =
        studentsCache.find(
            student =>
                String(student.student_id)
                ===
                String(studentId)
        );


    if (!student) {

        message.textContent =
            "Selected student is not in your assigned class.";

        return;

    }


    const total =
        ca + exam;


    const grade =
        getGrade(total);


    // ============================================
    // CHECK EXISTING RESULT
    // ============================================

    const {
        data: existing,
        error: checkError
    } =
        await supabaseClient
            .from("results")
            .select("id, status")
            .eq(
                "student_id",
                studentId
            )
            .eq(
                "subject",
                assignmentSubject
            )
            .eq(
                "class",
                assignmentClass
            )
            .eq(
                "term",
                term
            )
            .maybeSingle();


    if (checkError) {

        console.error(
            checkError
        );


        message.textContent =
            "Could not check existing result: " +
            checkError.message;

        return;

    }


    if (existing) {

        message.textContent =
            "A result already exists for this student, class, subject and term.";

        return;

    }


    button.disabled = true;

    button.textContent =
        "Submitting...";


    message.textContent = "";


    try {

        const {
            error
        } =
            await supabaseClient
                .from("results")
                .insert([{

                    student_id:
                        studentId,

                    subject:
                        assignmentSubject,

                    ca:
                        ca,

                    exam:
                        exam,

                    total:
                        total,

                    grade:
                        grade,

                    term:
                        term,

                    class:
                        assignmentClass,

                    status:
                        "pending"

                }]);


        if (error) {

            throw error;

        }


        message.textContent =
            "Result submitted successfully. It is now pending admin review.";


        await loadTeacherResults();


        setTimeout(
            () => {

                closeResultEntry();

            },
            1200
        );


    } catch (error) {

        console.error(
            "Error submitting result:",
            error
        );


        message.textContent =
            "Could not submit result: " +
            error.message;

    } finally {

        button.disabled = false;

        button.textContent =
            "Submit Result";

    }

}



// ============================================
// OPEN EDIT
// ============================================

function openEdit(result) {

    currentEditingResult =
        result;


    document.getElementById(
        "editStudentName"
    ).textContent =
        result.studentName || "--";


    document.getElementById(
        "editStudentId"
    ).textContent =
        result.student_id || "--";


    document.getElementById(
        "editSubject"
    ).textContent =
        result.subject || "--";


    document.getElementById(
        "editTerm"
    ).textContent =
        result.term || "--";


    document.getElementById(
        "editCA"
    ).value =
        result.ca ?? 0;


    document.getElementById(
        "editExam"
    ).value =
        result.exam ?? 0;


    document.getElementById(
        "editMessage"
    ).textContent = "";


    updateEditPreview();


    document
        .getElementById("editPanel")
        .classList.add("show");


    document
        .getElementById("editPanel")
        .scrollIntoView({

            behavior: "smooth",

            block: "start"

        });

}



// ============================================
// CANCEL EDIT
// ============================================

function cancelEdit() {

    currentEditingResult =
        null;


    document
        .getElementById("editPanel")
        .classList.remove("show");


    document.getElementById(
        "editMessage"
    ).textContent = "";

}



// ============================================
// SAVE EDIT
// ============================================

async function saveResult() {

    if (!currentEditingResult) {

        return;

    }


    const ca =
        Number(
            document.getElementById(
                "editCA"
            ).value
        );


    const exam =
        Number(
            document.getElementById(
                "editExam"
            ).value
        );


    const message =
        document.getElementById(
            "editMessage"
        );


    const saveButton =
        document.getElementById(
            "saveBtn"
        );


    if (
        !Number.isFinite(ca)
        ||
        ca < 0
        ||
        ca > 40
    ) {

        message.textContent =
            "CA mark must be between 0 and 40.";

        return;

    }


    if (
        !Number.isFinite(exam)
        ||
        exam < 0
        ||
        exam > 60
    ) {

        message.textContent =
            "Exam mark must be between 0 and 60.";

        return;

    }


    // ============================================
    // SECURITY CHECK
    // ============================================

    if (
        !teacherHasAssignment(
            currentEditingResult.class,
            currentEditingResult.subject
        )
    ) {

        message.textContent =
            "You are not assigned to this result.";

        return;

    }


    const total =
        ca + exam;


    const grade =
        getGrade(total);


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";


    message.textContent = "";


    try {

        const updateData = {

            ca:
                ca,

            exam:
                exam,

            total:
                total,

            grade:
                grade,

            status:
                "pending"

        };


        const {
            error
        } =
            await supabaseClient
                .from("results")
                .update(updateData)
                .eq(
                    "id",
                    currentEditingResult.id
                );


        if (error) {

            throw error;

        }


        message.textContent =
            "Result updated and sent for admin review.";


        await loadTeacherResults();


        setTimeout(
            () => {

                cancelEdit();

            },
            1000
        );


    } catch (error) {

        console.error(
            "Error updating result:",
            error
        );


        message.textContent =
            "Could not update result: " +
            error.message;

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            "Save Changes";

    }

}



// ============================================
// LOAD TEACHER RESULTS
// ============================================

async function loadTeacherResults() {

    const resultsTable =
        document.getElementById(
            "resultsTable"
        );


    resultsTable.innerHTML = `

        <tr>

            <td colspan="11">
                Loading results...
            </td>

        </tr>

    `;


    try {

        // ============================================
        // LOAD RESULTS
        // ============================================

        const {
            data: results,
            error: resultsError
        } =
            await supabaseClient
                .from("results")
                .select("*")
                .order(
                    "student_id",
                    {
                        ascending: true
                    }
                );


        if (resultsError) {

            throw resultsError;

        }


        // ============================================
        // LOAD STUDENTS
        // ============================================

        const {
            data: students,
            error: studentsError
        } =
            await supabaseClient
                .from("students")
                .select(
                    "student_id, first_name, last_name, fullname, class"
                );


        if (studentsError) {

            throw studentsError;

        }


        const studentMap = {};


        (students || []).forEach(
            student => {

                studentMap[
                    String(
                        student.student_id
                    )
                ] =
                    student;

            }
        );


        // ============================================
        // ONLY SHOW TEACHER ASSIGNMENTS
        // ============================================

        const filteredResults =
            (results || []).filter(
                result => {

                    return teacherHasAssignment(
                        result.class,
                        result.subject
                    );

                }
            );


        resultsCache =
            filteredResults.map(
                result => {

                    const student =
                        studentMap[
                            String(
                                result.student_id
                            )
                        ];


                    const studentName =
                        `${student?.first_name || ""} ${student?.last_name || ""}`
                            .trim()
                        ||
                        student?.fullname
                        ||
                        result.student_name
                        ||
                        "--";


                    return {

                        ...result,

                        studentName:
                            studentName

                    };

                }
            );


        // ============================================
        // EMPTY
        // ============================================

        if (
            resultsCache.length === 0
        ) {

            resultsTable.innerHTML = `

                <tr>

                    <td colspan="11">
                        No results found for your assigned classes and subjects.
                    </td>

                </tr>

            `;

            return;

        }


        resultsTable.innerHTML = "";


        // ============================================
        // RENDER
        // ============================================

        resultsCache.forEach(
            (result, index) => {


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
                    result.grade
                    ||
                    getGrade(
                        calculatedTotal
                    );


                const resultClass =
                    grade === "F"
                        ? "fail"
                        : "pass";


                const status =
                    result.status
                    ||
                    "pending";


                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML = `

                    <td>
                        ${escapeHtml(
                            result.student_id || "--"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            result.studentName
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            result.class || "--"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            result.subject || "--"
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
                        ${escapeHtml(
                            grade
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            result.term || "--"
                        )}
                    </td>

                    <td>

                        <span
                            class="status-badge status-${escapeHtml(status)}">

                            ${escapeHtml(status)}

                        </span>

                    </td>

                    <td>

                        <button
                            type="button"
                            class="edit-btn edit-result-btn"
                            data-index="${index}">

                            Edit

                        </button>

                    </td>

                `;


                resultsTable.appendChild(
                    row
                );

            }
        );


        // ============================================
        // EDIT BUTTONS
        // ============================================

        document
            .querySelectorAll(
                ".edit-result-btn"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function () {

                        const index =
                            Number(
                                this.dataset.index
                            );


                        const result =
                            resultsCache[
                                index
                            ];


                        if (result) {

                            openEdit(
                                result
                            );

                        }

                    }
                );

            });


    } catch (error) {

        console.error(
            "Error loading results:",
            error
        );


        resultsCache = [];


        resultsTable.innerHTML = `

            <tr>

                <td colspan="11">

                    Error loading results:
                    ${escapeHtml(
                        error.message
                    )}

                </td>

            </tr>

        `;

    }

}



// ============================================
// LOAD TEACHER DATA
// ============================================

async function loadTeacherData() {

    const teacherData =
        localStorage.getItem(
            "teacher"
        );


    if (!teacherData) {

        window.location.href =
            "teacher-login.html";

        return;

    }


    try {

        teacher =
            JSON.parse(
                teacherData
            );

    } catch (error) {

        console.error(
            "Invalid teacher data:",
            error
        );


        localStorage.removeItem(
            "teacher"
        );


        localStorage.removeItem(
            "teacherAssignments"
        );


        window.location.href =
            "teacher-login.html";

        return;

    }


    // ============================================
    // LOAD ASSIGNMENTS
    // ============================================

    try {

        const savedAssignments =
            localStorage.getItem(
                "teacherAssignments"
            );


        if (savedAssignments) {

            teacherAssignments =
                JSON.parse(
                    savedAssignments
                );

        }


    } catch (error) {

        console.error(
            "Could not read assignments:",
            error
        );

        teacherAssignments = [];

    }


    // ============================================
    // REFRESH FROM SUPABASE
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


    if (!assignmentError) {

        teacherAssignments =
            assignments || [];


        localStorage.setItem(
            "teacherAssignments",
            JSON.stringify(
                teacherAssignments
            )
        );

    }


    // ============================================
    // NO ASSIGNMENTS
    // ============================================

    if (
        teacherAssignments.length === 0
    ) {

        alert(
            "No class or subject has been assigned to your account yet."
        );


        logout();

        return;

    }


    // ============================================
    // TEACHER NAME
    // ============================================

    const teacherName =
        teacher.fullname
        ||
        teacher.name
        ||
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim()
        ||
        "--";


    const teacherId =
        teacher.teacher_id
        ||
        teacher.id
        ||
        "--";


    // ============================================
    // UNIQUE SUBJECTS
    // ============================================

    const subjects =
        [
            ...new Set(
                teacherAssignments
                    .map(
                        assignment =>
                            assignment.subject
                    )
                    .filter(Boolean)
            )
        ];


    // ============================================
    // UNIQUE CLASSES
    // ============================================

    const classes =
        [
            ...new Set(
                teacherAssignments
                    .map(
                        assignment =>
                            assignment.class
                    )
                    .filter(Boolean)
            )
        ];


    // ============================================
    // DISPLAY PROFILE
    // ============================================

    document.getElementById(
        "teacherName"
    ).textContent =
        teacherName;


    document.getElementById(
        "teacherId"
    ).textContent =
        teacherId;


    document.getElementById(
        "teacherSubject"
    ).textContent =
        subjects.join(", ") || "--";


    document.getElementById(
        "teacherClass"
    ).textContent =
        classes.join(", ") || "--";


    document.getElementById(
        "teacherCardName"
    ).textContent =
        teacherName;


    document.getElementById(
        "subjectCard"
    ).textContent =
        subjects.length
            ? subjects.join(", ")
            : "--";


    document.getElementById(
        "classCard"
    ).textContent =
        classes.length
            ? classes.join(", ")
            : "--";


    // ============================================
    // LOAD RESULTS
    // ============================================

    await loadTeacherResults();

}



// ============================================
// SAFE HTML
// ============================================

function escapeHtml(value) {

    return String(value ?? "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}



// ============================================
// PAGE EVENTS
// ============================================

document.addEventListener(
    "DOMContentLoaded",
    function () {


        document
            .getElementById(
                "logoutBtn"
            )
            .addEventListener(
                "click",
                logout
            );


        document
            .getElementById(
                "addResultBtn"
            )
            .addEventListener(
                "click",
                openResultEntry
            );


        document
            .getElementById(
                "cancelResultBtn"
            )
            .addEventListener(
                "click",
                closeResultEntry
            );


        document
            .getElementById(
                "submitResultBtn"
            )
            .addEventListener(
                "click",
                submitResult
            );


        document
            .getElementById(
                "resultAssignment"
            )
            .addEventListener(
                "change",
                handleAssignmentChange
            );


        document
            .getElementById(
                "resultCA"
            )
            .addEventListener(
                "input",
                updateResultPreview
            );


        document
            .getElementById(
                "resultExam"
            )
            .addEventListener(
                "input",
                updateResultPreview
            );


        document
            .getElementById(
                "saveBtn"
            )
            .addEventListener(
                "click",
                saveResult
            );


        document
            .getElementById(
                "cancelBtn"
            )
            .addEventListener(
                "click",
                cancelEdit
            );


        document
            .getElementById(
                "editCA"
            )
            .addEventListener(
                "input",
                updateEditPreview
            );


        document
            .getElementById(
                "editExam"
            )
            .addEventListener(
                "input",
                updateEditPreview
            );


        loadTeacherData();

    }
);