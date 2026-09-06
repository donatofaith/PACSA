const student =
    JSON.parse(
        localStorage.getItem("student")
    );


if (!student) {
    window.location.href =
        "student-login.html";
}


let publishedReports = [];
let allResults = [];
let filteredResults = [];
let currentReport = null;


const $ = id =>
    document.getElementById(id);


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function normalize(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();
}


function uniqueValues(values) {

    return [
        ...new Set(
            values
                .map(value =>
                    String(value ?? "").trim()
                )
                .filter(Boolean)
        )
    ];
}


function getStudentName() {

    if (student.fullname) {
        return student.fullname;
    }

    return (
        `${student.first_name || ""} ${student.last_name || ""}`.trim()
        || "Student"
    );
}


function getGradeClass(grade) {

    const value =
        normalize(grade);

    if (value === "a") return "grade-a";
    if (value === "b") return "grade-b";
    if (value === "c") return "grade-c";
    if (value === "d") return "grade-d";
    if (value === "e") return "grade-e";

    return "grade-f";
}


function getResultTotal(result) {

    const stored =
        Number(result.total);

    if (Number.isFinite(stored)) {
        return stored;
    }

    return (
        (Number(result.ca) || 0) +
        (Number(result.exam) || 0)
    );
}


function showMessage(
    message,
    type = "info"
) {

    $("resultMessage").textContent =
        message;

    $("resultMessage").className =
        `result-message show ${type}`;
}


function hideMessage() {

    $("resultMessage").textContent = "";

    $("resultMessage").className =
        "result-message";
}


/* =========================
   PROFILE
========================= */

function displayStudentProfile() {

    const name =
        getStudentName();

    $("studentName").textContent =
        name;

    $("studentId").textContent =
        student.student_id || "--";

    $("studentClass").textContent =
        student.class || "--";

    $("studentStatus").textContent =
        student.status || "Active";

    $("studentMiniName").textContent =
        name;

    $("studentMiniId").textContent =
        student.student_id || "--";

    $("welcomeName").textContent =
        `Welcome, ${name}`;

    $("studentAvatar").src =
        "images/Faith.jpg";

    $("studentMiniAvatar").src =
        "images/Faith.jpg";

    $("reportStudentName").textContent =
        name;

    $("reportStudentId").textContent =
        student.student_id || "--";
}


/* =========================
   LOAD PUBLISHED REPORTS
========================= */

async function loadPublishedReports() {

    showMessage(
        "Loading your published results..."
    );

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("student_reports")
                .select("*")
                .eq(
                    "student_id",
                    student.student_id
                )
                .eq(
                    "status",
                    "published"
                )
                .order(
                    "published_at",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        publishedReports =
            data || [];


        if (
            !publishedReports.length
        ) {

            showMessage(
                "No approved result is available yet.",
                "warning"
            );

            renderEmptyState();

            populateFilters();

            return;
        }


        await loadResultRows();

        populateFilters();

        hideMessage();

        applyFilters();


    } catch (error) {

        console.error(
            "Could not load reports:",
            error
        );

        showMessage(
            "Unable to load your published results.",
            "warning"
        );

        renderEmptyState();

    }
}


/* =========================
   LOAD RESULT ROWS
========================= */

async function loadResultRows() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("results")
            .select("*")
            .eq(
                "student_id",
                student.student_id
            )
            .eq(
                "status",
                "published"
            );


    if (error) {
        throw error;
    }


    allResults =
        data || [];
}


/* =========================
   POPULATE FILTERS
========================= */

function populateFilters() {

    const sessions =
        uniqueValues(
            publishedReports.map(
                report =>
                    report.session
            )
        );


    const classes =
        uniqueValues(
            publishedReports.map(
                report =>
                    report.class
            )
        );


    const terms =
        uniqueValues(
            publishedReports.map(
                report =>
                    report.term
            )
        );


    $("sessionFilter").innerHTML = `
        <option value="">
            Select Session
        </option>
    `;


    sessions.forEach(
        session => {

            $("sessionFilter").innerHTML += `
                <option value="${escapeHtml(session)}">
                    ${escapeHtml(session)}
                </option>
            `;

        }
    );


    $("classFilter").innerHTML = `
        <option value="">
            Select Class
        </option>
    `;


    classes.forEach(
        className => {

            $("classFilter").innerHTML += `
                <option value="${escapeHtml(className)}">
                    ${escapeHtml(className)}
                </option>
            `;

        }
    );


    $("termFilter").innerHTML = `
        <option value="">
            Select Term
        </option>
    `;


    terms.forEach(
        term => {

            $("termFilter").innerHTML += `
                <option value="${escapeHtml(term)}">
                    ${escapeHtml(term)}
                </option>
            `;

        }
    );


    if (!publishedReports.length) {
        return;
    }


    const firstReport =
        publishedReports[0];


    $("sessionFilter").value =
        firstReport.session || "";


    $("classFilter").value =
        firstReport.class || "";


    $("termFilter").value =
        firstReport.term || "";

}


/* =========================
   APPLY FILTERS
========================= */

function applyFilters() {

    const selectedSession =
        $("sessionFilter").value;

    const selectedClass =
        $("classFilter").value;

    const selectedTerm =
        $("termFilter").value;


    if (
        !selectedSession ||
        !selectedClass ||
        !selectedTerm
    ) {

        currentReport =
            null;

        filteredResults =
            [];

        renderEmptyState(
            "Select a session, class and term to view your result."
        );

        return;
    }


    currentReport =
        publishedReports.find(
            report =>

                normalize(report.session) ===
                normalize(selectedSession)

                &&

                normalize(report.class) ===
                normalize(selectedClass)

                &&

                normalize(report.term) ===
                normalize(selectedTerm)
        )
        || null;


    if (!currentReport) {

        filteredResults =
            [];

        showMessage(
            "This report has not been approved for publication.",
            "warning"
        );

        renderEmptyState(
            "No published result found for this selection."
        );

        return;
    }


    filteredResults =
        allResults.filter(
            result =>

                normalize(result.session) ===
                normalize(selectedSession)

                &&

                normalize(result.class) ===
                normalize(selectedClass)

                &&

                normalize(result.term) ===
                normalize(selectedTerm)

                &&

                normalize(result.status) ===
                "published"
        );


    $("resultSelectionText").textContent =
        `${selectedClass} • ${selectedTerm} • ${selectedSession}`;


    $("reportStudentClass").textContent =
        selectedClass;


    $("reportSession").textContent =
        selectedSession;


    $("reportTerm").textContent =
        selectedTerm;


    if (
        !filteredResults.length
    ) {

        showMessage(
            "This report is published, but no result rows were found.",
            "warning"
        );

        renderEmptyState(
            "No published subject results were found."
        );

        return;
    }


    hideMessage();

    renderResults(
        filteredResults
    );

}


/* =========================
   RENDER RESULTS
========================= */

function renderResults(results) {

    $("resultsTable").innerHTML = "";

    $("reportResultsTable").innerHTML = "";


    let totalScore =
        0;

    let passed =
        0;


    results.forEach(
        result => {

            const total =
                getResultTotal(result);

            const grade =
                result.grade || "--";

            const gradeClass =
                getGradeClass(grade);


            if (
                total >= 40
            ) {
                passed++;
            }


            totalScore +=
                total;


            const row = `

                <tr>

                    <td>
                        ${escapeHtml(
                            result.subject || "--"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            result.ca ?? 0
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            result.exam ?? 0
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            total
                        )}
                    </td>

                    <td>

                        <span
                            class="grade-badge ${gradeClass}"
                        >
                            ${escapeHtml(
                                grade
                            )}
                        </span>

                    </td>

                </tr>

            `;


            $("resultsTable").innerHTML +=
                row;


            $("reportResultsTable").innerHTML +=
                row;

        }
    );


    const average =
        results.length
            ? totalScore / results.length
            : 0;


    const roundedAverage =
        Math.round(average);


    $("average").textContent =
        `${roundedAverage}%`;


    $("subjects").textContent =
        results.length;


    $("passedSubjects").textContent =
        passed;


    $("position").textContent =
        "N/A";


    $("reportAverage").textContent =
        `${roundedAverage}%`;


    $("reportSubjects").textContent =
        results.length;


    $("reportPosition").textContent =
        "N/A";


    $("reportPassed").textContent =
        passed;


    $("reportRemark").textContent =
        currentReport?.remark || "--";

}


/* =========================
   EMPTY STATE
========================= */

function renderEmptyState(
    message = "No published results available."
) {

    const row = `

        <tr>

            <td
                colspan="5"
                class="empty-row"
            >
                ${escapeHtml(message)}
            </td>

        </tr>

    `;


    $("resultsTable").innerHTML =
        row;


    $("reportResultsTable").innerHTML =
        row;


    $("average").textContent =
        "0%";


    $("subjects").textContent =
        "0";


    $("passedSubjects").textContent =
        "0";


    $("position").textContent =
        "N/A";


    $("reportAverage").textContent =
        "0%";


    $("reportSubjects").textContent =
        "0";


    $("reportPosition").textContent =
        "N/A";


    $("reportPassed").textContent =
        "0";


    $("reportRemark").textContent =
        "--";

}


/* =========================
   EVENTS
========================= */

$("sessionFilter")
    .addEventListener(
        "change",
        applyFilters
    );


$("classFilter")
    .addEventListener(
        "change",
        applyFilters
    );


$("termFilter")
    .addEventListener(
        "change",
        applyFilters
    );


$("printResultBtn")
    .addEventListener(
        "click",
        function () {

            if (
                !currentReport ||
                !filteredResults.length
            ) {

                showMessage(
                    "Select a published result before printing.",
                    "warning"
                );

                return;
            }


            window.print();

        }
    );


$("logoutBtn")
    .addEventListener(
        "click",
        function () {

            localStorage.removeItem(
                "student"
            );

            window.location.href =
                "student-login.html";

        }
    );


displayStudentProfile();

loadPublishedReports();