/* =========================================
   PACSA ADMIN DASHBOARD
   SUPABASE CONNECTED
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================
       MOBILE SIDEBAR
    ========================================= */

    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");

    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("active");
        });
    }

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 950 && sidebar) {
                sidebar.classList.remove("active");
            }
        });
    });


    /* =========================================
       CURRENT DATE
    ========================================= */

    const currentDate = document.getElementById("currentDate");

    if (currentDate) {
        currentDate.textContent = new Date().toLocaleDateString(
            "en-US",
            {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );
    }


    /* =========================================
       LOAD DASHBOARD
    ========================================= */

    loadDashboard();


    /* =========================================
       LOGOUT
    ========================================= */

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async e => {

            e.preventDefault();

            if (!confirm("Are you sure you want to logout?")) {
                return;
            }

            try {
                if (typeof supabaseClient !== "undefined") {
                    await supabaseClient.auth.signOut();
                }
            } catch (error) {
                console.error("Logout error:", error);
            }

            window.location.href = "login.html";
        });
    }


    /* =========================================
       NOTIFICATIONS
    ========================================= */

    const notificationBtn =
        document.querySelector(".notification-btn");

    if (notificationBtn) {
        notificationBtn.addEventListener("click", () => {
            alert("Your dashboard notifications are up to date.");
        });
    }


    /* =========================================
       CARD ANIMATION
    ========================================= */

    document.querySelectorAll(
        ".dashboard-card, .stat-card"
    ).forEach(card => {

        card.style.opacity = "0";
        card.style.transform = "translateY(15px)";

        setTimeout(() => {
            card.style.transition = "0.5s ease";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, 100);

    });

});


/* =========================================
   DASHBOARD DATA
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
        ] = await Promise.all([

            getData("students"),

            getData("Teachers"),

            getData("subjects"),

            getData("classes"),

            getData("applications"),

            getData("results"),

            getData("sessions_terms")

        ]);


        updateStatistics(
            students,
            teachers,
            subjects,
            classes
        );

        updateApplications(applications);

        updateSchoolStatus(sessions, results);

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
            "PACSA Admin Dashboard connected successfully."
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

async function getData(table) {

    const { data, error } = await supabaseClient
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
        document.querySelectorAll(".stat-card .counter");

    if (counters[0]) {
        animateCounter(
            counters[0],
            students.length
        );
    }

    if (counters[1]) {
        animateCounter(
            counters[1],
            teachers.length
        );
    }

    if (counters[2]) {
        animateCounter(
            counters[2],
            subjects.length
        );
    }

    if (counters[3]) {
        animateCounter(
            counters[3],
            classes.length
        );
    }
}


/* =========================================
   COUNTER ANIMATION
========================================= */

function animateCounter(element, target) {

    target = Number(target) || 0;

    let current = 0;

    if (target === 0) {
        element.textContent = "0";
        return;
    }

    const increment =
        Math.max(1, Math.ceil(target / 50));

    function update() {

        current += increment;

        if (current < target) {

            element.textContent =
                current.toLocaleString();

            requestAnimationFrame(update);

        } else {

            element.textContent =
                target.toLocaleString();

        }
    }

    update();
}


/* =========================================
   RECENT APPLICATIONS
========================================= */

function updateApplications(applications) {

    const tbody =
        document.querySelector(
            ".applications-card tbody"
        );

    if (!tbody) return;

    const recent =
        [...applications]
            .sort(
                (a, b) =>
                    new Date(b.created_at || 0) -
                    new Date(a.created_at || 0)
            )
            .slice(0, 5);


    if (!recent.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="3">
                    No applications yet.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML = recent.map(app => {

        const initials =
            getInitials(app.full_name);

        const status =
            app.status || "pending";

        return `
            <tr>

                <td>
                    <div class="table-person">

                        <div class="avatar">
                            ${escapeHtml(initials)}
                        </div>

                        ${escapeHtml(app.full_name)}

                    </div>
                </td>

                <td>
                    ${escapeHtml(app.class)}
                </td>

                <td>

                    <span class="status-badge ${escapeHtml(status)}">
                        ${escapeHtml(
                            capitalize(status)
                        )}
                    </span>

                </td>

            </tr>
        `;

    }).join("");
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

    if (!rows.length) return;


    const currentSession =
        sessions.find(
            session =>
                session.is_current === true
        );


    if (currentSession) {

        const sessionText =
            rows[0].querySelector("strong");

        const termText =
            rows[1].querySelector("strong");

        if (sessionText) {
            sessionText.textContent =
                currentSession.session || "--";
        }

        if (termText) {
            termText.textContent =
                currentSession.term || "--";
        }
    }


    const pending =
        results.filter(
            result =>
                result.status === "pending"
        ).length;


    const resultStatus =
        rows[2].querySelector(
            ".status-badge"
        );


    if (resultStatus) {

        if (pending > 0) {

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
}


/* =========================================
   PERFORMANCE OVERVIEW
========================================= */

function updatePerformance(
    results,
    students
) {

    const published =
        results.filter(
            result =>
                result.status === "published"
        );


    const performanceNumbers =
        document.querySelectorAll(
            ".performance-number"
        );


    if (!published.length) {

        if (performanceNumbers[0])
            performanceNumbers[0].textContent = "0%";

        if (performanceNumbers[1])
            performanceNumbers[1].textContent = "0%";

    } else {

        const scores =
            published.map(
                result =>
                    Number(result.total) || 0
            );


        const average =
            Math.round(
                scores.reduce(
                    (sum, score) =>
                        sum + score,
                    0
                ) / scores.length
            );


        const passed =
            scores.filter(
                score => score >= 40
            ).length;


        const passRate =
            Math.round(
                (passed / scores.length) * 100
            );


        if (performanceNumbers[0])
            performanceNumbers[0].textContent =
                average + "%";


        if (performanceNumbers[1])
            performanceNumbers[1].textContent =
                passRate + "%";
    }


    /* =====================================
       BEST CLASS
    ===================================== */

    const classScores = {};

    published.forEach(result => {

        const className =
            result.class || "Unknown";

        if (!classScores[className]) {
            classScores[className] = [];
        }

        classScores[className].push(
            Number(result.total) || 0
        );
    });


    let bestClass = "--";
    let bestClassAverage = -1;


    Object.entries(classScores)
        .forEach(([className, scores]) => {

            const average =
                scores.reduce(
                    (a, b) => a + b,
                    0
                ) / scores.length;

            if (average > bestClassAverage) {

                bestClassAverage = average;
                bestClass = className;

            }
        });


    const performanceTexts =
        document.querySelectorAll(
            ".performance-text"
        );


    if (performanceTexts[0]) {
        performanceTexts[0].textContent =
            bestClass;
    }


    /* =====================================
       TOP STUDENT
    ===================================== */

    const studentScores = {};

    published.forEach(result => {

        const id = result.student_id;

        if (!studentScores[id]) {
            studentScores[id] = [];
        }

        studentScores[id].push(
            Number(result.total) || 0
        );
    });


    let topStudentId = null;
    let topAverage = -1;


    Object.entries(studentScores)
        .forEach(([studentId, scores]) => {

            const average =
                scores.reduce(
                    (a, b) => a + b,
                    0
                ) / scores.length;

            if (average > topAverage) {

                topAverage = average;
                topStudentId = studentId;

            }
        });


    let topStudentName = "--";


    if (topStudentId) {

        const student =
            students.find(
                s =>
                    String(s.student_id) ===
                    String(topStudentId)
            );


        if (student) {

            topStudentName =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .trim();

            if (!topStudentName) {
                topStudentName =
                    student.fullname ||
                    topStudentId;
            }
        }
    }


    if (performanceTexts[1]) {
        performanceTexts[1].textContent =
            topStudentName;
    }


    updateAttentionStudents(
        published,
        students
    );
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

    if (!container) return;


    const studentScores = {};


    results.forEach(result => {

        const id = result.student_id;

        if (!studentScores[id]) {
            studentScores[id] = [];
        }

        studentScores[id].push(
            Number(result.total) || 0
        );
    });


    const attention = Object.entries(
        studentScores
    )
        .map(([studentId, scores]) => {

            const average =
                Math.round(
                    scores.reduce(
                        (a, b) => a + b,
                        0
                    ) / scores.length
                );

            return {
                studentId,
                average
            };

        })
        .filter(
            student =>
                student.average < 50
        )
        .sort(
            (a, b) =>
                a.average - b.average
        )
        .slice(0, 5);


    if (!attention.length) {

        container.innerHTML = `
            <div class="attention-item">
                <div class="attention-details">
                    <strong>No students requiring attention</strong>
                    <span>All published results are currently above 50%.</span>
                </div>
            </div>
        `;

        return;
    }


    container.innerHTML =
        attention.map(item => {

            const student =
                students.find(
                    s =>
                        String(s.student_id) ===
                        String(item.studentId)
                );


            const name =
                student
                    ? (
                        `${student.first_name || ""} ${student.last_name || ""}`
                            .trim() ||
                        student.fullname ||
                        item.studentId
                    )
                    : item.studentId;


            const initials =
                getInitials(name);


            const className =
                student?.class || "--";


            const scoreClass =
                item.average < 40
                    ? "low"
                    : "warning";


            return `
                <div class="attention-item">

                    <div class="student-mini-avatar">
                        ${escapeHtml(initials)}
                    </div>

                    <div class="attention-details">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <span>
                            ${escapeHtml(className)}
                        </span>

                    </div>

                    <div class="performance-score ${scoreClass}">
                        ${item.average}%
                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================
   RECENT ACTIVITIES
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

    if (!container) return;


    const activities = [];


    students.forEach(student => {

        if (student.created_at) {

            activities.push({
                type: "student",
                title: "New student registered",
                description:
                    `${getStudentName(student)} was added to the system.`,
                date:
                    new Date(student.created_at)
            });

        }
    });


    teachers.forEach(teacher => {

        if (teacher.created_at) {

            activities.push({
                type: "teacher",
                title: "Teacher added",
                description:
                    `${getTeacherName(teacher)} was added to the system.`,
                date:
                    new Date(teacher.created_at)
            });

        }
    });


    applications.forEach(application => {

        if (application.created_at) {

            activities.push({
                type: "application",
                title: "New admission application",
                description:
                    `${application.full_name} submitted an application.`,
                date:
                    new Date(application.created_at)
            });

        }
    });


    results.forEach(result => {

        if (result.id) {

            activities.push({
                type: "result",
                title: "Result submitted",
                description:
                    `${result.subject || "A subject"} result is in the system.`,
                date:
                    new Date()
            });

        }
    });


    activities.sort(
        (a, b) =>
            b.date - a.date
    );


    const recent =
        activities.slice(0, 4);


    if (!recent.length) {

        container.innerHTML = `
            <div class="activity-item">
                <div class="activity-details">
                    <strong>No recent activities</strong>
                    <p>There is no recent system activity.</p>
                </div>
            </div>
        `;

        return;
    }


    container.innerHTML =
        recent.map(activity => {

            let icon = "📌";
            let color = "purple";


            if (activity.type === "student") {
                icon = "👨‍🎓";
                color = "purple";
            }

            if (activity.type === "teacher") {
                icon = "👨‍🏫";
                color = "green";
            }

            if (activity.type === "result") {
                icon = "📑";
                color = "orange";
            }

            if (activity.type === "application") {
                icon = "📝";
                color = "blue";
            }


            return `
                <div class="activity-item">

                    <div class="activity-icon ${color}">
                        ${icon}
                    </div>

                    <div class="activity-details">

                        <strong>
                            ${escapeHtml(activity.title)}
                        </strong>

                        <p>
                            ${escapeHtml(activity.description)}
                        </p>

                    </div>

                    <span class="activity-time">
                        ${timeAgo(activity.date)}
                    </span>

                </div>
            `;

        }).join("");
}


/* =========================================
   HELPERS
========================================= */

function getStudentName(student) {

    return (
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() ||
        student.fullname ||
        student.student_id ||
        "Student"
    );
}


function getTeacherName(teacher) {

    return (
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim() ||
        teacher.fullname ||
        teacher.teacher_id ||
        "Teacher"
    );
}


function getInitials(name) {

    return String(name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0])
        .join("")
        .toUpperCase() || "?";
}


function capitalize(value) {

    return String(value || "")
        .charAt(0)
        .toUpperCase() +
        String(value || "")
            .slice(1);
}


function timeAgo(date) {

    const seconds =
        Math.floor(
            (Date.now() - new Date(date).getTime())
            / 1000
        );


    if (seconds < 60)
        return "Just now";


    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60)
        return `${minutes} min ago`;


    const hours =
        Math.floor(minutes / 60);

    if (hours < 24)
        return `${hours} hour${hours > 1 ? "s" : ""} ago`;


    const days =
        Math.floor(hours / 24);

    if (days < 7)
        return `${days} day${days > 1 ? "s" : ""} ago`;


    return new Date(date)
        .toLocaleDateString();
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}