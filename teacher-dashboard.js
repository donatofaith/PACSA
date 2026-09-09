const $ = id => document.getElementById(id);
const norm = v => String(v ?? "").trim().toLowerCase();

const esc = v =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const personName = person =>
    `${person?.first_name || ""} ${person?.last_name || ""}`.trim();

const grade = total =>
    total >= 70 ? "A" :
    total >= 60 ? "B" :
    total >= 50 ? "C" :
    total >= 45 ? "D" :
    total >= 40 ? "E" : "F";


const PROFILE_BUCKET = "profile-photos";
const DEFAULT_PHOTO = "images/PACSA LOGO.png";
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

const state = {
    teacher: null,
    user: null,
    assignments: [],
    classAssignments: [],
    students: [],
    studentSubjects: [],
    results: [],
    currentSession: "",
    selectedAssignment: null,
    selectedClassAssignment: null,
    selectedClassStudent: null,
    classResults: [],
    editingResult: null
};


/* =====================================================
   AUTH
===================================================== */

async function logout() {

    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error(error);
    }

    localStorage.removeItem("teacher");
    localStorage.removeItem("teacherAssignments");
    localStorage.removeItem("classTeacherAssignments");

    window.location.replace("teacher-login.html");
}


function hasSubjectAssignment(className, subject) {

    return state.assignments.some(a =>
        norm(a.class) === norm(className) &&
        norm(a.subject) === norm(subject)
    );
}


function isClassTeacher(className, session) {

    return state.classAssignments.some(a =>
        norm(a.class) === norm(className) &&
        norm(a.session) === norm(session)
    );
}


/* =====================================================
   SESSION
===================================================== */

async function loadCurrentSession() {

    const { data } = await supabaseClient
        .from("sessions_terms")
        .select("session")
        .eq("is_current", true)
        .limit(1)
        .maybeSingle();

    if (data?.session) {
        state.currentSession = data.session;
        return;
    }

    const { data: latest } = await supabaseClient
        .from("sessions_terms")
        .select("session,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    state.currentSession =
        latest?.session ||
        state.classAssignments[0]?.session ||
        "";
}


async function loadStudentSubjects() {

    if (!state.currentSession) {
        state.studentSubjects = [];
        return;
    }

    const { data, error } = await supabaseClient
        .from("student_subjects")
        .select("*")
        .eq("session", state.currentSession);

    if (error) {
        console.error(error);
        state.studentSubjects = [];
        return;
    }

    state.studentSubjects = data || [];
}


/* =====================================================
   LOAD TEACHER
===================================================== */

async function loadTeacherData() {

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) throw error;

    const user = data?.session?.user;

    if (!user) {
        await logout();
        return;
    }

    state.user = user;


    const { data: teacher, error: teacherError } =
        await supabaseClient
            .from("Teachers")
            .select(`
                id,
                teacher_id,
                first_name,
                last_name,
                email,
                phone,
                subject,
                class,
                auth_user_id,
                portal_status,
                profile_photo_path
            `)
            .eq("auth_user_id", user.id)
            .maybeSingle();


    if (teacherError) throw teacherError;


    if (!teacher) {
        alert(
            "This account is not linked to a PACSA teacher."
        );

        await logout();
        return;
    }


    if (norm(teacher.portal_status) !== "active") {
        alert(
            "Your Teacher Portal account is not active."
        );

        await logout();
        return;
    }


    state.teacher = teacher;


    const [
        subjectResponse,
        classResponse,
        studentResponse
    ] = await Promise.all([

        supabaseClient
            .from("teacher_assignments")
            .select("*")
            .eq("teacher_id", teacher.teacher_id),

        supabaseClient
            .from("class_teacher_assignments")
            .select("*")
            .eq("teacher_id", teacher.teacher_id),

        supabaseClient
            .from("students")
            .select(`
                student_id,
                first_name,
                last_name,
                class,
                status
            `)
            .order("student_id")
    ]);


    if (subjectResponse.error)
        throw subjectResponse.error;

    if (classResponse.error)
        throw classResponse.error;

    if (studentResponse.error)
        throw studentResponse.error;


    state.assignments =
        subjectResponse.data || [];

    state.classAssignments =
        classResponse.data || [];

    state.students =
        studentResponse.data || [];


    if (
        !state.assignments.length &&
        !state.classAssignments.length
    ) {

        alert(
            "No responsibility has been assigned to this teacher."
        );

        await logout();
        return;
    }


    localStorage.setItem(
        "teacher",
        JSON.stringify(state.teacher)
    );

    localStorage.setItem(
        "teacherAssignments",
        JSON.stringify(state.assignments)
    );

    localStorage.setItem(
        "classTeacherAssignments",
        JSON.stringify(state.classAssignments)
    );


    await loadCurrentSession();
    await loadStudentSubjects();

    renderProfile();
    renderAssignments();
    setupClassTeacherArea();

    await loadProfilePhoto();
    await loadTeacherResults();
}


/* =====================================================
   PROFILE
===================================================== */

function renderProfile() {

    const teacher = state.teacher;

    const name =
        personName(teacher) ||
        "Teacher";


    const subjects = [
        ...new Set(
            state.assignments
                .map(a => a.subject)
                .filter(Boolean)
        )
    ];


    const classes = [
        ...new Set(
            [
                ...state.assignments,
                ...state.classAssignments
            ]
                .map(a => a.class)
                .filter(Boolean)
        )
    ];


    if ($("topTeacherName"))
        $("topTeacherName").textContent = name;

    if ($("welcomeTeacherName"))
        $("welcomeTeacherName").textContent = name;

    if ($("teacherName"))
        $("teacherName").textContent = name;

    if ($("topTeacherId"))
        $("topTeacherId").textContent =
            teacher.teacher_id || "--";

    if ($("teacherId"))
        $("teacherId").textContent =
            teacher.teacher_id || "--";

    if ($("teacherEmail"))
        $("teacherEmail").textContent =
            teacher.email || "--";

    if ($("teacherPhone"))
        $("teacherPhone").textContent =
            teacher.phone || "--";

    if ($("teacherSubject"))
        $("teacherSubject").textContent =
            subjects.join(", ") || "--";

    if ($("teacherClass"))
        $("teacherClass").textContent =
            classes.join(", ") || "--";

    if ($("teacherStatus"))
        $("teacherStatus").textContent =
            "Active Account";

    if ($("assignmentCount"))
        $("assignmentCount").textContent =
            state.assignments.length;

    if ($("classCount"))
        $("classCount").textContent =
            classes.length;


    if (state.classAssignments.length) {

        if ($("classTeacherBadge"))
            $("classTeacherBadge").style.display =
                "inline-flex";

        if ($("classTeacherProfileRow"))
            $("classTeacherProfileRow").style.display =
                "flex";

        if ($("teacherClassTeacher")) {

            $("teacherClassTeacher").textContent =
                state.classAssignments
                    .map(
                        a =>
                            `${a.class} (${a.session})`
                    )
                    .join(", ");
        }
    }
}


/* =====================================================
   PROFILE PHOTO
===================================================== */

function setProfilePhoto(url = DEFAULT_PHOTO) {

    ["teacherAvatar", "miniAvatar"]
        .forEach(id => {

            const image = $(id);

            if (!image) return;

            image.src = url;

            image.onerror = () => {
                image.onerror = null;
                image.src = DEFAULT_PHOTO;
            };
        });
}


async function loadProfilePhoto() {

    const path =
        state.teacher?.profile_photo_path;

    if (!path) {
        setProfilePhoto();
        return;
    }

    const { data, error } =
        await supabaseClient.storage
            .from(PROFILE_BUCKET)
            .createSignedUrl(
                path,
                3600
            );

    if (error) {
        console.error(error);
        setProfilePhoto();
        return;
    }

    setProfilePhoto(
        data?.signedUrl
    );
}


async function uploadProfilePhoto(file) {

    const message =
        $("teacherPhotoMessage");

    const loading =
        $("teacherPhotoLoading");

    const button =
        $("changeTeacherPhotoBtn");


    const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (!allowed.includes(file.type)) {

        if (message)
            message.textContent =
                "Choose a JPG, PNG or WebP image.";

        return;
    }


    if (file.size > MAX_PHOTO_SIZE) {

        if (message)
            message.textContent =
                "Profile photo must be 2 MB or smaller.";

        return;
    }


    const extension =
        file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
            ? "webp"
            : "jpg";


    const path =
        `teachers/${state.user.id}/profile.${extension}`;


    if (button)
        button.disabled = true;

    loading?.classList.add("show");

    if (message)
        message.textContent = "";


    try {

        const oldPath =
            state.teacher.profile_photo_path;


        const { error: uploadError } =
            await supabaseClient.storage
                .from(PROFILE_BUCKET)
                .upload(
                    path,
                    file,
                    {
                        upsert: true,
                        contentType: file.type
                    }
                );


        if (uploadError)
            throw uploadError;


        const { error: updateError } =
            await supabaseClient
                .from("Teachers")
                .update({
                    profile_photo_path: path
                })
                .eq(
                    "auth_user_id",
                    state.user.id
                );


        if (updateError)
            throw updateError;


        if (
            oldPath &&
            oldPath !== path
        ) {

            await supabaseClient.storage
                .from(PROFILE_BUCKET)
                .remove([oldPath]);
        }


        state.teacher.profile_photo_path =
            path;


        await loadProfilePhoto();


        if (message)
            message.textContent =
                "Profile photo updated.";


    } catch (error) {

        console.error(error);

        if (message)
            message.textContent =
                `Could not upload photo: ${error.message}`;

    } finally {

        if (button)
            button.disabled = false;

        loading?.classList.remove("show");

        if ($("teacherPhotoInput"))
            $("teacherPhotoInput").value = "";
    }
}


/* =====================================================
   ASSIGNMENTS
===================================================== */

function renderAssignments() {

    const container =
        $("assignmentCards");


    if (container) {

        container.innerHTML =
            state.assignments.length

                ? state.assignments
                    .map(
                        (a, i) => `

                        <div class="assignment-card">

                            <div class="assignment-number">
                                ${i + 1}
                            </div>

                            <span>
                                Subject
                            </span>

                            <h3>
                                ${esc(a.subject)}
                            </h3>

                            <div class="assignment-class">
                                Class:
                                ${esc(a.class)}
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
    }


    const classes = [
        ...new Set(
            [
                ...state.assignments,
                ...state.classAssignments
            ].map(a => norm(a.class))
        )
    ];


    if ($("studentCount")) {

        $("studentCount").textContent =
            state.students.filter(
                student =>
                    classes.includes(
                        norm(student.class)
                    )
            ).length;
    }
}


/* =====================================================
   CLASS TEACHER
===================================================== */

function setupClassTeacherArea() {

    if (!state.classAssignments.length) {

        if ($("myClassNavLink"))
            $("myClassNavLink").style.display =
                "none";

        if ($("myClassSection")) {
            $("myClassSection").style.display =
                "none";
            $("myClassSection").classList.remove("show");
        }

        return;
    }


    if ($("myClassNavLink"))
        $("myClassNavLink").style.display =
            "flex";

    if ($("myClassSection")) {
        $("myClassSection").style.display =
            "block";
        $("myClassSection").classList.add("show");
    }

    if ($("classSelectorWrapper"))
        $("classSelectorWrapper").style.display =
            "block";


    const select =
        $("classTeacherClassSelect");


    if (select) {

        select.innerHTML =
            state.classAssignments
                .map(
                    (a, i) => `

                    <option value="${i}">
                        ${esc(a.class)}
                        —
                        ${esc(a.session)}
                    </option>
                `
                )
                .join("");
    }


    if ($("classTeacherCards")) {

        $("classTeacherCards").innerHTML =
            state.classAssignments
                .map(
                    a => `

                    <div class="class-teacher-card">

                        <div class="class-teacher-card-top">

                            <div>
                                <p>Class Teacher</p>

                                <h3>
                                    ${esc(a.class)}
                                </h3>
                            </div>

                            <div class="class-teacher-icon">
                                🏫
                            </div>

                        </div>

                        <div class="class-session">

                            <span>Session</span>

                            <strong>
                                ${esc(a.session)}
                            </strong>

                        </div>

                    </div>
                `
                )
                .join("");
    }


    createSubmitButton();
    loadClassStudents();
}


function createSubmitButton() {

    if ($("submitReportBtn"))
        return;


    const save =
        $("saveRemarkBtn");


    if (!save)
        return;


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "submitReportBtn";

    button.type =
        "button";

    button.className =
        "save-btn";

    button.textContent =
        "Submit to Admin";


    save.insertAdjacentElement(
        "afterend",
        button
    );


    button.addEventListener(
        "click",
        submitReport
    );
}


function loadClassStudents() {

    const select =
        $("classTeacherClassSelect");


    if (
        !select ||
        !state.classAssignments.length
    ) return;


    const assignment =
        state.classAssignments[
            Number(select.value || 0)
        ];


    state.selectedClassAssignment =
        assignment;


    const students =
        state.students.filter(
            student =>
                norm(student.class) ===
                norm(assignment.class)
        );


    if ($("classStudentCount")) {

        $("classStudentCount").textContent =
            `${students.length} student${
                students.length === 1
                    ? ""
                    : "s"
            }`;
    }


    const table =
        $("classStudentsTable");


    if (!table)
        return;


    table.innerHTML =
        students.length

            ? students
                .map(
                    (student, index) => `

                    <tr>

                        <td>
                            ${esc(student.student_id)}
                        </td>

                        <td>
                            ${esc(
                                personName(student) ||
                                "Student"
                            )}
                        </td>

                        <td>
                            ${esc(student.class)}
                        </td>

                        <td>
                            ${esc(
                                student.status ||
                                "Active"
                            )}
                        </td>

                        <td>

                            <button
                                type="button"
                                class="class-view-btn"
                                data-student="${index}"
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
                    <td colspan="5">
                        No students found.
                    </td>
                </tr>
            `;


    document
        .querySelectorAll(
            "[data-student]"
        )
        .forEach(button => {

            button.onclick = () =>
                openClassResult(
                    students[
                        Number(
                            button.dataset.student
                        )
                    ]
                );
        });
}


async function openClassResult(student) {

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
            "You are not the class teacher for this class."
        );

        return;
    }


    state.selectedClassStudent =
        student;


    if ($("classResultStudentName"))
        $("classResultStudentName").textContent =
            personName(student) ||
            "Student";

    if ($("classResultStudentId"))
        $("classResultStudentId").textContent =
            student.student_id;

    if ($("classResultClass"))
        $("classResultClass").textContent =
            assignment.class;

    if ($("classResultSession"))
        $("classResultSession").textContent =
            assignment.session;


    $("classResultView")
        ?.classList
        .add("show");


    const { data, error } =
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

        console.error(error);

        return;
    }


    state.classResults =
        data || [];


    setupClassTerms();
}


function setupClassTerms() {

    const select =
        $("classResultTerm");


    if (!select)
        return;


    const termOrder = [
        "First Term",
        "Second Term",
        "Third Term"
    ];


    const terms = [
        ...new Set(
            state.classResults
                .map(r => r.term)
                .filter(Boolean)
        )
    ];


    terms.sort(
        (a, b) =>
            termOrder.indexOf(a) -
            termOrder.indexOf(b)
    );


    select.innerHTML = `

        <option value="">
            Select Term
        </option>

        ${terms
            .map(
                term => `

                <option value="${esc(term)}">
                    ${esc(term)}
                </option>
            `
            )
            .join("")}
    `;


    if (!terms.length) {

        if ($("classFullResultTable")) {

            $("classFullResultTable")
                .innerHTML = `

                <tr>

                    <td colspan="5">
                        No result entered yet.
                    </td>

                </tr>
            `;
        }

        resetClassSummary();

        return;
    }


    select.value =
        terms[0];


    renderClassResult();
}


function renderClassResult() {

    const term =
        $("classResultTerm")?.value;


    const rows =
        state.classResults.filter(
            r =>
                norm(r.term) ===
                norm(term)
        );


    if (!rows.length) {

        resetClassSummary();

        return;
    }


    let totalScore = 0;
    let passed = 0;


    $("classFullResultTable").innerHTML =
        rows.map(result => {

            const ca =
                Number(result.ca) || 0;

            const exam =
                Number(result.exam) || 0;

            const total =
                Number(result.total) ||
                ca + exam;


            totalScore += total;

            if (total >= 40)
                passed++;


            return `

                <tr>

                    <td>
                        ${esc(result.subject)}
                    </td>

                    <td>${ca}</td>

                    <td>${exam}</td>

                    <td>
                        <strong>${total}</strong>
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
        }).join("");


    if ($("classResultSubjectCount"))
        $("classResultSubjectCount").textContent =
            rows.length;

    if ($("classResultAverage"))
        $("classResultAverage").textContent =
            `${(
                totalScore /
                rows.length
            ).toFixed(1)}%`;

    if ($("classResultPassed"))
        $("classResultPassed").textContent =
            passed;

    if ($("classResultFailed"))
        $("classResultFailed").textContent =
            rows.length - passed;


    loadRemark();
}


function resetClassSummary() {

    if ($("classResultSubjectCount"))
        $("classResultSubjectCount").textContent =
            "0";

    if ($("classResultAverage"))
        $("classResultAverage").textContent =
            "0%";

    if ($("classResultPassed"))
        $("classResultPassed").textContent =
            "0";

    if ($("classResultFailed"))
        $("classResultFailed").textContent =
            "0";
}


/* =====================================================
   REMARK
===================================================== */

async function loadRemark() {

    const student =
        state.selectedClassStudent;

    const assignment =
        state.selectedClassAssignment;

    const term =
        $("classResultTerm")?.value;


    if (
        !student ||
        !assignment ||
        !term
    ) return;


    const { data, error } =
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


    if (error) {

        console.error(error);

        return;
    }


    if ($("classTeacherRemark"))
        $("classTeacherRemark").value =
            data?.remark || "";


    if (
        $("remarkMessage") &&
        data
    ) {

        $("remarkMessage").textContent =
            `Report status: ${
                data.status || "draft"
            }`;
    }
}


async function saveRemark() {

    await saveReportStatus(
        "draft"
    );
}


async function submitReport() {

    await saveReportStatus(
        "pending"
    );
}


async function saveReportStatus(status) {

    const student =
        state.selectedClassStudent;

    const assignment =
        state.selectedClassAssignment;

    const term =
        $("classResultTerm")?.value;

    const remark =
        $("classTeacherRemark")
            ?.value
            .trim();

    const message =
        $("remarkMessage");


    if (
        !student ||
        !assignment
    ) {

        if (message)
            message.textContent =
                "Select a student.";

        return;
    }


    if (!term) {

        if (message)
            message.textContent =
                "Select a term.";

        return;
    }


    if (!remark) {

        if (message)
            message.textContent =
                "Enter a class teacher remark.";

        return;
    }


    if (
        !isClassTeacher(
            assignment.class,
            assignment.session
        )
    ) {

        if (message)
            message.textContent =
                "You are not the class teacher.";

        return;
    }


    if (
        status === "pending" &&
        !state.classResults.some(
            r =>
                norm(r.term) ===
                norm(term)
        )
    ) {

        if (message)
            message.textContent =
                "This student has no result yet.";

        return;
    }


    if (
        status === "pending" &&
        !confirm(
            `Submit ${
                personName(student) ||
                student.student_id
            }'s complete ${term} report to Admin?`
        )
    ) return;


    const { error } =
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

                    status,

                    published_at:
                        null
                },
                {
                    onConflict:
                        "student_id,class,term,session"
                }
            );


    if (message) {

        message.textContent =
            error

                ? `Could not save: ${error.message}`

                : status === "pending"

                    ? "Complete report submitted to Admin."

                    : "Remark saved as draft.";
    }
}


function closeClassResult() {

    $("classResultView")
        ?.classList
        .remove("show");

    state.selectedClassStudent =
        null;

    state.classResults =
        [];
}


/* =====================================================
   RESULT ENTRY
===================================================== */

function openResultEntry() {

    if (!state.assignments.length) {

        alert(
            "You have no subject assignment."
        );

        return;
    }


    const select =
        $("resultAssignment");


    select.innerHTML = `

        <option value="">
            Select Class & Subject
        </option>

        ${state.assignments
            .map(
                (a, i) => `

                <option value="${i}">
                    ${esc(a.class)}
                    —
                    ${esc(a.subject)}
                </option>
            `
            )
            .join("")}
    `;


    $("resultEntryPanel")
        ?.classList
        .add("show");
}


function closeResultEntry() {

    $("resultEntryPanel")
        ?.classList
        .remove("show");

    state.selectedAssignment =
        null;
}


function handleAssignmentChange() {

    const index =
        $("resultAssignment")?.value;


    if (index === "") {

        state.selectedAssignment =
            null;

        return;
    }


    const assignment =
        state.assignments[
            Number(index)
        ];


    state.selectedAssignment =
        assignment;


    const registeredIds =
        state.studentSubjects

            .filter(
                r =>
                    norm(r.class) ===
                        norm(assignment.class)

                    &&

                    norm(r.subject) ===
                        norm(assignment.subject)

                    &&

                    norm(r.session) ===
                        norm(state.currentSession)
            )

            .map(
                r =>
                    String(r.student_id)
            );


    const students =
        state.students.filter(
            student =>
                norm(student.class) ===
                    norm(assignment.class)

                &&

                registeredIds.includes(
                    String(
                        student.student_id
                    )
                )
        );


    $("resultStudent").innerHTML = `

        <option value="">
            Select Student
        </option>

        ${students
            .map(
                student => `

                <option
                    value="${esc(
                        student.student_id
                    )}"
                >
                    ${esc(
                        student.student_id
                    )}
                    -
                    ${esc(
                        personName(student) ||
                        "Student"
                    )}
                </option>
            `
            )
            .join("")}
    `;
}


function calculateResult() {

    const ca =
        Number(
            $("resultCA")?.value ||
            0
        );

    const exam =
        Number(
            $("resultExam")?.value ||
            0
        );

    const total =
        ca + exam;


    if ($("resultTotal"))
        $("resultTotal").value =
            total;

    if ($("resultGrade"))
        $("resultGrade").value =
            grade(total);
}


async function submitResult() {

    const assignment =
        state.selectedAssignment;

    const studentId =
        $("resultStudent")?.value;

    const term =
        $("resultTerm")?.value;

    const ca =
        Number(
            $("resultCA")?.value
        );

    const exam =
        Number(
            $("resultExam")?.value
        );

    const message =
        $("resultMessage");


    if (
        !assignment ||
        !studentId ||
        !term
    ) {

        if (message)
            message.textContent =
                "Complete all result fields.";

        return;
    }


    if (
        ca < 0 ||
        ca > 40
    ) {

        if (message)
            message.textContent =
                "CA must be between 0 and 40.";

        return;
    }


    if (
        exam < 0 ||
        exam > 60
    ) {

        if (message)
            message.textContent =
                "Exam must be between 0 and 60.";

        return;
    }


    if (
        !hasSubjectAssignment(
            assignment.class,
            assignment.subject
        )
    ) {

        if (message)
            message.textContent =
                "This subject is not assigned to you.";

        return;
    }


    const registered =
        state.studentSubjects.some(
            r =>
                String(r.student_id) ===
                    String(studentId)

                &&

                norm(r.subject) ===
                    norm(assignment.subject)

                &&

                norm(r.class) ===
                    norm(assignment.class)

                &&

                norm(r.session) ===
                    norm(state.currentSession)
        );


    if (!registered) {

        if (message)
            message.textContent =
                "Student is not registered for this subject.";

        return;
    }


    const total =
        ca + exam;


    const { data: existing } =
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
                state.currentSession
            )
            .maybeSingle();


    if (existing) {

        if (message)
            message.textContent =
                "A result already exists. Use Edit.";

        return;
    }


    const { error } =
        await supabaseClient
            .from("results")
            .insert({
                student_id:
                    studentId,

                subject:
                    assignment.subject,

                class:
                    assignment.class,

                term,

                session:
                    state.currentSession,

                ca,

                exam,

                total,

                grade:
                    grade(total),

                status:
                    "pending"
            });


    if (error) {

        if (message)
            message.textContent =
                error.message;

        return;
    }


    await resetReportToDraft({
        student_id:
            studentId,

        class:
            assignment.class,

        term,

        session:
            state.currentSession
    });


    if (message)
        message.textContent =
            "Result saved successfully.";


    $("resultCA").value =
        "";

    $("resultExam").value =
        "";


    calculateResult();

    await loadTeacherResults();
}


/* =====================================================
   RESET REPORT
===================================================== */

async function resetReportToDraft(result) {

    await supabaseClient
        .from("student_reports")
        .update({
            status:
                "draft",

            published_at:
                null
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


/* =====================================================
   LOAD RESULTS
===================================================== */

async function loadTeacherResults() {

    const { data, error } =
        await supabaseClient
            .from("results")
            .select("*")
            .order(
                "id",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(error);

        return;
    }


    state.results =
        (data || [])

            .filter(
                result =>
                    hasSubjectAssignment(
                        result.class,
                        result.subject
                    )
            )

            .map(
                result => {

                    const student =
                        state.students.find(
                            s =>
                                String(
                                    s.student_id
                                ) ===
                                String(
                                    result.student_id
                                )
                        );


                    return {
                        ...result,

                        studentName:
                            personName(student) ||
                            result.student_id
                    };
                }
            );


    renderResultStatistics();
    populateFilters();
    renderResultsTable();
}


function renderResultStatistics() {

    const total =
        state.results.length;


    if ($("resultCount"))
        $("resultCount").textContent =
            total;


    if ($("pendingResultCount"))
        $("pendingResultCount").textContent =
            state.results.filter(
                r =>
                    norm(r.status) ===
                    "pending"
            ).length;


    if ($("publishedResultCount"))
        $("publishedResultCount").textContent =
            state.results.filter(
                r =>
                    norm(r.status) ===
                    "published"
            ).length;


    if ($("rejectedResultCount"))
        $("rejectedResultCount").textContent =
            state.results.filter(
                r =>
                    norm(r.status) ===
                    "rejected"
            ).length;
}


function populateFilters() {

    if (
        !$("resultClassFilter") ||
        !$("resultSubjectFilter")
    ) return;


    const classes = [
        ...new Set(
            state.assignments.map(
                a => a.class
            )
        )
    ];


    const subjects = [
        ...new Set(
            state.assignments.map(
                a => a.subject
            )
        )
    ];


    $("resultClassFilter").innerHTML = `

        <option value="">
            All Classes
        </option>

        ${classes
            .map(
                item => `
                <option value="${esc(item)}">
                    ${esc(item)}
                </option>
            `
            )
            .join("")}
    `;


    $("resultSubjectFilter").innerHTML = `

        <option value="">
            All Subjects
        </option>

        ${subjects
            .map(
                item => `
                <option value="${esc(item)}">
                    ${esc(item)}
                </option>
            `
            )
            .join("")}
    `;
}


function filteredResults() {

    const search =
        norm(
            $("resultSearch")?.value
        );

    const className =
        norm(
            $("resultClassFilter")?.value
        );

    const subject =
        norm(
            $("resultSubjectFilter")?.value
        );

    const term =
        norm(
            $("resultTermFilter")?.value
        );

    const status =
        norm(
            $("resultStatusFilter")?.value
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
                        result.term
                    ].join(" ")
                );


            return (
                (!search ||
                    searchable.includes(
                        search
                    ))

                &&

                (!className ||
                    norm(result.class) ===
                        className)

                &&

                (!subject ||
                    norm(result.subject) ===
                        subject)

                &&

                (!term ||
                    norm(result.term) ===
                        term)

                &&

                (!status ||
                    norm(result.status) ===
                        status)
            );
        }
    );
}


function renderResultsTable() {

    const table =
        $("resultsTable");


    if (!table)
        return;


    const rows =
        filteredResults();


    if (!rows.length) {

        table.innerHTML = `

            <tr>
                <td colspan="11">
                    No results found.
                </td>
            </tr>
        `;

        return;
    }


    table.innerHTML =
        rows.map(result => {

            const ca =
                Number(result.ca) || 0;

            const exam =
                Number(result.exam) || 0;

            const total =
                Number(result.total) ||
                ca + exam;


            return `

                <tr>

                    <td>
                        ${esc(result.student_id)}
                    </td>

                    <td>
                        ${esc(result.studentName)}
                    </td>

                    <td>
                        ${esc(result.class)}
                    </td>

                    <td>
                        ${esc(result.subject)}
                    </td>

                    <td>${ca}</td>

                    <td>${exam}</td>

                    <td>${total}</td>

                    <td>
                        ${esc(
                            result.grade ||
                            grade(total)
                        )}
                    </td>

                    <td>
                        ${esc(result.term)}
                    </td>

                    <td>
                        ${esc(
                            result.status ||
                            "pending"
                        )}
                    </td>

                    <td>

                        <button
                            type="button"
                            class="edit-btn"
                            data-edit="${result.id}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-btn"
                            data-delete="${result.id}"
                        >
                            Delete
                        </button>

                    </td>

                </tr>
            `;
        }).join("");


    document
        .querySelectorAll(
            "[data-edit]"
        )
        .forEach(button => {

            button.onclick = () => {

                const result =
                    state.results.find(
                        r =>
                            String(r.id) ===
                            button.dataset.edit
                    );

                if (result)
                    openEditResult(result);
            };
        });


    document
        .querySelectorAll(
            "[data-delete]"
        )
        .forEach(button => {

            button.onclick = () => {

                const result =
                    state.results.find(
                        r =>
                            String(r.id) ===
                            button.dataset.delete
                    );

                if (result)
                    deleteResult(result);
            };
        });
}


/* =====================================================
   EDIT RESULT
===================================================== */

function openEditResult(result) {

    if (
        !hasSubjectAssignment(
            result.class,
            result.subject
        )
    ) {

        alert(
            "You cannot edit another teacher's result."
        );

        return;
    }


    state.editingResult =
        result;


    if ($("editStudentName"))
        $("editStudentName").textContent =
            result.studentName;

    if ($("editStudentId"))
        $("editStudentId").textContent =
            result.student_id;

    if ($("editClass"))
        $("editClass").textContent =
            result.class;

    if ($("editSubject"))
        $("editSubject").textContent =
            result.subject;

    if ($("editTerm"))
        $("editTerm").textContent =
            result.term;

    if ($("editCA"))
        $("editCA").value =
            result.ca ?? 0;

    if ($("editExam"))
        $("editExam").value =
            result.exam ?? 0;


    calculateEditResult();


    $("editPanel")
        ?.classList
        .add("show");
}


function calculateEditResult() {

    const ca =
        Number(
            $("editCA")?.value ||
            0
        );

    const exam =
        Number(
            $("editExam")?.value ||
            0
        );

    const total =
        ca + exam;


    if ($("editTotal"))
        $("editTotal").value =
            total;

    if ($("editGrade"))
        $("editGrade").value =
            grade(total);
}


function cancelEdit() {

    state.editingResult =
        null;

    $("editPanel")
        ?.classList
        .remove("show");
}


async function saveEditedResult() {

    const result =
        state.editingResult;


    if (!result)
        return;


    const ca =
        Number(
            $("editCA")?.value
        );

    const exam =
        Number(
            $("editExam")?.value
        );


    if (
        ca < 0 ||
        ca > 40
    ) {

        $("editMessage").textContent =
            "CA must be between 0 and 40.";

        return;
    }


    if (
        exam < 0 ||
        exam > 60
    ) {

        $("editMessage").textContent =
            "Exam must be between 0 and 60.";

        return;
    }


    const total =
        ca + exam;


    const { error } =
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

        $("editMessage").textContent =
            error.message;

        return;
    }


    await resetReportToDraft(
        result
    );


    $("editMessage").textContent =
        "Result updated successfully.";


    await loadTeacherResults();


    setTimeout(
        cancelEdit,
        500
    );
}


async function deleteResult(result) {

    if (
        !confirm(
            `Delete ${result.studentName}'s ${result.subject} result?`
        )
    ) return;


    const { error } =
        await supabaseClient
            .from("results")
            .delete()
            .eq(
                "id",
                result.id
            );


    if (error) {

        alert(
            error.message
        );

        return;
    }


    await resetReportToDraft(
        result
    );


    await loadTeacherResults();
}


/* =====================================================
   FILTERS
===================================================== */

function clearFilters() {

    [
        "resultSearch",
        "resultClassFilter",
        "resultSubjectFilter",
        "resultTermFilter",
        "resultStatusFilter"
    ].forEach(id => {

        if ($(id))
            $(id).value = "";
    });


    renderResultsTable();
}


function closeMobileSidebar() {

    $("sidebar")
        ?.classList
        .remove("open");

    $("sidebarOverlay")
        ?.classList
        .remove("show");
}


function setupPageNavigation() {

    document
        .querySelectorAll(".sidebar-nav .nav-link")
        .forEach(link => {

            link.addEventListener(
                "click",
                event => {

                    const targetId =
                        link.getAttribute("href")
                            ?.replace("#", "");

                    const target =
                        targetId
                            ? $(targetId)
                            : null;

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    if (targetId === "myClassSection") {
                        target.style.display = "block";
                        target.classList.add("show");
                    }

                    document
                        .querySelectorAll(".sidebar-nav .nav-link")
                        .forEach(item =>
                            item.classList.remove("active")
                        );

                    link.classList.add("active");

                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                    closeMobileSidebar();
                }
            );
        });
}


/* =====================================================
   AUTH WATCHER
===================================================== */

supabaseClient.auth.onAuthStateChange(
    (event, session) => {

        if (
            event === "SIGNED_OUT" ||
            !session
        ) {

            localStorage.removeItem(
                "teacher"
            );

            localStorage.removeItem(
                "teacherAssignments"
            );

            localStorage.removeItem(
                "classTeacherAssignments"
            );
        }
    }
);


/* =====================================================
   EVENTS
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupPageNavigation();

        $("logoutBtn")
            ?.addEventListener(
                "click",
                logout
            );


        $("sidebarLogoutBtn")
            ?.addEventListener(
                "click",
                logout
            );


        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("sidebar")
                        ?.classList
                        .add("open");

                    $("sidebarOverlay")
                        ?.classList
                        .add("show");
                }
            );


        $("sidebarOverlay")
            ?.addEventListener(
                "click",
                closeMobileSidebar
            );


        $("classTeacherClassSelect")
            ?.addEventListener(
                "change",
                () => {

                    closeClassResult();
                    loadClassStudents();
                }
            );


        $("classResultTerm")
            ?.addEventListener(
                "change",
                renderClassResult
            );


        $("closeClassResultBtn")
            ?.addEventListener(
                "click",
                closeClassResult
            );


        $("saveRemarkBtn")
            ?.addEventListener(
                "click",
                saveRemark
            );


        $("addResultBtn")
            ?.addEventListener(
                "click",
                openResultEntry
            );


        $("cancelResultBtn")
            ?.addEventListener(
                "click",
                closeResultEntry
            );


        $("resultAssignment")
            ?.addEventListener(
                "change",
                handleAssignmentChange
            );


        $("resultCA")
            ?.addEventListener(
                "input",
                calculateResult
            );


        $("resultExam")
            ?.addEventListener(
                "input",
                calculateResult
            );


        $("submitResultBtn")
            ?.addEventListener(
                "click",
                submitResult
            );


        $("editCA")
            ?.addEventListener(
                "input",
                calculateEditResult
            );


        $("editExam")
            ?.addEventListener(
                "input",
                calculateEditResult
            );


        $("saveBtn")
            ?.addEventListener(
                "click",
                saveEditedResult
            );


        $("cancelBtn")
            ?.addEventListener(
                "click",
                cancelEdit
            );


        $("resultSearch")
            ?.addEventListener(
                "input",
                renderResultsTable
            );


        [
            "resultClassFilter",
            "resultSubjectFilter",
            "resultTermFilter",
            "resultStatusFilter"
        ].forEach(id => {

            $(id)?.addEventListener(
                "change",
                renderResultsTable
            );
        });


        $("clearResultFilters")
            ?.addEventListener(
                "click",
                clearFilters
            );


        $("changeTeacherPhotoBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("teacherPhotoInput")
                        ?.click();
                }
            );


        $("teacherPhotoInput")
            ?.addEventListener(
                "change",
                async event => {

                    const file =
                        event.target.files?.[0];

                    if (file)
                        await uploadProfilePhoto(
                            file
                        );
                }
            );


        try {

            await loadTeacherData();

        } catch (error) {

            console.error(error);

            alert(
                "Could not load teacher dashboard: " +
                error.message
            );

            await logout();
        }
    }
);