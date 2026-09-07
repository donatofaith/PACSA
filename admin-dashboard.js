/* =========================================
   PACSA ADMIN DASHBOARD
   SECURE SUPABASE AUTH VERSION
========================================= */

const $ = id =>
    document.getElementById(id);

let currentAdmin = null;


/* =========================================
   URL
========================================= */

function getAdminLoginUrl() {

    return new URL(
        "admin-login.html",
        window.location.href
    ).href;
}


/* =========================================
   ADMIN AUTH GUARD
========================================= */

async function verifyAdminSession() {

    try {

        const {
            data: sessionData,
            error: sessionError
        } =
            await supabaseClient
                .auth
                .getSession();


        if (sessionError) {
            throw sessionError;
        }


        const user =
            sessionData?.session?.user;


        /*
            No Supabase login = no Admin access.
        */

        if (!user) {

            localStorage.removeItem(
                "admin"
            );

            window.location.replace(
                getAdminLoginUrl()
            );

            return false;
        }


        /*
            Confirm this Auth account exists
            inside PACSA admins table.
        */

        const {
            data: admin,
            error: adminError
        } =
            await supabaseClient
                .from("admins")
                .select("*")
                .eq(
                    "auth_user_id",
                    user.id
                )
                .maybeSingle();


        if (adminError) {
            throw adminError;
        }


        /*
            Logged into Supabase but not an Admin.
        */

        if (!admin) {

            await supabaseClient
                .auth
                .signOut();


            localStorage.removeItem(
                "admin"
            );


            alert(
                "This account does not have PACSA Admin access."
            );


            window.location.replace(
                getAdminLoginUrl()
            );


            return false;
        }


        /*
            Block inactive Admin.
        */

        if (
            String(
                admin.status ||
                "active"
            )
                .trim()
                .toLowerCase()
            !==
            "active"
        ) {

            await supabaseClient
                .auth
                .signOut();


            localStorage.removeItem(
                "admin"
            );


            alert(
                "This Admin account is inactive."
            );


            window.location.replace(
                getAdminLoginUrl()
            );


            return false;
        }


        currentAdmin =
            admin;


        /*
            Compatibility only.

            Auth + admins table is the
            actual security check.
        */

        localStorage.setItem(
            "admin",
            JSON.stringify(
                admin
            )
        );


        displayAdminProfile();


        return true;


    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );


        try {

            await supabaseClient
                .auth
                .signOut();

        } catch {}


        localStorage.removeItem(
            "admin"
        );


        window.location.replace(
            getAdminLoginUrl()
        );


        return false;
    }
}


/* =========================================
   ADMIN PROFILE
========================================= */

function displayAdminProfile() {

    if (!currentAdmin) {
        return;
    }


    const name =
        currentAdmin.fullname ||
        "PACSA Administrator";


    /*
        These only update elements if
        they exist in your HTML.
    */

    if ($("adminName")) {

        $("adminName")
            .textContent =
            name;
    }


    if ($("adminEmail")) {

        $("adminEmail")
            .textContent =
            currentAdmin.email ||
            "--";
    }


    const nameElements =
        document.querySelectorAll(
            ".admin-name"
        );


    nameElements.forEach(
        element => {

            element.textContent =
                name;
        }
    );
}


/* =========================================
   LOGOUT
========================================= */

async function logoutAdmin() {

    const confirmed =
        confirm(
            "Are you sure you want to logout?"
        );


    if (!confirmed) {
        return;
    }


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
            "admin"
        );


        localStorage.removeItem(
            "teacher"
        );


        localStorage.removeItem(
            "student"
        );


        window.location.replace(
            getAdminLoginUrl()
        );
    }
}


/* =========================================
   LOAD DASHBOARD DATA
========================================= */

async function loadDashboard() {

    try {

        const [
            students,
            teachers,
            subjects,
            classes,
            applications,
            results,
            sessions
        ] =
            await Promise.all([

                getData(
                    "students"
                ),

                getData(
                    "Teachers"
                ),

                getData(
                    "subjects"
                ),

                getData(
                    "classes"
                ),

                getData(
                    "applications"
                ),

                getData(
                    "results"
                ),

                getData(
                    "sessions_terms"
                )

            ]);


        updateStatistics(
            students,
            teachers,
            subjects,
            classes
        );


        updateApplications(
            applications
        );


        updateSchoolStatus(
            sessions,
            results
        );


        updatePerformance(
            results,
            students
        );


        updateActivities(
            students,
            teachers,
            applications,
            results
        );


        console.log(
            "PACSA Admin Dashboard loaded."
        );


    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );
    }
}


/* =========================================
   GET DATA
========================================= */

async function getData(
    table
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(table)
            .select("*");


    if (error) {

        console.error(
            `Could not load ${table}:`,
            error
        );

        return [];
    }


    return data || [];
}


/* =========================================
   STATISTICS
========================================= */

function updateStatistics(
    students,
    teachers,
    subjects,
    classes
) {

    const counters =
        document.querySelectorAll(
            ".stat-card .counter"
        );


    const values = [

        students.length,

        teachers.length,

        subjects.length,

        classes.length

    ];


    counters.forEach(
        (
            counter,
            index
        ) => {

            if (
                values[index] !==
                undefined
            ) {

                animateCounter(
                    counter,
                    values[index]
                );
            }
        }
    );
}


/* =========================================
   COUNTER
========================================= */

function animateCounter(
    element,
    target
) {

    target =
        Number(target) ||
        0;


    if (
        target === 0
    ) {

        element.textContent =
            "0";

        return;
    }


    let current =
        0;


    const increment =
        Math.max(
            1,
            Math.ceil(
                target / 40
            )
        );


    function update() {

        current +=
            increment;


        if (
            current <
            target
        ) {

            element.textContent =
                current
                    .toLocaleString();


            requestAnimationFrame(
                update
            );


        } else {

            element.textContent =
                target
                    .toLocaleString();
        }
    }


    update();
}


/* =========================================
   RECENT APPLICATIONS
========================================= */

function updateApplications(
    applications
) {

    const tbody =
        document.querySelector(
            ".applications-card tbody"
        );


    if (!tbody) {
        return;
    }


    const recent =
        [...applications]

            .sort(
                (
                    a,
                    b
                ) =>

                    new Date(
                        b.created_at ||
                        0
                    )

                    -

                    new Date(
                        a.created_at ||
                        0
                    )
            )

            .slice(
                0,
                5
            );


    if (
        !recent.length
    ) {

        tbody.innerHTML = `

            <tr>

                <td colspan="3">
                    No applications yet.
                </td>

            </tr>
        `;

        return;
    }


    tbody.innerHTML =

        recent
            .map(
                app => {

                    const name =
                        app.full_name ||
                        app.fullname ||
                        "Applicant";


                    const initials =
                        getInitials(
                            name
                        );


                    const status =
                        app.status ||
                        "pending";


                    return `

                        <tr>

                            <td>

                                <div class="table-person">

                                    <div class="avatar">
                                        ${escapeHtml(
                                            initials
                                        )}
                                    </div>

                                    ${escapeHtml(
                                        name
                                    )}

                                </div>

                            </td>


                            <td>

                                ${escapeHtml(
                                    app.class ||
                                    "--"
                                )}

                            </td>


                            <td>

                                <span
                                    class="status-badge ${escapeHtml(
                                        status
                                    )}"
                                >

                                    ${escapeHtml(
                                        capitalize(
                                            status
                                        )
                                    )}

                                </span>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


/* =========================================
   SCHOOL STATUS
========================================= */

function updateSchoolStatus(
    sessions,
    results
) {

    const rows =
        document.querySelectorAll(
            ".school-status-card .academic-row"
        );


    if (!rows.length) {
        return;
    }


    const currentSession =
        sessions.find(
            session =>
                session.is_current ===
                true
        );


    if (
        currentSession
    ) {

        const sessionText =
            rows[0]
                ?.querySelector(
                    "strong"
                );


        const termText =
            rows[1]
                ?.querySelector(
                    "strong"
                );


        if (
            sessionText
        ) {

            sessionText.textContent =
                currentSession.session ||
                "--";
        }


        if (
            termText
        ) {

            termText.textContent =
                currentSession.term ||
                "--";
        }
    }


    const pending =

        results
            .filter(
                result =>
                    String(
                        result.status ||
                        ""
                    )
                        .toLowerCase()
                    ===
                    "pending"
            )
            .length;


    const resultStatus =
        rows[2]
            ?.querySelector(
                ".status-badge"
            );


    if (!resultStatus) {
        return;
    }


    if (
        pending > 0
    ) {

        resultStatus.textContent =
            `${pending} Pending`;


        resultStatus.className =
            "status-badge pending";


    } else {

        resultStatus.textContent =
            "Up to date";


        resultStatus.className =
            "status-badge active-status";
    }
}


/* =========================================
   PERFORMANCE
========================================= */

function updatePerformance(
    results,
    students
) {

    const published =

        results
            .filter(
                result =>

                    String(
                        result.status ||
                        ""
                    )
                        .trim()
                        .toLowerCase()

                    ===

                    "published"
            );


    const numbers =
        document.querySelectorAll(
            ".performance-number"
        );


    if (
        !published.length
    ) {

        if (
            numbers[0]
        ) {

            numbers[0]
                .textContent =
                "0%";
        }


        if (
            numbers[1]
        ) {

            numbers[1]
                .textContent =
                "0%";
        }


        updatePerformanceNames(
            [],
            students
        );


        updateAttentionStudents(
            [],
            students
        );


        return;
    }


    const scores =
        published
            .map(
                result =>
                    Number(
                        result.total
                    ) ||
                    0
            );


    const average =
        Math.round(

            scores.reduce(
                (
                    total,
                    score
                ) =>
                    total +
                    score,
                0
            )

            /

            scores.length
        );


    const passed =
        scores
            .filter(
                score =>
                    score >= 40
            )
            .length;


    const passRate =
        Math.round(
            (
                passed /
                scores.length
            )
            *
            100
        );


    if (
        numbers[0]
    ) {

        numbers[0]
            .textContent =
            `${average}%`;
    }


    if (
        numbers[1]
    ) {

        numbers[1]
            .textContent =
            `${passRate}%`;
    }


    updatePerformanceNames(
        published,
        students
    );


    updateAttentionStudents(
        published,
        students
    );
}


/* =========================================
   BEST CLASS + TOP STUDENT
========================================= */

function updatePerformanceNames(
    published,
    students
) {

    const texts =
        document.querySelectorAll(
            ".performance-text"
        );


    const classScores =
        {};


    published.forEach(
        result => {

            const className =
                result.class ||
                "Unknown";


            if (
                !classScores[
                    className
                ]
            ) {

                classScores[
                    className
                ] = [];
            }


            classScores[
                className
            ]
                .push(
                    Number(
                        result.total
                    ) ||
                    0
                );
        }
    );


    let bestClass =
        "--";


    let bestAverage =
        -1;


    Object.entries(
        classScores
    )
        .forEach(
            ([
                className,
                scores
            ]) => {

                const average =

                    scores.reduce(
                        (
                            total,
                            value
                        ) =>
                            total +
                            value,
                        0
                    )

                    /

                    scores.length;


                if (
                    average >
                    bestAverage
                ) {

                    bestAverage =
                        average;


                    bestClass =
                        className;
                }
            }
        );


    if (
        texts[0]
    ) {

        texts[0]
            .textContent =
            bestClass;
    }


    const studentScores =
        {};


    published.forEach(
        result => {

            const id =
                result.student_id;


            if (!id) {
                return;
            }


            if (
                !studentScores[id]
            ) {

                studentScores[id] =
                    [];
            }


            studentScores[id]
                .push(
                    Number(
                        result.total
                    ) ||
                    0
                );
        }
    );


    let topStudentId =
        null;


    let topAverage =
        -1;


    Object.entries(
        studentScores
    )
        .forEach(
            ([
                id,
                scores
            ]) => {

                const average =

                    scores.reduce(
                        (
                            total,
                            value
                        ) =>
                            total +
                            value,
                        0
                    )

                    /

                    scores.length;


                if (
                    average >
                    topAverage
                ) {

                    topAverage =
                        average;


                    topStudentId =
                        id;
                }
            }
        );


    let topStudentName =
        "--";


    if (
        topStudentId
    ) {

        const student =
            students.find(
                item =>
                    String(
                        item.student_id
                    )
                    ===
                    String(
                        topStudentId
                    )
            );


        if (
            student
        ) {

            topStudentName =
                getStudentName(
                    student
                );
        }
    }


    if (
        texts[1]
    ) {

        texts[1]
            .textContent =
            topStudentName;
    }
}


/* =========================================
   STUDENTS REQUIRING ATTENTION
========================================= */

function updateAttentionStudents(
    results,
    students
) {

    const container =
        document.querySelector(
            ".attention-list"
        );


    if (!container) {
        return;
    }


    const scoreMap =
        {};


    results.forEach(
        result => {

            const id =
                result.student_id;


            if (!id) {
                return;
            }


            if (
                !scoreMap[id]
            ) {

                scoreMap[id] =
                    [];
            }


            scoreMap[id]
                .push(
                    Number(
                        result.total
                    ) ||
                    0
                );
        }
    );


    const attention =

        Object.entries(
            scoreMap
        )

            .map(
                ([
                    studentId,
                    scores
                ]) => ({

                    studentId,

                    average:
                        Math.round(

                            scores.reduce(
                                (
                                    total,
                                    score
                                ) =>
                                    total +
                                    score,
                                0
                            )

                            /

                            scores.length
                        )

                })
            )

            .filter(
                student =>
                    student.average <
                    50
            )

            .sort(
                (
                    a,
                    b
                ) =>
                    a.average -
                    b.average
            )

            .slice(
                0,
                5
            );


    if (
        !attention.length
    ) {

        container.innerHTML = `

            <div class="attention-item">

                <div class="attention-details">

                    <strong>
                        No students requiring attention
                    </strong>

                    <span>
                        No published student average is currently below 50%.
                    </span>

                </div>

            </div>
        `;


        return;
    }


    container.innerHTML =

        attention
            .map(
                item => {

                    const student =
                        students.find(
                            row =>
                                String(
                                    row.student_id
                                )
                                ===
                                String(
                                    item.studentId
                                )
                        );


                    const name =
                        student
                            ? getStudentName(
                                student
                            )
                            : item.studentId;


                    const className =
                        student?.class ||
                        "--";


                    const scoreClass =
                        item.average < 40
                            ? "low"
                            : "warning";


                    return `

                        <div class="attention-item">

                            <div class="student-mini-avatar">
                                ${escapeHtml(
                                    getInitials(
                                        name
                                    )
                                )}
                            </div>


                            <div class="attention-details">

                                <strong>
                                    ${escapeHtml(
                                        name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        className
                                    )}
                                </span>

                            </div>


                            <div
                                class="performance-score ${scoreClass}"
                            >
                                ${item.average}%
                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================
   RECENT ACTIVITY
========================================= */

function updateActivities(
    students,
    teachers,
    applications,
    results
) {

    const container =
        document.querySelector(
            ".activity-list"
        );


    if (!container) {
        return;
    }


    const activities =
        [];


    students.forEach(
        student => {

            if (
                student.created_at
            ) {

                activities.push({

                    icon:
                        "👨‍🎓",

                    color:
                        "purple",

                    title:
                        "New student registered",

                    description:
                        `${getStudentName(
                            student
                        )} was added to the system.`,

                    date:
                        new Date(
                            student.created_at
                        )

                });
            }
        }
    );


    teachers.forEach(
        teacher => {

            if (
                teacher.created_at
            ) {

                activities.push({

                    icon:
                        "👨‍🏫",

                    color:
                        "green",

                    title:
                        "Teacher added",

                    description:
                        `${getTeacherName(
                            teacher
                        )} was added to the system.`,

                    date:
                        new Date(
                            teacher.created_at
                        )

                });
            }
        }
    );


    applications.forEach(
        app => {

            if (
                app.created_at
            ) {

                const name =
                    app.full_name ||
                    app.fullname ||
                    "Applicant";


                activities.push({

                    icon:
                        "📝",

                    color:
                        "blue",

                    title:
                        "New admission application",

                    description:
                        `${name} submitted an application.`,

                    date:
                        new Date(
                            app.created_at
                        )

                });
            }
        }
    );


    const recent =

        activities

            .sort(
                (
                    a,
                    b
                ) =>
                    b.date -
                    a.date
            )

            .slice(
                0,
                4
            );


    if (
        !recent.length
    ) {

        container.innerHTML = `

            <div class="activity-item">

                <div class="activity-details">

                    <strong>
                        No recent activities
                    </strong>

                    <p>
                        There is no recent system activity.
                    </p>

                </div>

            </div>
        `;


        return;
    }


    container.innerHTML =

        recent
            .map(
                activity => `

                    <div class="activity-item">

                        <div
                            class="activity-icon ${activity.color}"
                        >
                            ${activity.icon}
                        </div>


                        <div class="activity-details">

                            <strong>
                                ${escapeHtml(
                                    activity.title
                                )}
                            </strong>

                            <p>
                                ${escapeHtml(
                                    activity.description
                                )}
                            </p>

                        </div>


                        <span class="activity-time">
                            ${timeAgo(
                                activity.date
                            )}
                        </span>

                    </div>
                `
            )
            .join("");
}


/* =========================================
   HELPERS
========================================= */

function getStudentName(
    student
) {

    return (

        `${student?.first_name || ""} ${student?.last_name || ""}`
            .trim()

        ||

        student?.fullname

        ||

        student?.student_id

        ||

        "Student"
    );
}


function getTeacherName(
    teacher
) {

    return (

        `${teacher?.first_name || ""} ${teacher?.last_name || ""}`
            .trim()

        ||

        teacher?.fullname

        ||

        teacher?.teacher_id

        ||

        "Teacher"
    );
}


function getInitials(
    name
) {

    return String(
        name ||
        ""
    )
        .trim()
        .split(/\s+/)
        .slice(
            0,
            2
        )
        .map(
            word =>
                word[0]
        )
        .join("")
        .toUpperCase()

        ||

        "?";
}


function capitalize(
    value
) {

    value =
        String(
            value ||
            ""
        );


    return (
        value
            .charAt(0)
            .toUpperCase()

        +

        value
            .slice(1)
    );
}


function escapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function timeAgo(
    date
) {

    const seconds =
        Math.floor(
            (
                Date.now() -
                new Date(
                    date
                ).getTime()
            )
            /
            1000
        );


    if (
        seconds < 60
    ) {

        return "Just now";
    }


    const minutes =
        Math.floor(
            seconds /
            60
        );


    if (
        minutes < 60
    ) {

        return `${minutes} min ago`;
    }


    const hours =
        Math.floor(
            minutes /
            60
        );


    if (
        hours < 24
    ) {

        return `${hours} hour${
            hours === 1
                ? ""
                : "s"
        } ago`;
    }


    const days =
        Math.floor(
            hours /
            24
        );


    if (
        days < 7
    ) {

        return `${days} day${
            days === 1
                ? ""
                : "s"
        } ago`;
    }


    return new Date(
        date
    )
        .toLocaleDateString();
}


/* =========================================
   AUTH STATE
========================================= */

supabaseClient
    .auth
    .onAuthStateChange(
        (
            event,
            session
        ) => {

            if (
                event ===
                "SIGNED_OUT"

                ||

                !session
            ) {

                localStorage.removeItem(
                    "admin"
                );
            }
        }
    );


/* =========================================
   START ADMIN DASHBOARD
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
            AUTH MUST PASS FIRST.
        */

        const allowed =
            await verifyAdminSession();


        if (!allowed) {
            return;
        }


        /*
            MOBILE SIDEBAR
        */

        const menuBtn =
            $("menuBtn");


        const sidebar =
            $("sidebar");


        if (
            menuBtn &&
            sidebar
        ) {

            menuBtn.addEventListener(
                "click",
                () => {

                    sidebar
                        .classList
                        .toggle(
                            "active"
                        );
                }
            );
        }


        document
            .querySelectorAll(
                ".nav-link"
            )
            .forEach(
                link => {

                    link.addEventListener(
                        "click",
                        () => {

                            if (
                                window.innerWidth <=
                                950

                                &&

                                sidebar
                            ) {

                                sidebar
                                    .classList
                                    .remove(
                                        "active"
                                    );
                            }
                        }
                    );
                }
            );


        /*
            CURRENT DATE
        */

        const currentDate =
            $("currentDate");


        if (
            currentDate
        ) {

            currentDate.textContent =

                new Date()
                    .toLocaleDateString(
                        "en-US",
                        {

                            weekday:
                                "long",

                            year:
                                "numeric",

                            month:
                                "long",

                            day:
                                "numeric"

                        }
                    );
        }


        /*
            LOGOUT
        */

        $("logoutBtn")
            ?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    logoutAdmin();
                }
            );


        $("sidebarLogoutBtn")
            ?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    logoutAdmin();
                }
            );


        /*
            NOTIFICATIONS
        */

        document
            .querySelector(
                ".notification-btn"
            )
            ?.addEventListener(
                "click",
                () => {

                    alert(
                        "Your dashboard notifications are up to date."
                    );
                }
            );


        /*
            LOAD DATA ONLY AFTER AUTH.
        */

        await loadDashboard();


        /*
            CARD ANIMATION
        */

        document
            .querySelectorAll(
                ".dashboard-card, .stat-card"
            )
            .forEach(
                card => {

                    card.style.opacity =
                        "0";


                    card.style.transform =
                        "translateY(15px)";


                    setTimeout(
                        () => {

                            card.style.transition =
                                "0.5s ease";


                            card.style.opacity =
                                "1";


                            card.style.transform =
                                "translateY(0)";

                        },
                        100
                    );
                }
            );
    }
);