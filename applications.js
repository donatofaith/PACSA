let applications = [
    {
        id: 1,
        name: "Michael Johnson",
        gender: "Male",
        class: "SS1",
        guardian: "Mr. Johnson",
        date: "2026-08-20",
        status: "pending"
    },
    {
        id: 2,
        name: "Grace Williams",
        gender: "Female",
        class: "SS1",
        guardian: "Mrs. Williams",
        date: "2026-08-22",
        status: "approved"
    },
    {
        id: 3,
        name: "Daniel Peter",
        gender: "Male",
        class: "SS2",
        guardian: "Mr. Peter",
        date: "2026-08-25",
        status: "pending"
    },
    {
        id: 4,
        name: "Esther James",
        gender: "Female",
        class: "SS1",
        guardian: "Mrs. James",
        date: "2026-08-27",
        status: "rejected"
    }
];

const table = document.getElementById("applicationsTableBody");
const search = document.getElementById("applicationSearch");
const classFilter = document.getElementById("classFilter");
const statusFilter = document.getElementById("statusFilter");

function renderApplications() {

    const text = search.value.toLowerCase();

    const filtered = applications.filter(app => {

        const matchesSearch =
            `${app.name} ${app.guardian} ${app.class}`
                .toLowerCase()
                .includes(text);

        const matchesClass =
            !classFilter.value ||
            app.class === classFilter.value;

        const matchesStatus =
            !statusFilter.value ||
            app.status === statusFilter.value;

        return matchesSearch && matchesClass && matchesStatus;
    });

    table.innerHTML = filtered.map(app => `
        <tr>

            <td>
                <strong>${app.name}</strong>
            </td>

            <td>${app.gender}</td>

            <td>${app.class}</td>

            <td>${app.guardian}</td>

            <td>${app.date}</td>

            <td>
                <span class="status-badge ${app.status}">
                    ${app.status}
                </span>
            </td>

            <td>
                <button
                    class="btn btn-light"
                    onclick="viewApplication(${app.id})">
                    View
                </button>
            </td>

        </tr>
    `).join("");

    document.getElementById("emptyApplicationState").style.display =
        filtered.length ? "none" : "block";

    document.getElementById("applicationCount").textContent =
        filtered.length;

    document.getElementById("totalApplications").textContent =
        applications.length;

    document.getElementById("pendingApplications").textContent =
        applications.filter(a => a.status === "pending").length;

    document.getElementById("approvedApplications").textContent =
        applications.filter(a => a.status === "approved").length;

    document.getElementById("rejectedApplications").textContent =
        applications.filter(a => a.status === "rejected").length;
}

function viewApplication(id) {

    const app = applications.find(a => a.id === id);

    alert(
        `Applicant: ${app.name}\n` +
        `Gender: ${app.gender}\n` +
        `Class: ${app.class}\n` +
        `Parent/Guardian: ${app.guardian}\n` +
        `Date: ${app.date}\n` +
        `Status: ${app.status}`
    );
}

search.addEventListener("input", renderApplications);
classFilter.addEventListener("change", renderApplications);
statusFilter.addEventListener("change", renderApplications);

document.getElementById("clearFiltersBtn").addEventListener("click", () => {

    search.value = "";
    classFilter.value = "";
    statusFilter.value = "";

    renderApplications();
});

document.getElementById("menuBtn").addEventListener("click", () => {

    document.getElementById("sidebar").classList.toggle("open");

});

document.getElementById("logoutBtn").addEventListener("click", e => {

    e.preventDefault();

    if (confirm("Are you sure you want to logout?")) {
        window.location.href = "login.html";
    }

});

renderApplications();