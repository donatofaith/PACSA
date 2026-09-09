/* =========================================
   PACSA SHARED ADMIN AUTH GUARD
========================================= */


const PACSA_ADMIN_LOGIN =
    new URL(
        "admin-login.html",
        window.location.href
    ).href;


const PACSA_ADMIN_SESSION_KEY =
    "pacsa_admin_login_verified";


const PACSA_ADMIN_MAX_SESSION_MS =
    4 * 60 * 60 * 1000;


/* Hide Admin pages until Auth is checked */

document.documentElement.style.visibility =
    "hidden";


window.currentAdmin =
    null;


/* =========================================
   HELPERS
========================================= */

const adminNorm = value =>
    String(value ?? "")
        .trim()
        .toLowerCase();


function clearAdminStorage() {

    localStorage.removeItem(
        "admin"
    );

    sessionStorage.removeItem(
        PACSA_ADMIN_SESSION_KEY
    );
}


function getAdminSessionMarker() {

    try {

        return JSON.parse(
            sessionStorage.getItem(
                PACSA_ADMIN_SESSION_KEY
            ) ||
            "null"
        );

    } catch {

        return null;
    }
}


function hasFreshAdminLogin(
    userId
) {

    const marker =
        getAdminSessionMarker();


    if (
        !marker ||
        marker.userId !== userId ||
        !Number.isFinite(
            Number(
                marker.verifiedAt
            )
        )
    ) {

        return false;
    }


    const age =
        Date.now() -
        Number(
            marker.verifiedAt
        );


    return (
        age >= 0 &&
        age <=
        PACSA_ADMIN_MAX_SESSION_MS
    );
}


function escapeAdminHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function titleCase(value) {

    const text =
        String(value || "");

    return text.charAt(0).toUpperCase() +
        text.slice(1);
}


async function getFunctionErrorMessage(error) {

    let message =
        error?.message ||
        "Unknown error";


    try {

        const response =
            error?.context;


        if (
            response &&
            typeof response.clone ===
                "function"
        ) {

            const payload =
                await response
                    .clone()
                    .json();


            message =
                payload?.error ||
                payload?.message ||
                message;
        }

    } catch {}


    return message;
}


/* =========================================
   LOGOUT
========================================= */

window.adminLogout =
    async function () {

        try {

            await supabaseClient
                .auth
                .signOut();


        } catch (error) {

            console.error(
                "Admin logout:",
                error
            );


        } finally {

            clearAdminStorage();


            window.location.replace(
                PACSA_ADMIN_LOGIN
            );
        }
    };


/* =========================================
   SECURE ADMIN LOOKUP
========================================= */

async function getCurrentAdmin() {

    const {
        data,
        error
    } =
        await supabaseClient
            .rpc(
                "pacsa_get_my_admin"
            );


    if (error)
        throw error;


    return Array.isArray(data)
        ? data[0]
        : data;
}


/* =========================================
   ADMIN AUTH GUARD
========================================= */

window.adminAuthReady =
    (async function () {

        try {

            const {
                data: sessionData,
                error: sessionError
            } =
                await supabaseClient
                    .auth
                    .getSession();


            if (sessionError)
                throw sessionError;


            const user =
                sessionData
                    ?.session
                    ?.user;


            if (!user) {

                clearAdminStorage();

                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );

                return null;
            }


            if (
                !hasFreshAdminLogin(
                    user.id
                )
            ) {

                clearAdminStorage();

                try {
                    await supabaseClient.auth.signOut();
                } catch {}

                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );

                return null;
            }


            const admin =
                await getCurrentAdmin();


            if (!admin) {

                await supabaseClient
                    .auth
                    .signOut();

                clearAdminStorage();

                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );

                return null;
            }


            if (
                adminNorm(
                    admin.status ||
                    "active"
                )
                !== "active"
            ) {

                await supabaseClient
                    .auth
                    .signOut();

                clearAdminStorage();

                alert(
                    "This Admin account is inactive."
                );

                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );

                return null;
            }


            window.currentAdmin =
                admin;


            localStorage.setItem(
                "admin",
                JSON.stringify(
                    admin
                )
            );


            document
                .querySelectorAll(
                    ".admin-info strong, .admin-name"
                )
                .forEach(
                    element => {

                        element.textContent =
                            admin.fullname ||
                            "Administrator";
                    }
                );


            document
                .querySelectorAll(
                    "#logoutBtn, #sidebarLogoutBtn, .logout-link"
                )
                .forEach(
                    button => {

                        button.onclick =
                            async event => {

                                event.preventDefault();

                                const confirmed =
                                    confirm(
                                        "Are you sure you want to logout?"
                                    );

                                if (!confirmed)
                                    return;

                                await window.adminLogout();
                            };
                    }
                );


            document.documentElement.style.visibility =
                "visible";


            return admin;


        } catch (error) {

            console.error(
                "Admin authorization error:",
                error
            );

            clearAdminStorage();

            try {
                await supabaseClient.auth.signOut();
            } catch {}

            window.location.replace(
                PACSA_ADMIN_LOGIN
            );

            return null;
        }
    })();


/* =========================================
   SESSION WATCHER
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

                clearAdminStorage();

                if (
                    !window.location
                        .pathname
                        .endsWith(
                            "admin-login.html"
                        )
                ) {

                    window.location.replace(
                        PACSA_ADMIN_LOGIN
                    );
                }
            }
        }
    );


/* =========================================
   PORTAL ACCESS CARD
========================================= */

function ensurePortalAccessCard() {

    if (
        document.getElementById(
            "portalAccessModal"
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            "style"
        );

    style.textContent = `
        .portal-access-modal {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, .62);
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 99999;
        }

        .portal-access-modal.show {
            display: flex;
        }

        .portal-access-card {
            width: min(560px, 100%);
            background: #fff;
            border-radius: 22px;
            overflow: hidden;
            box-shadow: 0 24px 80px rgba(15, 23, 42, .28);
            font-family: inherit;
        }

        .portal-access-head {
            background: linear-gradient(135deg, #4C1D95, #7C3AED);
            color: #fff;
            padding: 24px;
        }

        .portal-access-head span {
            display: inline-flex;
            background: rgba(255, 255, 255, .16);
            border: 1px solid rgba(255, 255, 255, .24);
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .04em;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .portal-access-head h2 {
            margin: 0;
            font-size: 25px;
            line-height: 1.2;
        }

        .portal-access-body {
            padding: 24px;
        }

        .portal-access-note {
            margin: 0 0 18px;
            color: #4B5563;
            line-height: 1.55;
            font-size: 14px;
        }

        .portal-access-details {
            border: 1px solid #E5E7EB;
            border-radius: 16px;
            overflow: hidden;
            background: #F9FAFB;
        }

        .portal-access-row {
            display: grid;
            grid-template-columns: 145px 1fr;
            gap: 12px;
            padding: 14px 16px;
            border-bottom: 1px solid #E5E7EB;
        }

        .portal-access-row:last-child {
            border-bottom: none;
        }

        .portal-access-row span {
            color: #6B7280;
            font-size: 13px;
            font-weight: 700;
        }

        .portal-access-row strong,
        .portal-access-row a {
            color: #111827;
            font-size: 14px;
            word-break: break-word;
        }

        .portal-access-row a {
            color: #5B21B6;
            text-decoration: none;
            font-weight: 700;
        }

        .portal-access-password {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            background: #FEF3C7;
            padding: 4px 7px;
            border-radius: 7px;
            color: #92400E !important;
        }

        .portal-access-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 20px;
            flex-wrap: wrap;
        }

        .portal-access-actions button {
            border: none;
            border-radius: 11px;
            padding: 11px 16px;
            font-family: inherit;
            font-weight: 800;
            cursor: pointer;
        }

        .portal-copy-btn {
            background: #EDE9FE;
            color: #5B21B6;
        }

        .portal-close-btn {
            background: #5B21B6;
            color: #fff;
        }

        @media(max-width: 560px) {
            .portal-access-row {
                grid-template-columns: 1fr;
                gap: 5px;
            }
        }
    `;


    document.head.appendChild(
        style
    );


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "portalAccessModal";

    modal.className =
        "portal-access-modal";

    modal.innerHTML = `
        <div class="portal-access-card" role="dialog" aria-modal="true">
            <div class="portal-access-head">
                <span id="portalAccessType">Portal Access</span>
                <h2 id="portalAccessTitle">PACSA Portal Access</h2>
            </div>
            <div class="portal-access-body">
                <p class="portal-access-note" id="portalAccessNote"></p>
                <div class="portal-access-details">
                    <div class="portal-access-row">
                        <span>Name</span>
                        <strong id="portalAccessName">--</strong>
                    </div>
                    <div class="portal-access-row">
                        <span>ID</span>
                        <strong id="portalAccessId">--</strong>
                    </div>
                    <div class="portal-access-row">
                        <span>Email</span>
                        <strong id="portalAccessEmail">--</strong>
                    </div>
                    <div class="portal-access-row" id="portalPasswordRow">
                        <span>Temporary Password</span>
                        <strong class="portal-access-password" id="portalAccessPassword">--</strong>
                    </div>
                    <div class="portal-access-row">
                        <span>Login</span>
                        <a id="portalAccessLogin" href="#" target="_blank" rel="noopener">Open login page</a>
                    </div>
                </div>
                <div class="portal-access-actions">
                    <button type="button" class="portal-copy-btn" id="copyPortalAccessBtn">Copy Details</button>
                    <button type="button" class="portal-close-btn" id="closePortalAccessBtn">OK</button>
                </div>
            </div>
        </div>
    `;


    document.body.appendChild(
        modal
    );


    document
        .getElementById(
            "closePortalAccessBtn"
        )
        ?.addEventListener(
            "click",
            () => modal.classList.remove("show")
        );


    modal.addEventListener(
        "click",
        event => {

            if (event.target === modal) {
                modal.classList.remove("show");
            }
        }
    );
}


function getTemporaryPasswordFromMessage(message) {

    const text =
        String(message || "");

    const match =
        text.match(
            /TEMPORARY PASSWORD:\s*([^\n]+)/i
        );

    return match?.[1]?.trim() || "";
}


function showPortalAccessCard(data, context) {

    ensurePortalAccessCard();


    const role =
        context.role;

    const roleTitle =
        titleCase(role);

    const loginUrl =
        new URL(
            role === "student"
                ? "student-login.html"
                : "teacher-login.html",
            window.location.origin
        ).href;

    const password =
        data?.temporary_password ||
        getTemporaryPasswordFromMessage(
            data?.message
        );

    const invited =
        Boolean(data?.invited) &&
        !password;

    const title =
        `PACSA ${roleTitle} Portal`;

    const copyText =
        [
            title,
            "",
            `${roleTitle} Name: ${context.name || "--"}`,
            `${roleTitle} ID: ${context.recordId || "--"}`,
            `Email: ${context.email || "--"}`,
            password
                ? `Temporary Password: ${password}`
                : "Password: Set through email invitation link",
            `Login: ${loginUrl}`
        ].join("\n");


    document.getElementById("portalAccessType").textContent =
        password
            ? "Temporary Login Created"
            : "Portal Invitation Sent";

    document.getElementById("portalAccessTitle").textContent =
        title;

    document.getElementById("portalAccessNote").textContent =
        password
            ? `Email invitation could not be sent, so Portal access was created with a temporary password. Copy these details and give them securely to the ${role}.`
            : data?.message ||
                `Portal invitation sent to ${context.email}.`;

    document.getElementById("portalAccessName").textContent =
        context.name || "--";

    document.getElementById("portalAccessId").textContent =
        context.recordId || "--";

    document.getElementById("portalAccessEmail").textContent =
        context.email || "--";

    document.getElementById("portalAccessPassword").textContent =
        password || "Set through email link";

    document.getElementById("portalPasswordRow").style.display =
        invited
            ? "none"
            : "grid";


    const login =
        document.getElementById("portalAccessLogin");

    login.href =
        loginUrl;

    login.textContent =
        loginUrl;


    const copyButton =
        document.getElementById("copyPortalAccessBtn");

    copyButton.textContent =
        "Copy Details";

    copyButton.onclick =
        async () => {

            try {

                await navigator.clipboard.writeText(
                    copyText
                );

                copyButton.textContent =
                    "Copied";

            } catch {

                prompt(
                    "Copy these Portal access details:",
                    copyText
                );
            }
        };


    document
        .getElementById("portalAccessModal")
        .classList
        .add("show");
}


/* =========================================
   PORTAL ACCESS PROVISIONING
========================================= */

async function sendPortalInvitation(
    role,
    recordId,
    email,
    name,
    button
) {

    if (!email || email === "-") {

        alert(
            `Add a valid email to this ${role} record before creating Portal access.`
        );

        return;
    }


    const confirmed =
        confirm(
            `Create ${role} Portal access for ${name || email}?`
        );


    if (!confirmed)
        return;


    const oldText =
        button?.textContent ||
        "🔐";


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "…";
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .functions
                .invoke(
                    "create-portal-user",
                    {
                        body: {
                            role,
                            record_id:
                                recordId,
                            email
                        }
                    }
                );


        if (error) {

            throw new Error(
                await getFunctionErrorMessage(
                    error
                )
            );
        }


        if (data?.error) {
            throw new Error(
                data.error
            );
        }


        showPortalAccessCard(
            data || {},
            {
                role,
                recordId,
                email,
                name
            }
        );


    } catch (error) {

        console.error(
            "Portal invitation error:",
            error
        );


        alert(
            "Could not create Portal access: " +
            (
                error?.message ||
                "Unknown error"
            )
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                oldText;
        }
    }
}


function addPortalButtonsToRows() {

    const path =
        window.location.pathname;


    const studentPage =
        path.endsWith(
            "students.html"
        );


    const teacherPage =
        path.endsWith(
            "teachers.html"
        );


    if (
        !studentPage &&
        !teacherPage
    ) {
        return;
    }


    const body =
        document.getElementById(
            studentPage
                ? "studentsTableBody"
                : "teachersTableBody"
        );


    if (!body)
        return;


    body
        .querySelectorAll("tr")
        .forEach(row => {

            if (
                row.querySelector(
                    ".portal-access-btn"
                )
            ) {
                return;
            }


            const cells =
                row.querySelectorAll(
                    "td"
                );


            if (cells.length < 2)
                return;


            const name =
                cells[0]
                    ?.querySelector(
                        "strong"
                    )
                    ?.textContent
                    ?.trim() ||
                "";


            const email =
                cells[0]
                    ?.querySelector(
                        ".teacher-name-info span"
                    )
                    ?.textContent
                    ?.trim() ||
                "";


            const recordId =
                cells[1]
                    ?.textContent
                    ?.trim() ||
                "";


            const actions =
                row.querySelector(
                    ".table-action-buttons"
                );


            if (
                !actions ||
                !recordId
            ) {
                return;
            }


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";

            button.className =
                "table-btn portal-access-btn";

            button.title =
                "Create / Send Portal Access";

            button.textContent =
                "🔐";

            button.style.background =
                "#EDE9FE";

            button.style.color =
                "#5B21B6";


            button.addEventListener(
                "click",
                () =>
                    sendPortalInvitation(
                        studentPage
                            ? "student"
                            : "teacher",
                        recordId,
                        email,
                        name,
                        button
                    )
            );


            actions.appendChild(
                button
            );
        });
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        addPortalButtonsToRows();


        const target =
            document.getElementById(
                window.location.pathname
                    .endsWith("students.html")
                    ? "studentsTableBody"
                    : "teachersTableBody"
            );


        if (!target)
            return;


        const observer =
            new MutationObserver(
                addPortalButtonsToRows
            );


        observer.observe(
            target,
            {
                childList: true,
                subtree: true
            }
        );
    }
);
