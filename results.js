/* =========================================
   PACSA RESULTS MANAGEMENT
   ADMIN AUTH + COMPLETE REPORT REVIEW
========================================= */

let results = [];
let students = [];
let studentReports = [];
let reports = [];

let currentReport = null;


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


function capitalize(value) {

    const text =
        String(
            value || ""
        );


    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}


/* =========================================
   STUDENT HELPERS
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
            "Unknown Student"
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
   REPORT KEY
========================================= */

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


/* =========================================
   RESULT HELPERS
========================================= */

function getGrade(total) {

    if (total >= 70) return "A";

    if (total >= 60) return "B";

    if (total >= 50) return "C";

    if (total >= 45) return "D";

    if (total >= 40) return "E";

    return "F";
}


function getResultTotal(result) {

    const savedTotal =
        Number(
            result.total
        );


    if (
        Number.isFinite(
            savedTotal
        )
    ) {

        return savedTotal;
    }


    return (

        (Number(result.ca) || 0)

        +

        (Number(result.exam) || 0)
    );
}


/* =========================================
   BUILD ADMIN REPORT LIST
========================================= */

function buildReports() {

    /*
        IMPORTANT WORKFLOW:

        Admin does NOT review raw subject
        result groups.

        Admin only reviews rows that exist in
        student_reports and have been submitted.

        draft = still with Class Teacher
        pending = submitted to Admin
        published = approved
        rejected = rejected by Admin
    */


    const visibleReportRecords =
        studentReports.filter(
            report => {

                const status =
                    normalize(
                        report.status
                    );


                return (
                    status === "pending"
                    ||
                    status === "published"
                    ||
                    status === "rejected"
                );
            }
        );


    reports =
        visibleReportRecords
            .map(
                reportRecord => {

                    const matchingResults =
                        results.filter(
                            result =>

                                getReportKey(
                                    result.student_id,
                                    result.class,
                                    result.term,
                                    result.session
                                )

                                ===

                                getReportKey(
                                    reportRecord.student_id,
                                    reportRecord.class,
                                    reportRecord.term,
                                    reportRecord.session
                                )
                        );


                    const totals =
                        matchingResults.map(
                            getResultTotal
                        );


                    const average =
                        totals.length

                            ? totals.reduce(
                                (
                                    sum,
                                    value
                                ) =>
                                    sum + value,
                                0
                            )
                            /
                            totals.length

                            : 0;


                    return {

                        key:
                            getReportKey(
                                reportRecord.student_id,
                                reportRecord.class,
                                reportRecord.term,
                                reportRecord.session
                            ),

                        student_id:
                            reportRecord.student_id,

                        class:
                            reportRecord.class,

                        term:
                            reportRecord.term,

                        session:
                            reportRecord.session,

                        remark:
                            reportRecord.remark ||
                            "",

                        status:
                            normalize(
                                reportRecord.status
                            ),

                        published_at:
                            reportRecord.published_at ||
                            null,

                        reportRecord,

                        results:
                            matchingResults,

                        average,

                        passed:
                            totals.filter(
                                score =>
                                    score >= 40
                            )
                                .length,

                        failed:
                            totals.filter(
                                score =>
                                    score < 40
                            )
                                .length

                    };
                }
            )


            /*
                Do not show an empty report
                if there are no result rows.
            */

            .filter(
                report =>
                    report.results.length > 0
            )


            .sort(
                (a, b) => {

                    const sessionCompare =
                        String(
                            b.session
                        )
                            .localeCompare(
                                String(
                                    a.session
                                )
                            );


                    if (
                        sessionCompare !== 0
                    ) {

                        return sessionCompare;
                    }


                    return String(
                        a.student_id
                    )
                        .localeCompare(
                            String(
                                b.student_id
                            )
                        );
                }
            );
}


/* =========================================
   SESSION FILTER
========================================= */

function populateSessionFilter() {

    const select =
        $("sessionFilter");


    if (!select) {
        return;
    }


    const oldValue =
        select.value;


    const sessionsList =
        [
            ...new Set(

                reports
                    .map(
                        report =>
                            report.session
                    )
                    .filter(Boolean)
            )
        ];


    select.innerHTML = `

        <option value="">
            All Sessions
        </option>
    `;


    sessionsList.forEach(
        session => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                session;


            option.textContent =
                session;


            select.appendChild(
                option
            );
        }
    );


    if (
        sessionsList.includes(
            oldValue
        )
    ) {

        select.value =
            oldValue;
    }
}


/* =========================================
   RENDER REPORT LIST
========================================= */

function renderReports() {

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


    const session =
        normalize(
            $("sessionFilter")
                ?.value
        );


    const status =
        normalize(
            $("statusFilter")
                ?.value
        );


    const filtered =
        reports.filter(
            report => {

                const searchable =
                    normalize(
                        [
                            report.student_id,
                            getStudentName(
                                report.student_id
                            ),
                            report.class,
                            report.term,
                            report.session
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
                            report.term
                        )
                        ===
                        term
                    )

                    &&

                    (
                        !session

                        ||

                        normalize(
                            report.session
                        )
                        ===
                        session
                    )

                    &&

                    (
                        !status

                        ||

                        normalize(
                            report.status
                        )
                        ===
                        status
                    )
                );
            }
        );


    const tableBody =
        $("reportsTableBody");


    if (!tableBody) {
        return;
    }


    tableBody.innerHTML =
        filtered
            .map(
                report => {

                    const statusClass =

                        report.status ===
                        "published"

                            ? "active-status"

                            : report.status ===
                                "rejected"

                                ? "rejected-status"

                                : "pending";


                    return `

                        <tr>

                            <td>

                                <strong>
                                    ${escapeHtml(
                                        getStudentName(
                                            report.student_id
                                        )
                                    )}
                                </strong>

                                <br>

                                <small>
                                    ${escapeHtml(
                                        report.student_id
                                    )}
                                </small>

                            </td>


                            <td>
                                ${escapeHtml(
                                    report.class ||
                                    "--"
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    report.term ||
                                    "--"
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    report.session ||
                                    "--"
                                )}
                            </td>


                            <td>
                                ${report.results.length}
                            </td>


                            <td>
                                ${report.average.toFixed(1)}%
                            </td>


                            <td>

                                ${
                                    report.remark

                                        ? "Added"

                                        : `
                                            <span class="missing-remark">
                                                Missing
                                            </span>
                                        `
                                }

                            </td>


                            <td>

                                <span
                                    class="status-badge ${statusClass}"
                                >
                                    ${escapeHtml(
                                        capitalize(
                                            report.status
                                        )
                                    )}
                                </span>

                            </td>


                            <td class="action-column">

                                <button
                                    type="button"
                                    class="report-view-btn"
                                    data-report-key="${escapeHtml(
                                        report.key
                                    )}"
                                >
                                    View Result
                                </button>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    document
        .querySelectorAll(
            "[data-report-key]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        openReport(
                            this.dataset
                                .reportKey
                        );
                    }
                );
            }
        );


    if (
        $("totalReports")
    ) {

        $("totalReports")
            .textContent =
            reports.length;
    }


    if (
        $("publishedReports")
    ) {

        $("publishedReports")
            .textContent =

            reports.filter(
                report =>
                    report.status ===
                    "published"
            )
                .length;
    }


    if (
        $("pendingReports")
    ) {

        $("pendingReports")
            .textContent =

            reports.filter(
                report =>
                    report.status ===
                    "pending"
            )
                .length;
    }


    if (
        $("studentCount")
    ) {

        $("studentCount")
            .textContent =

            new Set(
                reports.map(
                    report =>
                        report.student_id
                )
            )
                .size;
    }


    if (
        $("reportCount")
    ) {

        $("reportCount")
            .textContent =
            filtered.length;
    }


    if (
        $("emptyReportState")
    ) {

        $("emptyReportState")
            .style
            .display =

            filtered.length
                ? "none"
                : "block";
    }
}


/* =========================================
   OPEN REPORT
========================================= */

function openReport(key) {

    currentReport =
        reports.find(
            report =>
                report.key ===
                key
        );


    if (!currentReport) {
        return;
    }


    $("reviewStudentName")
        .textContent =
        getStudentName(
            currentReport.student_id
        );


    $("reviewStudentInfo")
        .textContent =
        "Complete academic result";


    $("reviewStudentId")
        .textContent =
        currentReport.student_id ||
        "--";


    $("reviewClass")
        .textContent =
        currentReport.class ||
        "--";


    $("reviewTerm")
        .textContent =
        currentReport.term ||
        "--";


    $("reviewSession")
        .textContent =
        currentReport.session ||
        "--";


    $("reviewStatus")
        .textContent =
        capitalize(
            currentReport.status ||
            "pending"
        );


    $("reviewResultBody")
        .innerHTML =

        currentReport.results
            .map(
                result => {

                    const total =
                        getResultTotal(
                            result
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    result.subject ||
                                    "--"
                                )}
                            </td>


                            <td>
                                ${Number(
                                    result.ca
                                ) || 0}
                            </td>


                            <td>
                                ${Number(
                                    result.exam
                                ) || 0}
                            </td>


                            <td>

                                <strong>
                                    ${total}
                                </strong>

                            </td>


                            <td>

                                <strong>
                                    ${escapeHtml(
                                        result.grade
                                        ||
                                        getGrade(
                                            total
                                        )
                                    )}
                                </strong>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    $("reviewSubjects")
        .textContent =
        currentReport.results.length;


    $("reviewAverage")
        .textContent =
        `${currentReport.average.toFixed(1)}%`;


    $("reviewPassed")
        .textContent =
        currentReport.passed;


    $("reviewFailed")
        .textContent =
        currentReport.failed;


    if (
        currentReport.remark
    ) {

        $("reviewRemark")
            .textContent =
            currentReport.remark;


        $("reviewRemark")
            .classList
            .remove(
                "missing-remark"
            );


    } else {

        $("reviewRemark")
            .textContent =
            "No class teacher remark has been submitted yet.";


        $("reviewRemark")
            .classList
            .add(
                "missing-remark"
            );
    }


    /*
        ADMIN APPROVE / REJECT
        ONLY WHILE PENDING.
    */

    const pending =
        currentReport.status ===
        "pending";


    $("approveReportBtn")
        .style
        .display =
        pending
            ? "inline-block"
            : "none";


    $("rejectReportBtn")
        .style
        .display =
        pending
            ? "inline-block"
            : "none";


    $("deleteReportBtn")
        .style
        .display =
        "inline-block";


    $("reportReviewPanel")
        .classList
        .add(
            "show"
        );


    $("reportReviewPanel")
        .scrollIntoView({
            behavior:
                "smooth",

            block:
                "start"
        });
}


/* =========================================
   CLOSE REVIEW
========================================= */

function closeReview() {

    currentReport =
        null;


    $("reportReviewPanel")
        ?.classList
        .remove(
            "show"
        );
}


/* =========================================
   GET FRESH REPORT RECORD
========================================= */

async function fetchFreshReport(
    report
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "student_reports"
            )
            .select(`
                id,
                student_id,
                class,
                term,
                session,
                remark,
                status,
                published_at
            `)
            .eq(
                "student_id",
                report.student_id
            )
            .eq(
                "class",
                report.class
            )
            .eq(
                "term",
                report.term
            )
            .eq(
                "session",
                report.session
            )
            .maybeSingle();


    if (error) {
        throw error;
    }


    return data;
}


/* =========================================
   APPROVE COMPLETE REPORT
========================================= */

async function approveCurrentReport() {

    if (!currentReport) {
        return;
    }


    const button =
        $("approveReportBtn");


    button.disabled =
        true;


    button.textContent =
        "Checking...";


    try {

        /*
            STALE APPROVAL PROTECTION

            Re-read the exact report immediately
            before publishing.
        */

        const freshReport =
            await fetchFreshReport(
                currentReport
            );


        if (!freshReport) {

            throw new Error(
                "This report no longer exists."
            );
        }


        if (
            normalize(
                freshReport.status
            )
            !==
            "pending"
        ) {

            alert(
                "This report is no longer pending review. It may have been changed by the class teacher. Refreshing the page now."
            );


            closeReview();

            await loadData();

            return;
        }


        if (
            !String(
                freshReport.remark ||
                ""
            )
                .trim()
        ) {

            alert(
                "This report cannot be published because the class teacher remark is missing."
            );

            return;
        }


        const confirmed =
            confirm(
                `Publish the COMPLETE result for ${getStudentName(
                    currentReport.student_id
                )}?`
            );


        if (!confirmed) {
            return;
        }


        button.textContent =
            "Publishing...";


        /*
            IMPORTANT:

            The update itself also requires
            status='pending'.

            If the teacher changes the report
            between our check and this update,
            no row will be published.
        */

        const {
            data,
            error
        } =
            await supabaseClient
                .from(
                    "student_reports"
                )
                .update({

                    status:
                        "published",

                    published_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "student_id",
                    currentReport.student_id
                )
                .eq(
                    "class",
                    currentReport.class
                )
                .eq(
                    "term",
                    currentReport.term
                )
                .eq(
                    "session",
                    currentReport.session
                )
                .eq(
                    "status",
                    "pending"
                )
                .select();


        if (error) {
            throw error;
        }


        if (
            !data ||
            data.length !== 1
        ) {

            alert(
                "The report changed before it could be published. Nothing was published. Refreshing the results now."
            );


            closeReview();

            await loadData();

            return;
        }


        /*
            DO NOT change individual results.status.

            Publication is controlled by the
            student_reports row.
        */


        alert(
            "Complete student result published successfully."
        );


        closeReview();


        await loadData();


    } catch (error) {

        console.error(
            "Publish report error:",
            error
        );


        alert(
            `Could not publish report: ${error.message}`
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "Approve & Publish";
    }
}


/* =========================================
   REJECT COMPLETE REPORT
========================================= */

async function rejectCurrentReport() {

    if (!currentReport) {
        return;
    }


    const button =
        $("rejectReportBtn");


    button.disabled =
        true;


    button.textContent =
        "Checking...";


    try {

        /*
            GET FRESH COPY FIRST
        */

        const freshReport =
            await fetchFreshReport(
                currentReport
            );


        if (!freshReport) {

            throw new Error(
                "This report no longer exists."
            );
        }


        if (
            normalize(
                freshReport.status
            )
            !==
            "pending"
        ) {

            alert(
                "This report is no longer pending review. Refreshing the page."
            );


            closeReview();

            await loadData();

            return;
        }


        const confirmed =
            confirm(
                `Reject the COMPLETE result for ${getStudentName(
                    currentReport.student_id
                )}?`
            );


        if (!confirmed) {
            return;
        }


        button.textContent =
            "Rejecting...";


        const {
            data,
            error
        } =
            await supabaseClient
                .from(
                    "student_reports"
                )
                .update({

                    status:
                        "rejected",

                    published_at:
                        null

                })
                .eq(
                    "student_id",
                    currentReport.student_id
                )
                .eq(
                    "class",
                    currentReport.class
                )
                .eq(
                    "term",
                    currentReport.term
                )
                .eq(
                    "session",
                    currentReport.session
                )
                .eq(
                    "status",
                    "pending"
                )
                .select();


        if (error) {
            throw error;
        }


        if (
            !data ||
            data.length !== 1
        ) {

            alert(
                "The report changed before it could be rejected. Nothing was changed."
            );


            closeReview();

            await loadData();

            return;
        }


        /*
            Individual subject result rows
            remain untouched.
        */


        alert(
            "Complete student result rejected."
        );


        closeReview();


        await loadData();


    } catch (error) {

        console.error(
            "Reject report error:",
            error
        );


        alert(
            `Could not reject report: ${error.message}`
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "Reject Report";
    }
}


/* =========================================
   DELETE COMPLETE REPORT
========================================= */

async function deleteCurrentReport() {

    if (!currentReport) {
        return;
    }


    const studentName =
        getStudentName(
            currentReport.student_id
        );


    const firstConfirm =
        confirm(
            `Delete the COMPLETE result for ${studentName}?\n\n` +
            `${currentReport.class} | ${currentReport.term} | ${currentReport.session}\n\n` +
            `This permanently removes all subject results and the report remark.`
        );


    if (!firstConfirm) {
        return;
    }


    const secondConfirm =
        confirm(
            "This action cannot be undone.\n\nAre you sure you want to permanently delete this report?"
        );


    if (!secondConfirm) {
        return;
    }


    const button =
        $("deleteReportBtn");


    button.disabled =
        true;


    button.textContent =
        "Deleting...";


    try {

        /*
            DELETE SUBJECT RESULT ROWS
        */

        const {
            error:
            resultsDeleteError
        } =
            await supabaseClient
                .from("results")
                .delete()
                .eq(
                    "student_id",
                    currentReport.student_id
                )
                .eq(
                    "class",
                    currentReport.class
                )
                .eq(
                    "term",
                    currentReport.term
                )
                .eq(
                    "session",
                    currentReport.session
                );


        if (
            resultsDeleteError
        ) {

            throw resultsDeleteError;
        }


        /*
            DELETE REPORT / REMARK
        */

        const {
            error:
            reportDeleteError
        } =
            await supabaseClient
                .from(
                    "student_reports"
                )
                .delete()
                .eq(
                    "student_id",
                    currentReport.student_id
                )
                .eq(
                    "class",
                    currentReport.class
                )
                .eq(
                    "term",
                    currentReport.term
                )
                .eq(
                    "session",
                    currentReport.session
                );


        if (
            reportDeleteError
        ) {

            throw reportDeleteError;
        }


        alert(
            "Student report deleted successfully."
        );


        closeReview();


        await loadData();


    } catch (error) {

        console.error(
            "Delete report error:",
            error
        );


        alert(
            `Could not delete report: ${error.message}`
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "Delete Report";
    }
}


/* =========================================
   LOAD DATA
========================================= */

async function loadData() {

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
                        id,
                        student_id,
                        class,
                        term,
                        session,
                        remark,
                        status,
                        published_at,
                        created_at
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


        buildReports();


        populateSessionFilter();


        renderReports();


    } catch (error) {

        console.error(
            "Could not load result management:",
            error
        );


        alert(
            `Could not load results: ${error.message}`
        );
    }
}


/* =========================================
   PAGE START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        /*
            ADMIN AUTH FIRST
        */

        const admin =
            await window.adminAuthReady;


        if (!admin) {
            return;
        }


        $("reviewPendingBtn")
            ?.addEventListener(
                "click",
                function () {

                    $("reportSearch").value =
                        "";


                    $("termFilter").value =
                        "";


                    $("sessionFilter").value =
                        "";


                    $("statusFilter").value =
                        "pending";


                    renderReports();
                }
            );


        $("refreshReportsBtn")
            ?.addEventListener(
                "click",
                loadData
            );


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


        $("sessionFilter")
            ?.addEventListener(
                "change",
                renderReports
            );


        $("statusFilter")
            ?.addEventListener(
                "change",
                renderReports
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                function () {

                    $("reportSearch").value =
                        "";


                    $("termFilter").value =
                        "";


                    $("sessionFilter").value =
                        "";


                    $("statusFilter").value =
                        "";


                    renderReports();
                }
            );


        $("closeReviewBtn")
            ?.addEventListener(
                "click",
                closeReview
            );


        $("approveReportBtn")
            ?.addEventListener(
                "click",
                approveCurrentReport
            );


        $("rejectReportBtn")
            ?.addEventListener(
                "click",
                rejectCurrentReport
            );


        $("deleteReportBtn")
            ?.addEventListener(
                "click",
                deleteCurrentReport
            );


        $("menuBtn")
            ?.addEventListener(
                "click",
                function () {

                    $("sidebar")
                        ?.classList
                        .toggle(
                            "active"
                        );
                }
            );


        /*
            Logout is handled by admin-auth.js
        */


        await loadData();
    }
);