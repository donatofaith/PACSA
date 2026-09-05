let subjects = [];

function $(id) {
    return document.getElementById(id);
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
    const table = $("subjectsTableBody");
    const search = $("subjectSearch").value.trim().toLowerCase();
    const category = $("categoryFilter").value;
    const status = $("statusFilter").value;

    const filtered = subjects.filter(subject =>
        (String(subject.name || "").toLowerCase().includes(search) ||
         String(subject.code || "").toLowerCase().includes(search)) &&
        (!category || subject.category === category) &&
        (!status || subject.status === status)
    );

    table.innerHTML = filtered.map(subject => `
        <tr>
            <td><strong>${escapeHtml(subject.name)}</strong></td>
            <td>${escapeHtml(subject.code)}</td>
            <td>${escapeHtml(subject.category)}</td>
            <td>0</td>
<<<<<<< HEAD
            <td><span class="status-badge ${subject.status === "active" ? "active-status" : "pending"}">${escapeHtml(subject.status)}</span></td>
            <td class="action-column">
                <button type="button" class="btn btn-light" onclick="editSubject('${subject.id}')">Edit</button>
=======
            <td>
                <span class="status-badge ${subject.status === "active" ? "active-status" : "pending"}">
                    ${escapeHtml(subject.status)}
                </span>
            </td>
            <td class="action-column">
                <button type="button" class="btn btn-light" onclick="editSubject('${subject.id}')">
                    Edit
                </button>
                <button type="button" class="btn btn-light" onclick="deleteSubject('${subject.id}')">
                    Delete
                </button>
>>>>>>> 1d9664b (Update admin portal pages)
            </td>
        </tr>
    `).join("");

    $("emptySubjectState").style.display = filtered.length ? "none" : "block";
    $("totalSubjects").textContent = subjects.length;
    $("activeSubjects").textContent = subjects.filter(s => s.status === "active").length;
    $("coreSubjects").textContent = subjects.filter(s => s.category === "Core").length;
    $("classesCovered").textContent = "0";
    $("subjectCount").textContent = subjects.length;
}

async function loadSubjects() {
    $("subjectsLoading").style.display = "block";
    $("emptySubjectState").style.display = "none";

    const { data, error } = await supabaseClient
        .from("subjects")
        .select("id, name, code, category, status")
        .order("name", { ascending: true });

    $("subjectsLoading").style.display = "none";

    if (error) {
        console.error(error);
        $("emptySubjectState").style.display = "block";
        $("emptySubjectState").querySelector("h3").textContent = "Unable to Load Subjects";
        $("emptySubjectState").querySelector("p").textContent = error.message;
        return;
    }

    subjects = data || [];
    renderSubjects();
}

function openSubjectModal(subject = null) {
    const modal = $("subjectModal");
    const form = $("subjectForm");

    form.reset();
<<<<<<< HEAD
    $("subjectModalTitle").textContent = subject ? "Edit Subject" : "Add New Subject";
=======

    $("subjectModalTitle").textContent =
        subject ? "Edit Subject" : "Add New Subject";

>>>>>>> 1d9664b (Update admin portal pages)
    $("subjectRecordId").value = subject?.id || "";
    $("subjectName").value = subject?.name || "";
    $("subjectCode").value = subject?.code || "";
    $("subjectCategory").value = subject?.category || "Core";
    $("subjectStatus").value = subject?.status || "active";

    modal.style.display = "flex";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "9999";
    modal.style.background = "rgba(15, 23, 42, 0.55)";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "20px";
}

function closeSubjectModal() {
    $("subjectModal").style.display = "none";
}

window.editSubject = function(id) {
<<<<<<< HEAD
    const subject = subjects.find(s => String(s.id) === String(id));
    if (subject) openSubjectModal(subject);
};

document.addEventListener("DOMContentLoaded", () => {
    $("subjectForm").addEventListener("submit", async e => {
        e.preventDefault();

        const saveButton = $("saveSubjectBtn");
        const id = $("subjectRecordId").value;
        const data = {
            name: $("subjectName").value.trim(),
            code: $("subjectCode").value.trim().toUpperCase(),
            category: $("subjectCategory").value,
            status: $("subjectStatus").value
        };
=======
    const subject = subjects.find(
        s => String(s.id) === String(id)
    );

    if (subject) {
        openSubjectModal(subject);
    }
};

window.deleteSubject = async function(id) {
    const subject = subjects.find(
        s => String(s.id) === String(id)
    );
>>>>>>> 1d9664b (Update admin portal pages)

        if (!data.name || !data.code) {
            alert("Please enter the subject name and subject code.");
            return;
        }

<<<<<<< HEAD
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        const result = id
            ? await supabaseClient.from("subjects").update(data).eq("id", id)
            : await supabaseClient.from("subjects").insert([data]);

        saveButton.disabled = false;
        saveButton.textContent = "Save Subject";

        if (result.error) {
            alert(`Could not save subject: ${result.error.message}`);
            return;
        }

        closeSubjectModal();
        loadSubjects();
    });

    $("addSubjectBtn").addEventListener("click", e => {
        e.preventDefault();
        openSubjectModal();
    });

    $("emptyAddSubjectBtn").addEventListener("click", e => {
        e.preventDefault();
        openSubjectModal();
    });

    $("closeSubjectModal").addEventListener("click", closeSubjectModal);
    $("cancelSubjectBtn").addEventListener("click", closeSubjectModal);

    $("subjectModal").addEventListener("click", e => {
        if (e.target === $("subjectModal")) closeSubjectModal();
    });

    $("subjectSearch").addEventListener("input", renderSubjects);
    $("categoryFilter").addEventListener("change", renderSubjects);
    $("statusFilter").addEventListener("change", renderSubjects);

    $("clearFiltersBtn").addEventListener("click", () => {
        $("subjectSearch").value = "";
        $("categoryFilter").value = "";
        $("statusFilter").value = "";
        renderSubjects();
    });

    $("menuBtn").addEventListener("click", () => {
        $("sidebar").classList.toggle("active");
    });

    $("logoutBtn").addEventListener("click", e => {
        e.preventDefault();
        if (confirm("Are you sure you want to logout?")) {
            window.location.href = "login.html";
        }
    });

    loadSubjects();
});
=======
    const confirmed = confirm(
        `Are you sure you want to delete "${subject.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("subjects")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Delete subject error:", error);
        alert(`Could not delete subject: ${error.message}`);
        return;
    }

    await loadSubjects();
};

document.addEventListener("DOMContentLoaded", () => {

    $("subjectForm").addEventListener("submit", async e => {
        e.preventDefault();

        const saveButton = $("saveSubjectBtn");
        const id = $("subjectRecordId").value;

        const data = {
            name: $("subjectName").value.trim(),
            code: $("subjectCode").value.trim().toUpperCase(),
            category: $("subjectCategory").value,
            status: $("subjectStatus").value
        };

        if (!data.name || !data.code) {
            alert("Please enter the subject name and subject code.");
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        const result = id
            ? await supabaseClient
                .from("subjects")
                .update(data)
                .eq("id", id)
            : await supabaseClient
                .from("subjects")
                .insert([data]);

        saveButton.disabled = false;
        saveButton.textContent = "Save Subject";

        if (result.error) {
            console.error(result.error);
            alert(`Could not save subject: ${result.error.message}`);
            return;
        }

        closeSubjectModal();
        await loadSubjects();
    });

    $("addSubjectBtn").addEventListener("click", e => {
        e.preventDefault();
        openSubjectModal();
    });

    $("emptyAddSubjectBtn").addEventListener("click", e => {
        e.preventDefault();
        openSubjectModal();
    });

    $("closeSubjectModal").addEventListener("click", closeSubjectModal);

    $("cancelSubjectBtn").addEventListener("click", closeSubjectModal);

    $("subjectModal").addEventListener("click", e => {
        if (e.target === $("subjectModal")) {
            closeSubjectModal();
        }
    });

    $("subjectSearch").addEventListener("input", renderSubjects);

    $("categoryFilter").addEventListener("change", renderSubjects);

    $("statusFilter").addEventListener("change", renderSubjects);

    $("clearFiltersBtn").addEventListener("click", () => {
        $("subjectSearch").value = "";
        $("categoryFilter").value = "";
        $("statusFilter").value = "";
        renderSubjects();
    });

    $("menuBtn").addEventListener("click", () => {
        $("sidebar").classList.toggle("active");
    });

    $("logoutBtn").addEventListener("click", e => {
        e.preventDefault();

        if (confirm("Are you sure you want to logout?")) {
            window.location.href = "login.html";
        }
    });

    loadSubjects();
});
>>>>>>> 1d9664b (Update admin portal pages)
