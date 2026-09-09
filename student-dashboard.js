/* =========================================
   PACSA STUDENT DASHBOARD
   SECURE AUTH + PUBLISHED REPORT CARD ONLY
========================================= */

let student = null;
let authUser = null;
let publishedReports = [];
let allResults = [];
let filteredResults = [];
let currentReport = null;

const PROFILE_BUCKET = "profile-photos";
const DEFAULT_AVATAR = "images/PACSA LOGO.png";
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const $ = id => document.getElementById(id);

function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function uniqueValues(values) {
    return [
        ...new Set(
            values
                .map(value => String(value ?? "").trim())
                .filter(Boolean)
        )
    ];
}

function ordinal(number) {
    const n = Number(number);
    if (!Number.isFinite(n) || n < 1) return "N/A";

    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;

    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

function getStudentLoginUrl() {
    return new URL("student-login.html", window.location.href).href;
}

function getStudentName() {
    if (!student) return "Student";
    return `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
}

function getGradeClass(grade) {
    const value = normalize(grade);

    if (value === "a") return "grade-a";
    if (value === "b") return "grade-b";
    if (value === "c") return "grade-c";
    if (value === "d") return "grade-d";
    if (value === "e") return "grade-e";

    return "grade-f";
}

function getResultTotal(result) {
    const stored = Number(result.total);
    if (Number.isFinite(stored)) return stored;
    return (Number(result.ca) || 0) + (Number(result.exam) || 0);
}

function calculateAverage(results) {
    if (!results.length) return 0;

    const total = results.reduce(
        (sum, result) => sum + getResultTotal(result),
        0
    );

    return total / results.length;
}

function hideDuplicateResultsList() {
    const duplicateCard = document.querySelector(".results-card");
    if (duplicateCard) duplicateCard.style.display = "none";
}

function showMessage(message, type = "info") {
    const element = $("resultMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `result-message show ${type}`;
}

function hideMessage() {
    const element = $("resultMessage");
    if (!element) return;

    element.textContent = "";
    element.className = "result-message";
}

function showPhotoMessage(message, type) {
    const element = $("photoMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `photo-message show ${type}`;
}

function hidePhotoMessage() {
    const element = $("photoMessage");
    if (!element) return;

    element.textContent = "";
    element.className = "photo-message";
}

async function verifyStudentSession() {
    try {
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData?.session?.user;

        if (!user) {
            localStorage.removeItem("student");
            window.location.replace(getStudentLoginUrl());
            return false;
        }

        authUser = user;

        const { data: studentRows, error: studentError } =
            await supabaseClient.rpc("pacsa_get_my_student");

        if (studentError) throw studentError;

        const studentData = Array.isArray(studentRows)
            ? studentRows[0]
            : studentRows;

        if (!studentData) {
            await supabaseClient.auth.signOut();
            localStorage.removeItem("student");
            alert("This account is not linked to a PACSA student record.");
            window.location.replace(getStudentLoginUrl());
            return false;
        }

        if (normalize(studentData.status || "active") !== "active") {
            await supabaseClient.auth.signOut();
            localStorage.removeItem("student");
            alert("Your student account is inactive. Contact the school administrator.");
            window.location.replace(getStudentLoginUrl());
            return false;
        }

        if (normalize(studentData.portal_status) !== "active") {
            await supabaseClient.auth.signOut();
            localStorage.removeItem("student");
            alert("Your Student Portal account is not active.");
            window.location.replace(getStudentLoginUrl());
            return false;
        }

        student = studentData;
        localStorage.setItem("student", JSON.stringify(studentData));
        return true;

    } catch (error) {
        console.error("Student authentication error:", error);
        localStorage.removeItem("student");

        try {
            await supabaseClient.auth.signOut();
        } catch (_) {}

        window.location.replace(getStudentLoginUrl());
        return false;
    }
}

async function displayStudentProfile() {
    if (!student) return;

    const name = getStudentName();

    setText("studentName", name);
    setText("studentId", student.student_id || "--");
    setText("studentClass", student.class || "--");
    setText("studentStatus", student.status || "Active");
    setText("studentMiniName", name);
    setText("studentMiniId", student.student_id || "--");
    setText("welcomeName", `Welcome, ${name}`);
    setText("reportStudentName", name);
    setText("reportStudentId", student.student_id || "--");
    setText("reportStudentClass", student.class || "--");

    setProfileImage(DEFAULT_AVATAR);
    await loadStudentProfilePhoto();
}

function setProfileImage(url) {
    ["studentAvatar", "studentMiniAvatar"].forEach(id => {
        const image = $(id);
        if (!image) return;

        image.src = url || DEFAULT_AVATAR;
        image.onerror = () => {
            image.onerror = null;
            image.src = DEFAULT_AVATAR;
        };
    });
}

async function loadStudentProfilePhoto() {
    if (!student?.profile_photo_path) {
        setProfileImage(DEFAULT_AVATAR);
        return;
    }

    try {
        const { data, error } = await supabaseClient.storage
            .from(PROFILE_BUCKET)
            .createSignedUrl(student.profile_photo_path, 3600);

        if (error) throw error;
        setProfileImage(data?.signedUrl || DEFAULT_AVATAR);

    } catch (error) {
        console.error("Profile photo load error:", error);
        setProfileImage(DEFAULT_AVATAR);
    }
}

function getPhotoExtension(file) {
    if (file.type === "image/png") return "png";
    if (file.type === "image/webp") return "webp";
    return "jpg";
}

function buildStudentPhotoPath(file) {
    return `students/${authUser.id}/profile.${getPhotoExtension(file)}`;
}

async function removeOldProfilePhoto(oldPath, newPath) {
    if (!oldPath || oldPath === newPath) return;

    const { error } = await supabaseClient.storage
        .from(PROFILE_BUCKET)
        .remove([oldPath]);

    if (error) console.warn("Old profile photo cleanup failed:", error);
}

async function uploadStudentProfilePhoto(file) {
    if (!student || !authUser) {
        showPhotoMessage("Your account session is unavailable.", "error");
        return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        showPhotoMessage("Please choose a JPG, PNG or WebP image.", "error");
        return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
        showPhotoMessage("Profile photo must be 2 MB or smaller.", "error");
        return;
    }

    const button = $("changePhotoBtn");
    const loading = $("photoLoading");
    const input = $("profilePhotoInput");
    const oldPath = student.profile_photo_path || null;
    const newPath = buildStudentPhotoPath(file);

    if (button) button.disabled = true;
    loading?.classList.add("show");
    hidePhotoMessage();

    try {
        const { error: uploadError } = await supabaseClient.storage
            .from(PROFILE_BUCKET)
            .upload(newPath, file, {
                cacheControl: "3600",
                upsert: true,
                contentType: file.type
            });

        if (uploadError) throw uploadError;

        const { data: updated, error: updateError } = await supabaseClient
            .rpc("pacsa_update_student_photo", { p_path: newPath });

        if (updateError) throw updateError;
        if (!updated) throw new Error("Could not update the student profile record.");

        student.profile_photo_path = newPath;
        localStorage.setItem("student", JSON.stringify(student));

        await removeOldProfilePhoto(oldPath, newPath);
        await loadStudentProfilePhoto();

        showPhotoMessage("Profile photo updated.", "success");

    } catch (error) {
        console.error("Profile photo upload error:", error);
        showPhotoMessage("Could not upload profile photo: " + error.message, "error");

    } finally {
        if (button) button.disabled = false;
        loading?.classList.remove("show");
        if (input) input.value = "";
    }
}

async function loadPublishedReports() {
    hideMessage();

    const { data, error } = await supabaseClient
        .from("student_reports")
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
        .eq("student_id", student.student_id)
        .eq("status", "published")
        .order("published_at", { ascending: false });

    if (error) {
        console.error("Published reports error:", error);
        showMessage("Could not load published reports.", "error");
        return;
    }

    publishedReports = data || [];
    populateReportFilters();

    if (publishedReports.length) {
        currentReport = publishedReports[0];
        syncFiltersToReport(currentReport);
        await selectReport(currentReport);
    } else {
        currentReport = null;
        allResults = [];
        filteredResults = [];
        renderResults();
        renderSummary("N/A");
        showMessage("No published result is available yet.", "info");
    }
}

function buildOptions(values, placeholder) {
    return `
        <option value="">${placeholder}</option>
        ${values
            .map(value => `
                <option value="${escapeHtml(value)}">
                    ${escapeHtml(value)}
                </option>
            `)
            .join("")}
    `;
}

function populateReportFilters() {
    const sessionSelect = $("sessionFilter");
    const classSelect = $("classFilter");
    const termSelect = $("termFilter");

    if (!sessionSelect || !classSelect || !termSelect) return;

    const sessions = uniqueValues(publishedReports.map(report => report.session));
    const classes = uniqueValues(publishedReports.map(report => report.class));
    const terms = uniqueValues(publishedReports.map(report => report.term));

    sessionSelect.innerHTML = buildOptions(sessions, "Select Session");
    classSelect.innerHTML = buildOptions(classes, "Select Class");
    termSelect.innerHTML = buildOptions(terms, "Select Term");

    sessionSelect.onchange = applyReportFilter;
    classSelect.onchange = applyReportFilter;
    termSelect.onchange = applyReportFilter;
}

function syncFiltersToReport(report) {
    if (!report) return;

    if ($("sessionFilter")) $("sessionFilter").value = report.session || "";
    if ($("classFilter")) $("classFilter").value = report.class || "";
    if ($("termFilter")) $("termFilter").value = report.term || "";
}

function applyReportFilter() {
    const selectedSession = $("sessionFilter")?.value || "";
    const selectedClass = $("classFilter")?.value || "";
    const selectedTerm = $("termFilter")?.value || "";

    const match = publishedReports.find(report => {
        const sessionOk =
            !selectedSession || normalize(report.session) === normalize(selectedSession);

        const classOk =
            !selectedClass || normalize(report.class) === normalize(selectedClass);

        const termOk =
            !selectedTerm || normalize(report.term) === normalize(selectedTerm);

        return sessionOk && classOk && termOk;
    });

    if (match) {
        currentReport = match;
        syncFiltersToReport(match);
        selectReport(match);
    } else {
        currentReport = null;
        allResults = [];
        filteredResults = [];
        renderResults();
        renderSummary("N/A");
        showMessage("No published report matches the selected filters.", "info");
    }
}

async function selectReport(report) {
    hideMessage();

    setText("reportSession", report.session || "--");
    setText("reportTerm", report.term || "--");
    setText("reportStudentClass", report.class || "--");
    setText("reportRemark", report.remark || "No remark provided.");

    await loadResultsForReport(report);
}

async function loadResultsForReport(report) {
    const { data, error } = await supabaseClient
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
        .eq("student_id", student.student_id)
        .eq("class", report.class)
        .eq("term", report.term)
        .eq("session", report.session)
        .order("subject", { ascending: true });

    if (error) {
        console.error("Student result error:", error);
        showMessage("Could not load this report.", "error");
        return;
    }

    allResults = data || [];
    filteredResults = [...allResults];

    renderResults();
    renderSummary("Calculating...");
    await renderPosition(report);
}

function resultRowsHtml() {
    if (!filteredResults.length) {
        return `
            <tr>
                <td colspan="5" class="empty-row">
                    No published result found.
                </td>
            </tr>
        `;
    }

    return filteredResults
        .map(result => {
            const total = getResultTotal(result);
            const grade = result.grade || "-";

            return `
                <tr>
                    <td>${escapeHtml(result.subject || "-")}</td>
                    <td>${escapeHtml(result.ca ?? "-")}</td>
                    <td>${escapeHtml(result.exam ?? "-")}</td>
                    <td><strong>${escapeHtml(total)}</strong></td>
                    <td>
                        <span class="grade-badge ${getGradeClass(grade)}">
                            ${escapeHtml(grade)}
                        </span>
                    </td>
                </tr>
            `;
        })
        .join("");
}

function renderResults() {
    const reportBody = $("reportResultsTable");
    if (reportBody) reportBody.innerHTML = resultRowsHtml();
}

function renderSummary(positionText = "N/A") {
    const count = allResults.length;
    const average = calculateAverage(allResults);
    const averageText = count ? `${average.toFixed(1)}%` : "0%";

    const passed = allResults.filter(
        result => getResultTotal(result) >= 40
    ).length;

    setText("subjects", count);
    setText("average", averageText);
    setText("passedSubjects", passed);
    setText("position", positionText);

    setText("reportSubjects", count);
    setText("reportAverage", averageText);
    setText("reportPassed", passed);
    setText("reportPosition", positionText);
}

async function calculatePositionForReport(report) {
    try {
        const { data: classReports, error: reportsError } = await supabaseClient
            .from("student_reports")
            .select("student_id")
            .eq("class", report.class)
            .eq("term", report.term)
            .eq("session", report.session)
            .eq("status", "published");

        if (reportsError) throw reportsError;

        const studentIds = uniqueValues(
            (classReports || []).map(item => item.student_id)
        );

        if (!studentIds.length) return "N/A";

        const { data: classResults, error: resultsError } = await supabaseClient
            .from("results")
            .select("student_id, ca, exam, total")
            .eq("class", report.class)
            .eq("term", report.term)
            .eq("session", report.session)
            .in("student_id", studentIds);

        if (resultsError) throw resultsError;

        const averages = studentIds
            .map(studentId => {
                const results = (classResults || []).filter(
                    result => normalize(result.student_id) === normalize(studentId)
                );

                return {
                    studentId,
                    average: calculateAverage(results)
                };
            })
            .filter(item => Number.isFinite(item.average));

        averages.sort((a, b) => b.average - a.average);

        let previousAverage = null;
        let previousPosition = 0;

        for (let index = 0; index < averages.length; index += 1) {
            const item = averages[index];
            const sameAverage = previousAverage !== null &&
                Number(item.average.toFixed(2)) === Number(previousAverage.toFixed(2));

            const position = sameAverage
                ? previousPosition
                : index + 1;

            if (normalize(item.studentId) === normalize(student.student_id)) {
                return ordinal(position);
            }

            previousAverage = item.average;
            previousPosition = position;
        }

        return "N/A";

    } catch (error) {
        console.error("Position calculation error:", error);
        return "N/A";
    }
}

async function renderPosition(report) {
    const position = await calculatePositionForReport(report);
    renderSummary(position);
}

function getCleanReportPrintHtml(reportCardHtml) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>PACSA Report Card</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: A4 portrait;
                    margin: 8mm;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    background: #fff;
                    color: #111827;
                    font-family: "Outfit", Arial, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .print-page {
                    width: 100%;
                    max-width: 190mm;
                    min-height: 277mm;
                    margin: 0 auto;
                    background: #fff;
                    padding: 0;
                }

                .report-card {
                    width: 100%;
                    padding: 0;
                    border: none;
                    box-shadow: none;
                    background: #fff;
                }

                .report-header {
                    text-align: center;
                    padding-bottom: 8px;
                    margin-bottom: 12px;
                    border-bottom: 2px solid #111827;
                }

                .report-header img {
                    width: 50px;
                    height: 50px;
                    object-fit: contain;
                    margin-bottom: 4px;
                }

                .report-header h2 {
                    margin: 0;
                    color: #111827;
                    font-size: 24px;
                    line-height: 1.15;
                    letter-spacing: .02em;
                }

                .report-header p {
                    margin: 3px 0 0;
                    font-size: 11px;
                    color: #374151;
                }

                .student-info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .student-info-item,
                .summary-box,
                .remark-display {
                    border: 1px solid #D1D5DB;
                    border-radius: 8px;
                    background: #F9FAFB;
                    break-inside: avoid;
                }

                .student-info-item {
                    padding: 8px 10px;
                }

                .student-info-item span,
                .summary-box span,
                .remark-display span {
                    display: block;
                    margin-bottom: 3px;
                    color: #6B7280;
                    font-size: 8.5px;
                    text-transform: uppercase;
                    letter-spacing: .04em;
                }

                .student-info-item strong,
                .summary-box strong,
                .remark-display strong {
                    display: block;
                    color: #111827;
                    font-size: 11px;
                    line-height: 1.3;
                }

                .table-wrap {
                    width: 100%;
                    overflow: visible;
                }

                table,
                .report-table {
                    width: 100%;
                    min-width: 0 !important;
                    border-collapse: collapse;
                    table-layout: fixed;
                    margin-top: 4px;
                    break-inside: avoid;
                }

                th {
                    background: #374151 !important;
                    color: #fff !important;
                    padding: 7px 6px;
                    font-size: 9px;
                    text-align: center;
                    text-transform: uppercase;
                    letter-spacing: .04em;
                }

                td {
                    padding: 7px 6px;
                    border-bottom: 1px solid #E5E7EB;
                    font-size: 10px;
                    line-height: 1.25;
                    text-align: center;
                }

                th:first-child,
                td:first-child {
                    text-align: left;
                    width: 42%;
                }

                td strong {
                    font-weight: 800;
                }

                .grade-badge {
                    display: inline-flex;
                    min-width: 26px;
                    justify-content: center;
                    padding: 2px 6px;
                    border-radius: 999px;
                    font-size: 9px;
                    font-weight: 800;
                    background: transparent !important;
                    color: #111827 !important;
                }

                .report-summary {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    margin-top: 12px;
                }

                .summary-box {
                    padding: 8px 10px;
                }

                .remark-display {
                    margin-top: 10px;
                    padding: 9px 10px;
                }

                .remark-display strong {
                    min-height: 22px;
                }

                .report-actions-bottom {
                    display: none !important;
                }

                @media print {
                    body {
                        background: #fff !important;
                    }

                    .print-page {
                        margin: 0;
                        width: 100%;
                        max-width: none;
                        min-height: 0;
                    }
                }
            </style>
        </head>
        <body>
            <main class="print-page">
                ${reportCardHtml}
            </main>
        </body>
        </html>
    `;
}

function printCurrentResult() {
    if (!currentReport || !filteredResults.length) {
        showMessage("Select a published result before printing.", "warning");
        return;
    }

    const reportCard = document.querySelector(".report-card");

    if (!reportCard) {
        showMessage("Report card is not ready for printing.", "warning");
        return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1100");

    if (!printWindow) {
        window.print();
        return;
    }

    printWindow.document.open();
    printWindow.document.write(getCleanReportPrintHtml(reportCard.outerHTML));
    printWindow.document.close();

    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
    };
}

async function logoutStudent() {
    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error("Student logout:", error);
    } finally {
        localStorage.removeItem("student");
        window.location.replace(getStudentLoginUrl());
    }
}

function setupEvents() {
    hideDuplicateResultsList();

    $("logoutBtn")?.addEventListener("click", async event => {
        event.preventDefault();
        await logoutStudent();
    });

    $("sidebarLogoutBtn")?.addEventListener("click", async event => {
        event.preventDefault();
        await logoutStudent();
    });

    $("printResultBtn")?.addEventListener("click", printCurrentResult);

    $("changePhotoBtn")?.addEventListener("click", () => {
        $("profilePhotoInput")?.click();
    });

    $("profilePhotoInput")?.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (file) await uploadStudentProfilePhoto(file);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    setupEvents();

    const valid = await verifyStudentSession();
    if (!valid) return;

    await displayStudentProfile();
    await loadPublishedReports();
});
