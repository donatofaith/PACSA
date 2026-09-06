const $ = id => document.getElementById(id);
const norm = v => String(v ?? "").trim().toLowerCase();

const esc = v =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const grade = total =>
    total >= 70 ? "A" :
    total >= 60 ? "B" :
    total >= 50 ? "C" :
    total >= 45 ? "D" :
    total >= 40 ? "E" : "F";

const studentName = student =>
    `${student?.first_name || ""} ${student?.last_name || ""}`.trim() ||
    student?.fullname ||
    "Unnamed Student";

const teacherName = teacher =>
    teacher?.fullname ||
    teacher?.name ||
    `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim() ||
    "Teacher";

const initials = name =>
    (
        String(name || "T")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part[0])
            .join("")
            .slice(0, 2) || "T"
    ).toUpperCase();


const state = {
    teacher: null,
    assignments: [],
    classAssignments: [],
    students: [],
    resultStudents: [],
    results: [],

    selectedAssignment: null,
    selectedClassAssignment: null,
    selectedClassStudent: null,

    classResults: [],
    edit: null,

    currentSession: ""
};


/* =========================
   LOGOUT
========================= */

function logout() {

    [
        "teacher",
        "teacherAssignments",
        "classTeacherAssignments"
    ].forEach(key =>
        localStorage.removeItem(key)
    );

    location.href =
        "teacher-login.html";
}


/* =========================
   HELPERS
========================= */

function hasAssignment(className, subject) {

    return state.assignments.some(
        assignment =>
            norm(assignment.class) === norm(className) &&
            norm(assignment.subject) === norm(subject)
    );
}


function isClassTeacher(className, session) {

    return state.classAssignments.some(
        assignment =>
            norm(assignment.class) === norm(className) &&
            norm(assignment.session) === norm(session)
    );
}


function calculate(
    caId,
    examId,
    totalId,
    gradeId
) {

    const ca =
        Number($(caId).value || 0);

    const exam =
        Number($(examId).value || 0);

    const total =
        ca + exam;

    $(totalId).value =
        total;

    $(gradeId).value =
        grade(total);
}


/* =========================
   CURRENT SESSION
========================= */

async function getCurrentSession() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("sessions_terms")
            .select("session")
            .eq("is_current", true)
            .limit(1)
            .maybeSingle();


    if (
        !error &&
        data?.session
    ) {

        return data.session;
    }


    return (
        state.classAssignments[0]?.session ||
        ""
    );
}


/* =========================
   LOAD BASIC DATA
========================= */

async function loadBaseData() {

    const stored =
        localStorage.getItem("teacher");


    if (!stored) {
        return logout();
    }


    try {

        state.teacher =
            JSON.parse(stored);

    } catch {

        return logout();
    }


    const teacherId =
        state.teacher.teacher_id;


    const [
        assignmentsResponse,
        classResponse,
        studentsResponse
    ] =
        await Promise.all([

            supabaseClient
                .from("teacher_assignments")
                .select("*")
                .eq("teacher_id", teacherId)
                .order("class"),

            supabaseClient
                .from("class_teacher_assignments")
                .select("*")
                .eq("teacher_id", teacherId)
                .order("class"),

            supabaseClient
                .from("students")
                .select(
                    "student_id,first_name,last_name,fullname,class,status"
                )
                .order("student_id")

        ]);


    if (assignmentsResponse.error)
        throw assignmentsResponse.error;

    if (classResponse.error)
        throw classResponse.error;

    if (studentsResponse.error)
        throw studentsResponse.error;


    state.assignments =
        assignmentsResponse.data || [];

    state.classAssignments =
        classResponse.data || [];

    state.students =
        studentsResponse.data || [];


    localStorage.setItem(
        "teacherAssignments",
        JSON.stringify(
            state.assignments
        )
    );


    localStorage.setItem(
        "classTeacherAssignments",
        JSON.stringify(
            state.classAssignments
        )
    );


    if (
        !state.assignments.length &&
        !state.classAssignments.length
    ) {

        alert(
            "No teaching assignment has been added to this account."
        );

        return logout();
    }


    state.currentSession =
        await getCurrentSession();
}


/* =========================
   PROFILE
========================= */

function renderProfile() {

    const teacher =
        state.teacher;

    const name =
        teacherName(teacher);

    const avatar =
        initials(name);


    const subjects =
        [
            ...new Set(
                state.assignments
                    .map(a => a.subject)
                    .filter(Boolean)
            )
        ];


    const classes =
        [
            ...new Set(
                [
                    ...state.assignments,
                    ...state.classAssignments
                ]
                    .map(a => a.class)
                    .filter(Boolean)
            )
        ];


    $("topTeacherName").textContent =
        name;

    $("topTeacherId").textContent =
        teacher.teacher_id ||
        teacher.id ||
        "--";

    $("miniAvatar").textContent =
        avatar;

    $("welcomeTeacherName").textContent =
        name;

    $("teacherName").textContent =
        name;

    $("teacherId").textContent =
        teacher.teacher_id ||
        teacher.id ||
        "--";

    $("teacherEmail").textContent =
        teacher.email || "--";

    $("teacherPhone").textContent =
        teacher.phone || "--";

    $("teacherSubject").textContent =
        subjects.join(", ") || "--";

    $("teacherClass").textContent =
        classes.join(", ") || "--";

    $("teacherAvatar").textContent =
        avatar;

    $("assignmentCount").textContent =
        state.assignments.length;

    $("classCount").textContent =
        classes.length;


    if (
        state.classAssignments.length
    ) {

        $("classTeacherBadge").style.display =
            "inline-flex";

        $("classTeacherProfileRow").style.display =
            "flex";

        $("teacherClassTeacher").textContent =
            state.classAssignments
                .map(
                    a =>
                        `${a.class} (${a.session})`
                )
                .join(", ");
    }
}


/* =========================
   ASSIGNMENTS
========================= */

function renderAssignments() {

    $("assignmentCards").innerHTML =
        state.assignments.length

            ? state.assignments
                .map(
                    (assignment, index) => `
                        <div class="assignment-card">

                            <div class="assignment-number">
                                ${index + 1}
                            </div>

                            <span>
                                Subject
                            </span>

                            <h3>
                                ${esc(
                                    assignment.subject || "--"
                                )}
                            </h3>

                            <div class="assignment-class">
                                Class:
                                ${esc(
                                    assignment.class || "--"
                                )}
                            </div>

                        </div>
                    `
                )
                .join("")

            : `
                <div class="empty-card">
                    No subject assignment found.
                </div>
            `;


    const visibleClasses =
        [
            ...new Set(
                [
                    ...state.assignments,
                    ...state.classAssignments
                ]
                    .map(a =>
                        norm(a.class)
                    )
                    .filter(Boolean)
            )
        ];


    $("studentCount").textContent =
        state.students.filter(
            student =>
                visibleClasses.includes(
                    norm(student.class)
                )
        ).length;
}


/* =========================
   MY CLASS
========================= */

function setupMyClass() {

    if (
        !state.classAssignments.length
    ) {

        $("myClassSection")
            .classList
            .remove("show");

        $("myClassNavLink").style.display =
            "none";

        return;
    }


    $("myClassSection")
        .classList
        .add("show");

    $("myClassNavLink").style.display =
        "flex";


    $("classTeacherCards").innerHTML =
        state.classAssignments
            .map(
                assignment => `

                    <div class="class-teacher-card">

                        <div class="class-teacher-card-top">

                            <div>

                                <p>
                                    Class Teacher
                                </p>

                                <h3>
                                    ${esc(
                                        assignment.class || "--"
                                    )}
                                </h3>

                            </div>

                            <div class="class-teacher-icon">
                                🏫
                            </div>

                        </div>

                        <div class="class-session">

                            <span>
                                Session
                            </span>

                            <strong>
                                ${esc(
                                    assignment.session || "--"
                                )}
                            </strong>

                        </div>

                    </div>
                `
            )
            .join("");


    $("classTeacherClassSelect").innerHTML =
        state.classAssignments
            .map(
                (assignment, index) =>
                    `<option value="${index}">
                        ${esc(assignment.class)}
                        —
                        ${esc(assignment.session)}
                    </option>`
            )
            .join("");


    $("classSelectorWrapper").style.display =
        state.classAssignments.length > 1
            ? "block"
            : "none";


    loadClassStudents();
}


/* =========================
   CLASS STUDENTS
========================= */

function loadClassStudents() {

    const index =
        Number(
            $("classTeacherClassSelect").value ||
            0
        );


    const assignment =
        state.classAssignments[index];


    if (!assignment) {
        return;
    }


    state.selectedClassAssignment =
        assignment;

    state.selectedClassStudent =
        null;

    state.classResults =
        [];


    const students =
        state.students.filter(
            student =>
                norm(student.class) ===
                norm(assignment.class)
        );


    $("classStudentCount").textContent =
        `${students.length} student${students.length === 1 ? "" : "s"}`;


    $("classStudentsTable").innerHTML =
        students.length

            ? students
                .map(
                    (student, index) => `

                        <tr>

                            <td>
                                ${esc(
                                    student.student_id || "--"
                                )}
                            </td>

                            <td>
                                ${esc(
                                    studentName(student)
                                )}
                            </td>

                            <td>
                                ${esc(
                                    student.class || "--"
                                )}
                            </td>

                            <td>

                                <span class="class-account-badge">
                                    ${esc(
                                        student.status || "Active"
                                    )}
                                </span>

                            </td>

                            <td>

                                <button
                                    type="button"
                                    class="class-view-btn"
                                    data-class-student="${index}"
                                >
                                    View Result
                                </button>

                            </td>

                        </tr>
                    `
                )
                .join("")

            : `
                <tr>

                    <td
                        colspan="5"
                        class="class-empty"
                    >
                        No students found in
                        ${esc(assignment.class)}.
                    </td>

                </tr>
            `;


    document
        .querySelectorAll(
            "[data-class-student]"
        )
        .forEach(
            button => {

                button.onclick =
                    () => {

                        const student =
                            students[
                                Number(
                                    button.dataset
                                        .classStudent
                                )
                            ];

                        if (student) {
                            openClassResult(
                                student
                            );
                        }
                    };

            }
        );
}


/* =========================
   OPEN COMPLETE RESULT
========================= */

async function openClassResult(
    student
) {

    const assignment =
        state.selectedClassAssignment;


    if (
        !assignment ||
        !isClassTeacher(
            assignment.class,
            assignment.session
        )
    ) {

        alert(
            "Class teacher assignment was not found."
        );

        return;
    }


    state.selectedClassStudent =
        student;


    $("classResultStudentName").textContent =
        studentName(student);

    $("classResultStudentInfo").textContent =
        "Complete class result - read only";

    $("classResultStudentId").textContent =
        student.student_id || "--";

    $("classResultClass").textContent =
        assignment.class || "--";

    $("classResultSession").textContent =
        assignment.session || "--";

    $("classTeacherRemark").value =
        "";

    $("remarkMessage").textContent =
        "";


    $("classResultView")
        .classList
        .add("show");


    $("classResultView")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


    const {
        data,
        error
    } =
        await supabaseClient
            .from("results")
            .select("*")
            .eq(
                "student_id",
                student.student_id
            )
            .eq(
                "class",
                assignment.class
            )
            .eq(
                "session",
                assignment.session
            )
            .order("subject");


    if (error) {

        $("classFullResultTable").innerHTML = `

            <tr>

                <td colspan="5">
                    ${esc(error.message)}
                </td>

            </tr>
        `;

        return;
    }


    state.classResults =
        data || [];


    setupClassTerms();
}


/* =========================
   TERMS
========================= */

function setupClassTerms() {

    const terms =
        [
            ...new Set(
                state.classResults
                    .map(
                        result =>
                            result.term
                    )
                    .filter(Boolean)
            )
        ];


    const order =
        [
            "First Term",
            "Second Term",
            "Third Term"
        ];


    terms.sort(
        (a, b) =>
            order.indexOf(a) -
            order.indexOf(b)
    );


    $("classResultTerm").innerHTML =
        `
            <option value="">
                Select Term
            </option>
        ` +
        terms
            .map(
                term =>
                    `<option value="${esc(term)}">
                        ${esc(term)}
                    </option>`
            )
            .join("");


    if (!terms.length) {

        $("classFullResultTable").innerHTML = `

            <tr>

                <td colspan="5">
                    No results have been entered
                    for this student in this session.
                </td>

            </tr>
        `;

        resetClassSummary();

        return;
    }


    $("classResultTerm").value =
        terms[0];


    renderClassResult();
}


/* =========================
   RESULT SUMMARY
========================= */

function resetClassSummary() {

    $("classResultSubjectCount").textContent =
        "0";

    $("classResultAverage").textContent =
        "0%";

    $("classResultPassed").textContent =
        "0";

    $("classResultFailed").textContent =
        "0";
}


/* =========================
   RENDER COMPLETE RESULT
========================= */

function renderClassResult() {

    const term =
        $("classResultTerm").value;


    $("remarkMessage").textContent =
        "";


    if (!term) {

        $("classFullResultTable").innerHTML = `

            <tr>
                <td colspan="5">
                    Select a term to view the result.
                </td>
            </tr>
        `;

        $("classTeacherRemark").value =
            "";

        resetClassSummary();

        return;
    }


    const results =
        state.classResults.filter(
            result =>
                norm(result.term) ===
                norm(term)
        );


    if (!results.length) {

        $("classFullResultTable").innerHTML = `

            <tr>
                <td colspan="5">
                    No result found for this term.
                </td>
            </tr>
        `;

        resetClassSummary();

        return;
    }


    let scoreSum =
        0;

    let passed =
        0;


    $("classFullResultTable").innerHTML =
        results
            .map(
                result => {

                    const ca =
                        Number(
                            result.ca
                        ) || 0;

                    const exam =
                        Number(
                            result.exam
                        ) || 0;


                    const storedTotal =
                        Number(
                            result.total
                        );


                    const total =
                        Number.isFinite(
                            storedTotal
                        )
                            ? storedTotal
                            : ca + exam;


                    scoreSum +=
                        total;


                    if (
                        total >= 40
                    ) {

                        passed++;
                    }


                    return `

                        <tr>

                            <td>
                                ${esc(
                                    result.subject || "--"
                                )}
                            </td>

                            <td>
                                ${ca}
                            </td>

                            <td>
                                ${exam}
                            </td>

                            <td>
                                <strong>
                                    ${total}
                                </strong>
                            </td>

                            <td>
                                <strong>
                                    ${esc(
                                        result.grade ||
                                        grade(total)
                                    )}
                                </strong>
                            </td>

                        </tr>
                    `;

                }
            )
            .join("");


    $("classResultSubjectCount").textContent =
        results.length;


    $("classResultAverage").textContent =
        `${(
            scoreSum /
            results.length
        ).toFixed(1)}%`;


    $("classResultPassed").textContent =
        passed;


    $("classResultFailed").textContent =
        results.length -
        passed;


    loadRemark();
}


/* =========================
   LOAD REMARK
========================= */

async function loadRemark() {

    const student =
        state.selectedClassStudent;

    const assignment =
        state.selectedClassAssignment;

    const term =
        $("classResultTerm").value;


    if (
        !student ||
        !assignment ||
        !term
    ) {

        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("student_reports")
            .select("*")
            .eq(
                "student_id",
                student.student_id
            )
            .eq(
                "class",
                assignment.class
            )
            .eq(
                "term",
                term
            )
            .eq(
                "session",
                assignment.session
            )
            .maybeSingle();


    $("classTeacherRemark").value =
        error
            ? ""
            : data?.remark || "";


    if (error) {

        console.error(error);

        $("remarkMessage").textContent =
            "Could not load remark.";
    }
}


/* =========================
   SAVE REMARK
========================= */

async function saveRemark() {

    const student =
        state.selectedClassStudent;

    const assignment =
        state.selectedClassAssignment;

    const term =
        $("classResultTerm").value;

    const remark =
        $("classTeacherRemark")
            .value
            .trim();

    const message =
        $("remarkMessage");

    const button =
        $("saveRemarkBtn");


    if (
        !student ||
        !assignment
    ) {

        alert(
            "Select a student result first."
        );

        return;
    }


    if (!term) {

        message.textContent =
            "Please select a term first.";

        return;
    }


    if (!remark) {

        message.textContent =
            "Please enter a remark.";

        return;
    }


    if (
        !isClassTeacher(
            assignment.class,
            assignment.session
        )
    ) {

        message.textContent =
            "You are not assigned as class teacher for this class.";

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Saving...";

    message.textContent =
        "";


    const {
        error
    } =
        await supabaseClient
            .from("student_reports")
            .upsert(
                {
                    student_id:
                        student.student_id,

                    class:
                        assignment.class,

                    term,

                    session:
                        assignment.session,

                    remark,

                    status:
                        "pending",

                    published_at:
                        null
                },
                {
                    onConflict:
                        "student_id,class,term,session"
                }
            );


    button.disabled =
        false;

    button.textContent =
        "Save Remark";


    message.textContent =
        error
            ? `Could not save remark: ${error.message}`
            : "Remark saved successfully.";
}


/* =========================
   CLOSE CLASS RESULT
========================= */

function closeClassResult() {

    $("classResultView")
        .classList
        .remove("show");


    state.selectedClassStudent =
        null;

    state.classResults =
        [];


    $("classResultTerm").innerHTML = `

        <option value="">
            Select Term
        </option>
    `;


    $("classTeacherRemark").value =
        "";

    $("remarkMessage").textContent =
        "";
}


/* =========================
   RESULT ASSIGNMENTS
========================= */

function renderResultAssignments() {

    $("resultAssignment").innerHTML =
        `
            <option value="">
                Select Class & Subject
            </option>
        ` +
        state.assignments
            .map(
                (assignment, index) =>
                    `<option value="${index}">
                        ${esc(assignment.class)}
                        —
                        ${esc(assignment.subject)}
                    </option>`
            )
            .join("");


    if (
        state.assignments.length === 1
    ) {

        $("resultAssignment").value =
            "0";

        handleAssignmentChange();
    }
}


function resetStudentSelect() {

    $("resultStudent").innerHTML = `

        <option value="">
            Select Student
        </option>
    `;
}


function handleAssignmentChange() {

    const value =
        $("resultAssignment").value;


    if (
        value === ""
    ) {

        state.selectedAssignment =
            null;

        state.resultStudents =
            [];

        resetStudentSelect();

        return;
    }


    state.selectedAssignment =
        state.assignments[
            Number(value)
        ] || null;


    state.resultStudents =
        state.students.filter(
            student =>
                norm(student.class) ===
                norm(
                    state.selectedAssignment?.class
                )
        );


    $("resultStudent").innerHTML =
        `
            <option value="">
                Select Student
            </option>
        ` +
        state.resultStudents
            .map(
                student =>
                    `<option value="${esc(student.student_id)}">
                        ${esc(student.student_id)}
                        -
                        ${esc(studentName(student))}
                    </option>`
            )
            .join("");
}


/* =========================
   OPEN RESULT ENTRY
========================= */

function openResultEntry() {

    if (
        !state.assignments.length
    ) {

        alert(
            "You do not have a subject assignment for result entry."
        );

        return;
    }


    $("resultEntryPanel")
        .classList
        .add("show");


    $("resultMessage").textContent =
        "";


    renderResultAssignments();


    $("resultEntryPanel")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


/* =========================
   CLOSE RESULT ENTRY
========================= */

function closeResultEntry() {

    $("resultEntryPanel")
        .classList
        .remove("show");


    [
        "resultAssignment",
        "resultTerm",
        "resultCA",
        "resultExam",
        "resultTotal",
        "resultGrade"
    ].forEach(
        id =>
            $(id).value = ""
    );


    resetStudentSelect();


    $("resultMessage").textContent =
        "";


    state.selectedAssignment =
        null;

    state.resultStudents =
        [];
}


/* =========================
   INVALIDATE REPORT
========================= */

async function invalidateReport(
    result
) {

    if (
        !result?.session
    ) {

        return;
    }


    await supabaseClient
        .from("student_reports")
        .update({
            status: "pending",
            published_at: null
        })
        .eq(
            "student_id",
            result.student_id
        )
        .eq(
            "class",
            result.class
        )
        .eq(
            "term",
            result.term
        )
        .eq(
            "session",
            result.session
        );
}


/* =========================
   SUBMIT RESULT
========================= */

async function submitResult() {

    const message =
        $("resultMessage");

    const button =
        $("submitResultBtn");

    const studentId =
        $("resultStudent").value;

    const term =
        $("resultTerm").value;

    const caValue =
        $("resultCA").value;

    const examValue =
        $("resultExam").value;

    const assignment =
        state.selectedAssignment;


    if (!assignment) {

        message.textContent =
            "Please select a class and subject.";

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
        caValue === "" ||
        examValue === ""
    ) {

        message.textContent =
            "Please enter both CA and Exam marks.";

        return;
    }


    const ca =
        Number(caValue);

    const exam =
        Number(examValue);


    if (
        !Number.isFinite(ca) ||
        ca < 0 ||
        ca > 40
    ) {

        message.textContent =
            "CA mark must be between 0 and 40.";

        return;
    }


    if (
        !Number.isFinite(exam) ||
        exam < 0 ||
        exam > 60
    ) {

        message.textContent =
            "Exam mark must be between 0 and 60.";

        return;
    }


    if (
        !hasAssignment(
            assignment.class,
            assignment.subject
        )
    ) {

        message.textContent =
            "You are not assigned to this class and subject.";

        return;
    }


    /*
     * IMPORTANT FIX:
     * Every result must have a session.
     */

    const classSession =
        state.classAssignments.find(
            item =>
                norm(item.class) ===
                norm(assignment.class)
        )?.session;


    const session =
        classSession ||
        state.currentSession;


    if (!session) {

        message.textContent =
            "No current school session was found.";

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Checking...";


    try {

        /*
         * Duplicate now includes session.
         */

        const {
            data: existing,
            error: checkError
        } =
            await supabaseClient
                .from("results")
                .select("id")
                .eq(
                    "student_id",
                    studentId
                )
                .eq(
                    "subject",
                    assignment.subject
                )
                .eq(
                    "class",
                    assignment.class
                )
                .eq(
                    "term",
                    term
                )
                .eq(
                    "session",
                    session
                )
                .limit(1);


        if (checkError) {
            throw checkError;
        }


        if (
            existing?.length
        ) {

            message.textContent =
                "A result already exists for this student, subject, class, term and session.";

            return;
        }


        button.textContent =
            "Submitting...";


        const total =
            ca + exam;


        const {
            error
        } =
            await supabaseClient
                .from("results")
                .insert([
                    {
                        student_id:
                            studentId,

                        subject:
                            assignment.subject,

                        class:
                            assignment.class,

                        ca,

                        exam,

                        total,

                        grade:
                            grade(total),

                        term,

                        session,

                        status:
                            "pending"
                    }
                ]);


        if (error) {
            throw error;
        }


        /*
         * If this report had already been approved,
         * adding/changing a score sends it back
         * for admin review.
         */

        await invalidateReport({
            student_id:
                studentId,

            class:
                assignment.class,

            term,

            session
        });


        message.textContent =
            "Result submitted successfully.";


        await loadTeacherResults();


        setTimeout(
            closeResultEntry,
            700
        );


    } catch (error) {

        console.error(error);


        message.textContent =
            "Could not submit result: " +
            error.message;

    } finally {

        button.disabled =
            false;

        button.textContent =
            "Submit Result";
    }
}


/* =========================
   FIX OLD MISSING SESSIONS
========================= */

async function repairMissingSessions() {

    if (
        !state.currentSession
    ) {

        return;
    }


    const classes =
        [
            ...new Set(
                state.assignments
                    .map(a => a.class)
                    .filter(Boolean)
            )
        ];


    for (
        const className
        of classes
    ) {

        const classSession =
            state.classAssignments.find(
                assignment =>
                    norm(assignment.class) ===
                    norm(className)
            )?.session ||
            state.currentSession;


        /*
         * Null sessions
         */

        const nullResponse =
            await supabaseClient
                .from("results")
                .select("id")
                .eq(
                    "class",
                    className
                )
                .is(
                    "session",
                    null
                );


        if (
            nullResponse.data?.length
        ) {

            await supabaseClient
                .from("results")
                .update({
                    session:
                        classSession
                })
                .in(
                    "id",
                    nullResponse.data.map(
                        result =>
                            result.id
                    )
                );
        }


        /*
         * Empty string sessions
         */

        const emptyResponse =
            await supabaseClient
                .from("results")
                .select("id")
                .eq(
                    "class",
                    className
                )
                .eq(
                    "session",
                    ""
                );


        if (
            emptyResponse.data?.length
        ) {

            await supabaseClient
                .from("results")
                .update({
                    session:
                        classSession
                })
                .in(
                    "id",
                    emptyResponse.data.map(
                        result =>
                            result.id
                    )
                );
        }
    }
}


/* =========================
   LOAD TEACHER RESULTS
========================= */

async function loadTeacherResults() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("results")
            .select("*")
            .order("student_id");


    if (error) {

        console.error(error);

        return;
    }


    state.results =
        (data || [])
            .filter(
                result =>
                    hasAssignment(
                        result.class,
                        result.subject
                    )
            )
            .map(
                result => {

                    const student =
                        state.students.find(
                            item =>
                                String(
                                    item.student_id
                                ) ===
                                String(
                                    result.student_id
                                )
                        );


                    return {
                        ...result,
                        studentName:
                            studentName(student)
                    };
                }
            );


    $("resultCount").textContent =
        state.results.length;


    $("pendingResultCount").textContent =
        state.results.filter(
            result =>
                norm(
                    result.status ||
                    "pending"
                ) ===
                "pending"
        ).length;


    $("publishedResultCount").textContent =
        state.results.filter(
            result =>
                norm(
                    result.status
                ) ===
                "published"
        ).length;


    $("rejectedResultCount").textContent =
        state.results.filter(
            result =>
                norm(
                    result.status
                ) ===
                "rejected"
        ).length;


    populateResultFilters();

    renderResultsTable();
}


/* =========================
   RESULT FILTERS
========================= */

function populateResultFilters() {

    const classes =
        [
            ...new Set(
                state.assignments
                    .map(a => a.class)
                    .filter(Boolean)
            )
        ];


    const subjects =
        [
            ...new Set(
                state.assignments
                    .map(a => a.subject)
                    .filter(Boolean)
            )
        ];


    const currentClass =
        $("resultClassFilter").value;

    const currentSubject =
        $("resultSubjectFilter").value;


    $("resultClassFilter").innerHTML =
        `
            <option value="">
                All Classes
            </option>
        ` +
        classes
            .map(
                value =>
                    `<option value="${esc(value)}">
                        ${esc(value)}
                    </option>`
            )
            .join("");


    $("resultSubjectFilter").innerHTML =
        `
            <option value="">
                All Subjects
            </option>
        ` +
        subjects
            .map(
                value =>
                    `<option value="${esc(value)}">
                        ${esc(value)}
                    </option>`
            )
            .join("");


    if (
        classes.includes(
            currentClass
        )
    ) {

        $("resultClassFilter").value =
            currentClass;
    }


    if (
        subjects.includes(
            currentSubject
        )
    ) {

        $("resultSubjectFilter").value =
            currentSubject;
    }
}


function getFilteredResults() {

    const search =
        norm(
            $("resultSearch").value
        );

    const classFilter =
        norm(
            $("resultClassFilter").value
        );

    const subjectFilter =
        norm(
            $("resultSubjectFilter").value
        );

    const termFilter =
        norm(
            $("resultTermFilter").value
        );

    const statusFilter =
        norm(
            $("resultStatusFilter").value
        );


    return state.results.filter(
        result => {

            const searchable =
                norm(
                    [
                        result.student_id,
                        result.studentName,
                        result.class,
                        result.subject,
                        result.term,
                        result.status
                    ].join(" ")
                );


            return (

                (
                    !search ||
                    searchable.includes(
                        search
                    )
                )

                &&

                (
                    !classFilter ||
                    norm(
                        result.class
                    ) ===
                    classFilter
                )

                &&

                (
                    !subjectFilter ||
                    norm(
                        result.subject
                    ) ===
                    subjectFilter
                )

                &&

                (
                    !termFilter ||
                    norm(
                        result.term
                    ) ===
                    termFilter
                )

                &&

                (
                    !statusFilter ||
                    norm(
                        result.status ||
                        "pending"
                    ) ===
                    statusFilter
                )
            );
        }
    );
}


/* =========================
   RESULT TABLE
========================= */

function renderResultsTable() {

    const results =
        getFilteredResults();


    if (!results.length) {

        $("resultsTable").innerHTML = `

            <tr>

                <td colspan="11">
                    No results found.
                </td>

            </tr>
        `;

        return;
    }


    $("resultsTable").innerHTML =
        results
            .map(
                result => {

                    const ca =
                        Number(
                            result.ca
                        ) || 0;

                    const exam =
                        Number(
                            result.exam
                        ) || 0;

                    const storedTotal =
                        Number(
                            result.total
                        );

                    const total =
                        Number.isFinite(
                            storedTotal
                        )
                            ? storedTotal
                            : ca + exam;


                    return `

                        <tr>

                            <td>
                                ${esc(
                                    result.student_id || "--"
                                )}
                            </td>

                            <td>
                                ${esc(
                                    result.studentName || "--"
                                )}
                            </td>

                            <td>
                                ${esc(
                                    result.class || "--"
                                )}
                            </td>

                            <td>
                                ${esc(
                                    result.subject || "--"
                                )}
                            </td>

                            <td>
                                ${ca}
                            </td>

                            <td>
                                ${exam}
                            </td>

                            <td>
                                ${total}
                            </td>

                            <td>
                                ${esc(
                                    result.grade ||
                                    grade(total)
                                )}
                            </td>

                            <td>
                                ${esc(
                                    result.term || "--"
                                )}
                            </td>

                            <td>

                                <span
                                    class="status-badge status-${esc(
                                        norm(
                                            result.status ||
                                            "pending"
                                        )
                                    )}"
                                >
                                    ${esc(
                                        result.status ||
                                        "pending"
                                    )}
                                </span>

                            </td>

                            <td>

                                <button
                                    type="button"
                                    class="edit-btn"
                                    data-edit="${result.id}"
                                >
                                    Edit
                                </button>

                            </td>

                        </tr>
                    `;

                }
            )
            .join("");


    document
        .querySelectorAll(
            "[data-edit]"
        )
        .forEach(
            button => {

                button.onclick =
                    () => {

                        const result =
                            state.results.find(
                                item =>
                                    String(item.id) ===
                                    String(
                                        button.dataset.edit
                                    )
                            );


                        if (result) {

                            openEdit(
                                result
                            );
                        }
                    };

            }
        );
}


/* =========================
   EDIT RESULT
========================= */

function openEdit(
    result
) {

    if (
        !result ||
        !hasAssignment(
            result.class,
            result.subject
        )
    ) {

        alert(
            "You are not assigned to this result."
        );

        return;
    }


    state.edit =
        result;


    $("editStudentName").textContent =
        result.studentName || "--";

    $("editStudentId").textContent =
        result.student_id || "--";

    $("editClass").textContent =
        result.class || "--";

    $("editSubject").textContent =
        result.subject || "--";

    $("editTerm").textContent =
        result.term || "--";

    $("editCA").value =
        result.ca ?? 0;

    $("editExam").value =
        result.exam ?? 0;

    $("editMessage").textContent =
        "";


    calculate(
        "editCA",
        "editExam",
        "editTotal",
        "editGrade"
    );


    $("editPanel")
        .classList
        .add("show");


    $("editPanel")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


function cancelEdit() {

    state.edit =
        null;


    $("editPanel")
        .classList
        .remove("show");


    $("editMessage").textContent =
        "";
}


/* =========================
   SAVE EDIT
========================= */

async function saveEdit() {

    const result =
        state.edit;

    const message =
        $("editMessage");

    const button =
        $("saveBtn");


    if (!result) {
        return;
    }


    const ca =
        Number(
            $("editCA").value
        );

    const exam =
        Number(
            $("editExam").value
        );


    if (
        !Number.isFinite(ca) ||
        ca < 0 ||
        ca > 40
    ) {

        message.textContent =
            "CA mark must be between 0 and 40.";

        return;
    }


    if (
        !Number.isFinite(exam) ||
        exam < 0 ||
        exam > 60
    ) {

        message.textContent =
            "Exam mark must be between 0 and 60.";

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Saving...";


    const total =
        ca + exam;


    try {

        const {
            error
        } =
            await supabaseClient
                .from("results")
                .update({
                    ca,
                    exam,
                    total,
                    grade:
                        grade(total),
                    status:
                        "pending"
                })
                .eq(
                    "id",
                    result.id
                );


        if (error) {
            throw error;
        }


        await invalidateReport(
            result
        );


        message.textContent =
            "Result updated successfully.";


        await loadTeacherResults();


        setTimeout(
            cancelEdit,
            700
        );


    } catch (error) {

        console.error(error);


        message.textContent =
            "Could not update result: " +
            error.message;

    } finally {

        button.disabled =
            false;

        button.textContent =
            "Save Changes";
    }
}


/* =========================
   CLEAR FILTERS
========================= */

function clearFilters() {

    [
        "resultSearch",
        "resultClassFilter",
        "resultSubjectFilter",
        "resultTermFilter",
        "resultStatusFilter"
    ].forEach(
        id =>
            $(id).value = ""
    );


    renderResultsTable();
}


/* =========================
   NAVIGATION
========================= */

function setupNavigation() {

    document
        .querySelectorAll(
            ".nav-link"
        )
        .forEach(
            link => {

                link.onclick =
                    () => {

                        document
                            .querySelectorAll(
                                ".nav-link"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        link.classList.add(
                            "active"
                        );


                        $("sidebar")
                            .classList
                            .remove("open");


                        $("sidebarOverlay")
                            .classList
                            .remove("show");
                    };

            }
        );
}


/* =========================
   LOAD DASHBOARD
========================= */

async function init() {

    try {

        await loadBaseData();

        renderProfile();

        renderAssignments();

        setupMyClass();


        /*
         * Fix old results that did
         * not save session.
         */

        await repairMissingSessions();


        await loadTeacherResults();


    } catch (error) {

        console.error(error);


        alert(
            "Could not load teacher dashboard: " +
            error.message
        );
    }
}


/* =========================
   EVENTS
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {


        $("logoutBtn").onclick =
            logout;


        $("sidebarLogoutBtn").onclick =
            logout;


        $("menuBtn").onclick =
            () => {

                $("sidebar")
                    .classList
                    .add("open");

                $("sidebarOverlay")
                    .classList
                    .add("show");
            };


        $("sidebarOverlay").onclick =
            () => {

                $("sidebar")
                    .classList
                    .remove("open");

                $("sidebarOverlay")
                    .classList
                    .remove("show");
            };


        $("classTeacherClassSelect").onchange =
            () => {

                closeClassResult();

                loadClassStudents();
            };


        $("classResultTerm").onchange =
            renderClassResult;


        $("closeClassResultBtn").onclick =
            closeClassResult;


        $("saveRemarkBtn").onclick =
            saveRemark;


        $("addResultBtn").onclick =
            openResultEntry;


        $("cancelResultBtn").onclick =
            closeResultEntry;


        $("submitResultBtn").onclick =
            submitResult;


        $("resultAssignment").onchange =
            handleAssignmentChange;


        $("resultCA").oninput =
            () =>
                calculate(
                    "resultCA",
                    "resultExam",
                    "resultTotal",
                    "resultGrade"
                );


        $("resultExam").oninput =
            () =>
                calculate(
                    "resultCA",
                    "resultExam",
                    "resultTotal",
                    "resultGrade"
                );


        $("saveBtn").onclick =
            saveEdit;


        $("cancelBtn").onclick =
            cancelEdit;


        $("editCA").oninput =
            () =>
                calculate(
                    "editCA",
                    "editExam",
                    "editTotal",
                    "editGrade"
                );


        $("editExam").oninput =
            () =>
                calculate(
                    "editCA",
                    "editExam",
                    "editTotal",
                    "editGrade"
                );


        $("resultSearch").oninput =
            renderResultsTable;


        [
            "resultClassFilter",
            "resultSubjectFilter",
            "resultTermFilter",
            "resultStatusFilter"
        ].forEach(
            id => {

                $(id).onchange =
                    renderResultsTable;
            }
        );


        $("clearResultFilters").onclick =
            clearFilters;


        setupNavigation();

        init();

    }
);