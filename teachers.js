/* =========================================
   PACSA TEACHERS MANAGEMENT
   ADMIN AUTH + ASSIGNMENTS
========================================= */

let teachers = [];
let teacherAssignments = [];
let classTeacherAssignments = [];

const $ = id =>
    document.getElementById(id);


/* =========================================
   START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
            ADMIN AUTH FIRST
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

        $("teacherSearch")
            ?.addEventListener(
                "input",
                renderTeachers
            );


        $("departmentFilter")
            ?.addEventListener(
                "change",
                renderTeachers
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("teacherSearch").value =
                        "";

                    $("departmentFilter").value =
                        "";

                    renderTeachers();
                }
            );


        /* ADD TEACHER */

        $("addTeacherBtn")
            ?.addEventListener(
                "click",
                () => {

                    openTeacherModal();
                }
            );


        $("emptyAddTeacherBtn")
            ?.addEventListener(
                "click",
                () => {

                    openTeacherModal();
                }
            );


        /* ASSIGNMENT ROW */

        $("addAssignmentBtn")
            ?.addEventListener(
                "click",
                () => {

                    addAssignmentRow();
                }
            );


        /* MODALS */

        $("closeTeacherModal")
            ?.addEventListener(
                "click",
                closeTeacherModal
            );


        $("cancelTeacherBtn")
            ?.addEventListener(
                "click",
                closeTeacherModal
            );


        $("closeViewTeacherModal")
            ?.addEventListener(
                "click",
                closeViewTeacherModal
            );


        $("teacherModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("teacherModal")
                    ) {

                        closeTeacherModal();
                    }
                }
            );


        $("viewTeacherModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("viewTeacherModal")
                    ) {

                        closeViewTeacherModal();
                    }
                }
            );


        /* SAVE */

        $("teacherForm")
            ?.addEventListener(
                "submit",
                saveTeacher
            );


        await loadTeachers();
    }
);


/* =========================================
   LOAD TEACHERS
========================================= */

async function loadTeachers() {

    if (
        $("teachersLoading")
    ) {

        $("teachersLoading")
            .style
            .display =
            "block";
    }


    if (
        $("emptyTeacherState")
    ) {

        $("emptyTeacherState")
            .style
            .display =
            "none";
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("Teachers")
                .select(`
                    id,
                    teacher_id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    class,
                    subject,
                    auth_user_id,
                    portal_status
                `)
                .order(
                    "first_name",
                    {
                        ascending: true
                    }
                );


        if (error) {
            throw error;
        }


        teachers =
            data || [];


        await Promise.all([

            loadTeacherAssignments(),

            loadClassTeacherAssignments()

        ]);


        populateClasses();

        renderTeachers();

        updateStatistics();


    } catch (error) {

        console.error(
            "Could not load teachers:",
            error
        );


        alert(
            "Could not load teachers: " +
            error.message
        );


    } finally {

        if (
            $("teachersLoading")
        ) {

            $("teachersLoading")
                .style
                .display =
                "none";
        }
    }
}


/* =========================================
   LOAD TEACHING ASSIGNMENTS
========================================= */

async function loadTeacherAssignments() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "teacher_assignments"
            )
            .select(`
                id,
                teacher_id,
                class,
                subject,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Could not load teacher assignments:",
            error
        );


        teacherAssignments =
            [];

        return;
    }


    teacherAssignments =
        data || [];
}


/* =========================================
   LOAD CLASS TEACHER ASSIGNMENTS
========================================= */

async function loadClassTeacherAssignments() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "class_teacher_assignments"
            )
            .select(`
                id,
                teacher_id,
                class,
                session
            `);


    if (error) {

        console.error(
            "Could not load class teacher assignments:",
            error
        );


        classTeacherAssignments =
            [];

        return;
    }


    classTeacherAssignments =
        data || [];
}


/* =========================================
   GET TEACHER ASSIGNMENTS
========================================= */

function getTeacherAssignments(
    teacherId
) {

    return teacherAssignments.filter(
        assignment =>

            String(
                assignment.teacher_id
            )

            ===

            String(
                teacherId
            )
    );
}


/* =========================================
   GET CLASS TEACHER ASSIGNMENTS
========================================= */

function getClassTeacherAssignments(
    teacherId
) {

    return classTeacherAssignments.filter(
        assignment =>

            String(
                assignment.teacher_id
            )

            ===

            String(
                teacherId
            )
    );
}


/* =========================================
   RENDER TEACHERS
========================================= */

function renderTeachers() {

    const search =
        String(
            $("teacherSearch")
                ?.value ||
            ""
        )
            .toLowerCase()
            .trim();


    const selectedClass =
        $("departmentFilter")
            ?.value ||
        "";


    const filtered =
        teachers.filter(
            teacher => {

                const name =
                    getTeacherName(
                        teacher
                    )
                        .toLowerCase();


                const assignments =
                    getTeacherAssignments(
                        teacher.teacher_id
                    );


                const assignmentClasses =
                    assignments
                        .map(
                            item =>
                                item.class
                        )
                        .filter(Boolean);


                const matchesClass =
                    !selectedClass

                    ||

                    teacher.class ===
                    selectedClass

                    ||

                    assignmentClasses.includes(
                        selectedClass
                    );


                const matchesSearch =
                    name.includes(
                        search
                    )

                    ||

                    String(
                        teacher.teacher_id ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            search
                        )

                    ||

                    String(
                        teacher.email ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            search
                        );


                return (
                    matchesSearch &&
                    matchesClass
                );
            }
        );


    if (
        $("teachersTableBody")
    ) {

        $("teachersTableBody")
            .innerHTML =

            filtered
                .map(
                    teacher => {

                        const name =
                            getTeacherName(
                                teacher
                            );


                        const assignments =
                            getTeacherAssignments(
                                teacher.teacher_id
                            );


                        let classHtml =
                            "";


                        let subjectHtml =
                            "";


                        if (
                            assignments.length
                        ) {

                            const uniqueClasses =
                                [
                                    ...new Set(

                                        assignments
                                            .map(
                                                item =>
                                                    item.class
                                            )
                                            .filter(Boolean)
                                    )
                                ];


                            const uniqueSubjects =
                                [
                                    ...new Set(

                                        assignments
                                            .map(
                                                item =>
                                                    item.subject
                                            )
                                            .filter(Boolean)
                                    )
                                ];


                            classHtml =
                                uniqueClasses
                                    .map(
                                        className => `

                                            <span class="assignment-badge">
                                                ${escapeHtml(
                                                    className
                                                )}
                                            </span>
                                        `
                                    )
                                    .join("");


                            subjectHtml =
                                uniqueSubjects
                                    .map(
                                        subject => `

                                            <span class="assignment-badge">
                                                ${escapeHtml(
                                                    subject
                                                )}
                                            </span>
                                        `
                                    )
                                    .join("");


                        } else {

                            classHtml =
                                teacher.class

                                    ? `

                                        <span class="assignment-badge">
                                            ${escapeHtml(
                                                teacher.class
                                            )}
                                        </span>
                                    `

                                    : `

                                        <span class="no-assignment">
                                            Not assigned
                                        </span>
                                    `;


                            subjectHtml =
                                teacher.subject

                                    ? `

                                        <span class="assignment-badge">
                                            ${escapeHtml(
                                                teacher.subject
                                            )}
                                        </span>
                                    `

                                    : `

                                        <span class="no-assignment">
                                            Not assigned
                                        </span>
                                    `;
                        }


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
                                                    teacher.email ||
                                                    "-"
                                                )}
                                            </span>

                                        </div>

                                    </div>

                                </td>


                                <td>

                                    ${escapeHtml(
                                        teacher.teacher_id ||
                                        "-"
                                    )}

                                </td>


                                <td>

                                    <div class="assignment-summary">
                                        ${classHtml}
                                    </div>

                                </td>


                                <td>

                                    <div class="assignment-summary">
                                        ${subjectHtml}
                                    </div>

                                </td>


                                <td>

                                    ${escapeHtml(
                                        teacher.phone ||
                                        "-"
                                    )}

                                </td>


                                <td>

                                    <div class="table-action-buttons">

                                        <button
                                            type="button"
                                            class="table-btn view-table-btn"
                                            onclick="viewTeacher('${teacher.id}')"
                                            title="View Teacher"
                                        >
                                            👁
                                        </button>


                                        <button
                                            type="button"
                                            class="table-btn edit-table-btn"
                                            onclick="editTeacher('${teacher.id}')"
                                            title="Edit Teacher"
                                        >
                                            ✏
                                        </button>


                                        <button
                                            type="button"
                                            class="table-btn delete-table-btn"
                                            onclick="deleteTeacher('${teacher.id}')"
                                            title="Delete Teacher"
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
        $("emptyTeacherState")
    ) {

        $("emptyTeacherState")
            .style
            .display =

            filtered.length
                ? "none"
                : "block";
    }


    if (
        $("teacherCount")
    ) {

        $("teacherCount")
            .textContent =
            filtered.length;
    }
}


/* =========================================
   CLASS FILTER
========================================= */

function populateClasses() {

    const filter =
        $("departmentFilter");


    if (!filter) {
        return;
    }


    const oldValue =
        filter.value;


    const classes =
        [];


    teachers.forEach(
        teacher => {

            if (
                teacher.class
            ) {

                classes.push(
                    teacher.class
                );
            }
        }
    );


    teacherAssignments.forEach(
        assignment => {

            if (
                assignment.class
            ) {

                classes.push(
                    assignment.class
                );
            }
        }
    );


    const uniqueClasses =
        [
            ...new Set(
                classes
            )
        ]
            .sort();


    filter.innerHTML =
        `<option value="">All Classes</option>`;


    uniqueClasses.forEach(
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
        uniqueClasses.includes(
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
        $("totalTeachers")
    ) {

        $("totalTeachers")
            .textContent =
            teachers.length;
    }


    /*
        Teacher account is considered active
        unless explicitly inactive.
    */

    if (
        $("activeTeachers")
    ) {

        $("activeTeachers")
            .textContent =

            teachers.filter(
                teacher =>

                    String(
                        teacher.portal_status ||
                        "active"
                    )
                        .toLowerCase()

                    !==

                    "inactive"
            )
                .length;
    }


    const classes =
        new Set();


    teacherAssignments.forEach(
        assignment => {

            if (
                assignment.class
            ) {

                classes.add(
                    assignment.class
                );
            }
        }
    );


    if (
        $("totalDepartments")
    ) {

        $("totalDepartments")
            .textContent =
            classes.size;
    }


    /*
        REAL CLASS TEACHERS

        Count unique teachers in the
        class_teacher_assignments table.
    */

    const classTeacherIds =
        new Set(

            classTeacherAssignments
                .map(
                    assignment =>
                        assignment.teacher_id
                )
                .filter(Boolean)
        );


    if (
        $("classTeachers")
    ) {

        $("classTeachers")
            .textContent =
            classTeacherIds.size;
    }


    if (
        $("teacherCount")
    ) {

        $("teacherCount")
            .textContent =
            teachers.length;
    }
}


/* =========================================
   OPEN ADD / EDIT TEACHER
========================================= */

function openTeacherModal(
    teacher = null
) {

    $("teacherForm")
        ?.reset();


    if (
        $("teacherRecordId")
    ) {

        $("teacherRecordId")
            .value =
            teacher?.id ||
            "";
    }


    if (
        $("teacherModalTitle")
    ) {

        $("teacherModalTitle")
            .textContent =

            teacher
                ? "Edit Teacher"
                : "Add New Teacher";
    }


    if (
        $("teacherFirstName")
    ) {

        $("teacherFirstName")
            .value =
            teacher?.first_name ||
            "";
    }


    if (
        $("teacherLastName")
    ) {

        $("teacherLastName")
            .value =
            teacher?.last_name ||
            "";
    }


    if (
        $("teacherId")
    ) {

        $("teacherId")
            .value =
            teacher?.teacher_id ||
            "";
    }


    if (
        $("teacherEmail")
    ) {

        $("teacherEmail")
            .value =
            teacher?.email ||
            "";
    }


    if (
        $("teacherPhone")
    ) {

        $("teacherPhone")
            .value =
            teacher?.phone ||
            "";
    }


    if (
        $("assignmentList")
    ) {

        $("assignmentList")
            .innerHTML =
            "";
    }


    if (
        teacher
    ) {

        const assignments =
            getTeacherAssignments(
                teacher.teacher_id
            );


        if (
            assignments.length
        ) {

            assignments.forEach(
                assignment => {

                    addAssignmentRow(
                        assignment.class,
                        assignment.subject
                    );
                }
            );


        } else {

            addAssignmentRow(
                teacher.class ||
                "",
                teacher.subject ||
                ""
            );
        }


    } else {

        addAssignmentRow();
    }


    $("teacherModal")
        ?.classList
        .add(
            "active"
        );
}


/* =========================================
   ADD ASSIGNMENT ROW
========================================= */

function addAssignmentRow(
    className = "",
    subject = ""
) {

    const container =
        $("assignmentList");


    if (!container) {
        return;
    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "assignment-row";


    row.innerHTML = `

        <div class="form-group">

            <label>
                Class
            </label>

            <input
                type="text"
                class="assignment-class"
                placeholder="e.g. SS2"
                value="${escapeAttribute(
                    className
                )}"
                required
            >

        </div>


        <div class="form-group">

            <label>
                Subject
            </label>

            <input
                type="text"
                class="assignment-subject"
                placeholder="e.g. Mathematics"
                value="${escapeAttribute(
                    subject
                )}"
                required
            >

        </div>


        <button
            type="button"
            class="remove-assignment-btn"
            title="Remove Assignment"
        >
            🗑
        </button>
    `;


    row
        .querySelector(
            ".remove-assignment-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                const rows =
                    $("assignmentList")
                        ?.querySelectorAll(
                            ".assignment-row"
                        );


                if (
                    rows &&
                    rows.length <= 1
                ) {

                    alert(
                        "A teacher must have at least one teaching assignment."
                    );

                    return;
                }


                row.remove();
            }
        );


    container.appendChild(
        row
    );
}


/* =========================================
   GET FORM ASSIGNMENTS
========================================= */

function getAssignmentsFromForm() {

    const rows =
        $("assignmentList")
            ?.querySelectorAll(
                ".assignment-row"
            )
        ||
        [];


    const assignments =
        [];


    rows.forEach(
        row => {

            const className =
                row
                    .querySelector(
                        ".assignment-class"
                    )
                    ?.value
                    .trim()
                ||
                "";


            const subject =
                row
                    .querySelector(
                        ".assignment-subject"
                    )
                    ?.value
                    .trim()
                ||
                "";


            if (
                className &&
                subject
            ) {

                assignments.push({

                    class:
                        className,

                    subject

                });
            }
        }
    );


    /*
        REMOVE DUPLICATE
        CLASS + SUBJECT PAIRS
    */

    const unique =
        [];


    const seen =
        new Set();


    assignments.forEach(
        assignment => {

            const key =
                `${assignment.class.toLowerCase()}|${assignment.subject.toLowerCase()}`;


            if (
                !seen.has(
                    key
                )
            ) {

                seen.add(
                    key
                );


                unique.push(
                    assignment
                );
            }
        }
    );


    return unique;
}


/* =========================================
   CLOSE MODALS
========================================= */

function closeTeacherModal() {

    $("teacherModal")
        ?.classList
        .remove(
            "active"
        );
}


function closeViewTeacherModal() {

    $("viewTeacherModal")
        ?.classList
        .remove(
            "active"
        );
}


/* =========================================
   SAVE TEACHER
========================================= */

async function saveTeacher(
    event
) {

    event.preventDefault();


    const recordId =
        $("teacherRecordId")
            ?.value ||
        "";


    const existingTeacher =
        recordId

            ? teachers.find(
                teacher =>
                    String(
                        teacher.id
                    )
                    ===
                    String(
                        recordId
                    )
            )

            : null;


    const oldTeacherId =
        existingTeacher
            ?.teacher_id ||
        "";


    const teacherData = {

        first_name:
            $("teacherFirstName")
                ?.value
                .trim() ||
            "",

        last_name:
            $("teacherLastName")
                ?.value
                .trim() ||
            "",

        teacher_id:
            $("teacherId")
                ?.value
                .trim() ||
            "",

        email:
            $("teacherEmail")
                ?.value
                .trim() ||
            "",

        phone:
            $("teacherPhone")
                ?.value
                .trim() ||
            ""
    };


    if (
        !teacherData.first_name

        ||

        !teacherData.last_name

        ||

        !teacherData.teacher_id
    ) {

        alert(
            "Please enter First Name, Last Name and Teacher ID."
        );

        return;
    }


    const assignments =
        getAssignmentsFromForm();


    if (
        !assignments.length
    ) {

        alert(
            "Please add at least one valid class and subject assignment."
        );

        return;
    }


    /*
        KEEP FIRST ASSIGNMENT IN Teachers TABLE
        FOR COMPATIBILITY WITH EXISTING CODE.
    */

    teacherData.class =
        assignments[0].class;


    teacherData.subject =
        assignments[0].subject;


    const button =
        $("saveTeacherBtn");


    if (
        button
    ) {

        button.disabled =
            true;


        button.textContent =
            "Saving...";
    }


    try {

        /*
            CHECK DUPLICATE TEACHER ID
        */

        const duplicate =
            teachers.find(
                teacher =>

                    String(
                        teacher.teacher_id
                    )
                        .toLowerCase()

                    ===

                    String(
                        teacherData.teacher_id
                    )
                        .toLowerCase()

                    &&

                    String(
                        teacher.id
                    )

                    !==

                    String(
                        recordId
                    )
            );


        if (
            duplicate
        ) {

            throw new Error(
                "Another teacher already uses this Teacher ID."
            );
        }


        /* =====================================
           UPDATE EXISTING TEACHER
        ===================================== */

        if (
            recordId
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "Teachers"
                    )
                    .update(
                        teacherData
                    )
                    .eq(
                        "id",
                        recordId
                    );


            if (error) {
                throw error;
            }


            /*
                IF TEACHER ID CHANGED,
                UPDATE CLASS TEACHER LINK TOO.
            */

            if (
                oldTeacherId &&
                oldTeacherId !==
                teacherData.teacher_id
            ) {

                const {
                    error:
                    classTeacherUpdateError
                } =
                    await supabaseClient
                        .from(
                            "class_teacher_assignments"
                        )
                        .update({

                            teacher_id:
                                teacherData.teacher_id

                        })
                        .eq(
                            "teacher_id",
                            oldTeacherId
                        );


                if (
                    classTeacherUpdateError
                ) {

                    throw classTeacherUpdateError;
                }
            }


            /*
                DELETE OLD TEACHING ASSIGNMENTS
                USING OLD ID.
            */

            const {
                error:
                deleteError
            } =
                await supabaseClient
                    .from(
                        "teacher_assignments"
                    )
                    .delete()
                    .eq(
                        "teacher_id",
                        oldTeacherId ||
                        teacherData.teacher_id
                    );


            if (
                deleteError
            ) {

                throw deleteError;
            }


        } else {

            /* =====================================
               CREATE NEW TEACHER
            ===================================== */

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "Teachers"
                    )
                    .insert([
                        teacherData
                    ]);


            if (error) {
                throw error;
            }
        }


        /* =====================================
           INSERT ASSIGNMENTS
        ===================================== */

        const assignmentRows =
            assignments.map(
                assignment => ({

                    teacher_id:
                        teacherData.teacher_id,

                    class:
                        assignment.class,

                    subject:
                        assignment.subject

                })
            );


        const {
            error:
            assignmentError
        } =
            await supabaseClient
                .from(
                    "teacher_assignments"
                )
                .insert(
                    assignmentRows
                );


        if (
            assignmentError
        ) {

            throw assignmentError;
        }


        closeTeacherModal();


        await loadTeachers();


        alert(

            recordId

                ? "Teacher and assignments updated successfully."

                : "Teacher and assignments added successfully."
        );


    } catch (error) {

        console.error(
            "Save teacher error:",
            error
        );


        alert(
            "Could not save teacher: " +
            error.message
        );


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;


            button.textContent =
                "Save Teacher";
        }
    }
}


/* =========================================
   VIEW TEACHER
========================================= */

window.viewTeacher =
    function (
        id
    ) {

        const teacher =
            teachers.find(
                item =>
                    String(
                        item.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (!teacher) {
            return;
        }


        const name =
            getTeacherName(
                teacher
            );


        if (
            $("viewTeacherAvatar")
        ) {

            $("viewTeacherAvatar")
                .textContent =
                getInitials(
                    name
                );
        }


        if (
            $("viewTeacherName")
        ) {

            $("viewTeacherName")
                .textContent =
                name;
        }


        if (
            $("viewTeacherId")
        ) {

            $("viewTeacherId")
                .textContent =
                teacher.teacher_id ||
                "-";
        }


        if (
            $("viewTeacherEmail")
        ) {

            $("viewTeacherEmail")
                .textContent =
                teacher.email ||
                "-";
        }


        if (
            $("viewTeacherPhone")
        ) {

            $("viewTeacherPhone")
                .textContent =
                teacher.phone ||
                "-";
        }


        const assignments =
            getTeacherAssignments(
                teacher.teacher_id
            );


        const classTeacherRoles =
            getClassTeacherAssignments(
                teacher.teacher_id
            );


        const assignmentContainer =
            $("viewTeacherAssignments");


        if (
            assignmentContainer
        ) {

            const teachingHtml =
                assignments.map(
                    assignment => `

                        <span class="assignment-badge">
                            🏫 ${escapeHtml(
                                assignment.class
                            )}
                            —
                            📚 ${escapeHtml(
                                assignment.subject
                            )}
                        </span>
                    `
                );


            const classTeacherHtml =
                classTeacherRoles.map(
                    assignment => `

                        <span class="assignment-badge">
                            👨‍🏫 Class Teacher:
                            ${escapeHtml(
                                assignment.class
                            )}
                            ${
                                assignment.session

                                    ? `— ${escapeHtml(
                                        assignment.session
                                    )}`

                                    : ""
                            }
                        </span>
                    `
                );


            const allBadges =
                [
                    ...teachingHtml,
                    ...classTeacherHtml
                ];


            assignmentContainer.innerHTML =

                allBadges.length

                    ? allBadges.join("")

                    : `

                        <span class="no-assignment">
                            No teaching assignments found.
                        </span>
                    `;
        }


        const uniqueClasses =
            [
                ...new Set(

                    assignments
                        .map(
                            assignment =>
                                assignment.class
                        )
                        .filter(Boolean)
                )
            ];


        if (
            $("viewTeacherDepartment")
        ) {

            $("viewTeacherDepartment")
                .textContent =

                uniqueClasses.length

                    ? uniqueClasses.join(
                        ", "
                    )

                    : teacher.class ||
                    "-";
        }


        $("viewTeacherModal")
            ?.classList
            .add(
                "active"
            );
    };


/* =========================================
   EDIT TEACHER
========================================= */

window.editTeacher =
    function (
        id
    ) {

        const teacher =
            teachers.find(
                item =>
                    String(
                        item.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (
            teacher
        ) {

            openTeacherModal(
                teacher
            );
        }
    };


/* =========================================
   DELETE TEACHER
========================================= */

window.deleteTeacher =
    async function (
        id
    ) {

        const teacher =
            teachers.find(
                item =>
                    String(
                        item.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (!teacher) {
            return;
        }


        const name =
            getTeacherName(
                teacher
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
                DELETE TEACHING ASSIGNMENTS
            */

            const {
                error:
                assignmentDeleteError
            } =
                await supabaseClient
                    .from(
                        "teacher_assignments"
                    )
                    .delete()
                    .eq(
                        "teacher_id",
                        teacher.teacher_id
                    );


            if (
                assignmentDeleteError
            ) {

                throw assignmentDeleteError;
            }


            /*
                DELETE CLASS TEACHER ASSIGNMENTS
            */

            const {
                error:
                classTeacherDeleteError
            } =
                await supabaseClient
                    .from(
                        "class_teacher_assignments"
                    )
                    .delete()
                    .eq(
                        "teacher_id",
                        teacher.teacher_id
                    );


            if (
                classTeacherDeleteError
            ) {

                throw classTeacherDeleteError;
            }


            /*
                DELETE TEACHER
            */

            const {
                error:
                teacherDeleteError
            } =
                await supabaseClient
                    .from(
                        "Teachers"
                    )
                    .delete()
                    .eq(
                        "id",
                        id
                    );


            if (
                teacherDeleteError
            ) {

                throw teacherDeleteError;
            }


            await loadTeachers();


            alert(
                "Teacher and all assignments deleted successfully."
            );


        } catch (error) {

            console.error(
                "Delete teacher error:",
                error
            );


            alert(
                "Could not delete teacher: " +
                error.message
            );
        }
    };


/* =========================================
   HELPERS
========================================= */

function getTeacherName(
    teacher
) {

    return (

        `${teacher?.first_name || ""} ${teacher?.last_name || ""}`
            .trim()

        ||

        teacher?.teacher_id

        ||

        "Teacher"
    );
}


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

        "T";
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