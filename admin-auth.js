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

            /* =====================================
               1. REQUIRE AUTH SESSION
            ===================================== */

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


            /* =====================================
               2. REQUIRE EXPLICIT ADMIN LOGIN
            ===================================== */

            if (
                !hasFreshAdminLogin(
                    user.id
                )
            ) {

                clearAdminStorage();


                try {

                    await supabaseClient
                        .auth
                        .signOut();

                } catch {}


                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );


                return null;
            }


            /* =====================================
               3. REQUIRE PACSA ADMIN RECORD
            ===================================== */

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


            /* =====================================
               4. REQUIRE ACTIVE ADMIN
            ===================================== */

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


            /* =====================================
               5. ADMIN VALID
            ===================================== */

            window.currentAdmin =
                admin;


            localStorage.setItem(
                "admin",
                JSON.stringify(
                    admin
                )
            );


            /* =====================================
               ADMIN DISPLAY NAME
            ===================================== */

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


            /* =====================================
               LOGOUT BUTTONS
            ===================================== */

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


                                await window
                                    .adminLogout();
                            };
                    }
                );


            /* =====================================
               SHOW PAGE
            ===================================== */

            document
                .documentElement
                .style
                .visibility =
                "visible";


            return admin;


        } catch (error) {

            console.error(
                "Admin authorization error:",
                error
            );


            clearAdminStorage();


            try {

                await supabaseClient
                    .auth
                    .signOut();

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
                event ===
                "SIGNED_OUT"

                ||

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
   PORTAL ACCESS PROVISIONING
========================================= */

async function sendPortalInvitation(
    role,
    recordId,
    email,
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
            `Send a ${role} Portal invitation to ${email}?`
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


        alert(
            data?.message ||
            "Portal invitation sent successfully."
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
