/* =========================================
   PACSA TEACHERS MANAGEMENT
========================================= */


/* =========================================
   MOBILE SIDEBAR
========================================= */

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");


if (menuBtn && sidebar) {

    menuBtn.addEventListener("click", () => {

        sidebar.classList.toggle("active");

    });

}


/* =========================================
   LOGOUT
========================================= */

const logoutBtn =
    document.getElementById("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener("click", (event) => {

        event.preventDefault();


        const confirmLogout =
            confirm("Are you sure you want to logout?");


        if (confirmLogout) {

            /*
            FUTURE:

            await supabase.auth.signOut();

            window.location.href = "login.html";
            */


            alert(
                "Supabase logout will be connected here."
            );

        }

    });

}


/* =========================================
   DOM ELEMENTS
========================================= */

const teachersTableBody =
    document.getElementById(
        "teachersTableBody"
    );

const teachersLoading =
    document.getElementById(
        "teachersLoading"
    );

const emptyTeacherState =
    document.getElementById(
        "emptyTeacherState"
    );

const teacherSearch =
    document.getElementById(
        "teacherSearch"
    );

const departmentFilter =
    document.getElementById(
        "departmentFilter"
    );

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

const clearFiltersBtn =
    document.getElementById(
        "clearFiltersBtn"
    );


/* =========================================
   MODALS
========================================= */

const teacherModal =
    document.getElementById(
        "teacherModal"
    );

const viewTeacherModal =
    document.getElementById(
        "viewTeacherModal"
    );

const addTeacherBtn =
    document.getElementById(
        "addTeacherBtn"
    );

const emptyAddTeacherBtn =
    document.getElementById(
        "emptyAddTeacherBtn"
    );

const closeTeacherModal =
    document.getElementById(
        "closeTeacherModal"
    );

const closeViewTeacherModal =
    document.getElementById(
        "closeViewTeacherModal"
    );

const cancelTeacherBtn =
    document.getElementById(
        "cancelTeacherBtn"
    );


/* =========================================
   FORM
========================================= */

const teacherForm =
    document.getElementById(
        "teacherForm"
    );

const teacherModalTitle =
    document.getElementById(
        "teacherModalTitle"
    );


/* =========================================
   TEACHER DATA
   TEMPORARY DATA ONLY

   THIS WILL BE REPLACED
   WITH SUPABASE DATA
========================================= */

let teachers = [

    {
        id: "1",

        teacher_id: "PAC-T001",

        first_name: "Adewale",

        last_name: "Johnson",

        email:
            "adewale@pacsa.edu.ng",

        phone:
            "08012345678",

        department:
            "Science",

        subject:
            "Mathematics",

        status:
            "active"
    },


    {
        id: "2",

        teacher_id: "PAC-T002",

        first_name: "Grace",

        last_name: "Williams",

        email:
            "grace@pacsa.edu.ng",

        phone:
            "08087654321",

        department:
            "Languages",

        subject:
            "English Language",

        status:
            "active"
    },


    {
        id: "3",

        teacher_id: "PAC-T003",

        first_name: "Samuel",

        last_name: "Okafor",

        email:
            "samuel@pacsa.edu.ng",

        phone:
            "08056781234",

        department:
            "Science",

        subject:
            "Physics",

        status:
            "active"
    },


    {
        id: "4",

        teacher_id: "PAC-T004",

        first_name: "Blessing",

        last_name: "Adeyemi",

        email:
            "blessing@pacsa.edu.ng",

        phone:
            "08099887766",

        department:
            "Arts",

        subject:
            "Government",

        status:
            "inactive"
    }

];


/* =========================================
   INITIALIZE PAGE
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadTeachers();

        populateDepartments();

        updateStatistics();

    }
);


/* =========================================
   LOAD TEACHERS
========================================= */

function loadTeachers() {

    showLoading(true);


    setTimeout(() => {

        renderTeachers(teachers);

        showLoading(false);

    }, 300);

}


/* =========================================
   RENDER TEACHERS
========================================= */

function renderTeachers(teacherList) {


    teachersTableBody.innerHTML = "";


    if (teacherList.length === 0) {

        emptyTeacherState.style.display =
            "block";


        document.querySelector(
            ".table-wrapper"
        ).style.display =
            "none";


        return;

    }


    emptyTeacherState.style.display =
        "none";


    document.querySelector(
        ".table-wrapper"
    ).style.display =
        "block";


    teacherList.forEach(teacher => {


        const fullName =
            `${teacher.first_name} ${teacher.last_name}`;


        const initials =
            getInitials(fullName);


        const statusClass =
            teacher.status === "active"
                ? "active-status"
                : "pending";


        const statusText =
            teacher.status === "active"
                ? "Active"
                : "Inactive";


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>

                <div class="teacher-cell">

                    <div class="teacher-table-avatar">

                        ${initials}

                    </div>


                    <div class="teacher-name-info">

                        <strong>

                            ${fullName}

                        </strong>


                        <span>

                            ${teacher.email || "-"}

                        </span>

                    </div>

                </div>

            </td>


            <td>

                ${teacher.teacher_id || "-"}

            </td>


            <td>

                ${teacher.department || "-"}

            </td>


            <td>

                ${teacher.subject || "-"}

            </td>


            <td>

                ${teacher.phone || "-"}

            </td>


            <td>

                <span class="status-badge ${statusClass}">

                    ${statusText}

                </span>

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

        `;


        teachersTableBody.appendChild(row);

    });


    updateTeacherCount(teacherList.length);

}


/* =========================================
   GET INITIALS
========================================= */

function getInitials(name) {

    return name

        .split(" ")

        .map(word => word.charAt(0))

        .join("")

        .substring(0, 2)

        .toUpperCase();

}


/* =========================================
   LOADING STATE
========================================= */

function showLoading(show) {

    teachersLoading.style.display =
        show ? "block" : "none";


    document.querySelector(
        ".table-wrapper"
    ).style.display =
        show ? "none" : "block";

}


/* =========================================
   POPULATE DEPARTMENTS
========================================= */

function populateDepartments() {


    const departments =
        [...new Set(

            teachers.map(
                teacher =>
                    teacher.department
            )

        )];


    departmentFilter.innerHTML =
        `<option value="">All Departments</option>`;


    departments.forEach(department => {

        if (department) {

            const option =
                document.createElement("option");


            option.value =
                department;


            option.textContent =
                department;


            departmentFilter.appendChild(
                option
            );

        }

    });

}


/* =========================================
   SEARCH & FILTER
========================================= */

function filterTeachers() {


    const searchValue =
        teacherSearch.value
            .toLowerCase()
            .trim();


    const departmentValue =
        departmentFilter.value;


    const statusValue =
        statusFilter.value;


    const filteredTeachers =
        teachers.filter(teacher => {


            const fullName =
                `${teacher.first_name} ${teacher.last_name}`
                    .toLowerCase();


            const matchesSearch =

                fullName.includes(
                    searchValue
                )

                ||

                (teacher.teacher_id || "")
                    .toLowerCase()
                    .includes(searchValue)

                ||

                (teacher.email || "")
                    .toLowerCase()
                    .includes(searchValue);


            const matchesDepartment =

                !departmentValue

                ||

                teacher.department ===
                    departmentValue;


            const matchesStatus =

                !statusValue

                ||

                teacher.status ===
                    statusValue;


            return

                matchesSearch

                &&

                matchesDepartment

                &&

                matchesStatus;

        });


    renderTeachers(filteredTeachers);

}


/* SEARCH EVENTS */

teacherSearch.addEventListener(
    "input",
    filterTeachers
);


departmentFilter.addEventListener(
    "change",
    filterTeachers
);


statusFilter.addEventListener(
    "change",
    filterTeachers
);


/* =========================================
   CLEAR FILTERS
========================================= */

clearFiltersBtn.addEventListener(
    "click",
    () => {

        teacherSearch.value = "";

        departmentFilter.value = "";

        statusFilter.value = "";


        renderTeachers(teachers);

    }
);


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStatistics() {


    const total =
        teachers.length;


    const active =
        teachers.filter(
            teacher =>
                teacher.status === "active"
        ).length;


    const departments =
        new Set(
            teachers
                .map(
                    teacher =>
                        teacher.department
                )
                .filter(Boolean)
        ).size;


    document.getElementById(
        "totalTeachers"
    ).textContent =
        total;


    document.getElementById(
        "activeTeachers"
    ).textContent =
        active;


    document.getElementById(
        "totalDepartments"
    ).textContent =
        departments;


    /*
    CLASS TEACHERS WILL BE
    CALCULATED FROM SUPABASE
    LATER
    */


    document.getElementById(
        "classTeachers"
    ).textContent =
        "0";


    document.getElementById(
        "teacherCount"
    ).textContent =
        total;

}


/* =========================================
   OPEN ADD TEACHER MODAL
========================================= */

function openAddTeacherModal() {


    teacherForm.reset();


    document.getElementById(
        "teacherRecordId"
    ).value =
        "";


    teacherModalTitle.textContent =
        "Add New Teacher";


    teacherModal.classList.add(
        "active"
    );

}


addTeacherBtn.addEventListener(
    "click",
    openAddTeacherModal
);


emptyAddTeacherBtn.addEventListener(
    "click",
    openAddTeacherModal
);


/* =========================================
   CLOSE MODALS
========================================= */

function closeTeacherFormModal() {

    teacherModal.classList.remove(
        "active"
    );

}


function closeTeacherViewModal() {

    viewTeacherModal.classList.remove(
        "active"
    );

}


closeTeacherModal.addEventListener(
    "click",
    closeTeacherFormModal
);


cancelTeacherBtn.addEventListener(
    "click",
    closeTeacherFormModal
);


closeViewTeacherModal.addEventListener(
    "click",
    closeTeacherViewModal
);


/* =========================================
   CLOSE MODAL OUTSIDE CLICK
========================================= */

window.addEventListener(
    "click",
    event => {

        if (
            event.target === teacherModal
        ) {

            closeTeacherFormModal();

        }


        if (
            event.target === viewTeacherModal
        ) {

            closeTeacherViewModal();

        }

    }
);


/* =========================================
   SAVE TEACHER
========================================= */

teacherForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        const recordId =
            document.getElementById(
                "teacherRecordId"
            ).value;


        const teacherData = {

            id:
                recordId
                ||
                Date.now().toString(),


            teacher_id:
                document.getElementById(
                    "teacherId"
                ).value,


            first_name:
                document.getElementById(
                    "teacherFirstName"
                ).value,


            last_name:
                document.getElementById(
                    "teacherLastName"
                ).value,


            email:
                document.getElementById(
                    "teacherEmail"
                ).value,


            phone:
                document.getElementById(
                    "teacherPhone"
                ).value,


            department:
                document.getElementById(
                    "teacherDepartment"
                ).value,


            subject:
                document.getElementById(
                    "teacherSubject"
                ).value,


            status:
                document.getElementById(
                    "teacherStatus"
                ).value

        };


        if (recordId) {


            const index =
                teachers.findIndex(
                    teacher =>
                        teacher.id === recordId
                );


            teachers[index] =
                teacherData;


            alert(
                "Teacher updated successfully."
            );


        } else {


            teachers.push(
                teacherData
            );


            alert(
                "Teacher added successfully."
            );

        }


        renderTeachers(teachers);

        populateDepartments();

        updateStatistics();

        closeTeacherFormModal();


        /*
        ==================================

        FUTURE SUPABASE INSERT / UPDATE

        ADD:

        await supabase
        .from("teachers")
        .insert([teacherData])


        UPDATE:

        await supabase
        .from("teachers")
        .update(teacherData)
        .eq("id", recordId)

        ==================================
        */

    }
);


/* =========================================
   VIEW TEACHER
========================================= */

function viewTeacher(id) {


    const teacher =
        teachers.find(
            teacher =>
                teacher.id === id
        );


    if (!teacher) return;


    const fullName =
        `${teacher.first_name} ${teacher.last_name}`;


    document.getElementById(
        "viewTeacherAvatar"
    ).textContent =
        getInitials(fullName);


    document.getElementById(
        "viewTeacherName"
    ).textContent =
        fullName;


    document.getElementById(
        "viewTeacherDepartment"
    ).textContent =
        teacher.department || "-";


    document.getElementById(
        "viewTeacherId"
    ).textContent =
        teacher.teacher_id || "-";


    document.getElementById(
        "viewTeacherEmail"
    ).textContent =
        teacher.email || "-";


    document.getElementById(
        "viewTeacherPhone"
    ).textContent =
        teacher.phone || "-";


    document.getElementById(
        "viewTeacherSubject"
    ).textContent =
        teacher.subject || "-";


    document.getElementById(
        "viewTeacherStatus"
    ).textContent =
        teacher.status || "-";


    viewTeacherModal.classList.add(
        "active"
    );

}


/* =========================================
   EDIT TEACHER
========================================= */

function editTeacher(id) {


    const teacher =
        teachers.find(
            teacher =>
                teacher.id === id
        );


    if (!teacher) return;


    document.getElementById(
        "teacherRecordId"
    ).value =
        teacher.id;


    document.getElementById(
        "teacherId"
    ).value =
        teacher.teacher_id || "";


    document.getElementById(
        "teacherFirstName"
    ).value =
        teacher.first_name || "";


    document.getElementById(
        "teacherLastName"
    ).value =
        teacher.last_name || "";


    document.getElementById(
        "teacherEmail"
    ).value =
        teacher.email || "";


    document.getElementById(
        "teacherPhone"
    ).value =
        teacher.phone || "";


    document.getElementById(
        "teacherDepartment"
    ).value =
        teacher.department || "";


    document.getElementById(
        "teacherSubject"
    ).value =
        teacher.subject || "";


    document.getElementById(
        "teacherStatus"
    ).value =
        teacher.status || "active";


    teacherModalTitle.textContent =
        "Edit Teacher";


    teacherModal.classList.add(
        "active"
    );

}


/* =========================================
   DELETE TEACHER
========================================= */

function deleteTeacher(id) {


    const teacher =
        teachers.find(
            teacher =>
                teacher.id === id
        );


    if (!teacher) return;


    const fullName =
        `${teacher.first_name} ${teacher.last_name}`;


    const confirmDelete =
        confirm(

            `Are you sure you want to remove ${fullName}?`

        );


    if (!confirmDelete) return;


    teachers =
        teachers.filter(
            teacher =>
                teacher.id !== id
        );


    renderTeachers(teachers);

    populateDepartments();

    updateStatistics();


    alert(
        "Teacher removed successfully."
    );


    /*
    FUTURE SUPABASE:

    await supabase
    .from("teachers")
    .delete()
    .eq("id", id)
    */

}


/* =========================================
   NOTIFICATION
========================================= */

const notificationBtn =
    document.querySelector(
        ".notification-btn"
    );


if (notificationBtn) {

    notificationBtn.addEventListener(
        "click",
        () => {

            alert(
                "You have new system notifications."
            );

        }
    );

}


console.log(
    "PACSA Teachers Management Loaded"
);