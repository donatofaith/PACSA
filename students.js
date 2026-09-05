let students = [];

const $ = id => document.getElementById(id);


/* START */

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

    $("studentSearch")?.addEventListener("input", renderStudents);
    $("classFilter")?.addEventListener("change", renderStudents);
    $("statusFilter")?.addEventListener("change", renderStudents);

    $("clearFiltersBtn")?.addEventListener("click", () => {
        $("studentSearch").value = "";
        $("classFilter").value = "";
        $("statusFilter").value = "";
        renderStudents();
    });

    $("addStudentBtn")?.addEventListener(
        "click",
        () => openStudentModal()
    );

    $("emptyAddStudentBtn")?.addEventListener(
        "click",
        () => openStudentModal()
    );

    $("closeStudentModal")?.addEventListener(
        "click",
        closeStudentModal
    );

    $("cancelStudentBtn")?.addEventListener(
        "click",
        closeStudentModal
    );

    $("closeViewStudentModal")?.addEventListener(
        "click",
        closeViewStudentModal
    );

    $("closeViewStudentBtn")?.addEventListener(
        "click",
        closeViewStudentModal
    );

    $("studentForm")?.addEventListener(
        "submit",
        saveStudent
    );

    loadStudents();
});


/* LOAD */

async function loadStudents() {

    $("studentsLoading").style.display = "block";
    $("emptyStudentState").style.display = "none";

    const { data, error } = await supabaseClient
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
        .order("first_name", { ascending: true });

    $("studentsLoading").style.display = "none";

    if (error) {
        console.error(error);

        alert(
            "Could not load students: " +
            error.message
        );

        return;
    }

    students = data || [];

    populateClasses();
    renderStudents();
    updateStatistics();
}


/* RENDER */

function renderStudents() {

    const search =
        $("studentSearch").value
            .toLowerCase()
            .trim();

    const selectedClass =
        $("classFilter").value;

    const selectedStatus =
        $("statusFilter").value;

    const filtered = students.filter(student => {

        const name =
            `${student.first_name || ""} ${student.last_name || ""}`
                .toLowerCase();

        const id =
            String(student.student_id || "")
                .toLowerCase();

        const email =
            String(student.email || "")
                .toLowerCase();

        return (
            (
                name.includes(search) ||
                id.includes(search) ||
                email.includes(search)
            ) &&
            (
                !selectedClass ||
                student.class === selectedClass
            ) &&
            (
                !selectedStatus ||
                student.status === selectedStatus
            )
        );
    });

    $("studentsTableBody").innerHTML =
        filtered.map(student => {

            const name =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .trim();

            const status =
                student.status || "active";

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
                                        student.email || "-"
                                    )}
                                </span>
                            </div>

                        </div>
                    </td>

                    <td>
                        ${escapeHtml(
                            student.student_id || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            student.class || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            student.gender || "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            student.phone || "-"
                        )}
                    </td>

                    <td>
                        <span class="status-badge ${
                            status === "active"
                                ? "active-status"
                                : "pending"
                        }">
                            ${escapeHtml(status)}
                        </span>
                    </td>

                    <td>
                        <div class="table-action-buttons">

                            <button
                                class="table-btn view-table-btn"
                                onclick="viewStudent('${encodeURIComponent(
                                    student.student_id
                                )}')"
                                title="View Student">
                                👁
                            </button>

                            <button
                                class="table-btn edit-table-btn"
                                onclick="editStudent('${encodeURIComponent(
                                    student.student_id
                                )}')"
                                title="Edit Student">
                                ✏
                            </button>

                            <button
                                class="table-btn delete-table-btn"
                                onclick="deleteStudent('${encodeURIComponent(
                                    student.student_id
                                )}')"
                                title="Delete Student">
                                🗑
                            </button>

                        </div>
                    </td>

                </tr>
            `;

        }).join("");

    $("emptyStudentState").style.display =
        filtered.length ? "none" : "block";

    $("studentCount").textContent =
        filtered.length;
}


/* CLASS FILTER */

function populateClasses() {

    const filter =
        $("classFilter");

    const classes = [
        ...new Set(
            students
                .map(student => student.class)
                .filter(Boolean)
        )
    ];

    filter.innerHTML =
        `<option value="">All Classes</option>`;

    classes.forEach(className => {

        const option =
            document.createElement("option");

        option.value = className;
        option.textContent = className;

        filter.appendChild(option);
    });
}


/* STATISTICS */

function updateStatistics() {

    $("totalStudents").textContent =
        students.length;

    $("activeStudents").textContent =
        students.filter(
            student => student.status === "active"
        ).length;

    const classes =
        new Set(
            students
                .map(student => student.class)
                .filter(Boolean)
        );

    $("totalClasses").textContent =
        classes.size;

    $("newStudents").textContent =
        students.length;

    $("studentCount").textContent =
        students.length;
}


/* FIND */

function findStudent(studentId) {

    const id =
        decodeURIComponent(studentId);

    return students.find(
        student =>
            String(student.student_id) === String(id)
    );
}


/* OPEN ADD / EDIT */

function openStudentModal(student = null) {

    $("studentForm").reset();

    $("studentRecordId").value =
        student?.student_id || "";

    $("studentModalTitle").textContent =
        student
            ? "Edit Student"
            : "Add New Student";

    $("studentFirstName").value =
        student?.first_name || "";

    $("studentLastName").value =
        student?.last_name || "";

    $("studentId").value =
        student?.student_id || "";

    $("studentEmail").value =
        student?.email || "";

    $("studentPhone").value =
        student?.phone || "";

    $("studentClass").value =
        student?.class || "";

    $("studentGender").value =
        student?.gender || "Male";

    $("studentStatus").value =
        student?.status || "active";

    $("studentModal")
        .classList.add("active");
}


/* CLOSE */

function closeStudentModal() {

    $("studentModal")
        .classList.remove("active");
}


function closeViewStudentModal() {

    $("viewStudentModal")
        .classList.remove("active");
}


/* SAVE */

async function saveStudent(event) {

    event.preventDefault();

    const oldStudentId =
        $("studentRecordId").value.trim();

    const studentData = {

        first_name:
            $("studentFirstName")
                .value.trim(),

        last_name:
            $("studentLastName")
                .value.trim(),

        student_id:
            $("studentId")
                .value.trim(),

        email:
            $("studentEmail")
                .value.trim(),

        phone:
            $("studentPhone")
                .value.trim(),

        class:
            $("studentClass")
                .value,

        gender:
            $("studentGender")
                .value,

        status:
            $("studentStatus")
                .value
    };


    /* VALIDATION */

    if (
        !studentData.first_name ||
        !studentData.last_name ||
        !studentData.student_id ||
        !studentData.class
    ) {

        alert(
            "Please enter First Name, Last Name, Student ID and Class."
        );

        return;
    }


    const button =
        $("saveStudentBtn");

    button.disabled = true;
    button.textContent = "Saving...";


    let result;


    /* UPDATE */

    if (oldStudentId) {

        result = await supabaseClient
            .from("students")
            .update(studentData)
            .eq(
                "student_id",
                oldStudentId
            );

    }

    /* INSERT */

    else {

        result = await supabaseClient
            .from("students")
            .insert([
                studentData
            ]);
    }


    button.disabled = false;
    button.textContent = "Save Student";


    if (result.error) {

        console.error(
            "Save student error:",
            result.error
        );

        alert(
            "Could not save student: " +
            result.error.message
        );

        return;
    }


    closeStudentModal();

    await loadStudents();

    alert(
        oldStudentId
            ? "Student updated successfully."
            : "Student added successfully."
    );
}


/* VIEW */

window.viewStudent = function(studentId) {

    const student =
        findStudent(studentId);

    if (!student) return;

    const name =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim();

    $("viewStudentAvatar").textContent =
        getInitials(name);

    $("viewStudentName").textContent =
        name;

    $("viewStudentId").textContent =
        student.student_id || "-";

    $("viewStudentClass").textContent =
        student.class || "-";

    $("viewStudentGender").textContent =
        student.gender || "-";

    $("viewStudentEmail").textContent =
        student.email || "-";

    $("viewStudentPhone").textContent =
        student.phone || "-";

    $("viewStudentStatus").textContent =
        student.status || "active";

    $("viewStudentStatus").className =
        "status-badge " +
        (
            student.status === "active"
                ? "active-status"
                : "pending"
        );

    $("viewStudentModal")
        .classList.add("active");
};


/* EDIT */

window.editStudent = function(studentId) {

    const student =
        findStudent(studentId);

    if (student) {
        openStudentModal(student);
    }
};


/* DELETE */

window.deleteStudent = async function(studentId) {

    const student =
        findStudent(studentId);

    if (!student) return;

    const name =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim();

    if (
        !confirm(
            `Are you sure you want to delete ${name}?`
        )
    ) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("students")
            .delete()
            .eq(
                "student_id",
                student.student_id
            );

    if (error) {

        console.error(error);

        alert(
            "Could not delete student: " +
            error.message
        );

        return;
    }

    await loadStudents();

    alert(
        "Student deleted successfully."
    );
};


/* HELPERS */

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