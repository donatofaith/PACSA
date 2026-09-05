let teachers = [];
let teacherAssignments = [];

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {

    $("menuBtn")?.addEventListener("click", () => {
        $("sidebar")?.classList.toggle("active");
    });

    $("logoutBtn")?.addEventListener("click", e => {
        e.preventDefault();

        if (confirm("Are you sure you want to logout?")) {
            window.location.href = "login.html";
        }
    });

    $("teacherSearch")?.addEventListener("input", renderTeachers);
    $("departmentFilter")?.addEventListener("change", renderTeachers);

    $("clearFiltersBtn")?.addEventListener("click", () => {
        $("teacherSearch").value = "";
        $("departmentFilter").value = "";
        renderTeachers();
    });

    $("addTeacherBtn")?.addEventListener("click", () => {
        openTeacherModal();
    });

    $("emptyAddTeacherBtn")?.addEventListener("click", () => {
        openTeacherModal();
    });

    $("addAssignmentBtn")?.addEventListener("click", () => {
        addAssignmentRow();
    });

    $("closeTeacherModal")?.addEventListener(
        "click",
        closeTeacherModal
    );

    $("cancelTeacherBtn")?.addEventListener(
        "click",
        closeTeacherModal
    );

    $("closeViewTeacherModal")?.addEventListener(
        "click",
        closeViewTeacherModal
    );

    $("teacherForm")?.addEventListener(
        "submit",
        saveTeacher
    );

    loadTeachers();
});


/* =========================================
   LOAD TEACHERS
========================================= */

async function loadTeachers() {

    $("teachersLoading").style.display = "block";
    $("emptyTeacherState").style.display = "none";

    const { data, error } = await supabaseClient
        .from("Teachers")
        .select(`
            id,
            teacher_id,
            first_name,
            last_name,
            email,
            phone,
            class,
            subject
        `)
        .order("first_name", {
            ascending: true
        });

    if (error) {

        $("teachersLoading").style.display = "none";

        console.error(error);

        alert(
            "Could not load teachers: " +
            error.message
        );

        return;
    }

    teachers = data || [];

    await loadTeacherAssignments();

    $("teachersLoading").style.display = "none";

    populateClasses();
    renderTeachers();
    updateStatistics();
}


/* =========================================
   LOAD ASSIGNMENTS
========================================= */

async function loadTeacherAssignments() {

    const { data, error } = await supabaseClient
        .from("teacher_assignments")
        .select(`
            id,
            teacher_id,
            class,
            subject,
            created_at
        `)
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Could not load teacher assignments:",
            error
        );

        teacherAssignments = [];

        return;
    }

    teacherAssignments = data || [];
}


/* =========================================
   GET TEACHER ASSIGNMENTS
========================================= */

function getTeacherAssignments(teacherId) {

    return teacherAssignments.filter(
        assignment =>
            String(assignment.teacher_id) ===
            String(teacherId)
    );
}


/* =========================================
   RENDER
========================================= */

function renderTeachers() {

    const search =
        $("teacherSearch").value
            .toLowerCase()
            .trim();

    const selectedClass =
        $("departmentFilter").value;

    const filtered = teachers.filter(teacher => {

        const name =
            `${teacher.first_name || ""} ${teacher.last_name || ""}`
                .toLowerCase();

        const assignments =
            getTeacherAssignments(teacher.teacher_id);

        const assignmentClasses =
            assignments
                .map(item => item.class)
                .filter(Boolean);

        const matchesClass =
            !selectedClass ||
            teacher.class === selectedClass ||
            assignmentClasses.includes(selectedClass);

        const matchesSearch =
            name.includes(search) ||
            String(
                teacher.teacher_id || ""
            )
                .toLowerCase()
                .includes(search) ||
            String(
                teacher.email || ""
            )
                .toLowerCase()
                .includes(search);

        return matchesSearch && matchesClass;
    });

    $("teachersTableBody").innerHTML =
        filtered.map(teacher => {

            const name =
                `${teacher.first_name || ""} ${teacher.last_name || ""}`
                    .trim();

            const assignments =
                getTeacherAssignments(
                    teacher.teacher_id
                );

            let classHtml = "";
            let subjectHtml = "";

            if (assignments.length) {

                const uniqueClasses = [
                    ...new Set(
                        assignments
                            .map(item => item.class)
                            .filter(Boolean)
                    )
                ];

                const uniqueSubjects = [
                    ...new Set(
                        assignments
                            .map(item => item.subject)
                            .filter(Boolean)
                    )
                ];

                classHtml =
                    uniqueClasses.map(className => `
                        <span class="assignment-badge">
                            ${escapeHtml(className)}
                        </span>
                    `).join("");

                subjectHtml =
                    uniqueSubjects.map(subject => `
                        <span class="assignment-badge">
                            ${escapeHtml(subject)}
                        </span>
                    `).join("");

            } else {

                classHtml =
                    teacher.class
                        ? `
                            <span class="assignment-badge">
                                ${escapeHtml(teacher.class)}
                            </span>
                        `
                        : `<span class="no-assignment">Not assigned</span>`;

                subjectHtml =
                    teacher.subject
                        ? `
                            <span class="assignment-badge">
                                ${escapeHtml(teacher.subject)}
                            </span>
                        `
                        : `<span class="no-assignment">Not assigned</span>`;
            }

            return `
                <tr>

                    <td>
                        <div class="teacher-cell">

                            <div class="teacher-table-avatar">
                                ${getInitials(name)}
                            </div>

                            <div class="teacher-name-info">
                                <strong>
                                    ${escapeHtml(name)}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        teacher.email || "-"
                                    )}
                                </span>
                            </div>

                        </div>
                    </td>

                    <td>
                        ${escapeHtml(
                            teacher.teacher_id || "-"
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
                            teacher.phone || "-"
                        )}
                    </td>

                    <td>
                        <div class="table-action-buttons">

                            <button
                                class="table-btn view-table-btn"
                                onclick="viewTeacher('${teacher.id}')"
                                title="View Teacher">
                                👁
                            </button>

                            <button
                                class="table-btn edit-table-btn"
                                onclick="editTeacher('${teacher.id}')"
                                title="Edit Teacher">
                                ✏
                            </button>

                            <button
                                class="table-btn delete-table-btn"
                                onclick="deleteTeacher('${teacher.id}')"
                                title="Delete Teacher">
                                🗑
                            </button>

                        </div>
                    </td>

                </tr>
            `;

        }).join("");

    $("emptyTeacherState").style.display =
        filtered.length
            ? "none"
            : "block";

    $("teacherCount").textContent =
        filtered.length;
}


/* =========================================
   CLASSES FILTER
========================================= */

function populateClasses() {

    const filter =
        $("departmentFilter");

    const classes = [
        ...new Set(
            teachers
                .map(teacher => teacher.class)
                .filter(Boolean)
        )
    ];

    teacherAssignments.forEach(
        assignment => {

            if (assignment.class) {
                classes.push(
                    assignment.class
                );
            }

        }
    );

    const uniqueClasses = [
        ...new Set(classes)
    ];

    filter.innerHTML =
        `<option value="">All Classes</option>`;

    uniqueClasses.forEach(className => {

        const option =
            document.createElement("option");

        option.value = className;
        option.textContent = className;

        filter.appendChild(option);

    });
}


/* =========================================
   STATISTICS
========================================= */

function updateStatistics() {

    $("totalTeachers").textContent =
        teachers.length;

    $("activeTeachers").textContent =
        teachers.length;

    const classes = new Set();

    teachers.forEach(teacher => {

        if (teacher.class) {
            classes.add(teacher.class);
        }

        getTeacherAssignments(
            teacher.teacher_id
        ).forEach(assignment => {

            if (assignment.class) {
                classes.add(
                    assignment.class
                );
            }

        });

    });

    $("totalDepartments").textContent =
        classes.size;

    /*
       For now, a teacher with at least one
       class assignment is counted as a class teacher.
    */

    const classTeacherCount =
        teachers.filter(teacher => {

            const assignments =
                getTeacherAssignments(
                    teacher.teacher_id
                );

            return (
                teacher.class ||
                assignments.length > 0
            );

        }).length;

    $("classTeachers").textContent =
        classTeacherCount;

    $("teacherCount").textContent =
        teachers.length;
}


/* =========================================
   OPEN ADD / EDIT MODAL
========================================= */

async function openTeacherModal(
    teacher = null
) {

    $("teacherForm").reset();

    $("teacherRecordId").value =
        teacher?.id || "";

    $("teacherModalTitle").textContent =
        teacher
            ? "Edit Teacher"
            : "Add New Teacher";

    $("teacherFirstName").value =
        teacher?.first_name || "";

    $("teacherLastName").value =
        teacher?.last_name || "";

    $("teacherId").value =
        teacher?.teacher_id || "";

    $("teacherEmail").value =
        teacher?.email || "";

    $("teacherPhone").value =
        teacher?.phone || "";

    $("assignmentList").innerHTML = "";

    if (teacher) {

        const assignments =
            getTeacherAssignments(
                teacher.teacher_id
            );

        if (assignments.length) {

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
                teacher.class || "",
                teacher.subject || ""
            );

        }

    } else {

        addAssignmentRow();

    }

    $("teacherModal").classList.add(
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

    const row =
        document.createElement("div");

    row.className =
        "assignment-row";

    row.innerHTML = `

        <div class="form-group">

            <label>Class</label>

            <input
                type="text"
                class="assignment-class"
                placeholder="e.g. JSS 1"
                value="${escapeHtml(className)}"
                required
            >

        </div>

        <div class="form-group">

            <label>Subject</label>

            <input
                type="text"
                class="assignment-subject"
                placeholder="e.g. Mathematics"
                value="${escapeHtml(subject)}"
                required
            >

        </div>

        <button
            type="button"
            class="remove-assignment-btn"
            title="Remove Assignment">
            🗑
        </button>

    `;

    row
        .querySelector(
            ".remove-assignment-btn"
        )
        .addEventListener(
            "click",
            () => {

                const rows =
                    document.querySelectorAll(
                        ".assignment-row"
                    );

                if (rows.length <= 1) {

                    alert(
                        "A teacher must have at least one assignment."
                    );

                    return;
                }

                row.remove();
            }
        );

    container.appendChild(row);
}


/* =========================================
   GET ASSIGNMENTS FROM FORM
========================================= */

function getAssignmentsFromForm() {

    const rows =
        document.querySelectorAll(
            ".assignment-row"
        );

    const assignments = [];

    rows.forEach(row => {

        const classInput =
            row.querySelector(
                ".assignment-class"
            );

        const subjectInput =
            row.querySelector(
                ".assignment-subject"
            );

        const className =
            classInput.value.trim();

        const subject =
            subjectInput.value.trim();

        if (className && subject) {

            assignments.push({
                class: className,
                subject: subject
            });

        }

    });

    return assignments;
}


/* =========================================
   CLOSE
========================================= */

function closeTeacherModal() {

    $("teacherModal")
        .classList.remove("active");
}

function closeViewTeacherModal() {

    $("viewTeacherModal")
        .classList.remove("active");
}


/* =========================================
   SAVE TEACHER
========================================= */

async function saveTeacher(event) {

    event.preventDefault();

    const id =
        $("teacherRecordId").value;

    const teacherData = {

        first_name:
            $("teacherFirstName")
                .value
                .trim(),

        last_name:
            $("teacherLastName")
                .value
                .trim(),

        teacher_id:
            $("teacherId")
                .value
                .trim(),

        email:
            $("teacherEmail")
                .value
                .trim(),

        phone:
            $("teacherPhone")
                .value
                .trim()
    };

    if (
        !teacherData.first_name ||
        !teacherData.last_name ||
        !teacherData.teacher_id
    ) {

        alert(
            "Please enter First Name, Last Name and Teacher ID."
        );

        return;
    }

    const assignments =
        getAssignmentsFromForm();

    if (!assignments.length) {

        alert(
            "Please add at least one valid class and subject assignment."
        );

        return;
    }

    const button =
        $("saveTeacherBtn");

    button.disabled = true;
    button.textContent =
        "Saving...";

    /*
       Keep the first assignment in the
       existing Teachers table for
       compatibility with the current system.
    */

    teacherData.class =
        assignments[0].class;

    teacherData.subject =
        assignments[0].subject;

    let teacherResult;

    /* =====================================
       UPDATE EXISTING TEACHER
    ===================================== */

    if (id) {

        teacherResult =
            await supabaseClient
                .from("Teachers")
                .update(teacherData)
                .eq("id", id);

    }

    /* =====================================
       CREATE NEW TEACHER
    ===================================== */

    else {

        teacherResult =
            await supabaseClient
                .from("Teachers")
                .insert([
                    teacherData
                ])
                .select()
                .single();

    }

    if (teacherResult.error) {

        console.error(
            teacherResult.error
        );

        button.disabled = false;
        button.textContent =
            "Save Teacher";

        alert(
            "Could not save teacher: " +
            teacherResult.error.message
        );

        return;
    }

    /*
       Get the actual teacher ID used
       by teacher_assignments.
    */

    let savedTeacher;

    if (id) {

        savedTeacher =
            teachers.find(
                teacher =>
                    String(teacher.id) ===
                    String(id)
            );

    } else {

        savedTeacher =
            teacherResult.data;

    }

    if (!savedTeacher) {

        button.disabled = false;
        button.textContent =
            "Save Teacher";

        alert(
            "Teacher was saved, but the teacher record could not be identified."
        );

        return;
    }

    const teacherId =
        teacherData.teacher_id;


    /* =====================================
       DELETE OLD ASSIGNMENTS
    ===================================== */

    const deleteResult =
        await supabaseClient
            .from("teacher_assignments")
            .delete()
            .eq(
                "teacher_id",
                teacherId
            );

    if (deleteResult.error) {

        console.error(
            deleteResult.error
        );

        button.disabled = false;
        button.textContent =
            "Save Teacher";

        alert(
            "Teacher saved, but old assignments could not be updated: " +
            deleteResult.error.message
        );

        return;
    }


    /* =====================================
       INSERT NEW ASSIGNMENTS
    ===================================== */

    const assignmentRows =
        assignments.map(
            assignment => ({

                teacher_id:
                    teacherId,

                class:
                    assignment.class,

                subject:
                    assignment.subject

            })
        );

    const assignmentResult =
        await supabaseClient
            .from("teacher_assignments")
            .insert(
                assignmentRows
            );

    if (assignmentResult.error) {

        console.error(
            assignmentResult.error
        );

        button.disabled = false;
        button.textContent =
            "Save Teacher";

        alert(
            "Teacher saved, but assignments could not be saved: " +
            assignmentResult.error.message
        );

        return;
    }


    /* =====================================
       SUCCESS
    ===================================== */

    button.disabled = false;
    button.textContent =
        "Save Teacher";

    closeTeacherModal();

    await loadTeachers();

    alert(
        id
            ? "Teacher and assignments updated successfully."
            : "Teacher and assignments added successfully."
    );
}


/* =========================================
   VIEW TEACHER
========================================= */

window.viewTeacher =
    function(id) {

        const teacher =
            teachers.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!teacher) return;

        const name =
            `${teacher.first_name || ""} ${teacher.last_name || ""}`
                .trim();

        $("viewTeacherAvatar")
            .textContent =
            getInitials(name);

        $("viewTeacherName")
            .textContent =
            name;

        $("viewTeacherId")
            .textContent =
            teacher.teacher_id || "-";

        $("viewTeacherEmail")
            .textContent =
            teacher.email || "-";

        $("viewTeacherPhone")
            .textContent =
            teacher.phone || "-";


        const assignments =
            getTeacherAssignments(
                teacher.teacher_id
            );

        const assignmentContainer =
            $("viewTeacherAssignments");

        if (assignments.length) {

            assignmentContainer.innerHTML =
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
                ).join("");

        } else {

            assignmentContainer.innerHTML =
                `<span class="no-assignment">
                    No teaching assignments found.
                </span>`;

        }


        const uniqueClasses = [
            ...new Set(
                assignments
                    .map(
                        assignment =>
                            assignment.class
                    )
                    .filter(Boolean)
            )
        ];

        $("viewTeacherDepartment")
            .textContent =
            uniqueClasses.length
                ? uniqueClasses.join(", ")
                : teacher.class || "-";


        $("viewTeacherModal")
            .classList.add("active");
    };


/* =========================================
   EDIT
========================================= */

window.editTeacher =
    function(id) {

        const teacher =
            teachers.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (teacher) {

            openTeacherModal(
                teacher
            );

        }
    };


/* =========================================
   DELETE
========================================= */

window.deleteTeacher =
    async function(id) {

        const teacher =
            teachers.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!teacher) return;

        const name =
            `${teacher.first_name || ""} ${teacher.last_name || ""}`
                .trim();

        if (
            !confirm(
                `Are you sure you want to delete ${name}?`
            )
        ) {
            return;
        }


        /*
           Delete assignments first.
        */

        const assignmentDelete =
            await supabaseClient
                .from("teacher_assignments")
                .delete()
                .eq(
                    "teacher_id",
                    teacher.teacher_id
                );

        if (assignmentDelete.error) {

            console.error(
                assignmentDelete.error
            );

            alert(
                "Could not delete teacher assignments: " +
                assignmentDelete.error.message
            );

            return;
        }


        /*
           Delete teacher.
        */

        const teacherDelete =
            await supabaseClient
                .from("Teachers")
                .delete()
                .eq("id", id);

        if (teacherDelete.error) {

            console.error(
                teacherDelete.error
            );

            alert(
                "Could not delete teacher: " +
                teacherDelete.error.message
            );

            return;
        }


        await loadTeachers();

        alert(
            "Teacher and all assignments deleted successfully."
        );
    };


/* =========================================
   HELPERS
========================================= */

function getInitials(name) {

    return name
        .split(" ")
        .filter(Boolean)
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}