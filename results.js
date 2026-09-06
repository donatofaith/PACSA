let results = [];
let students = [];
let studentReports = [];
let reports = [];
let currentReport = null;


function $(id) {
    return document.getElementById(id);
}


function normalize(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}


function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function getStudent(studentId) {

    return students.find(
        student =>
            String(student.student_id) ===
            String(studentId)
    );

}


function getStudentName(studentId) {

    const student =
        getStudent(studentId);

    if (!student) {
        return studentId || "Unknown Student";
    }

    return (
        `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
        student.fullname ||
        student.student_id
    );

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


function getGrade(total) {

    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";

    return "F";

}


function getResultTotal(result) {

    const saved =
        Number(result.total);

    if (
        Number.isFinite(saved)
    ) {
        return saved;
    }

    return (
        (Number(result.ca) || 0) +
        (Number(result.exam) || 0)
    );

}



// ============================================
// BUILD COMPLETE REPORTS
// ============================================

function buildReports() {

    const grouped = {};


    results.forEach(result => {

        const key =
            getReportKey(
                result.student_id,
                result.class,
                result.term,
                result.session
            );


        if (!grouped[key]) {

            grouped[key] = {

                key,

                student_id:
                    result.student_id,

                class:
                    result.class,

                term:
                    result.term,

                session:
                    result.session,

                results: []

            };

        }


        grouped[key].results.push(
            result
        );

    });


    reports =
        Object.values(grouped)
            .map(group => {

                const reportRecord =
                    studentReports.find(
                        report =>
                            getReportKey(
                                report.student_id,
                                report.class,
                                report.term,
                                report.session
                            )
                            ===
                            group.key
                    );


                const totals =
                    group.results.map(
                        getResultTotal
                    );


                const average =
                    totals.length
                        ? totals.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) / totals.length
                        : 0;


                let status =
                    reportRecord?.status ||
                    "pending";


                if (!reportRecord) {

                    const statuses =
                        group.results.map(
                            result =>
                                normalize(
                                    result.status ||
                                    "pending"
                                )
                        );


                    if (
                        statuses.length &&
                        statuses.every(
                            value =>
                                value === "published"
                        )
                    ) {

                        status =
                            "published";

                    }

                    else if (
                        statuses.length &&
                        statuses.every(
                            value =>
                                value === "rejected"
                        )
                    ) {

                        status =
                            "rejected";

                    }

                }


                return {

                    ...group,

                    average,

                    passed:
                        totals.filter(
                            score =>
                                score >= 40
                        ).length,

                    failed:
                        totals.filter(
                            score =>
                                score < 40
                        ).length,

                    remark:
                        reportRecord?.remark ||
                        "",

                    status,

                    reportRecord:
                        reportRecord || null

                };

            })
            .sort(
                (a, b) =>
                    String(
                        b.student_id
                    )
                        .localeCompare(
                            String(
                                a.student_id
                            )
                        )
            );

}



// ============================================
// SESSION FILTER
// ============================================

function populateSessionFilter() {

    const select =
        $("sessionFilter");


    const current =
        select.value;


    const sessions =
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


    sessions.forEach(
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
        sessions.includes(
            current
        )
    ) {

        select.value =
            current;

    }

}



// ============================================
// RENDER REPORT LIST
// ============================================

function renderReports() {

    const search =
        normalize(
            $("reportSearch").value
        );


    const term =
        normalize(
            $("termFilter").value
        );


    const session =
        normalize(
            $("sessionFilter").value
        );


    const status =
        normalize(
            $("statusFilter").value
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
                        ].join(" ")
                    );


                return (

                    (
                        !search ||
                        searchable.includes(
                            search
                        )
                    )

                    &&

                    (
                        !term ||
                        normalize(
                            report.term
                        )
                        === term
                    )

                    &&

                    (
                        !session ||
                        normalize(
                            report.session
                        )
                        === session
                    )

                    &&

                    (
                        !status ||
                        normalize(
                            report.status
                        )
                        === status
                    )

                );

            }
        );


    $("reportsTableBody").innerHTML =
        filtered
            .map(
                report => {

                    const statusClass =
                        report.status === "published"
                            ? "active-status"
                            : report.status === "rejected"
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
                                        report.status
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


    $("totalReports").textContent =
        reports.length;


    $("publishedReports").textContent =
        reports.filter(
            report =>
                report.status ===
                "published"
        ).length;


    $("pendingReports").textContent =
        reports.filter(
            report =>
                report.status ===
                "pending"
        ).length;


    $("studentCount").textContent =
        new Set(
            reports.map(
                report =>
                    report.student_id
            )
        ).size;


    $("reportCount").textContent =
        filtered.length;


    $("emptyReportState").style.display =
        filtered.length
            ? "none"
            : "block";

}



// ============================================
// OPEN COMPLETE REPORT
// ============================================

function openReport(key) {

    currentReport =
        reports.find(
            report =>
                report.key === key
        );


    if (!currentReport) {
        return;
    }


    $("reviewStudentName").textContent =
        getStudentName(
            currentReport.student_id
        );


    $("reviewStudentInfo").textContent =
        "Complete academic result";


    $("reviewStudentId").textContent =
        currentReport.student_id ||
        "--";


    $("reviewClass").textContent =
        currentReport.class ||
        "--";


    $("reviewTerm").textContent =
        currentReport.term ||
        "--";


    $("reviewSession").textContent =
        currentReport.session ||
        "--";


    $("reviewStatus").textContent =
        currentReport.status ||
        "pending";


    $("reviewResultBody").innerHTML =
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
                                        result.grade ||
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


    $("reviewSubjects").textContent =
        currentReport.results.length;


    $("reviewAverage").textContent =
        `${currentReport.average.toFixed(1)}%`;


    $("reviewPassed").textContent =
        currentReport.passed;


    $("reviewFailed").textContent =
        currentReport.failed;


    if (
        currentReport.remark
    ) {

        $("reviewRemark").textContent =
            currentReport.remark;


        $("reviewRemark")
            .classList
            .remove(
                "missing-remark"
            );

    } else {

        $("reviewRemark").textContent =
            "No class teacher remark has been submitted yet.";


        $("reviewRemark")
            .classList
            .add(
                "missing-remark"
            );

    }


    /*
     * APPROVE/REJECT only make sense while
     * not already published.
     *
     * DELETE remains available to admin.
     */

    $("approveReportBtn").style.display =
        currentReport.status ===
        "published"
            ? "none"
            : "inline-block";


    $("rejectReportBtn").style.display =
        currentReport.status ===
        "published"
            ? "none"
            : "inline-block";


    $("deleteReportBtn").style.display =
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



// ============================================
// CLOSE REVIEW
// ============================================

function closeReview() {

    currentReport =
        null;


    $("reportReviewPanel")
        .classList
        .remove(
            "show"
        );

}



// ============================================
// APPROVE COMPLETE REPORT
// ============================================

async function approveCurrentReport() {

    if (!currentReport) {
        return;
    }


    if (!currentReport.remark) {

        alert(
            "This report cannot be published yet because the class teacher has not added a Remark."
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


    const button =
        $("approveReportBtn");


    button.disabled =
        true;


    button.textContent =
        "Publishing...";


    try {

        const reportPayload = {

            student_id:
                currentReport.student_id,

            class:
                currentReport.class,

            term:
                currentReport.term,

            session:
                currentReport.session,

            remark:
                currentReport.remark,

            status:
                "published",

            published_at:
                new Date().toISOString()

        };


        const {
            error: reportError
        } =
            await supabaseClient
                .from(
                    "student_reports"
                )
                .upsert(
                    reportPayload,
                    {
                        onConflict:
                            "student_id,class,term,session"
                    }
                );


        if (reportError) {
            throw reportError;
        }


        const {
            error: resultsError
        } =
            await supabaseClient
                .from("results")
                .update({
                    status:
                        "published"
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
                );


        if (resultsError) {
            throw resultsError;
        }


        alert(
            "Complete student result published successfully."
        );


        closeReview();


        await loadData();


    } catch (error) {

        console.error(
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



// ============================================
// REJECT COMPLETE REPORT
// ============================================

async function rejectCurrentReport() {

    if (!currentReport) {
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


    const button =
        $("rejectReportBtn");


    button.disabled =
        true;


    button.textContent =
        "Rejecting...";


    try {

        const reportPayload = {

            student_id:
                currentReport.student_id,

            class:
                currentReport.class,

            term:
                currentReport.term,

            session:
                currentReport.session,

            remark:
                currentReport.remark ||
                null,

            status:
                "rejected",

            published_at:
                null

        };


        const {
            error: reportError
        } =
            await supabaseClient
                .from(
                    "student_reports"
                )
                .upsert(
                    reportPayload,
                    {
                        onConflict:
                            "student_id,class,term,session"
                    }
                );


        if (reportError) {
            throw reportError;
        }


        const {
            error: resultsError
        } =
            await supabaseClient
                .from("results")
                .update({
                    status:
                        "rejected"
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
                );


        if (resultsError) {
            throw resultsError;
        }


        alert(
            "Complete student result rejected."
        );


        closeReview();


        await loadData();


    } catch (error) {

        console.error(
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



// ============================================
// DELETE COMPLETE REPORT
// ============================================

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
            `This will permanently remove all subject results and the report remark.`
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
         * DELETE SUBJECT RESULT ROWS
         */

        const {
            error: resultsDeleteError
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


        if (resultsDeleteError) {
            throw resultsDeleteError;
        }


        /*
         * DELETE REPORT / REMARK ROW
         */

        const {
            error: reportDeleteError
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


        if (reportDeleteError) {
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



// ============================================
// LOAD DATA
// ============================================

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
                    .select("*")
                    .order(
                        "id",
                        {
                            ascending:
                                false
                        }
                    ),

                supabaseClient
                    .from("students")
                    .select(
                        "student_id, first_name, last_name, fullname, class"
                    ),

                supabaseClient
                    .from(
                        "student_reports"
                    )
                    .select("*")

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



// ============================================
// PAGE EVENTS
// ============================================

document.addEventListener(
    "DOMContentLoaded",
    function () {


        $("reviewPendingBtn")
            .addEventListener(
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
            .addEventListener(
                "click",
                loadData
            );


        $("reportSearch")
            .addEventListener(
                "input",
                renderReports
            );


        $("termFilter")
            .addEventListener(
                "change",
                renderReports
            );


        $("sessionFilter")
            .addEventListener(
                "change",
                renderReports
            );


        $("statusFilter")
            .addEventListener(
                "change",
                renderReports
            );


        $("clearFiltersBtn")
            .addEventListener(
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
            .addEventListener(
                "click",
                closeReview
            );


        $("approveReportBtn")
            .addEventListener(
                "click",
                approveCurrentReport
            );


        $("rejectReportBtn")
            .addEventListener(
                "click",
                rejectCurrentReport
            );


        $("deleteReportBtn")
            .addEventListener(
                "click",
                deleteCurrentReport
            );


        $("menuBtn")
            .addEventListener(
                "click",
                function () {

                    $("sidebar")
                        .classList
                        .toggle(
                            "active"
                        );

                }
            );


        $("logoutBtn")
            .addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    if (
                        confirm(
                            "Are you sure you want to logout?"
                        )
                    ) {

                        window.location.href =
                            "login.html";

                    }

                }
            );


        loadData();

    }
);