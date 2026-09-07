/* =========================================
   PACSA REPORTS & ANALYTICS
   ADMIN AUTH + PUBLISHED RESULTS ONLY
========================================= */

let results = [];
let students = [];
let studentReports = [];

let publishedResults = [];

const $ = id =>
    document.getElementById(id);


/* =========================================
   HELPERS
========================================= */

function normalize(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getReportKey(
    studentId,
    className,
    term,
    session
) {

    return [
        studentId,
        className,
        term,
        session
    ]
        .map(normalize)
        .join("|");
}


function getTotal(result) {

    const saved =
        Number(
            result.total
        );


    if (
        Number.isFinite(saved)
    ) {

        return saved;
    }


    return (
        (Number(result.ca) || 0)
        +
        (Number(result.exam) || 0)
    );
}


function getGrade(total) {

    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";

    return "F";
}


function getPerformance(total) {

    if (total >= 70) {
        return "Excellent";
    }

    if (total >= 60) {
        return "Very Good";
    }

    if (total >= 50) {
        return "Good";
    }

    if (total >= 40) {
        return "Pass";
    }

    return "Needs Improvement";
}


/* =========================================
   STUDENT
========================================= */

function getStudent(studentId) {

    return students.find(
        student =>
            String(
                student.student_id
            )
            ===
            String(
                studentId
            )
    );
}


function getStudentName(studentId) {

    const student =
        getStudent(
            studentId
        );


    if (!student) {

        return (
            studentId ||
            "Student"
        );
    }


    return (
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim()
        ||
        student.fullname
        ||
        student.student_id
    );
}


/* =========================================
   LOAD DATA
========================================= */

async function loadReports() {

    try {

        const [
            resultsResponse,
            studentsResponse,
            reportsResponse
        ] =
            await Promise.all([

                supabaseClient
                    .from("results")
                    .select(`
                        id,
                        student_id,
                        subject,
                        ca,
                        exam,
                        total,
                        grade,
                        term,
                        session,
                        class,
                        status
                    `)
                    .order(
                        "id",
                        {
                            ascending:
                                false
                        }
                    ),


                supabaseClient
                    .from("students")
                    .select(`
                        student_id,
                        first_name,
                        last_name,
                        fullname,
                        class
                    `),


                supabaseClient
                    .from(
                        "student_reports"
                    )
                    .select(`
                        student_id,
                        class,
                        term,
                        session,
                        status,
                        published_at
                    `)

            ]);


        if (
            resultsResponse.error
        ) {

            throw resultsResponse.error;
        }


        if (
            studentsResponse.error
        ) {

            throw studentsResponse.error;
        }


        if (
            reportsResponse.error
        ) {

            throw reportsResponse.error;
        }


        results =
            resultsResponse.data ||
            [];


        students =
            studentsResponse.data ||
            [];


        studentReports =
            reportsResponse.data ||
            [];


        buildPublishedResults();

        populateClassFilter();

        updateStatistics();

        renderReports();


    } catch (error) {

        console.error(
            "Reports loading error:",
            error
        );


        alert(
            "Could not load reports: " +
            error.message
        );
    }
}


/* =========================================
   PUBLISHED RESULTS ONLY
========================================= */

function buildPublishedResults() {

    /*
        IMPORTANT:

        student_reports.status is the authority.

        Only complete reports approved by Admin
        and marked "published" are included in
        Reports & Analytics.
    */


    const publishedKeys =
        new Set(

            studentReports

                .filter(
                    report =>
                        normalize(
                            report.status
                        )
                        ===
                        "published"
                )

                .map(
                    report =>
                        getReportKey(
                            report.student_id,
                            report.class,
                            report.term,
                            report.session
                        )
                )
        );


    publishedResults =
        results.filter(
            result =>

                publishedKeys.has(

                    getReportKey(
                        result.student_id,
                        result.class,
                        result.term,
                        result.session
                    )
                )
        );
}


/* =========================================
   CLASS FILTER
========================================= */

function populateClassFilter() {

    const select =
        $("classFilter");


    if (!select) {
        return;
    }


    const previous =
        select.value;


    const classes =
        [
            ...new Set(

                publishedResults
                    .map(
                        result =>
                            result.class
                    )
                    .filter(Boolean)
            )
        ]
            .sort();


    select.innerHTML = `

        <option value="">
            All Classes
        </option>
    `;


    classes.forEach(
        className => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                className;


            option.textContent =
                className;


            select.appendChild(
                option
            );
        }
    );


    if (
        classes.includes(
            previous
        )
    ) {

        select.value =
            previous;
    }
}


/* =========================================
   FILTER DATA
========================================= */

function getFilteredResults() {

    const search =
        normalize(
            $("reportSearch")
                ?.value
        );


    const term =
        normalize(
            $("termFilter")
                ?.value
        );


    const className =
        normalize(
            $("classFilter")
                ?.value
        );


    return publishedResults.filter(
        result => {

            const searchable =
                normalize(
                    [
                        getStudentName(
                            result.student_id
                        ),
                        result.student_id,
                        result.class,
                        result.subject,
                        result.term,
                        result.session
                    ]
                        .join(" ")
                );


            return (

                (
                    !search
                    ||
                    searchable.includes(
                        search
                    )
                )

                &&

                (
                    !term
                    ||
                    normalize(
                        result.term
                    )
                    ===
                    term
                )

                &&

                (
                    !className
                    ||
                    normalize(
                        result.class
                    )
                    ===
                    className
                )
            );
        }
    );
}


/* =========================================
   RENDER TABLE
========================================= */

function renderReports() {

    const filtered =
        getFilteredResults();


    const body =
        $("reportsTableBody");


    if (!body) {
        return;
    }


    if (
        !filtered.length
    ) {

        body.innerHTML =
            "";


        $("emptyReportState")
            .style
            .display =
            "block";


        $("reportCount")
            .textContent =
            "0";


        return;
    }


    $("emptyReportState")
        .style
        .display =
        "none";


    body.innerHTML =
        filtered
            .map(
                result => {

                    const total =
                        getTotal(
                            result
                        );


                    const grade =
                        result.grade
                        ||
                        getGrade(
                            total
                        );


                    const performance =
                        getPerformance(
                            total
                        );


                    let performanceClass =
                        "pending";


                    if (
                        total >= 70
                    ) {

                        performanceClass =
                            "active-status";
                    }

                    else if (
                        total >= 40
                    ) {

                        performanceClass =
                            "completed";
                    }


                    return `

                        <tr>

                            <td>

                                <strong>
                                    ${escapeHtml(
                                        getStudentName(
                                            result.student_id
                                        )
                                    )}
                                </strong>

                                <br>

                                <small>
                                    ${escapeHtml(
                                        result.student_id ||
                                        "-"
                                    )}
                                </small>

                            </td>


                            <td>
                                ${escapeHtml(
                                    result.class ||
                                    "-"
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    result.subject ||
                                    "-"
                                )}
                            </td>


                            <td>

                                <strong>
                                    ${total}%
                                </strong>

                            </td>


                            <td>

                                <strong>
                                    ${escapeHtml(
                                        grade
                                    )}
                                </strong>

                            </td>


                            <td>
                                ${escapeHtml(
                                    result.term ||
                                    "-"
                                )}
                            </td>


                            <td>

                                <span
                                    class="status-badge ${performanceClass}"
                                >
                                    ${escapeHtml(
                                        performance
                                    )}
                                </span>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    $("reportCount")
        .textContent =
        filtered.length;
}


/* =========================================
   STATISTICS
========================================= */

function updateStatistics() {

    /*
        TOTAL STUDENTS WITH PUBLISHED RESULTS
    */

    const studentIds =
        new Set(

            publishedResults
                .map(
                    result =>
                        result.student_id
                )
                .filter(Boolean)
        );


    if (
        $("totalStudents")
    ) {

        $("totalStudents")
            .textContent =
            studentIds.size;
    }


    /*
        SUBJECTS
    */

    const subjects =
        new Set(

            publishedResults
                .map(
                    result =>
                        result.subject
                )
                .filter(Boolean)
        );


    if (
        $("totalSubjects")
    ) {

        $("totalSubjects")
            .textContent =
            subjects.size;
    }


    /*
        AVERAGE SCORE
    */

    const totals =
        publishedResults.map(
            getTotal
        );


    const average =
        totals.length

            ? totals.reduce(
                (
                    sum,
                    total
                ) =>
                    sum + total,
                0
            )
            /
            totals.length

            : 0;


    if (
        $("averageScore")
    ) {

        $("averageScore")
            .textContent =
            `${average.toFixed(1)}%`;
    }


    /*
        PASS RATE

        40 and above = pass.
    */

    const passed =
        totals.filter(
            total =>
                total >= 40
        )
            .length;


    const passRate =
        totals.length

            ? (
                passed /
                totals.length
            )
            *
            100

            : 0;


    if (
        $("passRate")
    ) {

        $("passRate")
            .textContent =
            `${passRate.toFixed(1)}%`;
    }
}


/* =========================================
   CLEAR FILTERS
========================================= */

function clearFilters() {

    if (
        $("reportSearch")
    ) {

        $("reportSearch").value =
            "";
    }


    if (
        $("termFilter")
    ) {

        $("termFilter").value =
            "";
    }


    if (
        $("classFilter")
    ) {

        $("classFilter").value =
            "";
    }


    renderReports();
}


/* =========================================
   GENERATE PRINTABLE REPORT
========================================= */

function generateReport() {

    const filtered =
        getFilteredResults();


    if (
        !filtered.length
    ) {

        alert(
            "There is no published report data to generate."
        );

        return;
    }


    const term =
        $("termFilter")
            ?.value ||
        "All Terms";


    const className =
        $("classFilter")
            ?.value ||
        "All Classes";


    const totals =
        filtered.map(
            getTotal
        );


    const average =
        totals.reduce(
            (
                sum,
                value
            ) =>
                sum + value,
            0
        )
        /
        totals.length;


    const passed =
        totals.filter(
            total =>
                total >= 40
        )
            .length;


    const passRate =
        totals.length

            ? (
                passed /
                totals.length
            )
            *
            100

            : 0;


    const uniqueStudents =
        new Set(
            filtered.map(
                result =>
                    result.student_id
            )
        )
            .size;


    const rows =
        filtered
            .map(
                result => {

                    const total =
                        getTotal(
                            result
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    getStudentName(
                                        result.student_id
                                    )
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.student_id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.class
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.subject
                                )}
                            </td>

                            <td>
                                ${total}%
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.grade
                                    ||
                                    getGrade(
                                        total
                                    )
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.term
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.session
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (
        !printWindow
    ) {

        alert(
            "Your browser blocked the report window. Please allow pop-ups and try again."
        );

        return;
    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                PACSA Academic Report
            </title>

            <style>

                body {
                    font-family:
                        Arial,
                        sans-serif;

                    padding:
                        30px;

                    color:
                        #1f2937;
                }


                .header {
                    text-align:
                        center;

                    margin-bottom:
                        25px;
                }


                .header h1 {
                    margin-bottom:
                        5px;
                }


                .summary {
                    display:
                        grid;

                    grid-template-columns:
                        repeat(
                            3,
                            1fr
                        );

                    gap:
                        12px;

                    margin:
                        20px 0;
                }


                .summary div {
                    border:
                        1px solid
                        #ddd;

                    padding:
                        12px;

                    border-radius:
                        8px;
                }


                table {
                    width:
                        100%;

                    border-collapse:
                        collapse;

                    margin-top:
                        20px;
                }


                th,
                td {
                    border:
                        1px solid
                        #ddd;

                    padding:
                        8px;

                    font-size:
                        12px;

                    text-align:
                        left;
                }


                th {
                    background:
                        #f3f4f6;
                }


                .footer {
                    margin-top:
                        25px;

                    text-align:
                        center;

                    font-size:
                        11px;

                    color:
                        #6b7280;
                }


                @media print {

                    button {
                        display:
                            none;
                    }
                }

            </style>

        </head>


        <body>


            <div class="header">

                <h1>
                    PACSA School Management System
                </h1>

                <h2>
                    Academic Performance Report
                </h2>

                <p>
                    ${escapeHtml(className)}
                    |
                    ${escapeHtml(term)}
                </p>

            </div>


            <div class="summary">

                <div>
                    <strong>
                        Students
                    </strong>

                    <br>

                    ${uniqueStudents}
                </div>


                <div>
                    <strong>
                        Average Score
                    </strong>

                    <br>

                    ${average.toFixed(1)}%
                </div>


                <div>
                    <strong>
                        Pass Rate
                    </strong>

                    <br>

                    ${passRate.toFixed(1)}%
                </div>

            </div>


            <table>

                <thead>

                    <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Score</th>
                        <th>Grade</th>
                        <th>Term</th>
                        <th>Session</th>
                    </tr>

                </thead>


                <tbody>
                    ${rows}
                </tbody>

            </table>


            <div class="footer">

                PACSA School Management System

            </div>


            <script>

                window.onload =
                    function () {

                        window.print();

                    };

            <\/script>


        </body>

        </html>
    `);


    printWindow.document.close();
}


/* =========================================
   START PAGE
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
            ADMIN AUTH FIRST
        */

        const admin =
            await window.adminAuthReady;


        if (!admin) {
            return;
        }


        $("reportSearch")
            ?.addEventListener(
                "input",
                renderReports
            );


        $("termFilter")
            ?.addEventListener(
                "change",
                renderReports
            );


        $("classFilter")
            ?.addEventListener(
                "change",
                renderReports
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                clearFilters
            );


        $("generateReportBtn")
            ?.addEventListener(
                "click",
                generateReport
            );


        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("sidebar")
                        ?.classList
                        .toggle(
                            "active"
                        );
                }
            );


        /*
            Logout handled by admin-auth.js
        */


        await loadReports();
    }
);