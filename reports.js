let reports = [];
let students = [];

const table = document.getElementById("reportsTableBody");
const search = document.getElementById("reportSearch");
const termFilter = document.getElementById("termFilter");
const classFilter = document.getElementById("classFilter");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getGrade(score) {
    if (score >= 70) return "A";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    if (score >= 45) return "D";
    if (score >= 40) return "E";
    return "F";
}

function getPerformance(score) {
    if (score >= 70) return "Excellent";
    if (score >= 60) return "Very Good";
    if (score >= 50) return "Good";
    if (score >= 45) return "Fair";
    return "Needs Improvement";
}

function getStudentName(studentId) {

    const student = students.find(
        s => String(s.student_id) === String(studentId)
    );

    if (!student) return studentId || "--";

    return (
        `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
        student.fullname ||
        studentId ||
        "--"
    );
}

function renderReports() {

    const text = search.value.trim().toLowerCase();

    const filtered = reports.filter(report => {

        const studentName =
            getStudentName(report.student_id);

        const matchesSearch =
            `${studentName} ${report.class || ""} ${report.subject || ""}`
                .toLowerCase()
                .includes(text);

        const matchesTerm =
            !termFilter.value ||
            report.term === termFilter.value;

        const matchesClass =
            !classFilter.value ||
            report.class === classFilter.value;

        return matchesSearch && matchesTerm && matchesClass;
    });

    table.innerHTML = filtered.map(report => {

        const score = Number(report.total) || 0;

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(
                            getStudentName(report.student_id)
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(report.class)}
                </td>

                <td>
                    ${escapeHtml(report.subject)}
                </td>

                <td>
                    ${score}%
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            report.grade || getGrade(score)
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(report.term)}
                </td>

                <td>
                    <span class="status-badge active">
                        ${escapeHtml(
                            getPerformance(score)
                        )}
                    </span>
                </td>

            </tr>
        `;
    }).join("");

    document.getElementById("emptyReportState").style.display =
        filtered.length ? "none" : "block";

    document.getElementById("reportCount").textContent =
        filtered.length;

    document.getElementById("totalStudents").textContent =
        new Set(reports.map(r => r.student_id)).size;

    const average =
        reports.length
            ? Math.round(
                reports.reduce(
                    (sum, r) => sum + (Number(r.total) || 0),
                    0
                ) / reports.length
            )
            : 0;

    document.getElementById("averageScore").textContent =
        average + "%";

    const passed =
        reports.filter(
            r => (Number(r.total) || 0) >= 40
        ).length;

    const passRate =
        reports.length
            ? Math.round(
                (passed / reports.length) * 100
            )
            : 0;

    document.getElementById("passRate").textContent =
        passRate + "%";

    document.getElementById("totalSubjects").textContent =
        new Set(reports.map(r => r.subject)).size;
}

async function loadReports() {

    table.innerHTML = `
        <tr>
            <td colspan="7">
                Loading reports...
            </td>
        </tr>
    `;

    const { data, error } = await supabaseClient
        .from("results")
        .select("*")
        .eq("status", "published")
        .order("id", { ascending: false });

    if (error) {

        console.error(error);

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    Could not load reports:
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

        return;
    }

    reports = data || [];

    await loadStudents();

    renderReports();
}

async function loadStudents() {

    const { data, error } = await supabaseClient
        .from("students")
        .select(
            "student_id, first_name, last_name, fullname"
        );

    if (error) {

        console.error(error);

        students = [];

        return;
    }

    students = data || [];
}

search.addEventListener(
    "input",
    renderReports
);

termFilter.addEventListener(
    "change",
    renderReports
);

classFilter.addEventListener(
    "change",
    renderReports
);

document.getElementById("clearFiltersBtn")
    .addEventListener("click", () => {

        search.value = "";
        termFilter.value = "";
        classFilter.value = "";

        renderReports();
    });

document.getElementById("generateReportBtn")
    .addEventListener("click", () => {

        window.print();

    });

document.getElementById("menuBtn")
    .addEventListener("click", () => {

        document.getElementById("sidebar")
            .classList.toggle("open");

    });

document.getElementById("logoutBtn")
    .addEventListener("click", e => {

        e.preventDefault();

        if (confirm("Are you sure you want to logout?")) {
            window.location.href = "login.html";
        }

    });

loadReports();