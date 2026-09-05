let results = [];
let students = [];

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

function getStudentName(studentId) {
    const student = students.find(
        s => String(s.student_id) === String(studentId)
    );

    if (!student) return studentId;

    return `${student.first_name || ""} ${student.last_name || ""}`.trim();
}

function renderResults() {
    const search = $("resultSearch").value.trim().toLowerCase();
    const term = $("termFilter").value;
    const status = $("statusFilter").value;

    const filtered = results.filter(result => {
        const studentName = getStudentName(result.student_id).toLowerCase();

        return (
            (
                studentName.includes(search) ||
                String(result.subject || "").toLowerCase().includes(search) ||
                String(result.class || "").toLowerCase().includes(search)
            ) &&
            (!term || result.term === term) &&
            (!status || result.status === status)
        );
    });

    $("resultsTableBody").innerHTML = filtered.map(result => `
        <tr>
            <td>
                <strong>
                    ${escapeHtml(getStudentName(result.student_id))}
                </strong>
            </td>

            <td>${escapeHtml(result.class)}</td>

            <td>${escapeHtml(result.subject)}</td>

            <td>${escapeHtml(result.total)}/100</td>

            <td>
                <strong>${escapeHtml(result.grade)}</strong>
            </td>

            <td>${escapeHtml(result.term)}</td>

            <td>
                <span class="status-badge ${
                    result.status === "published"
                        ? "active-status"
                        : result.status === "rejected"
                            ? "rejected-status"
                            : "pending"
                }">
                    ${escapeHtml(result.status || "pending")}
                </span>
            </td>

            <td class="action-column">
                ${
                    result.status === "pending"
                        ? `
                            <button
                                type="button"
                                class="btn btn-primary"
                                onclick="publishResult('${result.id}')">
                                Publish
                            </button>

                            <button
                                type="button"
                                class="btn btn-light"
                                onclick="rejectResult('${result.id}')">
                                Reject
                            </button>
                        `
                        : result.status === "published"
                            ? `<span>Published</span>`
                            : `<span>Rejected</span>`
                }
            </td>
        </tr>
    `).join("");

    $("totalResults").textContent = results.length;

    $("publishedResults").textContent =
        results.filter(r => r.status === "published").length;

    $("pendingResults").textContent =
        results.filter(r => !r.status || r.status === "pending").length;

    $("studentCount").textContent = students.length;

    $("resultCount").textContent = filtered.length;

    $("emptyResultState").style.display =
        filtered.length ? "none" : "block";
}

async function loadResults() {
    const { data, error } = await supabaseClient
        .from("results")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        alert(`Could not load results: ${error.message}`);
        return;
    }

    results = data || [];
    renderResults();
}

async function loadStudents() {
    const { data, error } = await supabaseClient
        .from("students")
        .select("student_id, first_name, last_name");

    if (error) {
        console.error(error);
        alert(`Could not load students: ${error.message}`);
        return;
    }

    students = data || [];
    renderResults();
}

window.publishResult = async function(id) {
    const result = results.find(
        r => String(r.id) === String(id)
    );

    if (!result) return;

    const confirmed = confirm(
        `Publish the result for ${getStudentName(result.student_id)}?`
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("results")
        .update({
            status: "published"
        })
        .eq("id", id);

    if (error) {
        console.error(error);
        alert(`Could not publish result: ${error.message}`);
        return;
    }

    await loadResults();
};

window.rejectResult = async function(id) {
    const result = results.find(
        r => String(r.id) === String(id)
    );

    if (!result) return;

    const confirmed = confirm(
        `Reject the result for ${getStudentName(result.student_id)}?`
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("results")
        .update({
            status: "rejected"
        })
        .eq("id", id);

    if (error) {
        console.error(error);
        alert(`Could not reject result: ${error.message}`);
        return;
    }

    await loadResults();
};

document.addEventListener("DOMContentLoaded", () => {

    /*
     * REVIEW SUBMISSIONS
     * Shows only results waiting for admin approval.
     */
    $("addResultBtn").addEventListener("click", () => {
        $("statusFilter").value = "pending";
        $("termFilter").value = "";
        $("resultSearch").value = "";

        renderResults();
    });

    /*
     * REFRESH RESULTS
     */
    $("emptyAddResultBtn").addEventListener("click", async () => {
        await loadResults();
    });

    $("resultSearch").addEventListener(
        "input",
        renderResults
    );

    $("termFilter").addEventListener(
        "change",
        renderResults
    );

    $("statusFilter").addEventListener(
        "change",
        renderResults
    );

    $("clearFiltersBtn").addEventListener("click", () => {
        $("resultSearch").value = "";
        $("termFilter").value = "";
        $("statusFilter").value = "";

        renderResults();
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

    loadStudents();
    loadResults();
});