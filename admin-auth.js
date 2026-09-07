/* =========================================
   PACSA SHARED ADMIN AUTH GUARD
========================================= */

const PACSA_ADMIN_LOGIN =
    new URL(
        "admin-login.html",
        window.location.href
    ).href;


/*
    Hide Admin page immediately.

    This prevents the page flashing before
    authentication has been checked.
*/

document.documentElement.style.visibility =
    "hidden";


window.currentAdmin =
    null;


/* =========================================
   CLEAR ADMIN STORAGE
========================================= */

function clearAdminStorage() {

    localStorage.removeItem(
        "admin"
    );
}


/* =========================================
   ADMIN LOGOUT
========================================= */

window.adminLogout =
    async function () {

        try {

            await supabaseClient
                .auth
                .signOut();

        } catch (error) {

            console.error(
                "Admin logout error:",
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
   VERIFY ADMIN
========================================= */

window.adminAuthReady =
    (async function () {

        try {

            /*
                1. Require Supabase Auth.
            */

            const {
                data: sessionData,
                error: sessionError
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

                clearAdminStorage();

                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );

                return null;
            }


            /*
                2. Require matching Admin row.
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


            if (
                adminError
            ) {

                throw adminError;
            }


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


            /*
                3. Admin account must be active.
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


                clearAdminStorage();


                alert(
                    "This Admin account is inactive."
                );


                window.location.replace(
                    PACSA_ADMIN_LOGIN
                );


                return null;
            }


            /*
                Admin is valid.
            */

            window.currentAdmin =
                admin;


            localStorage.setItem(
                "admin",
                JSON.stringify(
                    admin
                )
            );


            /*
                Update Admin name automatically
                wherever possible.
            */

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


            /*
                Shared logout support.

                Existing Admin pages already use
                id="logoutBtn".
            */

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


                                if (
                                    !confirmed
                                ) {

                                    return;
                                }


                                await window
                                    .adminLogout();
                            };
                    }
                );


            /*
                Now the page may be shown.
            */

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