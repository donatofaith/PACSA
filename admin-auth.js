/* =========================================
   PACSA SHARED ADMIN AUTH GUARD
========================================= */


const PACSA_ADMIN_LOGIN =
    new URL(
        "admin-login.html",
        window.location.href
    ).href;


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
               2. REQUIRE PACSA ADMIN RECORD
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
               3. REQUIRE ACTIVE ADMIN
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
               4. ADMIN VALID
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