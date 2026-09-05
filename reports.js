let reports = [
    {
        id: 1,
        student: "John Peter",
        class: "SS2A",
        subject: "Mathematics",
        score: 85,
        term: "First Term"
    },
    {
        id: 2,
        student: "Mary James",
        class: "SS1B",
        subject: "English",
        score: 72,
        term: "First Term"
    },
    {
        id: 3,
        student: "David Paul",
        class: "SS3A",
        subject: "Physics",
        score: 61,
        term: "First Term"
    },
    {
        id: 4,
        student: "Sarah Faith",
        class: "SS2A",
        subject: "Biology",
        score: 78,
        term: "First Term"
    }
];

const table = document.getElementById("reportsTableBody");
const search = document.getElementById("reportSearch");
const termFilter = document.getElementById("termFilter");
const classFilter = document.getElementById("classFilter");

function getGrade(score) {
    if (score >= 75) return "A";
    if (score >= 65) return "B";
    if (score >= 55) return "C";
    if (score >= 45) return "D";
    if (score >= 40) return "E";
    return "F";
}

function getPerformance(score) {
    if (score >= 75) return "Excellent";
    if (score >= 65) return "Very Good";
    if (score >= 55) return "Good";
    if (score >= 45) return "Fair";
    return "Needs Improvement";
}

function renderReports() {

    const text = search.value.toLowerCase();

    const filtered = reports.filter(report => {

        const matchesSearch =
            `${report.student} ${report.class} ${report.subject}`
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

    table.innerHTML = filtered.map(report => `
        <tr>
            <td>
                <strong>${report.student}</strong>
            </td>

            <td>${report.class}</td>

            <td>${report.subject}</td>

            <td>${report.score}%</td>

            <td>
                <strong>${getGrade(report.score)}</strong>
            </td>

            <td>${report.term}</td>

            <td>
                <span class="status-badge active">
                    ${getPerformance(report.score)}
                </span>
            </td>
        </tr>
    `).join("");

    document.getElementById("emptyReportState").style.display =
        filtered.length ? "none" : "block";

    document.getElementById("reportCount").textContent =
        filtered.length;

    document.getElementById("totalStudents").textContent =
        new Set(reports.map(r => r.student)).size;

    const average =
        reports.length
            ? Math.round(
                reports.reduce((sum, r) => sum + r.score, 0) /
                reports.length
            )
            : 0;

    document.getElementById("averageScore").textContent =
        average + "%";

    const passed =
        reports.filter(r => r.score >= 40).length;

    const passRate =
        reports.length
            ? Math.round((passed / reports.length) * 100)
            : 0;

    document.getElementById("passRate").textContent =
        passRate + "%";

    document.getElementById("totalSubjects").textContent =
        new Set(reports.map(r => r.subject)).size;
}

search.addEventListener("input", renderReports);
termFilter.addEventListener("change", renderReports);
classFilter.addEventListener("change", renderReports);

document.getElementById("clearFiltersBtn").addEventListener("click", () => {

    search.value = "";
    termFilter.value = "";
    classFilter.value = "";

    renderReports();
});

document.getElementById("generateReportBtn").addEventListener("click", () => {
    alert("Report generation will be connected to Supabase later.");
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

renderReports();