let subjects = [];

const table = document.getElementById("subjectsTableBody");
const search = document.getElementById("subjectSearch");
const category = document.getElementById("categoryFilter");
const status = document.getElementById("statusFilter");
const modal = document.getElementById("subjectModal");
const loading = document.getElementById("subjectsLoading");
const emptyState = document.getElementById("emptySubjectState");

function showLoading(show) {
    loading.style.display = show ? "block" : "none";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderSubjects() {
    const text = search.value.trim().toLowerCase();

    const filtered = subjects.filter(subject =>
        (String(subject.name || "").toLowerCase().includes(text) ||
         String(subject.code || "").toLowerCase().includes(text)) &&
        (!category.value || subject.category === category.value) &&
        (!status.value || subject.status === status.value)
    );

    table.innerHTML = filtered.map(subject => `
        <tr>
            <td><strong>${escapeHtml(subject.name)}</strong></td>
            <td>${escapeHtml(subject.code)}</td>
            <td>${escapeHtml(subject.category)}</td>
            <td>${Number(subject.classes || 0)}</td>
            <td><span class="status-badge ${escapeHtml(subject.status)}">${escapeHtml(subject.status)}</span></td>
            <td class="action-column">
                <button class="btn btn-light" onclick="editSubject('${subject.id}')">Edit</button>
            </td>
        </tr>
    `).join("");

    emptyState.style.display = filtered.length ? "none" : "block";

    document.getElementById("totalSubjects").textContent = subjects.length;
    document.getElementById("activeSubjects").textContent = subjects.filter(s => s.status === "active").length;
    document.getElementById("coreSubjects").textContent = subjects.filter(s => s.category === "Core").length;
    document.getElementById("classesCovered").textContent = subjects.reduce((total, s) => total + Number(s.classes || 0), 0);
    document.getElementById("subjectCount").textContent = subjects.length;
}

async function loadSubjects() {
    showLoading(true);
    emptyState.style.display = "none";

    const { data, error } = await supabaseClient
        .from("subjects")
        .select("id, name, code, category, status")
        .order("name", { ascending: true });

    showLoading(false);

    if (error) {
        console.error("Supabase subjects error:", error);
        table.innerHTML = "";
        emptyState.style.display = "block";
        emptyState.querySelector("h3").textContent = "Unable to Load Subjects";
        emptyState.querySelector("p").textContent = error.message;
        return;
    }

    subjects = (data || []).map(subject => ({
        ...subject,
        classes: 0
    }));

    renderSubjects();
}

function openSubjectModal(subject = null) {
    modal.classList.add("show");
    document.getElementById("subjectForm").reset();

    document.getElementById("subjectModalTitle").textContent = subject ? "Edit Subject" : "Add New Subject";
    document.getElementById("subjectRecordId").value = subject?.id || "";
    document.getElementById("subjectName").value = subject?.name || "";
    document.getElementById("subjectCode").value = subject?.code || "";
    document.getElementById("subjectCategory").value = subject?.category || "Core";
    document.getElementById("subjectStatus").value = subject?.status || "active";
}

function closeSubjectModal() {
    modal.classList.remove("show");
}

window.editSubject = function(id) {
    const subject = subjects.find(s => String(s.id) === String(id));
    if (subject) openSubjectModal(subject);
};

document.getElementById("subjectForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const saveButton = document.getElementById("saveSubjectBtn");
    const id = document.getElementById("subjectRecordId").value;

    const data = {
        name: document.getElementById("subjectName").value.trim(),
        code: document.getElementById("subjectCode").value.trim().toUpperCase(),
        category: document.getElementById("subjectCategory").value,
        status: document.getElementById("subjectStatus").value
    };

    if (!data.name || !data.code) {
        alert("Please enter the subject name and subject code.");
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    let error;

    if (id) {
        ({ error } = await supabaseClient
            .from("subjects")
            .update(data)
            .eq("id", id));
    } else {
        ({ error } = await supabaseClient
            .from("subjects")
            .insert([data]));
    }

    saveButton.disabled = false;
    saveButton.textContent = "Save Subject";

    if (error) {
        console.error("Supabase save subject error:", error);
        alert(`Could not save subject: ${error.message}`);
        return;
    }

    closeSubjectModal();
    await loadSubjects();
});

document.getElementById("addSubjectBtn").addEventListener("click", () => openSubjectModal());
document.getElementById("emptyAddSubjectBtn").addEventListener("click", () => openSubjectModal());
document.getElementById("closeSubjectModal").addEventListener("click", closeSubjectModal);
document.getElementById("cancelSubjectBtn").addEventListener("click", closeSubjectModal);

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

loadSubjects();
