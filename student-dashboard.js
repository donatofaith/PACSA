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

function printCurrentResult() {
    if (!currentReport || !filteredResults.length) {
        showMessage("Select a published result before printing.", "warning");
        return;
    }

    const report = document.querySelector(".report-wrapper");
    if (!report) {
        showMessage("Report card is not available for printing.", "warning");
        return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
        window.print();
        return;
    }

    const pageStyles = Array.from(document.querySelectorAll("style"))
        .map(style => style.textContent || "")
        .join("\n");

    const reportClone = report.cloneNode(true);
    reportClone.querySelector(".report-actions-bottom")?.remove();

    printWindow.document.open();
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PACSA Report Card</title>
            <style>
                ${pageStyles}

                body {
                    background: #fff !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                .report-wrapper {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    overflow: visible !important;
                }

                .report-card {
                    padding: 16px !important;
                }

                .table-wrap {
                    overflow: visible !important;
                }

                table,
                .report-table {
                    min-width: 0 !important;
                    width: 100% !important;
                }

                .report-actions-bottom {
                    display: none !important;
                }
            </style>
        </head>
        <body>
            ${reportClone.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 350);
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
