/* =========================================================
   PACSA - STUDENTS MANAGEMENT
   Temporary front-end data for development.
   Replace the students array with Supabase/database calls later.
   ========================================================= */

const students = [
    {
        id: "PACSA-001",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "0803 123 4567",
        studentClass: "JSS1",
        gender: "Male",
        status: "active",
        newStudent: true
    },
    {
        id: "PACSA-002",
        firstName: "Mary",
        lastName: "James",
        email: "mary.james@example.com",
        phone: "0806 234 5678",
        studentClass: "SS1",
        gender: "Female",
        status: "active",
        newStudent: true
    },
    {
        id: "PACSA-003",
        firstName: "Peter",
        lastName: "Okafor",
        email: "peter.okafor@example.com",
        phone: "0812 345 6789",
        studentClass: "JSS2",
        gender: "Male",
        status: "active",
        newStudent: false
    },
    {
        id: "PACSA-004",
        firstName: "Amaka",
        lastName: "Kingsley",
        email: "amaka.kingsley@example.com",
        phone: "0814 456 7890",
        studentClass: "SS2",
        gender: "Female",
        status: "inactive",
        newStudent: false
    },
    {
        id: "PACSA-005",
        firstName: "David",
        lastName: "Paul",
        email: "david.paul@example.com",
        phone: "0901 567 8901",
        studentClass: "JSS3",
        gender: "Male",
        status: "active",
        newStudent: false
    },
    {
        id: "PACSA-006",
        firstName: "Grace",
        lastName: "Williams",
        email: "grace.williams@example.com",
        phone: "0902 678 9012",
        studentClass: "SS3",
        gender: "Female",
        status: "active",
        newStudent: false
    }
];

let filteredStudents = [...students];

// ================= DOM ELEMENTS =================

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const logoutBtn = document.getElementById("logoutBtn");

const studentSearch = document.getElementById("studentSearch");
const classFilter = document.getElementById("classFilter");
const statusFilter = document.getElementById("statusFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const studentsTableBody = document.getElementById("studentsTableBody");
const studentsTable = document.getElementById("studentsTable");
const emptyStudentState = document.getElementById("emptyStudentState");
const studentsLoading = document.getElementById("studentsLoading");

const totalStudents = document.getElementById("totalStudents");
const activeStudents = document.getElementById("activeStudents");
const totalClasses = document.getElementById("totalClasses");
const newStudents = document.getElementById("newStudents");
const studentCount = document.getElementById("studentCount");

const studentModal = document.getElementById("studentModal");
const viewStudentModal = document.getElementById("viewStudentModal");
const addStudentBtn = document.getElementById("addStudentBtn");
const emptyAddStudentBtn = document.getElementById("emptyAddStudentBtn");
const closeStudentModal = document.getElementById("closeStudentModal");
const cancelStudentBtn = document.getElementById("cancelStudentBtn");
const closeViewStudentModal = document.getElementById("closeViewStudentModal");
const closeViewStudentBtn = document.getElementById("closeViewStudentBtn");
const studentForm = document.getElementById("studentForm");
const studentModalTitle = document.getElementById("studentModalTitle");

const studentRecordId = document.getElementById("studentRecordId");
const studentFirstName = document.getElementById("studentFirstName");
const studentLastName = document.getElementById("studentLastName");
const studentId = document.getElementById("studentId");
const studentEmail = document.getElementById("studentEmail");
const studentPhone = document.getElementById("studentPhone");
const studentClass = document.getElementById("studentClass");
const studentGender = document.getElementById("studentGender");
const studentStatus = document.getElementById("studentStatus");

// ================= INITIALIZE =================

document.addEventListener("DOMContentLoaded", () => {
    setupMobileMenu();
    setupLogout();
    populateClassFilter();
    updateStatistics();
    renderStudents();
    setupEvents();

    // Keep the loading animation visible briefly so the page feels consistent
    // with the Teachers Management page while the real database is connected later.
    setTimeout(() => {
        if (studentsLoading) studentsLoading.style.display = "none";
        if (studentsTable) studentsTable.style.display = "table";
    }, 450);
});

// ================= MOBILE SIDEBAR =================

function setupMobileMenu() {
    if (!menuBtn || !sidebar) return;

    menuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    document.querySelectorAll(".sidebar .nav-link").forEach(link => {
        link.addEventListener("click", () => {
            sidebar.classList.remove("open");
        });
    });
}

// ================= LOGOUT =================

function setupLogout() {
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", event => {
        event.preventDefault();

        const confirmLogout = confirm("Are you sure you want to logout?");

        if (confirmLogout) {
            // Connect this to your authentication logout function later.
            window.location.href = "index.html";
        }
    });
}

// ================= EVENTS =================

function setupEvents() {
    studentSearch?.addEventListener("input", applyFilters);
    classFilter?.addEventListener("change", applyFilters);
    statusFilter?.addEventListener("change", applyFilters);

    clearFiltersBtn?.addEventListener("click", () => {
        if (studentSearch) studentSearch.value = "";
        if (classFilter) classFilter.value = "";
        if (statusFilter) statusFilter.value = "";
        applyFilters();
    });

    addStudentBtn?.addEventListener("click", () => openStudentModal());
    emptyAddStudentBtn?.addEventListener("click", () => openStudentModal());

    closeStudentModal?.addEventListener("click", closeStudentFormModal);
    cancelStudentBtn?.addEventListener("click", closeStudentFormModal);

    closeViewStudentModal?.addEventListener("click", closeStudentViewModal);
    closeViewStudentBtn?.addEventListener("click", closeStudentViewModal);

    studentModal?.addEventListener("click", event => {
        if (event.target === studentModal) closeStudentFormModal();
    });

    viewStudentModal?.addEventListener("click", event => {
        if (event.target === viewStudentModal) closeStudentViewModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeStudentFormModal();
            closeStudentViewModal();
        }
    });

    studentForm?.addEventListener("submit", saveStudent);
}

// ================= CLASS FILTER =================

function populateClassFilter() {
    if (!classFilter) return;

    const classes = [...new Set(students.map(student => student.studentClass))]
        .sort((a, b) => a.localeCompare(b));

    classes.forEach(className => {
        const option = document.createElement("option");
        option.value = className;
        option.textContent = className;
        classFilter.appendChild(option);
    });
}

// ================= STATISTICS =================

function updateStatistics() {
    const active = students.filter(student => student.status === "active").length;
    const classes = new Set(students.map(student => student.studentClass)).size;
    const newlyAdded = students.filter(student => student.newStudent).length;

    if (totalStudents) totalStudents.textContent = students.length;
    if (activeStudents) activeStudents.textContent = active;
    if (totalClasses) totalClasses.textContent = classes;
    if (newStudents) newStudents.textContent = newlyAdded;
    if (studentCount) studentCount.textContent = filteredStudents.length;
}

// ================= FILTERING =================

function applyFilters() {
    const searchValue = (studentSearch?.value || "").trim().toLowerCase();
    const selectedClass = classFilter?.value || "";
    const selectedStatus = statusFilter?.value || "";

    filteredStudents = students.filter(student => {
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();

        const matchesSearch = !searchValue ||
            fullName.includes(searchValue) ||
            student.id.toLowerCase().includes(searchValue) ||
            student.email.toLowerCase().includes(searchValue) ||
            student.phone.toLowerCase().includes(searchValue);

        const matchesClass = !selectedClass || student.studentClass === selectedClass;
        const matchesStatus = !selectedStatus || student.status === selectedStatus;

        return matchesSearch && matchesClass && matchesStatus;
    });

    renderStudents();
    updateStatistics();
}

// ================= TABLE RENDER =================

function renderStudents() {
    if (!studentsTableBody) return;

    studentsTableBody.innerHTML = "";

    if (filteredStudents.length === 0) {
        if (studentsTable) studentsTable.style.display = "none";
        if (emptyStudentState) emptyStudentState.style.display = "block";
        if (studentCount) studentCount.textContent = "0";
        return;
    }

    if (studentsTable) studentsTable.style.display = "table";
    if (emptyStudentState) emptyStudentState.style.display = "none";

    filteredStudents.forEach(student => {
        const row = document.createElement("tr");
        const initials = getInitials(student.firstName, student.lastName);
        const fullName = `${student.firstName} ${student.lastName}`;
        const statusText = capitalize(student.status);

        row.innerHTML = `
            <td>
                <div class="table-person">
                    <div class="avatar">${initials}</div>
                    <div>
                        <strong>${escapeHtml(fullName)}</strong>
                        <small>${escapeHtml(student.email || "No email")}</small>
                    </div>
                </div>
            </td>

            <td>${escapeHtml(student.id)}</td>
            <td>${escapeHtml(student.studentClass)}</td>
            <td>${escapeHtml(student.gender)}</td>
            <td>${escapeHtml(student.phone || "—")}</td>

            <td>
                <span class="status-badge ${student.status === "active" ? "active-status" : "inactive-status"}">
                    ${statusText}
                </span>
            </td>

            <td class="action-column">
                <div class="table-actions">
                    <button class="btn btn-light action-btn" data-action="view" data-id="${student.id}">View</button>
                    <button class="btn btn-primary action-btn" data-action="edit" data-id="${student.id}">Edit</button>
                    <button class="btn btn-light action-btn delete-action" data-action="delete" data-id="${student.id}">Delete</button>
                </div>
            </td>
        `;

        studentsTableBody.appendChild(row);
    });

    studentsTableBody.querySelectorAll("button[data-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === "view") viewStudent(id);
            if (action === "edit") openStudentModal(id);
            if (action === "delete") deleteStudent(id);
        });
    });
}

// ================= ADD / EDIT =================

function openStudentModal(id = null) {
    if (!studentModal || !studentForm) return;

    studentForm.reset();

    if (id) {
        const student = students.find(item => item.id === id);
        if (!student) return;

        if (studentModalTitle) studentModalTitle.textContent = "Edit Student";
        if (studentRecordId) studentRecordId.value = student.id;
        if (studentFirstName) studentFirstName.value = student.firstName;
        if (studentLastName) studentLastName.value = student.lastName;
        if (studentId) studentId.value = student.id;
        if (studentEmail) studentEmail.value = student.email;
        if (studentPhone) studentPhone.value = student.phone;
        if (studentClass) studentClass.value = student.studentClass;
        if (studentGender) studentGender.value = student.gender;
        if (studentStatus) studentStatus.value = student.status;
    } else {
        if (studentModalTitle) studentModalTitle.textContent = "Add New Student";
        if (studentStatus) studentStatus.value = "active";
        if (studentGender) studentGender.value = "Male";
        if (studentId) studentId.value = generateStudentId();
    }

    studentModal.classList.add("show");
    document.body.classList.add("modal-open");
}

function closeStudentFormModal() {
    studentModal?.classList.remove("show");
    document.body.classList.remove("modal-open");
}

function saveStudent(event) {
    event.preventDefault();

    const firstName = studentFirstName?.value.trim();
    const lastName = studentLastName?.value.trim();
    const id = studentId?.value.trim() || generateStudentId();

    if (!firstName || !lastName || !studentClass?.value) {
        alert("Please fill in the required student information.");
        return;
    }

    const existingId = studentRecordId?.value;

    if (existingId) {
        const index = students.findIndex(student => student.id === existingId);

        if (index !== -1) {
            students[index] = {
                ...students[index],
                id,
                firstName,
                lastName,
                email: studentEmail?.value.trim() || "",
                phone: studentPhone?.value.trim() || "",
                studentClass: studentClass.value,
                gender: studentGender?.value || "Male",
                status: studentStatus?.value || "active"
            };
        }
    } else {
        students.push({
            id,
            firstName,
            lastName,
            email: studentEmail?.value.trim() || "",
            phone: studentPhone?.value.trim() || "",
            studentClass: studentClass.value,
            gender: studentGender?.value || "Male",
            status: studentStatus?.value || "active",
            newStudent: true
        });
    }

    filteredStudents = [...students];
    populateClassFilterAfterSave();
    applyFilters();
    closeStudentFormModal();

    alert(existingId ? "Student updated successfully." : "Student added successfully.");
}

function populateClassFilterAfterSave() {
    if (!classFilter) return;

    const currentValue = classFilter.value;
    const classes = [...new Set(students.map(student => student.studentClass))]
        .sort((a, b) => a.localeCompare(b));

    classFilter.innerHTML = '<option value="">All Classes</option>';

    classes.forEach(className => {
        const option = document.createElement("option");
        option.value = className;
        option.textContent = className;
        classFilter.appendChild(option);
    });

    classFilter.value = classes.includes(currentValue) ? currentValue : "";
}

// ================= VIEW =================

function viewStudent(id) {
    const student = students.find(item => item.id === id);
    if (!student || !viewStudentModal) return;

    const fullName = `${student.firstName} ${student.lastName}`;
    const statusElement = document.getElementById("viewStudentStatus");

    document.getElementById("viewStudentAvatar").textContent = getInitials(student.firstName, student.lastName);
    document.getElementById("viewStudentName").textContent = fullName;
    document.getElementById("viewStudentId").textContent = student.id;
    document.getElementById("viewStudentClass").textContent = student.studentClass;
    document.getElementById("viewStudentGender").textContent = student.gender;
    document.getElementById("viewStudentEmail").textContent = student.email || "—";
    document.getElementById("viewStudentPhone").textContent = student.phone || "—";

    if (statusElement) {
        statusElement.textContent = capitalize(student.status);
        statusElement.className = `status-badge ${student.status === "active" ? "active-status" : "inactive-status"}`;
    }

    viewStudentModal.classList.add("show");
    document.body.classList.add("modal-open");
}

function closeStudentViewModal() {
    viewStudentModal?.classList.remove("show");
    document.body.classList.remove("modal-open");
}

// ================= DELETE =================

function deleteStudent(id) {
    const student = students.find(item => item.id === id);
    if (!student) return;

    const confirmed = confirm(`Delete ${student.firstName} ${student.lastName}'s student record?`);

    if (!confirmed) return;

    const index = students.findIndex(item => item.id === id);
    if (index !== -1) students.splice(index, 1);

    applyFilters();
    populateClassFilterAfterSave();
}

// ================= HELPERS =================

function generateStudentId() {
    const numbers = students
        .map(student => parseInt(student.id.replace(/\D/g, ""), 10))
        .filter(number => !Number.isNaN(number));

    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    return `PACSA-${String(nextNumber).padStart(3, "0")}`;
}

function getInitials(firstName, lastName) {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
}

function capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
