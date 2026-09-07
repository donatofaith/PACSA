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
   HELPERS
========================================= */

function normalize(value) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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


        if (
            classTeacherResult.error
        ) {
            throw classTeacherResult.error;
        }


        classes =
            classResult.data || [];


        students =
            studentResult.data || [];


        teachers =
            teacherResult.data || [];


        classTeacherAssignments =
            classTeacherResult.data || [];


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
                normalize(
                    assignment.session
                )
                ===
                normalize(
                    currentSession
                );


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
            normalize(
                teacher.teacher_id
            )
            ===
            normalize(
                teacherId
            )
    );
}


/* =========================================
   TEACHER NAME
   NO FULLNAME COLUMN
========================================= */

function getTeacherName(
    teacher
) {

    if (!teacher) {
        return "Not Assigned";
    }


    const name =
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim();


    return (
        name
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

                    normalize(
                        item.level
                    )
                    ===
                    normalize(
                        level
                    );


                const matchesStatus =
                    status === "all"

                    ||

                    normalize(
                        item.status
                    )
                    ===
                    normalize(
                        status
                    );


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
                <td
                    colspan="6"
                    class="empty-state"
                >
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
                        normalize(
                            assignment.session
                        )
                        ===
                        normalize(
                            currentSession
                        )
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


    modal.classList.add(
        "show"
    );
}


/* =========================================
   CLOSE CLASS MODAL
========================================= */

function closeClassModal() {

    $("classModal")
        ?.classList
        .remove("show");


    $("classForm")
        ?.reset();
}


/* =========================================
   SAVE CLASS
========================================= */

async function saveClass(
    event
) {

    event.preventDefault();


    const classId =
        $("classId")
            ?.value
            .trim();


    const name =
        $("className")
            ?.value
            .trim();


    const level =
        $("classLevel")
            ?.value
            .trim();


    const arm =
        $("classArm")
            ?.value
            .trim();


    const session =
        $("academicSession")
            ?.value
            .trim()
        ||
        currentSession;


    const status =
        $("classStatus")
            ?.value
            .trim()
        ||
        "Active";


    const teacherId =
        $("classTeacher")
            ?.value
            .trim();


    if (
        !name ||
        !level
    ) {

        alert(
            "Class name and level are required."
        );

        return;
    }


    const saveButton =
        $("saveClassBtn");


    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";
    }


    try {

        let savedClass;


        if (
            classId
        ) {

            const oldClass =
                classes.find(
                    item =>
                        String(item.id)
                        ===
                        String(classId)
                );


            const {
                data,
                error
            } =
                await supabaseClient
                    .from("classes")
                    .update({
                        name,
                        level,
                        arm,
                        session,
                        status
                    })
                    .eq(
                        "id",
                        classId
                    )
                    .select()
                    .single();


            if (error)
                throw error;


            savedClass =
                data;


            if (
                oldClass &&
                normalize(
                    oldClass.name
                )
                !==
                normalize(
                    name
                )
            ) {

                await updateClassNameReferences(
                    oldClass.name,
                    name
                );
            }


        } else {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("classes")
                    .insert({
                        name,
                        level,
                        arm,
                        session,
                        status
                    })
                    .select()
                    .single();


            if (error)
                throw error;


            savedClass =
                data;
        }


        await saveClassTeacherAssignment(
            savedClass.name,
            teacherId,
            session
        );


        closeClassModal();

        await loadClasses();


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

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Class";
        }
    }
}


/* =========================================
   SAVE CLASS TEACHER
========================================= */

async function saveClassTeacherAssignment(
    className,
    teacherId,
    session
) {

    const existing =
        getClassTeacherAssignment(
            className
        );


    if (
        !teacherId
    ) {

        if (existing) {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "class_teacher_assignments"
                    )
                    .delete()
                    .eq(
                        "id",
                        existing.id
                    );


            if (error)
                throw error;
        }


        return;
    }


    if (existing) {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "class_teacher_assignments"
                )
                .update({
                    teacher_id:
                        teacherId,

                    class:
                        className,

                    session:
                        session
                })
                .eq(
                    "id",
                    existing.id
                );


        if (error)
            throw error;


        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "class_teacher_assignments"
            )
            .insert({
                teacher_id:
                    teacherId,

                class:
                    className,

                session:
                    session
            });


    if (error)
        throw error;
}


/* =========================================
   UPDATE CLASS NAME REFERENCES
========================================= */

async function updateClassNameReferences(
    oldName,
    newName
) {

    if (
        !oldName ||
        !newName ||
        normalize(oldName)
        ===
        normalize(newName)
    ) {
        return;
    }


    const updates = [

        supabaseClient
            .from("students")
            .update({
                class: newName
            })
            .eq(
                "class",
                oldName
            ),

        supabaseClient
            .from(
                "teacher_assignments"
            )
            .update({
                class: newName
            })
            .eq(
                "class",
                oldName
            ),

        supabaseClient
            .from(
                "class_teacher_assignments"
            )
            .update({
                class: newName
            })
            .eq(
                "class",
                oldName
            ),

        supabaseClient
            .from(
                "student_subjects"
            )
            .update({
                class: newName
            })
            .eq(
                "class",
                oldName
            ),

        supabaseClient
            .from("student_reports")
            .update({
                class: newName
            })
            .eq(
                "class",
                oldName
            )
    ];


    const results =
        await Promise.all(
            updates
        );


    const failed =
        results.find(
            result =>
                result.error
        );


    if (
        failed?.error
    ) {
        throw failed.error;
    }
}


/* =========================================
   EDIT CLASS
========================================= */

window.editClass =
    function (
        id
    ) {

        const item =
            classes.find(
                row =>
                    String(row.id)
                    ===
                    String(id)
            );


        if (!item) {

            alert(
                "Class was not found."
            );

            return;
        }


        openClassModal(
            item
        );
    };


/* =========================================
   VIEW CLASS
========================================= */

window.viewClass =
    function (
        id
    ) {

        const item =
            classes.find(
                row =>
                    String(row.id)
                    ===
                    String(id)
            );


        if (!item) {

            alert(
                "Class was not found."
            );

            return;
        }


        const teacher =
            getClassTeacherName(
                item.name
            );


        const count =
            getClassStudentCount(
                item.name
            );


        alert(
            `Class: ${item.name}\n` +
            `Level: ${item.level || "-"}\n` +
            `Students: ${count}\n` +
            `Class Teacher: ${teacher}\n` +
            `Status: ${item.status || "Active"}`
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
                row =>
                    String(row.id)
                    ===
                    String(id)
            );


        if (!item) {

            alert(
                "Class was not found."
            );

            return;
        }


        const studentCount =
            getClassStudentCount(
                item.name
            );


        if (
            studentCount > 0
        ) {

            alert(
                "You cannot delete this class because students are still assigned to it."
            );

            return;
        }


        const confirmed =
            confirm(
                `Delete ${item.name}?`
            );


        if (!confirmed)
            return;


        try {

            const {
                error:
                assignmentDeleteError
            } =
                await supabaseClient
                    .from(
                        "class_teacher_assignments"
                    )
                    .delete()
                    .eq(
                        "class",
                        item.name
                    );


            if (
                assignmentDeleteError
            ) {
                throw assignmentDeleteError;
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


            if (error)
                throw error;


            await loadClasses();


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