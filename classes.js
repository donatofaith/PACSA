/* =========================================
   PACSA CLASSES MANAGEMENT
   ADMIN AUTH + SUPABASE
========================================= */

let classes = [];
let students = [];
let teachers = [];
let classTeacherAssignments = [];

let currentSession = "";

const $ = id =>
    document.getElementById(id);


/* =========================================
   START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const admin =
            await window.adminAuthReady;

        if (!admin) {
            return;
        }


        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {
                    $("sidebar")
                        ?.classList
                        .toggle("active");
                }
            );


        $("classSearch")
            ?.addEventListener(
                "input",
                renderClasses
            );


        $("levelFilter")
            ?.addEventListener(
                "change",
                renderClasses
            );


        $("statusFilter")
            ?.addEventListener(
                "change",
                renderClasses
            );


        $("addClassBtn")
            ?.addEventListener(
                "click",
                () => {
                    openClassModal();
                }
            );


        $("closeModal")
            ?.addEventListener(
                "click",
                closeClassModal
            );


        $("cancelModal")
            ?.addEventListener(
                "click",
                closeClassModal
            );


        $("classModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("classModal")
                    ) {
                        closeClassModal();
                    }
                }
            );


        $("classForm")
            ?.addEventListener(
                "submit",
                saveClass
            );


        await loadCurrentSession();

        await loadClasses();
    }
);


/* =========================================
   NORMALIZE
========================================= */

function normalize(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}


/* =========================================
   CURRENT SESSION
========================================= */

async function loadCurrentSession() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("sessions_terms")
            .select(`
                session,
                term,
                start_date,
                is_current
            `)
            .order(
                "start_date",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Current session error:",
            error
        );

        return;
    }


    const rows =
        data || [];


    const selected =
        rows.find(
            row =>
                row.is_current === true
        )
        ||
        rows[0];


    currentSession =
        selected?.session ||
        "";


    if (
        $("academicSession")
    ) {

        $("academicSession").value =
            currentSession;
    }
}


/* =========================================
   LOAD ALL DATA
========================================= */

async function loadClasses() {

    try {

        const [
            classResult,
            studentResult,
            teacherResult,
            classTeacherResult
        ] =
            await Promise.all([

                supabaseClient
                    .from("classes")
                    .select(`
                        id,
                        name,
                        level,
                        arm,
                        session,
                        status
                    `)
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    ),

                supabaseClient
                    .from("students")
                    .select(`
                        student_id,
                        first_name,
                        last_name,
                        class,
                        status
                    `),

                supabaseClient
                    .from("Teachers")
                    .select(`
                        id,
                        teacher_id,
                        first_name,
                        last_name,
                        fullname,
                        email
                    `)
                    .order(
                        "first_name",
                        {
                            ascending: true
                        }
                    ),

                supabaseClient
                    .from(
                        "class_teacher_assignments"
                    )
                    .select(`
                        id,
                        teacher_id,
                        class,
                        session
                    `)

            ]);


        if (
            classResult.error
        ) {
            throw classResult.error;
        }


        if (
            studentResult.error
        ) {
            throw studentResult.error;
        }


        if (
            teacherResult.error
        ) {
            throw teacherResult.error;
        }


        classes =
            classResult.data ||
            [];


        students =
            studentResult.data ||
            [];


        teachers =
            teacherResult.data ||
            [];


        classTeacherAssignments =
            classTeacherResult.error
                ? []
                : classTeacherResult.data || [];


        populateTeacherDropdown();

        renderClasses();

        updateStats();


    } catch (error) {

        console.error(
            "Classes loading error:",
            error
        );


        alert(
            "Could not load classes: " +
            error.message
        );
    }
}


/* =========================================
   STUDENT COUNT
========================================= */

function getClassStudentCount(
    className
) {

    return students.filter(
        student =>
            normalize(
                student.class
            )
            ===
            normalize(
                className
            )
    ).length;
}


/* =========================================
   CLASS TEACHER ASSIGNMENT
========================================= */

function getClassTeacherAssignment(
    className
) {

    return classTeacherAssignments.find(
        assignment => {

            const sameClass =
                normalize(
                    assignment.class
                )
                ===
                normalize(
                    className
                );


            const sameSession =
                !currentSession
                ||
                assignment.session ===
                currentSession;


            return (
                sameClass &&
                sameSession
            );
        }
    );
}


/* =========================================
   FIND TEACHER
========================================= */

function findTeacherByTeacherId(
    teacherId
) {

    return teachers.find(
        teacher =>
            String(
                teacher.teacher_id
            )
            ===
            String(
                teacherId
            )
    );
}


/* =========================================
   TEACHER NAME
========================================= */

function getTeacherName(
    teacher
) {

    if (!teacher) {
        return "Not Assigned";
    }


    return (

        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim()

        ||

        teacher.fullname

        ||

        teacher.teacher_id

        ||

        "Teacher"
    );
}


/* =========================================
   CLASS TEACHER NAME
========================================= */

function getClassTeacherName(
    className
) {

    const assignment =
        getClassTeacherAssignment(
            className
        );


    if (!assignment) {
        return "Not Assigned";
    }


    const teacher =
        findTeacherByTeacherId(
            assignment.teacher_id
        );


    return getTeacherName(
        teacher
    );
}


/* =========================================
   RENDER CLASSES
========================================= */

function renderClasses() {

    const search =
        normalize(
            $("classSearch")
                ?.value
        );


    const level =
        $("levelFilter")
            ?.value ||
        "all";


    const status =
        $("statusFilter")
            ?.value ||
        "all";


    const filtered =
        classes.filter(
            item => {

                const teacherName =
                    getClassTeacherName(
                        item.name
                    );


                const matchesSearch =
                    normalize(
                        item.name
                    )
                        .includes(
                            search
                        )

                    ||

                    normalize(
                        teacherName
                    )
                        .includes(
                            search
                        );


                const matchesLevel =
                    level === "all"

                    ||

                    item.level ===
                    level;


                const matchesStatus =
                    status === "all"

                    ||

                    item.status ===
                    status;


                return (
                    matchesSearch &&
                    matchesLevel &&
                    matchesStatus
                );
            }
        );


    const tableBody =
        $("classesTableBody");


    if (!tableBody) {
        return;
    }


    if (
        !filtered.length
    ) {

        tableBody.innerHTML = `

            <tr>
                <td colspan="6" class="empty-state">
                    No classes found.
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        filtered
            .map(
                item => {

                    const studentCount =
                        getClassStudentCount(
                            item.name
                        );


                    const assignment =
                        getClassTeacherAssignment(
                            item.name
                        );


                    const teacher =
                        assignment
                            ? findTeacherByTeacherId(
                                assignment.teacher_id
                            )
                            : null;


                    const teacherName =
                        getTeacherName(
                            teacher
                        );


                    const teacherHtml =
                        assignment

                            ? `
                                <span class="class-teacher-badge">
                                    👨‍🏫
                                    ${escapeHtml(
                                        teacherName
                                    )}
                                </span>
                            `

                            : `
                                <span class="class-no-teacher">
                                    Not Assigned
                                </span>
                            `;


                    const currentStatus =
                        item.status ||
                        "Active";


                    return `

                        <tr>

                            <td>
                                <span class="class-name">
                                    ${escapeHtml(
                                        item.name ||
                                        "-"
                                    )}
                                </span>
                            </td>


                            <td>
                                <span class="class-level">
                                    ${escapeHtml(
                                        item.level ||
                                        "-"
                                    )}
                                </span>
                            </td>


                            <td>
                                <span class="student-count">
                                    ${studentCount}
                                </span>
                            </td>


                            <td>
                                ${teacherHtml}
                            </td>


                            <td>
                                <span
                                    class="status-badge ${
                                        normalize(
                                            currentStatus
                                        )
                                        ===
                                        "active"
                                            ? "active-status"
                                            : "pending"
                                    }"
                                >
                                    ${escapeHtml(
                                        currentStatus
                                    )}
                                </span>
                            </td>


                            <td>

                                <div class="action-buttons">

                                    <button
                                        type="button"
                                        class="table-action"
                                        onclick="viewClass('${item.id}')"
                                    >
                                        View
                                    </button>


                                    <button
                                        type="button"
                                        class="table-action"
                                        onclick="editClass('${item.id}')"
                                    >
                                        Edit
                                    </button>


                                    <button
                                        type="button"
                                        class="table-action"
                                        onclick="deleteClass('${item.id}')"
                                    >
                                        Delete
                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


/* =========================================
   STATS
========================================= */

function updateStats() {

    if (
        $("totalClasses")
    ) {

        $("totalClasses")
            .textContent =
            classes.length;
    }


    if (
        $("totalStudents")
    ) {

        $("totalStudents")
            .textContent =
            students.length;
    }


    const assignedClasses =
        new Set(

            classTeacherAssignments

                .filter(
                    assignment =>
                        !currentSession
                        ||
                        assignment.session ===
                        currentSession
                )

                .map(
                    assignment =>
                        normalize(
                            assignment.class
                        )
                )

                .filter(Boolean)
        );


    if (
        $("assignedClasses")
    ) {

        $("assignedClasses")
            .textContent =
            assignedClasses.size;
    }


    if (
        $("activeClasses")
    ) {

        $("activeClasses")
            .textContent =

            classes.filter(
                item =>
                    normalize(
                        item.status
                    )
                    ===
                    "active"
            )
                .length;
    }
}


/* =========================================
   TEACHER DROPDOWN
========================================= */

function populateTeacherDropdown() {

    const select =
        $("classTeacher");


    if (!select) {
        return;
    }


    select.innerHTML = `

        <option value="">
            Not Assigned
        </option>
    `;


    teachers.forEach(
        teacher => {

            if (
                !teacher.teacher_id
            ) {
                return;
            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                teacher.teacher_id;


            option.textContent =
                `${getTeacherName(
                    teacher
                )} (${teacher.teacher_id})`;


            select.appendChild(
                option
            );
        }
    );
}


/* =========================================
   OPEN CLASS MODAL
========================================= */

function openClassModal(
    item = null
) {

    const modal =
        $("classModal");


    if (!modal) {
        return;
    }


    $("classForm")
        ?.reset();


    if (
        $("classId")
    ) {

        $("classId").value =
            item?.id ||
            "";
    }


    if (
        $("modalTitle")
    ) {

        $("modalTitle")
            .textContent =
            item
                ? "Edit Class"
                : "Add New Class";
    }


    if (
        $("className")
    ) {

        $("className").value =
            item?.name ||
            "";
    }


    if (
        $("classLevel")
    ) {

        $("classLevel").value =
            item?.level ||
            "";
    }


    if (
        $("classArm")
    ) {

        $("classArm").value =
            item?.arm ||
            "";
    }


    if (
        $("academicSession")
    ) {

        $("academicSession").value =
            currentSession ||
            item?.session ||
            "";
    }


    if (
        $("classStatus")
    ) {

        $("classStatus").value =
            item?.status ||
            "Active";
    }


    const assignment =
        item
            ? getClassTeacherAssignment(
                item.name
            )
            : null;


    if (
        $("classTeacher")
    ) {

        $("classTeacher").value =
            assignment?.teacher_id ||
            "";
    }


    /*
        Support both classes.css possibilities.
    */

    modal.classList.add(
        "show"
    );

    modal.classList.add(
        "active"
    );

    modal.style.display =
        "flex";


    modal.style.position =
        "fixed";


    modal.style.inset =
        "0";


    modal.style.zIndex =
        "9999";
}


/* =========================================
   CLOSE MODAL
========================================= */

function closeClassModal() {

    const modal =
        $("classModal");


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );

    modal.classList.remove(
        "active"
    );

    modal.style.display =
        "none";
}


/* =========================================
   SAVE CLASS
========================================= */

async function saveClass(
    event
) {

    event.preventDefault();


    const recordId =
        $("classId")
            ?.value ||
        "";


    const existing =
        recordId

            ? classes.find(
                item =>
                    String(
                        item.id
                    )
                    ===
                    String(
                        recordId
                    )
            )

            : null;


    const oldClassName =
        existing?.name ||
        "";


    const classData = {

        name:
            $("className")
                ?.value
                .trim() ||
            "",

        level:
            $("classLevel")
                ?.value ||
            "",

        arm:
            $("classArm")
                ?.value
                .trim()
                .toUpperCase() ||
            "",

        session:
            currentSession ||
            $("academicSession")
                ?.value ||
            "",

        status:
            $("classStatus")
                ?.value ||
            "Active"
    };


    const selectedTeacherId =
        $("classTeacher")
            ?.value ||
        "";


    if (
        !classData.name ||
        !classData.level
    ) {

        alert(
            "Please enter Class Name and Level."
        );

        return;
    }


    const duplicate =
        classes.find(
            item =>

                normalize(
                    item.name
                )
                ===
                normalize(
                    classData.name
                )

                &&

                String(
                    item.id
                )
                !==
                String(
                    recordId
                )
        );


    if (
        duplicate
    ) {

        alert(
            "Another class already uses this name."
        );

        return;
    }


    const button =
        $("saveClassBtn");


    if (
        button
    ) {

        button.disabled =
            true;

        button.textContent =
            "Saving...";
    }


    try {

        if (
            recordId
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from("classes")
                    .update(
                        classData
                    )
                    .eq(
                        "id",
                        recordId
                    );


            if (error) {
                throw error;
            }


            if (
                oldClassName

                &&

                normalize(
                    oldClassName
                )
                !==
                normalize(
                    classData.name
                )
            ) {

                await updateCurrentClassReferences(
                    oldClassName,
                    classData.name
                );
            }


        } else {

            const {
                error
            } =
                await supabaseClient
                    .from("classes")
                    .insert([
                        classData
                    ]);


            if (error) {
                throw error;
            }
        }


        await saveClassTeacherAssignment(
            oldClassName ||
            classData.name,
            classData.name,
            selectedTeacherId
        );


        closeClassModal();


        await loadClasses();


        alert(
            recordId
                ? "Class updated successfully."
                : "Class added successfully."
        );


    } catch (error) {

        console.error(
            "Save class error:",
            error
        );


        alert(
            "Could not save class: " +
            error.message
        );


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;

            button.textContent =
                "Save Class";
        }
    }
}


/* =========================================
   UPDATE CURRENT CLASS REFERENCES
========================================= */

async function updateCurrentClassReferences(
    oldClassName,
    newClassName
) {

    const studentUpdate =
        await supabaseClient
            .from("students")
            .update({
                class:
                    newClassName
            })
            .eq(
                "class",
                oldClassName
            );


    if (
        studentUpdate.error
    ) {

        throw studentUpdate.error;
    }


    const teacherUpdate =
        await supabaseClient
            .from(
                "teacher_assignments"
            )
            .update({
                class:
                    newClassName
            })
            .eq(
                "class",
                oldClassName
            );


    if (
        teacherUpdate.error
    ) {

        throw teacherUpdate.error;
    }


    if (
        currentSession
    ) {

        const subjectUpdate =
            await supabaseClient
                .from(
                    "student_subjects"
                )
                .update({
                    class:
                        newClassName
                })
                .eq(
                    "class",
                    oldClassName
                )
                .eq(
                    "session",
                    currentSession
                );


        if (
            subjectUpdate.error
        ) {
            throw subjectUpdate.error;
        }


        const resultUpdate =
            await supabaseClient
                .from("results")
                .update({
                    class:
                        newClassName
                })
                .eq(
                    "class",
                    oldClassName
                )
                .eq(
                    "session",
                    currentSession
                );


        if (
            resultUpdate.error
        ) {
            throw resultUpdate.error;
        }


        const reportUpdate =
            await supabaseClient
                .from(
                    "student_reports"
                )
                .update({
                    class:
                        newClassName
                })
                .eq(
                    "class",
                    oldClassName
                )
                .eq(
                    "session",
                    currentSession
                );


        if (
            reportUpdate.error
        ) {
            throw reportUpdate.error;
        }
    }


    let classTeacherQuery =
        supabaseClient
            .from(
                "class_teacher_assignments"
            )
            .update({
                class:
                    newClassName
            })
            .eq(
                "class",
                oldClassName
            );


    if (
        currentSession
    ) {

        classTeacherQuery =
            classTeacherQuery.eq(
                "session",
                currentSession
            );
    }


    const classTeacherUpdate =
        await classTeacherQuery;


    if (
        classTeacherUpdate.error
    ) {

        throw classTeacherUpdate.error;
    }
}


/* =========================================
   SAVE CLASS TEACHER
========================================= */

async function saveClassTeacherAssignment(
    oldClassName,
    newClassName,
    teacherId
) {

    if (
        !currentSession
    ) {
        return;
    }


    const {
        error: deleteCurrentError
    } =
        await supabaseClient
            .from(
                "class_teacher_assignments"
            )
            .delete()
            .eq(
                "class",
                newClassName
            )
            .eq(
                "session",
                currentSession
            );


    if (
        deleteCurrentError
    ) {

        throw deleteCurrentError;
    }


    if (
        oldClassName

        &&

        normalize(
            oldClassName
        )
        !==
        normalize(
            newClassName
        )
    ) {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "class_teacher_assignments"
                )
                .delete()
                .eq(
                    "class",
                    oldClassName
                )
                .eq(
                    "session",
                    currentSession
                );


        if (error) {
            throw error;
        }
    }


    if (
        !teacherId
    ) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "class_teacher_assignments"
            )
            .insert([
                {
                    teacher_id:
                        teacherId,

                    class:
                        newClassName,

                    session:
                        currentSession
                }
            ]);


    if (error) {
        throw error;
    }
}


/* =========================================
   VIEW CLASS
========================================= */

window.viewClass =
    function (
        id
    ) {

        const item =
            classes.find(
                cls =>
                    String(
                        cls.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (!item) {
            return;
        }


        const studentCount =
            getClassStudentCount(
                item.name
            );


        const teacherName =
            getClassTeacherName(
                item.name
            );


        alert(
            `Class: ${item.name}\n` +
            `Level: ${item.level || "-"}\n` +
            `Arm: ${item.arm || "-"}\n` +
            `Students: ${studentCount}\n` +
            `Class Teacher: ${teacherName}\n` +
            `Session: ${currentSession || item.session || "-"}\n` +
            `Status: ${item.status || "Active"}`
        );
    };


/* =========================================
   EDIT CLASS
========================================= */

window.editClass =
    function (
        id
    ) {

        const item =
            classes.find(
                cls =>
                    String(
                        cls.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (!item) {

            alert(
                "Class could not be found."
            );

            return;
        }


        openClassModal(
            item
        );
    };


/* =========================================
   DELETE CLASS
========================================= */

window.deleteClass =
    async function (
        id
    ) {

        const item =
            classes.find(
                cls =>
                    String(
                        cls.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (!item) {
            return;
        }


        try {

            const [
                studentCheck,
                resultCheck,
                reportCheck,
                teacherCheck,
                subjectCheck,
                classTeacherCheck
            ] =
                await Promise.all([

                    supabaseClient
                        .from("students")
                        .select(
                            "student_id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "class",
                            item.name
                        ),

                    supabaseClient
                        .from("results")
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "class",
                            item.name
                        ),

                    supabaseClient
                        .from(
                            "student_reports"
                        )
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "class",
                            item.name
                        ),

                    supabaseClient
                        .from(
                            "teacher_assignments"
                        )
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "class",
                            item.name
                        ),

                    supabaseClient
                        .from(
                            "student_subjects"
                        )
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "class",
                            item.name
                        ),

                    supabaseClient
                        .from(
                            "class_teacher_assignments"
                        )
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "class",
                            item.name
                        )

                ]);


            const inUse =
                Number(
                    studentCheck.count || 0
                )
                +
                Number(
                    resultCheck.count || 0
                )
                +
                Number(
                    reportCheck.count || 0
                )
                +
                Number(
                    teacherCheck.count || 0
                )
                +
                Number(
                    subjectCheck.count || 0
                )
                +
                Number(
                    classTeacherCheck.count || 0
                );


            if (
                inUse > 0
            ) {

                alert(
                    `"${item.name}" is already being used by students, teachers or academic records.\n\n` +
                    `Change its Status to Inactive instead of deleting it.`
                );

                return;
            }


            const confirmed =
                confirm(
                    `Delete "${item.name}"?`
                );


            if (!confirmed) {
                return;
            }


            const {
                error
            } =
                await supabaseClient
                    .from("classes")
                    .delete()
                    .eq(
                        "id",
                        id
                    );


            if (error) {
                throw error;
            }


            await loadClasses();


            alert(
                "Class deleted successfully."
            );


        } catch (error) {

            console.error(
                "Delete class error:",
                error
            );


            alert(
                "Could not delete class: " +
                error.message
            );
        }
    };


/* =========================================
   ESCAPE HTML
========================================= */

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