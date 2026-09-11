/* =========================================
   PACSA SUBJECTS MANAGEMENT
   NO SUBJECT CODES REQUIRED
========================================= */

let subjects = [];
let teacherAssignments = [];
let studentSubjectRegistrations = [];
let resultSubjects = [];

const $ = id => document.getElementById(id);
const normalize = value => String(value || "").trim().toLowerCase();

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function capitalize(value) {
    const text = String(value || "");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function showToast(message, type = "success") {
    const toast = $("adminToast");
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.className = `admin-toast show ${type === "error" ? "error" : ""}`;

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

document.addEventListener("DOMContentLoaded", async () => {
    const admin = await window.adminAuthReady;
    if (!admin) return;

    $("menuBtn")?.addEventListener("click", () => $("sidebar")?.classList.toggle("active"));
    $("addSubjectBtn")?.addEventListener("click", () => openSubjectModal());
    $("emptyAddSubjectBtn")?.addEventListener("click", () => openSubjectModal());
    $("closeSubjectModal")?.addEventListener("click", closeSubjectModal);
    $("cancelSubjectBtn")?.addEventListener("click", closeSubjectModal);
    $("subjectForm")?.addEventListener("submit", saveSubject);
    $("subjectSearch")?.addEventListener("input", renderSubjects);
    $("categoryFilter")?.addEventListener("change", renderSubjects);
    $("statusFilter")?.addEventListener("change", renderSubjects);

    $("clearFiltersBtn")?.addEventListener("click", () => {
        $("subjectSearch").value = "";
        $("categoryFilter").value = "";
        $("statusFilter").value = "";
        renderSubjects();
    });

    $("subjectModal")?.addEventListener("click", event => {
        if (event.target === $("subjectModal")) closeSubjectModal();
    });

    document.querySelector(".notification-btn")?.addEventListener("click", () => {
        showToast("Your subject records are up to date.");
    });

    await loadSubjects();
});

function showLoading(loading) {
    if ($("subjectsLoading")) $("subjectsLoading").style.display = loading ? "block" : "none";
    if (loading && $("emptySubjectState")) $("emptySubjectState").style.display = "none";
}

async function loadSubjects() {
    showLoading(true);

    try {
        const [subjectResult, teacherAssignmentResult, studentSubjectResult, resultsResult] = await Promise.all([
            supabaseClient.from("subjects").select("id,name,category,status").order("name", { ascending: true }),
            supabaseClient.from("teacher_assignments").select("teacher_id,class,subject"),
            supabaseClient.from("student_subjects").select("student_id,class,subject,session"),
            supabaseClient.from("results").select("subject,class")
        ]);

        if (subjectResult.error) throw subjectResult.error;

        subjects = subjectResult.data || [];
        teacherAssignments = teacherAssignmentResult.error ? [] : teacherAssignmentResult.data || [];
        studentSubjectRegistrations = studentSubjectResult.error ? [] : studentSubjectResult.data || [];
        resultSubjects = resultsResult.error ? [] : resultsResult.data || [];

        renderSubjects();
        updateStatistics();
    } catch (error) {
        console.error("Load subjects error:", error);
        showToast("Could not load subjects: " + error.message, "error");
        if ($("emptySubjectState")) $("emptySubjectState").style.display = "block";
    } finally {
        showLoading(false);
    }
}

function getSubjectClasses(subjectName) {
    const subjectKey = normalize(subjectName);
    const classes = new Set();

    teacherAssignments
        .filter(item => normalize(item.subject) === subjectKey)
        .forEach(item => item.class && classes.add(item.class));

    studentSubjectRegistrations
        .filter(item => normalize(item.subject) === subjectKey)
        .forEach(item => item.class && classes.add(item.class));

    return [...classes].sort();
}

function renderSubjects() {
    const search = normalize($("subjectSearch")?.value);
    const category = $("categoryFilter")?.value || "";
    const status = $("statusFilter")?.value || "";

    const filtered = subjects.filter(subject => {
        const matchesSearch = normalize(subject.name).includes(search);
        const matchesCategory = !category || subject.category === category;
        const matchesStatus = !status || subject.status === status;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    if ($("subjectsTableBody")) {
        $("subjectsTableBody").innerHTML = filtered.map(subject => {
            const classes = getSubjectClasses(subject.name);
            const classHtml = classes.length
                ? classes.map(className => `<span class="subject-class-badge">${escapeHtml(className)}</span>`).join("")
                : `<span class="subject-no-class">Not assigned</span>`;
            const currentStatus = subject.status || "active";

            return `
                <tr>
                    <td><strong>${escapeHtml(subject.name || "-")}</strong></td>
                    <td>${escapeHtml(subject.category || "-")}</td>
                    <td><div class="subject-class-summary">${classHtml}</div></td>
                    <td>
                        <span class="status-badge ${currentStatus === "active" ? "active-status" : "pending"}">
                            ${escapeHtml(capitalize(currentStatus))}
                        </span>
                    </td>
                    <td>
                        <div class="table-action-buttons">
                            <button type="button" class="table-btn edit-table-btn" onclick="editSubject('${subject.id}')" title="Edit Subject">✏</button>
                            <button type="button" class="table-btn delete-table-btn" onclick="deleteSubject('${subject.id}')" title="Delete Subject">🗑</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    if ($("emptySubjectState")) $("emptySubjectState").style.display = filtered.length ? "none" : "block";
    if ($("subjectCount")) $("subjectCount").textContent = filtered.length;
}

function updateStatistics() {
    if ($("totalSubjects")) $("totalSubjects").textContent = subjects.length;
    if ($("activeSubjects")) $("activeSubjects").textContent = subjects.filter(s => normalize(s.status) === "active").length;
    if ($("coreSubjects")) $("coreSubjects").textContent = subjects.filter(s => normalize(s.category) === "core").length;

    const allClasses = new Set();
    subjects.forEach(subject => getSubjectClasses(subject.name).forEach(className => allClasses.add(className)));
    if ($("classesCovered")) $("classesCovered").textContent = allClasses.size;
    if ($("subjectCount")) $("subjectCount").textContent = subjects.length;
}

function openSubjectModal(subject = null) {
    $("subjectForm")?.reset();
    if ($("subjectRecordId")) $("subjectRecordId").value = subject?.id || "";
    if ($("subjectModalTitle")) $("subjectModalTitle").textContent = subject ? "Edit Subject" : "Add New Subject";
    if ($("subjectName")) $("subjectName").value = subject?.name || "";
    if ($("subjectCategory")) $("subjectCategory").value = subject?.category || "Core";
    if ($("subjectStatus")) $("subjectStatus").value = subject?.status || "active";
    $("subjectModal")?.classList.add("active");
}

function closeSubjectModal() {
    $("subjectModal")?.classList.remove("active");
}

async function saveSubject(event) {
    event.preventDefault();

    const recordId = $("subjectRecordId")?.value || "";
    const existingSubject = recordId ? subjects.find(subject => String(subject.id) === String(recordId)) : null;
    const oldSubjectName = existingSubject?.name || "";

    const subjectData = {
        name: $("subjectName")?.value.trim() || "",
        category: $("subjectCategory")?.value || "Core",
        status: $("subjectStatus")?.value || "active"
    };

    if (!subjectData.name) {
        showToast("Please enter the subject name.", "error");
        return;
    }

    const duplicateName = subjects.find(subject =>
        normalize(subject.name) === normalize(subjectData.name) &&
        String(subject.id) !== String(recordId)
    );

    if (duplicateName) {
        showToast("Another subject already uses this subject name.", "error");
        return;
    }

    const button = $("saveSubjectBtn");
    if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
    }

    try {
        if (recordId) {
            const { error } = await supabaseClient.from("subjects").update(subjectData).eq("id", recordId);
            if (error) throw error;

            if (oldSubjectName && normalize(oldSubjectName) !== normalize(subjectData.name)) {
                const [teacherUpdate, studentUpdate] = await Promise.all([
                    supabaseClient.from("teacher_assignments").update({ subject: subjectData.name }).eq("subject", oldSubjectName),
                    supabaseClient.from("student_subjects").update({ subject: subjectData.name }).eq("subject", oldSubjectName)
                ]);

                if (teacherUpdate.error) throw teacherUpdate.error;
                if (studentUpdate.error) throw studentUpdate.error;

                await supabaseClient.from("Teachers").update({ subject: subjectData.name }).eq("subject", oldSubjectName);
            }
        } else {
            const { error } = await supabaseClient.from("subjects").insert([subjectData]);
            if (error) throw error;
        }

        closeSubjectModal();
        await loadSubjects();
        showToast(recordId ? "Subject updated successfully." : "Subject added successfully.");
    } catch (error) {
        console.error("Save subject error:", error);
        showToast("Could not save subject: " + error.message, "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Save Subject";
        }
    }
}

window.editSubject = function(id) {
    const subject = subjects.find(item => String(item.id) === String(id));
    if (subject) openSubjectModal(subject);
};

window.deleteSubject = async function(id) {
    const subject = subjects.find(item => String(item.id) === String(id));
    if (!subject) return;

    const hasResults = resultSubjects.some(result => normalize(result.subject) === normalize(subject.name));
    if (hasResults) {
        showToast(`"${subject.name}" already has student results. Change it to Inactive instead.`, "error");
        return;
    }

    if (!confirm(`Delete "${subject.name}"?\n\nTeacher assignments and student subject registrations for this subject will also be removed.`)) return;

    try {
        const teacherDelete = await supabaseClient.from("teacher_assignments").delete().eq("subject", subject.name);
        if (teacherDelete.error) throw teacherDelete.error;

        const studentDelete = await supabaseClient.from("student_subjects").delete().eq("subject", subject.name);
        if (studentDelete.error) throw studentDelete.error;

        const subjectDelete = await supabaseClient.from("subjects").delete().eq("id", id);
        if (subjectDelete.error) throw subjectDelete.error;

        await loadSubjects();
        showToast("Subject deleted successfully.");
    } catch (error) {
        console.error("Delete subject error:", error);
        showToast("Could not delete subject: " + error.message, "error");
    }
};
