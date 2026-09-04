/* =========================================
PACSA CLASSES
========================================= */

document.addEventListener("DOMContentLoaded", () => {

```
const classes = [
    {
        id: 1,
        name: "JSS1A",
        level: "JSS",
        arm: "A",
        students: 32,
        teacher: "Mr. Ade",
        status: "Active"
    },
    {
        id: 2,
        name: "JSS1B",
        level: "JSS",
        arm: "B",
        students: 29,
        teacher: "Mrs. James",
        status: "Active"
    },
    {
        id: 3,
        name: "JSS2A",
        level: "JSS",
        arm: "A",
        students: 35,
        teacher: "Mr. Okafor",
        status: "Active"
    },
    {
        id: 4,
        name: "JSS2B",
        level: "JSS",
        arm: "B",
        students: 31,
        teacher: "Mrs. Williams",
        status: "Active"
    },
    {
        id: 5,
        name: "SS1A",
        level: "SSS",
        arm: "A",
        students: 34,
        teacher: "Mr. Johnson",
        status: "Active"
    },
    {
        id: 6,
        name: "SS1B",
        level: "SSS",
        arm: "B",
        students: 30,
        teacher: "Mrs. David",
        status: "Active"
    },
    {
        id: 7,
        name: "SS2A",
        level: "SSS",
        arm: "A",
        students: 35,
        teacher: "Mr. Paul",
        status: "Active"
    },
    {
        id: 8,
        name: "SS2B",
        level: "SSS",
        arm: "B",
        students: 28,
        teacher: "Not Assigned",
        status: "Inactive"
    }
];


const tableBody =
    document.getElementById("classesTableBody");

const searchInput =
    document.getElementById("classSearch");

const levelFilter =
    document.getElementById("levelFilter");

const statusFilter =
    document.getElementById("statusFilter");

const modal =
    document.getElementById("classModal");

const form =
    document.getElementById("classForm");


/* =========================================
   RENDER CLASSES
========================================= */

function renderClasses() {

    const search =
        searchInput.value.toLowerCase().trim();

    const level =
        levelFilter.value;

    const status =
        statusFilter.value;


    const filtered = classes.filter(item => {

        const matchesSearch =
            item.name.toLowerCase().includes(search) ||
            item.teacher.toLowerCase().includes(search);

        const matchesLevel =
            level === "all" ||
            item.level === level;

        const matchesStatus =
            status === "all" ||
            item.status === status;

        return (
            matchesSearch &&
            matchesLevel &&
            matchesStatus
        );

    });


    tableBody.innerHTML = "";


    if (filtered.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No classes found.
                </td>
            </tr>
        `;

        return;
    }


    filtered.forEach(item => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>
                <span class="class-name">
                    ${item.name}
                </span>
            </td>

            <td>
                <span class="class-level">
                    ${item.level}
                </span>
            </td>

            <td>
                <span class="student-count">
                    ${item.students}
                </span>
            </td>

            <td>
                <span class="teacher-name">
                    ${item.teacher}
                </span>
            </td>

            <td>

                <span class="status-badge ${
                    item.status === "Active"
                        ? "active-status"
                        : "pending"
                }">
                    ${item.status}
                </span>

            </td>

            <td>

                <div class="action-buttons">

                    <button
                        class="table-action"
                        onclick="viewClass(${item.id})">
                        View
                    </button>

                    <button
                        class="table-action"
                        onclick="editClass(${item.id})">
                        Edit
                    </button>

                </div>

            </td>

        `;

        tableBody.appendChild(row);

    });

}


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStats() {

    const totalClasses =
        classes.length;

    const totalStudents =
        classes.reduce(
            (sum, item) => sum + item.students,
            0
        );

    const assignedClasses =
        classes.filter(
            item => item.teacher !== "Not Assigned"
        ).length;

    const activeClasses =
        classes.filter(
            item => item.status === "Active"
        ).length;


    document.getElementById("totalClasses")
        .textContent = totalClasses;

    document.getElementById("totalStudents")
        .textContent = totalStudents;

    document.getElementById("assignedClasses")
        .textContent = assignedClasses;

    document.getElementById("activeClasses")
        .textContent = activeClasses;

}


/* =========================================
   ADD CLASS
========================================= */

document
    .getElementById("addClassBtn")
    .addEventListener("click", () => {

        form.reset();

        document.getElementById("classId")
            .value = "";

        document.getElementById("modalTitle")
            .textContent = "Add New Class";

        document.getElementById("academicSession")
            .value = "2025/2026";

        modal.classList.add("show");

    });


/* =========================================
   CLOSE MODAL
========================================= */

function closeModal() {

    modal.classList.remove("show");

}

document
    .getElementById("closeModal")
    .addEventListener("click", closeModal);

document
    .getElementById("cancelModal")
    .addEventListener("click", closeModal);


/* =========================================
   SAVE CLASS
========================================= */

form.addEventListener("submit", event => {

    event.preventDefault();


    const id =
        document.getElementById("classId").value;

    const name =
        document.getElementById("className").value
            .trim();

    const level =
        document.getElementById("classLevel").value;

    const arm =
        document.getElementById("classArm").value
            .trim()
            .toUpperCase();

    const status =
        document.getElementById("classStatus").value;


    if (id) {

        const existing =
            classes.find(
                item => item.id === Number(id)
            );

        if (existing) {

            existing.name = name;
            existing.level = level;
            existing.arm = arm;
            existing.status = status;

        }

    } else {

        classes.push({

            id:
                Date.now(),

            name:
                name,

            level:
                level,

            arm:
                arm,

            students:
                0,

            teacher:
                "Not Assigned",

            status:
                status

        });

    }


    renderClasses();
    updateStats();
    closeModal();

});


/* =========================================
   SEARCH / FILTER
========================================= */

searchInput.addEventListener(
    "input",
    renderClasses
);

levelFilter.addEventListener(
    "change",
    renderClasses
);

statusFilter.addEventListener(
    "change",
    renderClasses
);


/* =========================================
   VIEW CLASS
========================================= */

window.viewClass = function(id) {

    const item =
        classes.find(
            cls => cls.id === id
        );

    if (!item) return;

    alert(
        `Class: ${item.name}\n` +
        `Level: ${item.level}\n` +
        `Students: ${item.students}\n` +
        `Class Teacher: ${item.teacher}\n` +
        `Status: ${item.status}`
    );

};


/* =========================================
   EDIT CLASS
========================================= */

window.editClass = function(id) {

    const item =
        classes.find(
            cls => cls.id === id
        );

    if (!item) return;


    document.getElementById("classId")
        .value = item.id;

    document.getElementById("className")
        .value = item.name;

    document.getElementById("classLevel")
        .value = item.level;

    document.getElementById("classArm")
        .value = item.arm;

    document.getElementById("classStatus")
        .value = item.status;

    document.getElementById("modalTitle")
        .textContent = "Edit Class";

    modal.classList.add("show");

};


/* =========================================
   MOBILE SIDEBAR
========================================= */

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");


if (menuBtn && sidebar) {

    menuBtn.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle("open");
        }
    );

}


/* =========================================
   LOGOUT
========================================= */

const logoutBtn =
    document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (
                confirm(
                    "Are you sure you want to logout?"
                )
            ) {

                window.location.href =
                    "index.html";

            }

        }
    );

}


/* INITIAL LOAD */

renderClasses();
updateStats();
```

});
