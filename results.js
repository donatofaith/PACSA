```javascript
let results = [
    {id:1, student:"John Peter", class:"SS2A", subject:"Mathematics", score:85, term:"First Term", status:"published"},
    {id:2, student:"Mary James", class:"SS1B", subject:"English", score:72, term:"First Term", status:"published"},
    {id:3, student:"David Paul", class:"SS3A", subject:"Physics", score:61, term:"First Term", status:"pending"},
    {id:4, student:"Sarah Faith", class:"SS2A", subject:"Biology", score:78, term:"First Term", status:"published"}
];

const table = document.getElementById("resultsTableBody");
const search = document.getElementById("resultSearch");
const termFilter = document.getElementById("termFilter");
const statusFilter = document.getElementById("statusFilter");
const modal = document.getElementById("resultModal");

function grade(score) {
    if (score >= 75) return "A";
    if (score >= 65) return "B";
    if (score >= 55) return "C";
    if (score >= 45) return "D";
    if (score >= 40) return "E";
    return "F";
}

function renderResults() {

    const text = search.value.toLowerCase();

    const data = results.filter(r =>
        `${r.student} ${r.subject} ${r.class}`.toLowerCase().includes(text) &&
        (!termFilter.value || r.term === termFilter.value) &&
        (!statusFilter.value || r.status === statusFilter.value)
    );

    table.innerHTML = data.map(r => `
        <tr>
            <td><strong>${r.student}</strong></td>
            <td>${r.class}</td>
            <td>${r.subject}</td>
            <td>${r.score}</td>
            <td><strong>${grade(r.score)}</strong></td>
            <td>${r.term}</td>
            <td>
                <span class="status-badge ${r.status}">
                    ${r.status}
                </span>
            </td>
            <td class="action-column">
                <button class="btn btn-light" onclick="editResult(${r.id})">
                    Edit
                </button>
            </td>
        </tr>
    `).join("");

    document.getElementById("emptyResultState").style.display =
        data.length ? "none" : "block";

    document.getElementById("totalResults").textContent = results.length;

    document.getElementById("publishedResults").textContent =
        results.filter(r => r.status === "published").length;

    document.getElementById("pendingResults").textContent =
        results.filter(r => r.status === "pending").length;

    document.getElementById("studentCount").textContent =
        new Set(results.map(r => r.student)).size;

    document.getElementById("resultCount").textContent = results.length;
}

function openResultModal(id = null) {

    modal.classList.add("show");
    document.getElementById("resultForm").reset();
    document.getElementById("resultRecordId").value = "";

    document.getElementById("resultModalTitle").textContent =
        id ? "Edit Result" : "Enter Result";

    if (id) {

        const r = results.find(x => x.id === id);

        document.getElementById("resultRecordId").value = r.id;
        document.getElementById("studentName").value = r.student;
        document.getElementById("studentClass").value = r.class;
        document.getElementById("subjectName").value = r.subject;
        document.getElementById("score").value = r.score;
        document.getElementById("term").value = r.term;
        document.getElementById("resultStatus").value = r.status;
    }
}

function closeResultModal() {
    modal.classList.remove("show");
}

function editResult(id) {
    openResultModal(id);
}

document.getElementById("resultForm").addEventListener("submit", e => {

    e.preventDefault();

    const id = document.getElementById("resultRecordId").value;

    const data = {
        student: document.getElementById("studentName").value,
        class: document.getElementById("studentClass").value,
        subject: document.getElementById("subjectName").value,
        score: Number(document.getElementById("score").value),
        term: document.getElementById("term").value,
        status: document.getElementById("resultStatus").value
    };

    if (id) {
        Object.assign(results.find(r => r.id == id), data);
    } else {
        results.push({id: Date.now(), ...data});
    }

    closeResultModal();
    renderResults();
});

document.getElementById("addResultBtn")
    .addEventListener("click", () => openResultModal());

document.getElementById("emptyAddResultBtn")
    .addEventListener("click", () => openResultModal());

document.getElementById("closeResultModal")
    .addEventListener("click", closeResultModal);

document.getElementById("cancelResultBtn")
    .addEventListener("click", closeResultModal);

search.addEventListener("input", renderResults);
termFilter.addEventListener("change", renderResults);
statusFilter.addEventListener("change", renderResults);

document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    search.value = "";
    termFilter.value = "";
    statusFilter.value = "";
    renderResults();
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

renderResults();
```
