/* =========================================
   PACSA SETTINGS
   ADMIN AUTH + SUPABASE
========================================= */

let schoolSettings = null;
let sessionTerms = [];

const $ = id =>
    document.getElementById(id);


/* =========================================
   LOAD SETTINGS
========================================= */

async function loadSettings() {

    try {

        const [
            settingsResponse,
            sessionResponse
        ] =
            await Promise.all([

                supabaseClient
                    .from("school_settings")
                    .select(`
                        id,
                        school_name,
                        school_email,
                        school_phone,
                        school_address,
                        updated_at
                    `)
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    )
                    .limit(1)
                    .maybeSingle(),

                supabaseClient
                    .from("sessions_terms")
                    .select(`
                        id,
                        session,
                        term,
                        status,
                        is_current,
                        start_date,
                        end_date
                    `)
                    .order(
                        "start_date",
                        {
                            ascending: false
                        }
                    )

            ]);


        if (
            settingsResponse.error
        ) {

            throw settingsResponse.error;
        }


        if (
            sessionResponse.error
        ) {

            throw sessionResponse.error;
        }


        schoolSettings =
            settingsResponse.data;


        sessionTerms =
            sessionResponse.data || [];


        fillSchoolInformation();

        populateSessionOptions();

        populateTermOptions();

        showCurrentAcademicPeriod();


    } catch (error) {

        console.error(
            "Settings load error:",
            error
        );


        alert(
            "Could not load settings: " +
            error.message
        );
    }
}


/* =========================================
   SCHOOL INFORMATION
========================================= */

function fillSchoolInformation() {

    if (
        !schoolSettings
    ) {

        $("schoolName").value =
            "PACSA School";

        return;
    }


    $("schoolName").value =
        schoolSettings.school_name ||
        "PACSA School";


    $("schoolEmail").value =
        schoolSettings.school_email ||
        "";


    $("schoolPhone").value =
        schoolSettings.school_phone ||
        "";


    $("schoolAddress").value =
        schoolSettings.school_address ||
        "";
}


/* =========================================
   SESSION OPTIONS
========================================= */

function populateSessionOptions() {

    const select =
        $("currentSession");


    const sessions =
        [
            ...new Set(
                sessionTerms
                    .map(
                        item =>
                            item.session
                    )
                    .filter(Boolean)
            )
        ];


    select.innerHTML = `

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


            select.appendChild(
                option
            );
        }
    );
}


/* =========================================
   TERM OPTIONS
========================================= */

function populateTermOptions() {

    const selectedSession =
        $("currentSession")
            .value;


    const select =
        $("currentTerm");


    select.innerHTML = `

        <option value="">
            Select Term
        </option>
    `;


    if (
        !selectedSession
    ) {

        return;
    }


    const terms =
        sessionTerms
            .filter(
                item =>
                    item.session ===
                    selectedSession
            )
            .map(
                item =>
                    item.term
            )
            .filter(Boolean);


    [
        ...new Set(terms)
    ]
        .forEach(
            term => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    term;


                option.textContent =
                    term;


                select.appendChild(
                    option
                );
            }
        );
}


/* =========================================
   CURRENT SESSION / TERM
========================================= */

function showCurrentAcademicPeriod() {

    const current =
        sessionTerms.find(
            item =>
                item.is_current ===
                true
        );


    if (
        !current
    ) {

        return;
    }


    $("currentSession").value =
        current.session;


    populateTermOptions();


    $("currentTerm").value =
        current.term;
}


/* =========================================
   SAVE SCHOOL INFORMATION
========================================= */

async function saveSchoolInformation() {

    const payload = {

        school_name:
            $("schoolName")
                .value
                .trim(),

        school_email:
            $("schoolEmail")
                .value
                .trim() ||
            null,

        school_phone:
            $("schoolPhone")
                .value
                .trim() ||
            null,

        school_address:
            $("schoolAddress")
                .value
                .trim() ||
            null,

        updated_at:
            new Date()
                .toISOString()
    };


    if (
        schoolSettings?.id
    ) {

        const {
            error
        } =
            await supabaseClient
                .from("school_settings")
                .update(
                    payload
                )
                .eq(
                    "id",
                    schoolSettings.id
                );


        if (error) {
            throw error;
        }


    } else {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("school_settings")
                .insert([
                    payload
                ])
                .select()
                .single();


        if (error) {
            throw error;
        }


        schoolSettings =
            data;
    }
}


/* =========================================
   SAVE CURRENT SESSION / TERM
========================================= */

async function saveCurrentAcademicPeriod() {

    const selectedSession =
        $("currentSession")
            .value;


    const selectedTerm =
        $("currentTerm")
            .value;


    if (
        !selectedSession ||
        !selectedTerm
    ) {

        throw new Error(
            "Please select the current session and term."
        );
    }


    const selectedRecord =
        sessionTerms.find(
            item =>
                item.session ===
                selectedSession
                &&
                item.term ===
                selectedTerm
        );


    if (
        !selectedRecord
    ) {

        throw new Error(
            "The selected session and term could not be found."
        );
    }


    /*
        CLEAR CURRENT FLAG FROM EVERY ROW
    */

    const {
        error:
        clearCurrentError
    } =
        await supabaseClient
            .from("sessions_terms")
            .update({
                is_current:
                    false
            })
            .neq(
                "id",
                -1
            );


    if (
        clearCurrentError
    ) {

        throw clearCurrentError;
    }


    /*
        PREVIOUS ACTIVE TERM BECOMES COMPLETED
    */

    const {
        error:
        oldActiveError
    } =
        await supabaseClient
            .from("sessions_terms")
            .update({
                status:
                    "completed"
            })
            .eq(
                "status",
                "active"
            )
            .neq(
                "id",
                selectedRecord.id
            );


    if (
        oldActiveError
    ) {

        throw oldActiveError;
    }


    /*
        SET EXACT TERM CURRENT
    */

    const {
        error:
        currentError
    } =
        await supabaseClient
            .from("sessions_terms")
            .update({

                is_current:
                    true,

                status:
                    "active"

            })
            .eq(
                "id",
                selectedRecord.id
            );


    if (
        currentError
    ) {

        throw currentError;
    }
}


/* =========================================
   SAVE ALL SETTINGS
========================================= */

async function saveSettings() {

    const form =
        $("settingsForm");


    if (
        !form.checkValidity()
    ) {

        form.reportValidity();

        return;
    }


    const button =
        $("saveSettingsBtn");


    button.disabled =
        true;


    button.textContent =
        "Saving...";


    try {

        await saveSchoolInformation();

        await saveCurrentAcademicPeriod();


        await loadSettings();


        alert(
            "Settings saved successfully."
        );


    } catch (error) {

        console.error(
            "Save settings error:",
            error
        );


        alert(
            "Could not save settings: " +
            error.message
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "Save Changes";
    }
}


/* =========================================
   PAGE START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const admin =
            await window.adminAuthReady;


        if (!admin) {
            return;
        }


        $("saveSettingsBtn")
            ?.addEventListener(
                "click",
                saveSettings
            );


        $("currentSession")
            ?.addEventListener(
                "change",
                () => {

                    populateTermOptions();
                }
            );


        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("sidebar")
                        ?.classList
                        .toggle(
                            "active"
                        );
                }
            );


        /*
            Logout handled by admin-auth.js
        */


        await loadSettings();
    }
);