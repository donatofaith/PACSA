```javascript
let sessions = [
    {
        id: 1,
        name: "2025/2026",
        start: "2025-09-08",
        end: "2026-07-31",
        term: "Third Term",
        status: "completed"
    },
    {
        id: 2,
        name: "2026/2027",
        start: "2026-09-14",
        end: "2027-07-30",
        term: "First Term",
        status: "active"
    }
];

const table = document.getElementById("sessionsTableBody");
const search = document.getElementById("sessionSearch");
const filter = document.getElementById("statusFilter");
const modal = document.getElementById("sessionModal");

function renderSessions() {

    const text = search.value.toLowerCase();

    const data = sessions.filter(s =>
        s.name.toLowerCase().includes(text) &&
        (!filter.value || s.status === filter.value)
    );

    table.innerHTML = data.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td>${s.start}</td>
            <td>${s.end}</td>
            <td>${s.term}</td>
            <td>
                <span class="status-badge ${s.status}">
                    ${s.status}
                </span>
            </td>
            <td class="action-column">
                <button class="btn btn-light" onclick="editSession(${s.id})">
                    Edit
                </button>
            </td>
        </tr>
    `).join("");

    document.getElementById("emptySessionState").style.display =
        data.length ? "none" : "block";

    document.getElementById("totalSessions").textContent = sessions.length;

    const active = sessions.find(s => s.status === "active");

    document.getElementById("activeSession").textContent =
        active ? active.name : "-";

    document.getElementById("currentTerm").textContent =
        active ? active.term : "-";

    document.getElementById("completedSessions").textContent =
        sessions.filter(s => s.status === "completed").length;

    document.getElementById("sessionCount").textContent =
        sessions.length;
}


function openSessionModal(id = null) {

    modal.classList.add("show");

    document.getElementById("sessionForm").reset();

    document.getElementById("sessionRecordId").value = "";

    document.getElementById("sessionModalTitle").textContent =
        id ? "Edit Session" : "Add New Session";

    if (id) {

        const s = sessions.find(x => x.id === id);

        document.getElementById("sessionRecordId").value = s.id;
        document.getElementById("sessionName").value = s.name;
        document.getElementById("startDate").value = s.start;
        document.getElementById("endDate").value = s.end;
        document.getElementById("sessionTerm").value = s.term;
        document.getElementById("sessionStatus").value = s.status;
    }
}


function closeSessionModal() {
    modal.classList.remove("show");
}


function editSession(id) {
    openSessionModal(id);
}


document.getElementById("sessionForm").addEventListener("submit", e => {

    e.preventDefault();

    const id = document.getElementById("sessionRecordId").value;

    const data = {
        name: document.getElementById("sessionName").value,
        start: document.getElementById("startDate").value,
        end: document.getElementById("endDate").value,
        term: document.getElementById("sessionTerm").value,
        status: document.getElementById("sessionStatus").value
    };

    if (id) {

        Object.assign(
            sessions.find(s => s.id == id),
            data
        );

    } else {

        sessions.push({
            id: Date.now(),
            ...data
        });

    }

    closeSessionModal();
    renderSessions();
});


document.getElementById("addSessionBtn")
    .addEventListener("click", () => openSessionModal());

document.getElementById("emptyAddSessionBtn")
    .addEventListener("click", () => openSessionModal());

document.getElementById("closeSessionModal")
    .addEventListener("click", closeSessionModal);

document.getElementById("cancelSessionBtn")
    .addEventListener("click", closeSessionModal);

search.addEventListener("input", renderSessions);
filter.addEventListener("change", renderSessions);


document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    search.value = "";
    filter.value = "";
    renderSessions();
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


renderSessions();
```
