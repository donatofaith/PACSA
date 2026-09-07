/* =========================================
   PACSA STUDENT DASHBOARD
   AUTH + PUBLISHED RESULTS + PROFILE PHOTO
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

    return String(value ?? "")
        .trim()
        .toLowerCase();
}


function escapeHtml(value) {

    return String(value ?? "")
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


    if (
        student.fullname
    ) {

        return student.fullname;
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
        normalize(grade);


    if (value === "a") {
        return "grade-a";
    }

    if (value === "b") {
        return "grade-b";
    }

    if (value === "c") {
        return "grade-c";
    }

    if (value === "d") {
        return "grade-d";
    }

    if (value === "e") {
        return "grade-e";
    }


    return "grade-f";
}


function getResultTotal(result) {

    const stored =
        Number(
            result.total
        );


    if (
        Number.isFinite(stored)
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


        if (sessionError) {
            throw sessionError;
        }


        const user =
            sessionData?.session?.user;


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


        const {
            data:
            studentData,

            error:
            studentError
        } =
            await supabaseClient
                .from("students")
                .select(`
                    student_id,
                    first_name,
                    last_name,
                    fullname,
                    email,
                    phone,
                    class,
                    status,
                    auth_user_id,
                    portal_status,
                    profile_photo_path
                `)
                .eq(
                    "auth_user_id",
                    user.id
                )
                .maybeSingle();


        if (studentError) {
            throw studentError;
        }


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
            studentData.portal_status ===
            "pending_verification"
        ) {

            const {
                error:
                portalError
            } =
                await supabaseClient
                    .from("students")
                    .update({
                        portal_status:
                            "active"
                    })
                    .eq(
                        "student_id",
                        studentData.student_id
                    );


            if (!portalError) {

                studentData.portal_status =
                    "active";

            } else {

                console.error(
                    "Portal status update error:",
                    portalError
                );
            }
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


    $("reportStudentName").textContent =
        name;


    $("reportStudentId").textContent =
        student.student_id || "--";


    setProfileImage(
        DEFAULT_AVATAR
    );


    await loadStudentProfilePhoto();
}


/* =========================================
   PROFILE IMAGE DISPLAY
========================================= */

function setProfileImage(url) {

    const mainAvatar =
        $("studentAvatar");


    const miniAvatar =
        $("studentMiniAvatar");


    if (mainAvatar) {

        mainAvatar.src =
            url || DEFAULT_AVATAR;


        mainAvatar.onerror =
            () => {

                mainAvatar.onerror =
                    null;

                mainAvatar.src =
                    DEFAULT_AVATAR;
            };
    }


    if (miniAvatar) {

        miniAvatar.src =
            url || DEFAULT_AVATAR;


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
   LOAD PRIVATE PROFILE PHOTO
========================================= */

async function loadStudentProfilePhoto() {

    if (
        !student?.profile_photo_path
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
                    student.profile_photo_path,
                    60 * 60
                );


        if (error) {
            throw error;
        }


        if (
            data?.signedUrl
        ) {

            setProfileImage(
                data.signedUrl
            );

        } else {

            setProfileImage(
                DEFAULT_AVATAR
            );
        }


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
   PHOTO PATH
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


function buildStudentPhotoPath(file) {

    const extension =
        getPhotoExtension(file);


    return (
        `students/${authUser.id}/profile.${extension}`
    );
}


/* =========================================
   DELETE OLD PHOTO IF PATH CHANGES
========================================= */

async function removeOldProfilePhoto(
    oldPath,
    newPath
) {

    if (
        !oldPath ||
        oldPath === newPath
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
        !ALLOWED_PHOTO_TYPES.includes(
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
        student.profile_photo_path ||
        null;


    const newPath =
        buildStudentPhotoPath(
            file
        );


    button.disabled =
        true;


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


        const {
            data:
            updatedStudent,

            error:
            updateError
        } =
            await supabaseClient
                .from(
                    "students"
                )
                .update({
                    profile_photo_path:
                        newPath
                })
                .eq(
                    "student_id",
                    student.student_id
                )
                .eq(
                    "auth_user_id",
                    authUser.id
                )
                .select(`
                    student_id,
                    first_name,
                    last_name,
                    fullname,
                    email,
                    phone,
                    class,
                    status,
                    auth_user_id,
                    portal_status,
                    profile_photo_path
                `)
                .maybeSingle();


        if (
            updateError
        ) {

            throw updateError;
        }


        if (
            !updatedStudent
        ) {

            throw new Error(
                "Could not update the student profile record."
            );
        }


        student =
            updatedStudent;


        localStorage.setItem(
            "student",
            JSON.stringify(
                updatedStudent
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

        button.disabled =
            false;


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
   PROFILE PHOTO EVENTS
========================================= */

$("changePhotoBtn")
    ?.addEventListener(
        "click",
        () => {

            hidePhotoMessage();


            $("profilePhotoInput")
                ?.click();
        }
    );


$("profilePhotoInput")
    ?.addEventListener(
        "change",
        async event => {

            const file =
                event.target
                    .files?.[0];


            if (!file) {
                return;
            }


            await uploadStudentProfilePhoto(
                file
            );
        }
    );


/* =========================================
   LOAD PUBLISHED REPORTS
========================================= */

async function loadPublishedReports() {

    if (!student) {
        return;
    }


    showMessage(
        "Loading your published results..."
    );


    try {

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
                        ascending:
                            false
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

            allResults =
                [];


            filteredResults =
                [];


            currentReport =
                null;


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


/* =========================================
   LOAD RESULT ROWS
========================================= */

async function loadResultRows() {

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
            );


    if (error) {
        throw error;
    }


    allResults =
        data || [];
}


/* =========================================
   POPULATE FILTERS
========================================= */

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

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                session;


            option.textContent =
                session;


            $("sessionFilter")
                .appendChild(
                    option
                );
        }
    );


    $("classFilter").innerHTML = `
        <option value="">
            Select Class
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


            $("classFilter")
                .appendChild(
                    option
                );
        }
    );


    $("termFilter").innerHTML = `
        <option value="">
            Select Term
        </option>
    `;


    terms.forEach(
        term => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                term;


            option.textContent =
                term;


            $("termFilter")
                .appendChild(
                    option
                );
        }
    );


    if (
        !publishedReports.length
    ) {

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


/* =========================================
   APPLY FILTERS
========================================= */

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

                normalize(
                    report.session
                )
                ===
                normalize(
                    selectedSession
                )

                &&

                normalize(
                    report.class
                )
                ===
                normalize(
                    selectedClass
                )

                &&

                normalize(
                    report.term
                )
                ===
                normalize(
                    selectedTerm
                )

                &&

                normalize(
                    report.status
                )
                ===
                "published"
        )
        || null;


    if (
        !currentReport
    ) {

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

                normalize(
                    result.student_id
                )
                ===
                normalize(
                    student.student_id
                )

                &&

                normalize(
                    result.session
                )
                ===
                normalize(
                    selectedSession
                )

                &&

                normalize(
                    result.class
                )
                ===
                normalize(
                    selectedClass
                )

                &&

                normalize(
                    result.term
                )
                ===
                normalize(
                    selectedTerm
                )
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
            "This report is published, but no subject results were found.",
            "warning"
        );


        renderEmptyState(
            "No subject results were found for this report."
        );


        return;
    }


    hideMessage();


    renderResults(
        filteredResults
    );
}


/* =========================================
   RENDER RESULTS
========================================= */

function renderResults(results) {

    $("resultsTable").innerHTML =
        "";


    $("reportResultsTable").innerHTML =
        "";


    let totalScore =
        0;


    let passed =
        0;


    results.forEach(
        result => {

            const total =
                getResultTotal(
                    result
                );


            const grade =
                result.grade ||
                "--";


            const gradeClass =
                getGradeClass(
                    grade
                );


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


            $("resultsTable")
                .insertAdjacentHTML(
                    "beforeend",
                    row
                );


            $("reportResultsTable")
                .insertAdjacentHTML(
                    "beforeend",
                    row
                );
        }
    );


    const average =
        results.length

            ? totalScore /
              results.length

            : 0;


    const roundedAverage =
        Math.round(
            average
        );


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
        currentReport?.remark ||
        "--";
}


/* =========================================
   EMPTY STATE
========================================= */

function renderEmptyState(
    message =
        "No published results available."
) {

    const row = `
        <tr>

            <td
                colspan="5"
                class="empty-row"
            >
                ${escapeHtml(
                    message
                )}
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


/* =========================================
   FILTER EVENTS
========================================= */

$("sessionFilter")
    ?.addEventListener(
        "change",
        applyFilters
    );


$("classFilter")
    ?.addEventListener(
        "change",
        applyFilters
    );


$("termFilter")
    ?.addEventListener(
        "change",
        applyFilters
    );


/* =========================================
   PRINT RESULT
========================================= */

$("printResultBtn")
    ?.addEventListener(
        "click",
        () => {

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


/* =========================================
   LOGOUT
========================================= */

$("logoutBtn")
    ?.addEventListener(
        "click",
        async () => {

            try {

                await supabaseClient
                    .auth
                    .signOut();

            } catch (error) {

                console.error(
                    "Logout error:",
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
    );


/* =========================================
   AUTH WATCHER
========================================= */

supabaseClient
    .auth
    .onAuthStateChange(
        (
            event,
            session
        ) => {

            if (
                event === "SIGNED_OUT" ||
                !session
            ) {

                localStorage.removeItem(
                    "student"
                );
            }
        }
    );


/* =========================================
   START DASHBOARD
========================================= */

async function startStudentDashboard() {

    const allowed =
        await verifyStudentSession();


    if (!allowed) {
        return;
    }


    await displayStudentProfile();


    await loadPublishedReports();
}


startStudentDashboard();