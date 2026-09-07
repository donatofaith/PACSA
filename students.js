/* =========================================
   PACSA STUDENTS MANAGEMENT
   ADMIN AUTH + SUBJECT REGISTRATION
========================================= */

let students = [];
let subjects = [];
let subjectRegistrations = [];

let currentSession = "";
let currentTerm = "";

let managingStudent = null;

const $ = id =>
    document.getElementById(id);


/* =========================================
   START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
            WAIT FOR ADMIN AUTH FIRST
        */

        const admin =
            await window.adminAuthReady;

        if (!admin) {
            return;
        }


        /* MOBILE SIDEBAR */

        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("sidebar")
                        ?.classList
                        .toggle("active");
                }
            );


        /* SEARCH */

        $("studentSearch")
            ?.addEventListener(
                "input",
                renderStudents
            );


        $("classFilter")
            ?.addEventListener(
                "change",
                renderStudents
            );


        $("statusFilter")
            ?.addEventListener(
                "change",
                renderStudents
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("studentSearch").value =
                        "";

                    $("classFilter").value =
                        "";

                    $("statusFilter").value =
                        "";

                    renderStudents();
                }
            );


        /* ADD STUDENT */

        $("addStudentBtn")
            ?.addEventListener(
                "click",
                () =>
                    openStudentModal()
            );


        $("emptyAddStudentBtn")
            ?.addEventListener(
                "click",
                () =>
                    openStudentModal()
            );


        /* STUDENT MODAL */

        $("closeStudentModal")
            ?.addEventListener(
                "click",
                closeStudentModal
            );


        $("cancelStudentBtn")
            ?.addEventListener(
                "click",
                closeStudentModal
            );


        $("studentModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("studentModal")
                    ) {

                        closeStudentModal();
                    }
                }
            );


        $("studentForm")
            ?.addEventListener(
                "submit",
                saveStudent
            );


        /* VIEW STUDENT */

        $("closeViewStudentModal")
            ?.addEventListener(
                "click",
                closeViewStudentModal
            );


        $("closeViewStudentBtn")
            ?.addEventListener(
                "click",
                closeViewStudentModal
            );


        $("viewStudentModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("viewStudentModal")
                    ) {

                        closeViewStudentModal();
                    }
                }
            );


        /* SUBJECT MANAGER */

        $("closeSubjectManager")
            ?.addEventListener(
                "click",
                closeSubjectManager
            );


        $("cancelSubjectManager")
            ?.addEventListener(
                "click",
                closeSubjectManager
            );


        $("subjectManagerModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("subjectManagerModal")
                    ) {

                        closeSubjectManager();
                    }
                }
            );


        $("selectAllSubjectsBtn")
            ?.addEventListener(
                "click",
                selectAllSubjects
            );


        $("clearAllSubjectsBtn")
            ?.addEventListener(
                "click",
                clearAllSubjects
            );


        $("saveStudentSubjectsBtn")
            ?.addEventListener(
                "click",
                saveStudentSubjects
            );


        /*
            LOAD EVERYTHING
        */

        await loadCurrentSession();

        await loadPageData();
    }
);


/* =========================================
   CURRENT SESSION
========================================= */

async function loadCurrentSession() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("sessions_terms")
                .select(
                    "session, term, is_current, start_date, created_at"
                )
                .order(
                    "start_date",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        const rows =
            data || [];


        const active =
            rows.find(
                row =>
                    row.is_current ===
                    true
            );


        const selected =
            active ||
            rows[0] ||
            null;


        if (
            selected
        ) {

            currentSession =
                selected.session ||
                "";


            currentTerm =
                selected.term ||
                "";
        }


        if (
            $("subjectCurrentSession")
        ) {

            $("subjectCurrentSession")
                .textContent =
                currentSession ||
                "No current session";
        }


    } catch (error) {

        console.error(
            "Current session error:",
            error
        );


        currentSession =
            "";


        currentTerm =
            "";
    }
}


/* =========================================
   LOAD PAGE DATA
========================================= */

async function loadPageData() {

    showStudentLoading(
        true
    );


    try {

        const [
            studentResult,
            subjectResult
        ] =
            await Promise.all([

                supabaseClient
                    .from("students")
                    .select(`
                        first_name,
                        last_name,
                        student_id,
                        email,
                        phone,
                        class,
                        gender,
                        status
                    `)
                    .order(
                        "first_name",
                        {
                            ascending: true
                        }
                    ),

                supabaseClient
                    .from("subjects")
                    .select(
                        "id, name, code, category, status"
                    )
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    )

            ]);


        if (
            studentResult.error
        ) {

            throw studentResult.error;
        }


        if (
            subjectResult.error
        ) {

            throw subjectResult.error;
        }


        students =
            studentResult.data ||
            [];


        subjects =
            (
                subjectResult.data ||
                []
            )
                .filter(
                    subject =>
                        String(
                            subject.status ||
                            "active"
                        )
                            .toLowerCase()
                        ===
                        "active"
                );


        await loadSubjectRegistrations();


        populateClasses();

        renderStudents();

        updateStatistics();


    } catch (error) {

        console.error(
            "Students page loading error:",
            error
        );


        alert(
            "Could not load student information: " +
            error.message
        );


    } finally {

        showStudentLoading(
            false
        );
    }
}


/* =========================================
   LOAD SUBJECT REGISTRATIONS
========================================= */

async function loadSubjectRegistrations() {

    if (
        !currentSession
    ) {

        subjectRegistrations =
            [];

        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "student_subjects"
            )
            .select(`
                id,
                student_id,
                class,
                subject,
                session
            `)
            .eq(
                "session",
                currentSession
            );


    if (error) {

        console.error(
            "Subject registration error:",
            error
        );


        subjectRegistrations =
            [];

        return;
    }


    subjectRegistrations =
        data || [];
}


/* =========================================
   LOADING
========================================= */

function showStudentLoading(
    loading
) {

    if (
        $("studentsLoading")
    ) {

        $("studentsLoading")
            .style
            .display =
            loading
                ? "block"
                : "none";
    }


    if (
        loading &&
        $("emptyStudentState")
    ) {

        $("emptyStudentState")
            .style
            .display =
            "none";
    }
}


/* =========================================
   RENDER STUDENTS
========================================= */

function renderStudents() {

    const search =
        String(
            $("studentSearch")
                ?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const selectedClass =
        $("classFilter")
            ?.value ||
        "";


    const selectedStatus =
        $("statusFilter")
            ?.value ||
        "";


    const filtered =
        students.filter(
            student => {

                const name =
                    getStudentName(
                        student
                    )
                        .toLowerCase();


                const studentId =
                    String(
                        student.student_id ||
                        ""
                    )
                        .toLowerCase();


                const email =
                    String(
                        student.email ||
                        ""
                    )
                        .toLowerCase();


                const status =
                    String(
                        student.status ||
                        "active"
                    );


                return (

                    (
                        name.includes(
                            search
                        )

                        ||

                        studentId.includes(
                            search
                        )

                        ||

                        email.includes(
                            search
                        )
                    )

                    &&

                    (
                        !selectedClass

                        ||

                        student.class ===
                        selectedClass
                    )

                    &&

                    (
                        !selectedStatus

                        ||

                        status ===
                        selectedStatus
                    )
                );
            }
        );


    if (
        $("studentsTableBody")
    ) {

        $("studentsTableBody")
            .innerHTML =

            filtered
                .map(
                    student => {

                        const name =
                            getStudentName(
                                student
                            );


                        const status =
                            student.status ||
                            "active";


                        const subjectCount =
                            getStudentSubjectCount(
                                student.student_id
                            );


                        const encodedId =
                            encodeURIComponent(
                                student.student_id
                            );


                        return `

                            <tr>

                                <td>

                                    <div class="teacher-cell">

                                        <div class="teacher-table-avatar">

                                            ${escapeHtml(
                                                getInitials(
                                                    name
                                                )
                                            )}

                                        </div>


                                        <div class="teacher-name-info">

                                            <strong>
                                                ${escapeHtml(
                                                    name
                                                )}
                                            </strong>

                                            <span>
                                                ${escapeHtml(
                                                    student.email ||
                                                    "-"
                                                )}
                                            </span>

                                        </div>

                                    </div>

                                </td>


                                <td>
                                    ${escapeHtml(
                                        student.student_id ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        student.class ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        student.gender ||
                                        "-"
                                    )}
                                </td>


                                <td>
                                    ${escapeHtml(
                                        student.phone ||
                                        "-"
                                    )}
                                </td>


                                <td>

                                    <strong>
                                        ${subjectCount}
                                    </strong>

                                </td>


                                <td>

                                    <span
                                        class="status-badge ${
                                            status ===
                                            "active"

                                                ? "active-status"

                                                : "pending"
                                        }"
                                    >
                                        ${escapeHtml(
                                            capitalize(
                                                status
                                            )
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <div class="table-action-buttons">

                                        <button
                                            type="button"
                                            class="table-btn view-table-btn"
                                            onclick="viewStudent('${encodedId}')"
                                            title="View Student"
                                        >
                                            👁
                                        </button>


                                        <button
                                            type="button"
                                            class="table-btn edit-table-btn"
                                            onclick="editStudent('${encodedId}')"
                                            title="Edit Student"
                                        >
                                            ✏
                                        </button>


                                        <button
                                            type="button"
                                            class="table-btn manage-subject-btn"
                                            onclick="manageStudentSubjects('${encodedId}')"
                                            title="Manage Subjects"
                                        >
                                            📚
                                        </button>


                                        <button
                                            type="button"
                                            class="table-btn delete-table-btn"
                                            onclick="deleteStudent('${encodedId}')"
                                            title="Delete Student"
                                        >
                                            🗑
                                        </button>

                                    </div>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join("");
    }


    if (
        $("emptyStudentState")
    ) {

        $("emptyStudentState")
            .style
            .display =

            filtered.length
                ? "none"
                : "block";
    }


    if (
        $("studentCount")
    ) {

        $("studentCount")
            .textContent =
            filtered.length;
    }
}


/* =========================================
   SUBJECT COUNT
========================================= */

function getStudentSubjectCount(
    studentId
) {

    return subjectRegistrations
        .filter(
            row =>
                String(
                    row.student_id
                )
                ===
                String(
                    studentId
                )

                &&

                row.session ===
                currentSession
        )
        .length;
}


/* =========================================
   CLASS FILTER
========================================= */

function populateClasses() {

    const filter =
        $("classFilter");


    if (!filter) {
        return;
    }


    const oldValue =
        filter.value;


    const classes = [

        ...new Set(

            students
                .map(
                    student =>
                        student.class
                )
                .filter(Boolean)
        )

    ].sort();


    filter.innerHTML =
        `<option value="">All Classes</option>`;


    classes.forEach(
        className => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                className;


            option.textContent =
                className;


            filter.appendChild(
                option
            );
        }
    );


    if (
        classes.includes(
            oldValue
        )
    ) {

        filter.value =
            oldValue;
    }
}


/* =========================================
   STATISTICS
========================================= */

function updateStatistics() {

    if (
        $("totalStudents")
    ) {

        $("totalStudents")
            .textContent =
            students.length;
    }


    if (
        $("activeStudents")
    ) {

        $("activeStudents")
            .textContent =

            students.filter(
                student =>
                    String(
                        student.status ||
                        "active"
                    )
                        .toLowerCase()
                    ===
                    "active"
            )
                .length;
    }


    const classSet =
        new Set(

            students
                .map(
                    student =>
                        student.class
                )
                .filter(Boolean)
        );


    if (
        $("totalClasses")
    ) {

        $("totalClasses")
            .textContent =
            classSet.size;
    }


    if (
        $("subjectRegistrationCount")
    ) {

        $("subjectRegistrationCount")
            .textContent =
            subjectRegistrations.length;
    }


    if (
        $("studentCount")
    ) {

        $("studentCount")
            .textContent =
            students.length;
    }
}


/* =========================================
   FIND STUDENT
========================================= */

function findStudent(
    encodedStudentId
) {

    const studentId =
        decodeURIComponent(
            encodedStudentId
        );


    return students.find(
        student =>
            String(
                student.student_id
            )
            ===
            String(
                studentId
            )
    );
}


/* =========================================
   STUDENT NAME
========================================= */

function getStudentName(
    student
) {

    return (

        `${student?.first_name || ""} ${student?.last_name || ""}`
            .trim()

        ||

        student?.student_id

        ||

        "Student"
    );
}


/* =========================================
   OPEN STUDENT MODAL
========================================= */

function openStudentModal(
    student = null
) {

    $("studentForm")
        ?.reset();


    if (
        $("studentRecordId")
    ) {

        $("studentRecordId")
            .value =
            student?.student_id ||
            "";
    }


    if (
        $("studentModalTitle")
    ) {

        $("studentModalTitle")
            .textContent =

            student
                ? "Edit Student"
                : "Add New Student";
    }


    if (
        $("studentFirstName")
    ) {

        $("studentFirstName")
            .value =
            student?.first_name ||
            "";
    }


    if (
        $("studentLastName")
    ) {

        $("studentLastName")
            .value =
            student?.last_name ||
            "";
    }


    if (
        $("studentId")
    ) {

        $("studentId")
            .value =
            student?.student_id ||
            "";
    }


    if (
        $("studentEmail")
    ) {

        $("studentEmail")
            .value =
            student?.email ||
            "";
    }


    if (
        $("studentPhone")
    ) {

        $("studentPhone")
            .value =
            student?.phone ||
            "";
    }


    if (
        $("studentClass")
    ) {

        $("studentClass")
            .value =
            student?.class ||
            "";
    }


    if (
        $("studentGender")
    ) {

        $("studentGender")
            .value =
            student?.gender ||
            "Male";
    }


    if (
        $("studentStatus")
    ) {

        $("studentStatus")
            .value =
            student?.status ||
            "active";
    }


    $("studentModal")
        ?.classList
        .add("active");
}


/* =========================================
   CLOSE STUDENT MODAL
========================================= */

function closeStudentModal() {

    $("studentModal")
        ?.classList
        .remove("active");
}


/* =========================================
   SAVE STUDENT
========================================= */

async function saveStudent(
    event
) {

    event.preventDefault();


    const oldStudentId =
        $("studentRecordId")
            ?.value
            .trim() ||
        "";


    const studentData = {

        first_name:
            $("studentFirstName")
                ?.value
                .trim() ||
            "",

        last_name:
            $("studentLastName")
                ?.value
                .trim() ||
            "",

        student_id:
            $("studentId")
                ?.value
                .trim() ||
            "",

        email:
            $("studentEmail")
                ?.value
                .trim() ||
            "",

        phone:
            $("studentPhone")
                ?.value
                .trim() ||
            "",

        class:
            $("studentClass")
                ?.value ||
            "",

        gender:
            $("studentGender")
                ?.value ||
            "",

        status:
            $("studentStatus")
                ?.value ||
            "active"
    };


    if (
        !studentData.first_name

        ||

        !studentData.last_name

        ||

        !studentData.student_id

        ||

        !studentData.class
    ) {

        alert(
            "Please enter First Name, Last Name, Student ID and Class."
        );

        return;
    }


    const saveButton =
        $("saveStudentBtn");


    if (
        saveButton
    ) {

        saveButton.disabled =
            true;


        saveButton.textContent =
            "Saving...";
    }


    try {

        /*
            EDIT STUDENT
        */

        if (
            oldStudentId
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from("students")
                    .update(
                        studentData
                    )
                    .eq(
                        "student_id",
                        oldStudentId
                    );


            if (error) {
                throw error;
            }


            /*
                IF STUDENT ID CHANGED,
                UPDATE SUBJECT REGISTRATIONS
            */

            if (
                oldStudentId !==
                studentData.student_id
            ) {

                const {
                    error:
                    subjectIdError
                } =
                    await supabaseClient
                        .from(
                            "student_subjects"
                        )
                        .update({

                            student_id:
                                studentData.student_id

                        })
                        .eq(
                            "student_id",
                            oldStudentId
                        );


                if (
                    subjectIdError
                ) {

                    throw subjectIdError;
                }
            }


            /*
                KEEP CURRENT SESSION
                REGISTRATION CLASS IN SYNC
            */

            if (
                currentSession
            ) {

                const {
                    error:
                    classSyncError
                } =
                    await supabaseClient
                        .from(
                            "student_subjects"
                        )
                        .update({

                            class:
                                studentData.class

                        })
                        .eq(
                            "student_id",
                            studentData.student_id
                        )
                        .eq(
                            "session",
                            currentSession
                        );


                if (
                    classSyncError
                ) {

                    throw classSyncError;
                }
            }


        } else {

            /*
                NEW STUDENT
            */

            const {
                error
            } =
                await supabaseClient
                    .from("students")
                    .insert([
                        studentData
                    ]);


            if (error) {
                throw error;
            }
        }


        closeStudentModal();


        await loadPageData();


        alert(
            oldStudentId
                ? "Student updated successfully."
                : "Student added successfully."
        );


    } catch (error) {

        console.error(
            "Save student error:",
            error
        );


        alert(
            "Could not save student: " +
            error.message
        );


    } finally {

        if (
            saveButton
        ) {

            saveButton.disabled =
                false;


            saveButton.textContent =
                "Save Student";
        }
    }
}


/* =========================================
   VIEW STUDENT
========================================= */

window.viewStudent =
    function (
        studentId
    ) {

        const student =
            findStudent(
                studentId
            );


        if (!student) {
            return;
        }


        const name =
            getStudentName(
                student
            );


        const subjectCount =
            getStudentSubjectCount(
                student.student_id
            );


        if (
            $("viewStudentAvatar")
        ) {

            $("viewStudentAvatar")
                .textContent =
                getInitials(
                    name
                );
        }


        if (
            $("viewStudentName")
        ) {

            $("viewStudentName")
                .textContent =
                name;
        }


        if (
            $("viewStudentId")
        ) {

            $("viewStudentId")
                .textContent =
                student.student_id ||
                "-";
        }


        if (
            $("viewStudentClass")
        ) {

            $("viewStudentClass")
                .textContent =
                student.class ||
                "-";
        }


        if (
            $("viewStudentGender")
        ) {

            $("viewStudentGender")
                .textContent =
                student.gender ||
                "-";
        }


        if (
            $("viewStudentEmail")
        ) {

            $("viewStudentEmail")
                .textContent =
                student.email ||
                "-";
        }


        if (
            $("viewStudentPhone")
        ) {

            $("viewStudentPhone")
                .textContent =
                student.phone ||
                "-";
        }


        if (
            $("viewStudentSubjectCount")
        ) {

            $("viewStudentSubjectCount")
                .textContent =
                subjectCount;
        }


        if (
            $("viewStudentSession")
        ) {

            $("viewStudentSession")
                .textContent =
                currentSession ||
                "-";
        }


        if (
            $("viewStudentStatus")
        ) {

            const status =
                student.status ||
                "active";


            $("viewStudentStatus")
                .textContent =
                capitalize(
                    status
                );


            $("viewStudentStatus")
                .className =

                "status-badge " +

                (
                    status ===
                    "active"

                        ? "active-status"

                        : "pending"
                );
        }


        $("viewStudentModal")
            ?.classList
            .add("active");
    };


/* =========================================
   CLOSE VIEW
========================================= */

function closeViewStudentModal() {

    $("viewStudentModal")
        ?.classList
        .remove("active");
}


/* =========================================
   EDIT STUDENT
========================================= */

window.editStudent =
    function (
        studentId
    ) {

        const student =
            findStudent(
                studentId
            );


        if (
            student
        ) {

            openStudentModal(
                student
            );
        }
    };


/* =========================================
   MANAGE STUDENT SUBJECTS
========================================= */

window.manageStudentSubjects =
    function (
        studentId
    ) {

        const student =
            findStudent(
                studentId
            );


        if (!student) {

            alert(
                "Student could not be found."
            );

            return;
        }


        managingStudent =
            student;


        const name =
            getStudentName(
                student
            );


        if (
            $("subjectStudentAvatar")
        ) {

            $("subjectStudentAvatar")
                .textContent =
                getInitials(
                    name
                );
        }


        if (
            $("subjectStudentName")
        ) {

            $("subjectStudentName")
                .textContent =
                name;
        }


        if (
            $("subjectStudentInfo")
        ) {

            $("subjectStudentInfo")
                .textContent =

                `${student.student_id || "-"} · ${student.class || "-"}`;
        }


        if (
            $("subjectCurrentSession")
        ) {

            $("subjectCurrentSession")
                .textContent =
                currentSession ||
                "No current session";
        }


        if (
            $("subjectSaveMessage")
        ) {

            $("subjectSaveMessage")
                .textContent =
                "";
        }


        renderSubjectManager();


        $("subjectManagerModal")
            ?.classList
            .add("active");
    };


/* =========================================
   RENDER SUBJECT MANAGER
========================================= */

function renderSubjectManager() {

    const grid =
        $("subjectsCheckGrid");


    if (
        !grid ||
        !managingStudent
    ) {

        return;
    }


    if (
        !currentSession
    ) {

        grid.innerHTML = `

            <div class="subjects-empty">
                No current academic session has been configured.
            </div>
        `;


        updateSelectedSubjectCount();

        return;
    }


    if (
        !subjects.length
    ) {

        grid.innerHTML = `

            <div class="subjects-empty">
                No active subjects are available.
            </div>
        `;


        updateSelectedSubjectCount();

        return;
    }


    const registeredSubjects =
        new Set(

            subjectRegistrations
                .filter(
                    row =>
                        String(
                            row.student_id
                        )
                        ===
                        String(
                            managingStudent.student_id
                        )

                        &&

                        row.session ===
                        currentSession
                )
                .map(
                    row =>
                        row.subject
                )
        );


    grid.innerHTML =
        subjects
            .map(
                subject => {

                    const selected =
                        registeredSubjects.has(
                            subject.name
                        );


                    return `

                        <label
                            class="subject-check-card ${
                                selected
                                    ? "selected"
                                    : ""
                            }"
                        >

                            <input
                                type="checkbox"
                                class="student-subject-checkbox"
                                value="${escapeAttribute(
                                    subject.name
                                )}"
                                ${
                                    selected
                                        ? "checked"
                                        : ""
                                }
                            >

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        subject.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        subject.code ||
                                        subject.category ||
                                        "Subject"
                                    )}
                                </span>

                            </div>

                        </label>
                    `;
                }
            )
            .join("");


    document
        .querySelectorAll(
            ".student-subject-checkbox"
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    () => {

                        const card =
                            checkbox.closest(
                                ".subject-check-card"
                            );


                        card
                            ?.classList
                            .toggle(
                                "selected",
                                checkbox.checked
                            );


                        updateSelectedSubjectCount();
                    }
                );
            }
        );


    updateSelectedSubjectCount();
}


/* =========================================
   SELECT ALL SUBJECTS
========================================= */

function selectAllSubjects() {

    document
        .querySelectorAll(
            ".student-subject-checkbox"
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    true;


                checkbox
                    .closest(
                        ".subject-check-card"
                    )
                    ?.classList
                    .add(
                        "selected"
                    );
            }
        );


    updateSelectedSubjectCount();
}


/* =========================================
   CLEAR ALL SUBJECTS
========================================= */

function clearAllSubjects() {

    document
        .querySelectorAll(
            ".student-subject-checkbox"
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    false;


                checkbox
                    .closest(
                        ".subject-check-card"
                    )
                    ?.classList
                    .remove(
                        "selected"
                    );
            }
        );


    updateSelectedSubjectCount();
}


/* =========================================
   SELECTED COUNT
========================================= */

function updateSelectedSubjectCount() {

    const selected =
        document
            .querySelectorAll(
                ".student-subject-checkbox:checked"
            )
            .length;


    if (
        $("selectedSubjectCount")
    ) {

        $("selectedSubjectCount")
            .textContent =
            selected;
    }
}


/* =========================================
   SAVE STUDENT SUBJECTS
========================================= */

async function saveStudentSubjects() {

    if (
        !managingStudent
    ) {

        return;
    }


    if (
        !currentSession
    ) {

        alert(
            "No current academic session is available."
        );

        return;
    }


    const button =
        $("saveStudentSubjectsBtn");


    const message =
        $("subjectSaveMessage");


    const selectedSubjects =
        Array
            .from(
                document.querySelectorAll(
                    ".student-subject-checkbox:checked"
                )
            )
            .map(
                checkbox =>
                    checkbox.value
            );


    if (
        button
    ) {

        button.disabled =
            true;


        button.textContent =
            "Saving...";
    }


    if (
        message
    ) {

        message.textContent =
            "";
    }


    try {

        /*
            EXISTING SUBJECTS FOR THIS
            STUDENT + CURRENT SESSION
        */

        const existing =
            subjectRegistrations
                .filter(
                    row =>
                        String(
                            row.student_id
                        )
                        ===
                        String(
                            managingStudent.student_id
                        )

                        &&

                        row.session ===
                        currentSession
                );


        const existingNames =
            new Set(

                existing.map(
                    row =>
                        row.subject
                )
            );


        const selectedNames =
            new Set(
                selectedSubjects
            );


        /*
            SUBJECTS TO ADD
        */

        const toAdd =
            selectedSubjects.filter(
                subject =>
                    !existingNames.has(
                        subject
                    )
            );


        /*
            SUBJECTS TO REMOVE
        */

        const toRemove =
            existing
                .filter(
                    row =>
                        !selectedNames.has(
                            row.subject
                        )
                )
                .map(
                    row =>
                        row.subject
                );


        /*
            INSERT NEW SUBJECTS
        */

        if (
            toAdd.length
        ) {

            const rows =
                toAdd.map(
                    subject => ({

                        student_id:
                            managingStudent.student_id,

                        class:
                            managingStudent.class,

                        subject,

                        session:
                            currentSession

                    })
                );


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "student_subjects"
                    )
                    .insert(
                        rows
                    );


            if (error) {
                throw error;
            }
        }


        /*
            REMOVE UNSELECTED SUBJECTS
        */

        if (
            toRemove.length
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "student_subjects"
                    )
                    .delete()
                    .eq(
                        "student_id",
                        managingStudent.student_id
                    )
                    .eq(
                        "session",
                        currentSession
                    )
                    .in(
                        "subject",
                        toRemove
                    );


            if (error) {
                throw error;
            }
        }


        /*
            KEEP CLASS CORRECT FOR
            ALL CURRENT REGISTRATIONS
        */

        const {
            error:
            classUpdateError
        } =
            await supabaseClient
                .from(
                    "student_subjects"
                )
                .update({

                    class:
                        managingStudent.class

                })
                .eq(
                    "student_id",
                    managingStudent.student_id
                )
                .eq(
                    "session",
                    currentSession
                );


        if (
            classUpdateError
        ) {

            throw classUpdateError;
        }


        /*
            RELOAD REGISTRATION DATA
        */

        await loadSubjectRegistrations();


        renderStudents();

        updateStatistics();


        if (
            message
        ) {

            message.textContent =
                "Subjects saved successfully.";


            message.style.color =
                "#166534";
        }


        updateSelectedSubjectCount();


        setTimeout(
            () => {

                closeSubjectManager();

            },
            500
        );


    } catch (error) {

        console.error(
            "Save subjects error:",
            error
        );


        if (
            message
        ) {

            message.textContent =
                "Could not save subjects: " +
                error.message;


            message.style.color =
                "#DC2626";
        }


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;


            button.textContent =
                "Save Subjects";
        }
    }
}


/* =========================================
   CLOSE SUBJECT MANAGER
========================================= */

function closeSubjectManager() {

    managingStudent =
        null;


    $("subjectManagerModal")
        ?.classList
        .remove("active");


    if (
        $("subjectSaveMessage")
    ) {

        $("subjectSaveMessage")
            .textContent =
            "";
    }
}


/* =========================================
   DELETE STUDENT
========================================= */

window.deleteStudent =
    async function (
        studentId
    ) {

        const student =
            findStudent(
                studentId
            );


        if (!student) {
            return;
        }


        const name =
            getStudentName(
                student
            );


        const confirmed =
            confirm(
                `Are you sure you want to delete ${name}?`
            );


        if (!confirmed) {
            return;
        }


        try {

            /*
                DELETE SUBJECT REGISTRATIONS FIRST
            */

            const {
                error:
                registrationError
            } =
                await supabaseClient
                    .from(
                        "student_subjects"
                    )
                    .delete()
                    .eq(
                        "student_id",
                        student.student_id
                    );


            if (
                registrationError
            ) {

                throw registrationError;
            }


            /*
                DELETE STUDENT
            */

            const {
                error
            } =
                await supabaseClient
                    .from("students")
                    .delete()
                    .eq(
                        "student_id",
                        student.student_id
                    );


            if (error) {
                throw error;
            }


            await loadPageData();


            alert(
                "Student deleted successfully."
            );


        } catch (error) {

            console.error(
                "Delete student error:",
                error
            );


            alert(
                "Could not delete student: " +
                error.message
            );
        }
    };


/* =========================================
   HELPERS
========================================= */

function getInitials(
    name
) {

    return String(
        name ||
        ""
    )
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(
            0,
            2
        )
        .map(
            word =>
                word[0]
        )
        .join("")
        .toUpperCase()

        ||

        "ST";
}


function capitalize(
    value
) {

    const text =
        String(
            value ||
            ""
        );


    return (
        text
            .charAt(0)
            .toUpperCase()

        +

        text.slice(1)
    );
}


function escapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
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


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );
}