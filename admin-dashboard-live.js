/* =========================================
   PACSA ADMIN DASHBOARD LIVE WIDGETS
   Notifications + dashboard analytics
========================================= */

const PACSA_LIVE = (() => {
    const seenStorageKey = "pacsa_last_seen_application_at";

    const norm = value =>
        String(value ?? "")
            .trim()
            .toLowerCase();

    const escapeHtml = value =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");

    const getTotal = result => {
        const stored = Number(result?.total);

        if (Number.isFinite(stored)) {
            return stored;
        }

        const ca = Number(result?.ca_score ?? result?.ca ?? 0);
        const exam = Number(result?.exam_score ?? result?.exam ?? 0);

        return (Number.isFinite(ca) ? ca : 0) +
            (Number.isFinite(exam) ? exam : 0);
    };

    const fullName = student =>
        `${student?.first_name || ""} ${student?.last_name || ""}`
            .trim() ||
        student?.fullname ||
        student?.student_id ||
        "Student";

    const timeAgo = value => {
        const date = new Date(value || 0);
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (!Number.isFinite(seconds) || seconds < 0) return "Just now";
        if (seconds < 60) return "Just now";

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

        return date.toLocaleDateString();
    };

    function injectStyles() {
        if (document.getElementById("pacsaLiveStyles")) return;

        const style = document.createElement("style");
        style.id = "pacsaLiveStyles";
        style.textContent = `
            .notification-btn { position: relative; }
            .notification-dot.hidden { display: none !important; }
            .pacsa-notification-count {
                position: absolute;
                top: -7px;
                right: -7px;
                min-width: 18px;
                height: 18px;
                padding: 0 5px;
                border-radius: 999px;
                background: #dc2626;
                color: #fff;
                font-size: 11px;
                font-weight: 800;
                display: none;
                align-items: center;
                justify-content: center;
                border: 2px solid #fff;
            }
            .pacsa-notification-panel {
                position: fixed;
                top: 82px;
                right: 28px;
                width: min(360px, calc(100vw - 32px));
                background: #fff;
                border: 1px solid #e5e7eb;
                box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
                border-radius: 18px;
                padding: 16px;
                z-index: 9999;
                display: none;
            }
            .pacsa-notification-panel.active { display: block; }
            .pacsa-notification-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
            }
            .pacsa-notification-header h3 {
                margin: 0;
                font-size: 16px;
            }
            .pacsa-notification-header a {
                color: #5b21b6;
                font-weight: 700;
                text-decoration: none;
                font-size: 13px;
            }
            .pacsa-notification-item {
                display: flex;
                gap: 10px;
                padding: 12px 0;
                border-top: 1px solid #f1f5f9;
            }
            .pacsa-notification-icon {
                width: 34px;
                height: 34px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f3e8ff;
            }
            .pacsa-notification-body strong {
                display: block;
                font-size: 14px;
                color: #111827;
            }
            .pacsa-notification-body span {
                display: block;
                margin-top: 3px;
                color: #64748b;
                font-size: 12px;
                line-height: 1.4;
            }
            .pacsa-notification-empty {
                padding: 16px 0 6px;
                color: #64748b;
                font-size: 14px;
            }
            @media (max-width: 640px) {
                .pacsa-notification-panel {
                    top: 78px;
                    right: 16px;
                    left: 16px;
                    width: auto;
                }
            }
        `;

        document.head.appendChild(style);
    }

    async function loadTable(table) {
        const { data, error } = await supabaseClient
            .from(table)
            .select("*");

        if (error) {
            console.warn(`Could not load ${table}:`, error);
            return [];
        }

        return data || [];
    }

    async function loadLiveData() {
        const [applications, results, students] = await Promise.all([
            loadTable("applications"),
            loadTable("results"),
            loadTable("students"),
        ]);

        updateNotificationBell(applications);
        updateDashboardAnalytics(results, students);
    }

    function updateNotificationBell(applications) {
        const button = document.querySelector(".notification-btn");
        if (!button) return;

        let count = button.querySelector(".pacsa-notification-count");

        if (!count) {
            count = document.createElement("span");
            count.className = "pacsa-notification-count";
            button.appendChild(count);
        }

        const pending = [...applications]
            .filter(app => norm(app.status || "pending") === "pending")
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const latest = pending[0]?.created_at || "";
        const lastSeen = localStorage.getItem(seenStorageKey) || "";
        const unread = pending.filter(app =>
            !lastSeen || new Date(app.created_at || 0) > new Date(lastSeen)
        );

        const dot = button.querySelector(".notification-dot");

        if (pending.length > 0) {
            count.style.display = "flex";
            count.textContent = String(Math.min(unread.length || pending.length, 99));
            dot?.classList.remove("hidden");
        } else {
            count.style.display = "none";
            dot?.classList.add("hidden");
        }

        buildNotificationPanel(pending, latest);
    }

    function buildNotificationPanel(pending, latestCreatedAt) {
        let panel = document.getElementById("pacsaNotificationPanel");

        if (!panel) {
            panel = document.createElement("div");
            panel.id = "pacsaNotificationPanel";
            panel.className = "pacsa-notification-panel";
            document.body.appendChild(panel);
        }

        const items = pending.slice(0, 6);

        panel.innerHTML = `
            <div class="pacsa-notification-header">
                <h3>Notifications</h3>
                <a href="applications.html">Open Applications</a>
            </div>
            ${items.length
                ? items.map(app => `
                    <div class="pacsa-notification-item">
                        <div class="pacsa-notification-icon">📝</div>
                        <div class="pacsa-notification-body">
                            <strong>${escapeHtml(app.full_name || "New applicant")}</strong>
                            <span>
                                Applied for ${escapeHtml(app.class || "a class")} •
                                ${escapeHtml(timeAgo(app.created_at))}
                            </span>
                        </div>
                    </div>
                `).join("")
                : `<div class="pacsa-notification-empty">No pending applications right now.</div>`
            }
        `;

        const button = document.querySelector(".notification-btn");

        button?.addEventListener(
            "click",
            event => {
                event.preventDefault();
                event.stopImmediatePropagation();

                panel.classList.toggle("active");

                if (panel.classList.contains("active") && latestCreatedAt) {
                    localStorage.setItem(seenStorageKey, latestCreatedAt);

                    const count = button.querySelector(".pacsa-notification-count");
                    if (count) count.style.display = "none";
                }
            },
            true
        );

        document.addEventListener("click", event => {
            if (
                panel.classList.contains("active") &&
                !panel.contains(event.target) &&
                !button?.contains(event.target)
            ) {
                panel.classList.remove("active");
            }
        });
    }

    function updateDashboardAnalytics(results, students) {
        const usable = results
            .filter(result => {
                const status = norm(result.status || "published");
                return !["draft", "pending", "rejected"].includes(status);
            })
            .map(result => ({
                ...result,
                _total: getTotal(result),
            }))
            .filter(result => Number.isFinite(result._total) && result._total > 0);

        const numberBoxes = document.querySelectorAll(".performance-number");
        const textBoxes = document.querySelectorAll(".performance-text");

        if (!usable.length) {
            if (numberBoxes[0]) numberBoxes[0].textContent = "0%";
            if (numberBoxes[1]) numberBoxes[1].textContent = "0%";
            if (textBoxes[0]) textBoxes[0].textContent = "--";
            if (textBoxes[1]) textBoxes[1].textContent = "--";
            return;
        }

        const schoolAverage = Math.round(
            usable.reduce((sum, result) => sum + result._total, 0) / usable.length
        );

        const passRate = Math.round(
            (usable.filter(result => result._total >= 40).length / usable.length) * 100
        );

        if (numberBoxes[0]) numberBoxes[0].textContent = `${schoolAverage}%`;
        if (numberBoxes[1]) numberBoxes[1].textContent = `${passRate}%`;

        const byClass = {};
        const byStudent = {};

        usable.forEach(result => {
            const className = result.class || "Unknown";
            const studentId = result.student_id;

            byClass[className] = byClass[className] || [];
            byClass[className].push(result._total);

            if (studentId) {
                byStudent[studentId] = byStudent[studentId] || [];
                byStudent[studentId].push(result._total);
            }
        });

        let bestClass = "--";
        let bestClassAverage = -1;

        Object.entries(byClass).forEach(([className, totals]) => {
            const average = totals.reduce((sum, score) => sum + score, 0) / totals.length;

            if (average > bestClassAverage) {
                bestClassAverage = average;
                bestClass = className;
            }
        });

        let topStudentId = "";
        let topAverage = -1;

        Object.entries(byStudent).forEach(([studentId, totals]) => {
            const average = totals.reduce((sum, score) => sum + score, 0) / totals.length;

            if (average > topAverage) {
                topAverage = average;
                topStudentId = studentId;
            }
        });

        const topStudent = students.find(student =>
            String(student.student_id) === String(topStudentId)
        );

        if (textBoxes[0]) textBoxes[0].textContent = bestClass;
        if (textBoxes[1]) textBoxes[1].textContent = topStudent ? fullName(topStudent) : (topStudentId || "--");
    }

    function start() {
        injectStyles();
        setTimeout(loadLiveData, 900);
        setInterval(loadLiveData, 60000);
    }

    return { start };
})();

document.addEventListener("DOMContentLoaded", PACSA_LIVE.start);
