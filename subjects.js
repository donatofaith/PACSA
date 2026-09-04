```javascript
let subjects = [
    { id: 1, name: "Mathematics", code: "MTH", category: "Core", classes: 6, status: "active" },
    { id: 2, name: "English Language", code: "ENG", category: "Core", classes: 6, status: "active" },
    { id: 3, name: "Biology", code: "BIO", category: "Science", classes: 3, status: "active" },
    { id: 4, name: "Physics", code: "PHY", category: "Science", classes: 3, status: "active" },
    { id: 5, name: "Economics", code: "ECO", category: "Commercial", classes: 2, status: "active" }
];

const table = document.getElementById("subjectsTableBody");
const search = document.getElementById("subjectSearch");
const category = document.getElementById("categoryFilter");
const status = document.getElementById("statusFilter");
const modal = document.getElementById("subjectModal");

function renderSubjects() {

    const text = search.value.toLowerCase();

    const filtered = subjects.filter(subject =>
        (subject.name.toLowerCase().includes(text) ||
         subject.code.toLowerCase().includes(text)) &&
        (!category.value || subject.category === category.value) &&
        (!status.value || subject.status === status.value)
    );

    table.innerHTML = filtered.map(subject => `
        <tr>
            <td>
                <strong>${subject.name}</strong>
            </td>

            <td>${subject.code}</td>

            <td>${subject.category}</td>

            <td>${subject.classes}</td>

            <td>
                <span class="status-badge ${subject.status}">
                    ${subject.status}
                </span>
            </td>

            <td class="action-column">
                <button
                    class="btn btn-light"
                    onclick="editSubject(${subject.id})">
                    Edit
                </button>
            </td>
        </tr>
    `).join("");

    document.getElementById("emptySubjectState").style.display =
        filtered.length ? "none" : "block";

    document.getElementById("totalSubjects").textContent = subjects.length;

    document.getElementById("activeSubjects").textContent =
        subjects.filter(s => s.status === "active").length;

    document.getElementById("coreSubjects").textContent =
        subjects.filter(s => s.category === "Core").length;

    document.getElementById("classesCovered").textContent =
        subjects.reduce((total, s) => total + Number(s.classes), 0);

    document.getElementById("subjectCount").textContent =
        subjects.length;
}


function openSubjectModal() {
    modal.classList.add("show");

    document.getElementById("subjectModalTitle").textContent =
        "Add New Subject";

    document.getElementById("subjectForm").reset();

    document.getElementById("subjectRecordId").value = "";
}


function closeSubjectModal() {
    modal.classList.remove("show");
}


function editSubject(id) {

    const subject = subjects.find(s => s.id === id);

    if (!subject) return;

    openSubjectModal();

    document.getElementById("subjectModalTitle").textContent =
        "Edit Subject";

    document.getElementById("subjectRecordId").value = subject.id;
    document.getElementById("subjectName").value = subject.name;
    document.getElementById("subjectCode").value = subject.code;
    document.getElementById("subjectCategory").value = subject.category;
    document.getElementById("subjectClasses").value = subject.classes;
    document.getElementById("subjectStatus").value = subject.status;
}


document.getElementById("subjectForm").addEventListener("submit", function(e) {

    e.preventDefault();

    const id = document.getElementById("subjectRecordId").value;

    const data = {
        name: document.getElementById("subjectName").value,
        code: document.getElementById("subjectCode").value,
        category: document.getElementById("subjectCategory").value,
        classes: document.getElementById("subjectClasses").value || 0,
        status: document.getElementById("subjectStatus").value
    };

    if (id) {

        const subject = subjects.find(s => s.id == id);

        Object.assign(subject, data);

    } else {

        subjects.push({
            id: Date.now(),
            ...data
        });

    }

    closeSubjectModal();
    renderSubjects();
});


document.getElementById("addSubjectBtn")
    .addEventListener("click", openSubjectModal);

document.getElementById("emptyAddSubjectBtn")
    .addEventListener("click", openSubjectModal);

document.getElementById("closeSubjectModal")
    .addEventListener("click", closeSubjectModal);

document.getElementById("cancelSubjectBtn")
    .addEventListener("click", closeSubjectModal);

search.addEventListener("input", renderSubjects);
category.addEventListener("change", renderSubjects);
status.addEventListener("change", renderSubjects);


document.getElementById("clearFiltersBtn").addEventListener("click", () => {

    search.value = "";
    category.value = "";
    status.value = "";

    renderSubjects();

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


renderSubjects();
```
