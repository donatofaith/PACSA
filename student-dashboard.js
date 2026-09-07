/* =========================================
   PACSA STUDENT DASHBOARD
   SECURE AUTH + PUBLISHED RESULTS + PROFILE
========================================= */

let student = null;
let authUser = null;

let publishedReports = [];
let allResults = [];
let filteredResults = [];
let currentReport = null;


const PROFILE_BUCKET =
    "profile-photos";

const DEFAULT_AVATAR =
    "images/PACSA LOGO.png";

const MAX_PHOTO_SIZE =
    2 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];


const $ = id =>
    document.getElementById(id);


/* =========================================
   HELPERS
========================================= */

function normalize(value) {

    return String(
        value ?? ""
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


function uniqueValues(values) {

    return [
        ...new Set(
            values
                .map(
                    value =>
                        String(
                            value ?? ""
                        ).trim()
                )
                .filter(Boolean)
        )
    ];
}


function getStudentLoginUrl() {

    return new URL(
        "student-login.html",
        window.location.href
    ).href;
}


function getStudentName() {

    if (!student) {
        return "Student";
    }


    return (
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim()
        ||
        "Student"
    );
}


function getGradeClass(grade) {

    const value =
        normalize(
            grade
        );


    if (
        value === "a"
    ) return "grade-a";


    if (
        value === "b"
    ) return "grade-b";


    if (
        value === "c"
    ) return "grade-c";


    if (
        value === "d"
    ) return "grade-d";


    if (
        value === "e"
    ) return "grade-e";


    return "grade-f";
}


function getResultTotal(result) {

    const stored =
        Number(
            result.total
        );


    if (
        Number.isFinite(
            stored
        )
    ) {
        return stored;
    }


    return (
        (Number(result.ca) || 0)
        +
        (Number(result.exam) || 0)
    );
}


/* =========================================
   RESULT MESSAGE
========================================= */

function showMessage(
    message,
    type = "info"
) {

    const element =
        $("resultMessage");


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `result-message show ${type}`;
}


function hideMessage() {

    const element =
        $("resultMessage");


    if (!element) {
        return;
    }


    element.textContent =
        "";


    element.className =
        "result-message";
}


/* =========================================
   PHOTO MESSAGE
========================================= */

function showPhotoMessage(
    message,
    type
) {

    const element =
        $("photoMessage");


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `photo-message show ${type}`;
}


function hidePhotoMessage() {

    const element =
        $("photoMessage");


    if (!element) {
        return;
    }


    element.textContent =
        "";


    element.className =
        "photo-message";
}


/* =========================================
   AUTH GUARD
========================================= */

async function verifyStudentSession() {

    try {

        const {
            data:
            sessionData,

            error:
            sessionError
        } =
            await supabaseClient
                .auth
                .getSession();


        if (
            sessionError
        ) {
            throw sessionError;
        }


        const user =
            sessionData
                ?.session
                ?.user;


        if (!user) {

            localStorage.removeItem(
                "student"
            );


            window.location.replace(
                getStudentLoginUrl()
            );


            return false;
        }


        authUser =
            user;


        /*
            Secure RPC:
            Student gets only their own record.
        */

        const {
            data:
            studentRows,

            error:
            studentError
        } =
            await supabaseClient
                .rpc(
                    "pacsa_get_my_student"
                );


        if (
            studentError
        ) {
            throw studentError;
        }


        const studentData =
            Array.isArray(
                studentRows
            )
                ? studentRows[0]
                : studentRows;


        if (!studentData) {

            await supabaseClient
                .auth
                .signOut();


            localStorage.removeItem(
                "student"
            );


            alert(
                "This account is not linked to a PACSA student record."
            );


            window.location.replace(
                getStudentLoginUrl()
            );


            return false;
        }


        if (
            normalize(
                studentData.status ||
                "active"
            )
            !==
            "active"
        ) {

            await supabaseClient
                .auth
                .signOut();


            localStorage.removeItem(
                "student"
            );


            alert(
                "Your student account is inactive. Contact the school administrator."
            );


            window.location.replace(
                getStudentLoginUrl()
            );


            return false;
        }


        if (
            normalize(
                studentData.portal_status
            )
            !==
            "active"
        ) {

            await supabaseClient
                .auth
                .signOut();


            localStorage.removeItem(
                "student"
            );


            alert(
                "Your Student Portal account is not active."
            );


            window.location.replace(
                getStudentLoginUrl()
            );


            return false;
        }


        student =
            studentData;


        localStorage.setItem(
            "student",
            JSON.stringify(
                studentData
            )
        );


        return true;


    } catch (error) {

        console.error(
            "Student authentication error:",
            error
        );


        localStorage.removeItem(
            "student"
        );


        try {

            await supabaseClient
                .auth
                .signOut();

        } catch (_) {}


        window.location.replace(
            getStudentLoginUrl()
        );


        return false;
    }
}


/* =========================================
   PROFILE DISPLAY
========================================= */

async function displayStudentProfile() {

    if (!student) {
        return;
    }


    const name =
        getStudentName();


    if (
        $("studentName")
    ) {

        $("studentName").textContent =
            name;
    }


    if (
        $("studentId")
    ) {

        $("studentId").textContent =
            student.student_id ||
            "--";
    }


    if (
        $("studentClass")
    ) {

        $("studentClass").textContent =
            student.class ||
            "--";
    }


    if (
        $("studentStatus")
    ) {

        $("studentStatus").textContent =
            student.status ||
            "Active";
    }


    if (
        $("studentMiniName")
    ) {

        $("studentMiniName").textContent =
            name;
    }


    if (
        $("studentMiniId")
    ) {

        $("studentMiniId").textContent =
            student.student_id ||
            "--";
    }


    if (
        $("welcomeName")
    ) {

        $("welcomeName").textContent =
            `Welcome, ${name}`;
    }


    if (
        $("reportStudentName")
    ) {

        $("reportStudentName").textContent =
            name;
    }


    if (
        $("reportStudentId")
    ) {

        $("reportStudentId").textContent =
            student.student_id ||
            "--";
    }


    setProfileImage(
        DEFAULT_AVATAR
    );


    await loadStudentProfilePhoto();
}


/* =========================================
   PROFILE IMAGE
========================================= */

function setProfileImage(url) {

    const mainAvatar =
        $("studentAvatar");


    const miniAvatar =
        $("studentMiniAvatar");


    if (
        mainAvatar
    ) {

        mainAvatar.src =
            url ||
            DEFAULT_AVATAR;


        mainAvatar.onerror =
            () => {

                mainAvatar.onerror =
                    null;

                mainAvatar.src =
                    DEFAULT_AVATAR;
            };
    }


    if (
        miniAvatar
    ) {

        miniAvatar.src =
            url ||
            DEFAULT_AVATAR;


        miniAvatar.onerror =
            () => {

                miniAvatar.onerror =
                    null;

                miniAvatar.src =
                    DEFAULT_AVATAR;
            };
    }
}


/* =========================================
   LOAD PROFILE PHOTO
========================================= */

async function loadStudentProfilePhoto() {

    if (
        !student
            ?.profile_photo_path
    ) {

        setProfileImage(
            DEFAULT_AVATAR
        );

        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .storage
                .from(
                    PROFILE_BUCKET
                )
                .createSignedUrl(
                    student
                        .profile_photo_path,
                    3600
                );


        if (
            error
        ) {
            throw error;
        }


        setProfileImage(
            data?.signedUrl ||
            DEFAULT_AVATAR
        );


    } catch (error) {

        console.error(
            "Profile photo load error:",
            error
        );


        setProfileImage(
            DEFAULT_AVATAR
        );
    }
}


/* =========================================
   PHOTO HELPERS
========================================= */

function getPhotoExtension(file) {

    if (
        file.type ===
        "image/png"
    ) {

        return "png";
    }


    if (
        file.type ===
        "image/webp"
    ) {

        return "webp";
    }


    return "jpg";
}


function buildStudentPhotoPath(
    file
) {

    const extension =
        getPhotoExtension(
            file
        );


    return (
        `students/${authUser.id}/profile.${extension}`
    );
}


async function removeOldProfilePhoto(
    oldPath,
    newPath
) {

    if (
        !oldPath ||
        oldPath ===
        newPath
    ) {

        return;
    }


    const {
        error
    } =
        await supabaseClient
            .storage
            .from(
                PROFILE_BUCKET
            )
            .remove([
                oldPath
            ]);


    if (
        error
    ) {

        console.warn(
            "Old profile photo cleanup failed:",
            error
        );
    }
}


/* =========================================
   UPLOAD PROFILE PHOTO
========================================= */

async function uploadStudentProfilePhoto(
    file
) {

    if (
        !student ||
        !authUser
    ) {

        showPhotoMessage(
            "Your account session is unavailable.",
            "error"
        );

        return;
    }


    if (
        !ALLOWED_PHOTO_TYPES
            .includes(
                file.type
            )
    ) {

        showPhotoMessage(
            "Please choose a JPG, PNG or WebP image.",
            "error"
        );

        return;
    }


    if (
        file.size >
        MAX_PHOTO_SIZE
    ) {

        showPhotoMessage(
            "Profile photo must be 2 MB or smaller.",
            "error"
        );

        return;
    }


    const button =
        $("changePhotoBtn");


    const loading =
        $("photoLoading");


    const input =
        $("profilePhotoInput");


    const oldPath =
        student
            .profile_photo_path ||
        null;


    const newPath =
        buildStudentPhotoPath(
            file
        );


    if (
        button
    ) {

        button.disabled =
            true;
    }


    loading
        ?.classList
        .add(
            "show"
        );


    hidePhotoMessage();


    try {

        const {
            error:
            uploadError
        } =
            await supabaseClient
                .storage
                .from(
                    PROFILE_BUCKET
                )
                .upload(
                    newPath,
                    file,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            true,

                        contentType:
                            file.type
                    }
                );


        if (
            uploadError
        ) {
            throw uploadError;
        }


        /*
            Secure RPC:
            only updates the logged-in
            student's profile photo path.
        */

        const {
            data:
            updated,

            error:
            updateError
        } =
            await supabaseClient
                .rpc(
                    "pacsa_update_student_photo",
                    {
                        p_path:
                            newPath
                    }
                );


        if (
            updateError
        ) {
            throw updateError;
        }


        if (
            !updated
        ) {

            throw new Error(
                "Could not update the student profile record."
            );
        }


        student
            .profile_photo_path =
            newPath;


        localStorage.setItem(
            "student",
            JSON.stringify(
                student
            )
        );


        await removeOldProfilePhoto(
            oldPath,
            newPath
        );


        await loadStudentProfilePhoto();


        showPhotoMessage(
            "Profile photo updated.",
            "success"
        );


    } catch (error) {

        console.error(
            "Profile photo upload error:",
            error
        );


        showPhotoMessage(
            "Could not upload profile photo: " +
            error.message,
            "error"
        );


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;
        }


        loading
            ?.classList
            .remove(
                "show"
            );


        if (
            input
        ) {

            input.value =
                "";
        }
    }
}


/* =========================================
   LOAD PUBLISHED REPORTS
========================================= */

async function loadPublishedReports() {

    hideMessage();


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


    if (
        error
    ) {

        console.error(
            "Published reports error:",
            error
        );


        showMessage(
            "Could not load published reports.",
            "error"
        );


        return;
    }


    publishedReports =
        data || [];


    populateReportFilters();


    if (
        publishedReports.length
    ) {

        currentReport =
            publishedReports[0];


        selectReport(
            currentReport
        );


    } else {

        currentReport =
            null;


        allResults =
            [];


        filteredResults =
            [];


        renderResults();


        showMessage(
            "No published result is available yet.",
            "info"
        );
    }
}


/* =========================================
   REPORT FILTERS
========================================= */

function populateReportFilters() {

    const sessionSelect =
        $("sessionFilter");


    const termSelect =
        $("termFilter");


    if (
        !sessionSelect ||
        !termSelect
    ) {
        return;
    }


    const sessions =
        uniqueValues(
            publishedReports
                .map(
                    report =>
                        report.session
                )
        );


    const terms =
        uniqueValues(
            publishedReports
                .map(
                    report =>
                        report.term
                )
        );


    sessionSelect.innerHTML = `

        <option value="">
            All Sessions
        </option>

        ${sessions
            .map(
                value => `
                    <option value="${escapeHtml(value)}">
                        ${escapeHtml(value)}
                    </option>
                `
            )
            .join("")}
    `;


    termSelect.innerHTML = `

        <option value="">
            All Terms
        </option>

        ${terms
            .map(
                value => `
                    <option value="${escapeHtml(value)}">
                        ${escapeHtml(value)}
                    </option>
                `
            )
            .join("")}
    `;


    sessionSelect
        .addEventListener(
            "change",
            applyReportFilter
        );


    termSelect
        .addEventListener(
            "change",
            applyReportFilter
        );
}


/* =========================================
   APPLY REPORT FILTER
========================================= */

function applyReportFilter() {

    const selectedSession =
        $("sessionFilter")
            ?.value ||
        "";


    const selectedTerm =
        $("termFilter")
            ?.value ||
        "";


    const match =
        publishedReports.find(
            report => {

                const sessionOk =
                    !selectedSession
                    ||
                    normalize(
                        report.session
                    )
                    ===
                    normalize(
                        selectedSession
                    );


                const termOk =
                    !selectedTerm
                    ||
                    normalize(
                        report.term
                    )
                    ===
                    normalize(
                        selectedTerm
                    );


                return (
                    sessionOk &&
                    termOk
                );
            }
        );


    if (
        match
    ) {

        currentReport =
            match;


        selectReport(
            match
        );


    } else {

        currentReport =
            null;


        allResults =
            [];


        filteredResults =
            [];


        renderResults();


        showMessage(
            "No published report matches the selected filters.",
            "info"
        );
    }
}


/* =========================================
   SELECT REPORT
========================================= */

async function selectReport(
    report
) {

    hideMessage();


    if (
        $("reportSession")
    ) {

        $("reportSession").textContent =
            report.session ||
            "--";
    }


    if (
        $("reportTerm")
    ) {

        $("reportTerm").textContent =
            report.term ||
            "--";
    }


    if (
        $("reportClass")
    ) {

        $("reportClass").textContent =
            report.class ||
            "--";
    }


    if (
        $("reportRemark")
    ) {

        $("reportRemark").textContent =
            report.remark ||
            "No remark provided.";
    }


    await loadResultsForReport(
        report
    );
}


/* =========================================
   LOAD REPORT RESULTS
========================================= */

async function loadResultsForReport(
    report
) {

    const {
        data,
        error
    } =
        await supabaseClient
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
            .eq(
                "student_id",
                student.student_id
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
            .order(
                "subject",
                {
                    ascending: true
                }
            );


    if (
        error
    ) {

        console.error(
            "Student result error:",
            error
        );


        showMessage(
            "Could not load this report.",
            "error"
        );


        return;
    }


    allResults =
        data || [];


    filteredResults =
        [...allResults];


    renderResults();

    renderSummary();
}


/* =========================================
   RENDER RESULTS
========================================= */

function renderResults() {

    const body =
        $("resultsTableBody");


    if (!body) {
        return;
    }


    if (
        !filteredResults.length
    ) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="empty-state"
                >
                    No published result found.
                </td>

            </tr>
        `;

        return;
    }


    body.innerHTML =
        filteredResults
            .map(
                result => {

                    const total =
                        getResultTotal(
                            result
                        );


                    const grade =
                        result.grade ||
                        "-";


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    result.subject ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.ca ??
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    result.exam ??
                                    "-"
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        total
                                    )}
                                </strong>
                            </td>

                            <td>
                                <span class="grade-badge ${getGradeClass(
                                    grade
                                )}">
                                    ${escapeHtml(
                                        grade
                                    )}
                                </span>
                            </td>

                            <td>
                                ${
                                    total >= 40
                                        ? "Pass"
                                        : "Needs Improvement"
                                }
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


/* =========================================
   SUMMARY
========================================= */

function renderSummary() {

    const count =
        allResults.length;


    const totalScore =
        allResults.reduce(
            (
                sum,
                result
            ) =>
                sum +
                getResultTotal(
                    result
                ),
            0
        );


    const average =
        count
            ? (
                totalScore /
                count
            ).toFixed(1)
            : "0.0";


    const passed =
        allResults.filter(
            result =>
                getResultTotal(
                    result
                ) >= 40
        ).length;


    if (
        $("subjectCount")
    ) {

        $("subjectCount").textContent =
            count;
    }


    if (
        $("averageScore")
    ) {

        $("averageScore").textContent =
            average;
    }


    if (
        $("passedSubjects")
    ) {

        $("passedSubjects").textContent =
            passed;
    }
}


/* =========================================
   LOGOUT
========================================= */

async function logoutStudent() {

    try {

        await supabaseClient
            .auth
            .signOut();


    } catch (error) {

        console.error(
            "Student logout:",
            error
        );


    } finally {

        localStorage.removeItem(
            "student"
        );


        window.location.replace(
            getStudentLoginUrl()
        );
    }
}


/* =========================================
   EVENTS
========================================= */

function setupEvents() {

    $("logoutBtn")
        ?.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await logoutStudent();
            }
        );


    $("sidebarLogoutBtn")
        ?.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await logoutStudent();
            }
        );


    $("changePhotoBtn")
        ?.addEventListener(
            "click",
            () => {

                $("profilePhotoInput")
                    ?.click();
            }
        );


    $("profilePhotoInput")
        ?.addEventListener(
            "change",
            async event => {

                const file =
                    event
                        .target
                        .files
                        ?.[0];


                if (
                    file
                ) {

                    await uploadStudentProfilePhoto(
                        file
                    );
                }
            }
        );
}


/* =========================================
   START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupEvents();


        const valid =
            await verifyStudentSession();


        if (!valid) {
            return;
        }


        await displayStudentProfile();

        await loadPublishedReports();
    }
);