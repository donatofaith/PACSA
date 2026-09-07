/* =========================================
   PACSA SESSIONS & TERMS
   ADMIN AUTH + CURRENT TERM CONTROL
========================================= */

let sessions = [];

const $ = id =>
    document.getElementById(id);


/* =========================================
   START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const admin =
            await window.adminAuthReady;

        if (!admin) return;


        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {
                    $("sidebar")
                        ?.classList
                        .toggle("active");
                }
            );


        $("sessionSearch")
            ?.addEventListener(
                "input",
                renderSessions
            );


        $("statusFilter")
            ?.addEventListener(
                "change",
                renderSessions
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("sessionSearch").value = "";
                    $("statusFilter").value = "";

                    renderSessions();
                }
            );


        $("addSessionBtn")
            ?.addEventListener(
                "click",
                () => openSessionModal()
            );


        $("emptyAddSessionBtn")
            ?.addEventListener(
                "click",
                () => openSessionModal()
            );


        $("closeSessionModal")
            ?.addEventListener(
                "click",
                closeSessionModal
            );


        $("cancelSessionBtn")
            ?.addEventListener(
                "click",
                closeSessionModal
            );


        $("sessionModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("sessionModal")
                    ) {
                        closeSessionModal();
                    }
                }
            );


        $("sessionForm")
            ?.addEventListener(
                "submit",
                saveSession
            );


        await loadSessions();
    }
);


/* =========================================
   LOAD SESSIONS
========================================= */

async function loadSessions() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("sessions_terms")
            .select(`
                id,
                session,
                term,
                start_date,
                end_date,
                status,
                is_current,
                created_at
            `)
            .order(
                "start_date",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Load sessions error:",
            error
        );

        alert(
            "Could not load sessions: " +
            error.message
        );

        return;
    }


    sessions =
        data || [];


    renderSessions();

    updateStatistics();
}


/* =========================================
   RENDER TABLE
========================================= */

function renderSessions() {

    const search =
        String(
            $("sessionSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedStatus =
        $("statusFilter")
            ?.value || "";


    const filtered =
        sessions.filter(
            item => {

                const searchable =
                    `${item.session || ""} ${item.term || ""}`
                        .toLowerCase();


                return (
                    searchable.includes(search)
                    &&
                    (
                        !selectedStatus
                        ||
                        item.status === selectedStatus
                    )
                );
            }
        );


    const body =
        $("sessionsTableBody");


    if (!body) return;


    body.innerHTML =
        filtered
            .map(
                item => {

                    const status =
                        item.status || "upcoming";


                    return `

                        <tr>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        item.session || "-"
                                    )}
                                </strong>
                            </td>


                            <td>
                                ${escapeHtml(
                                    item.term || "-"
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    item.start_date
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    item.end_date
                                )}
                            </td>


                            <td>

                                <span
                                    class="status-badge ${
                                        status === "active"
                                            ? "active-status"
                                            : status === "completed"
                                                ? "completed"
                                                : "pending"
                                    }"
                                >
                                    ${escapeHtml(
                                        capitalize(status)
                                    )}
                                </span>

                            </td>


                            <td>

                                ${
                                    item.is_current

                                        ? `
                                            <span
                                                class="status-badge active-status"
                                            >
                                                ✓ Current
                                            </span>
                                        `

                                        : `
                                            <span>
                                                -
                                            </span>
                                        `
                                }

                            </td>


                            <td>

                                <div class="table-action-buttons">

                                    ${
                                        !item.is_current

                                            ? `
                                                <button
                                                    type="button"
                                                    class="table-btn view-table-btn"
                                                    onclick="setCurrentSession('${item.id}')"
                                                    title="Make Current"
                                                >
                                                    ✓
                                                </button>
                                            `

                                            : `
                                                <button
                                                    type="button"
                                                    class="table-btn view-table-btn"
                                                    disabled
                                                    title="Current Term"
                                                >
                                                    ✓
                                                </button>
                                            `
                                    }


                                    <button
                                        type="button"
                                        class="table-btn edit-table-btn"
                                        onclick="editSession('${item.id}')"
                                        title="Edit"
                                    >
                                        ✏
                                    </button>


                                    <button
                                        type="button"
                                        class="table-btn delete-table-btn"
                                        onclick="deleteSession('${item.id}')"
                                        title="Delete"
                                    >
                                        🗑
                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    $("emptySessionState").style.display =
        filtered.length
            ? "none"
            : "block";


    $("sessionCount").textContent =
        filtered.length;
}


/* =========================================
   TOP STATISTICS
========================================= */

function updateStatistics() {

    const uniqueSessions =
        new Set(
            sessions
                .map(
                    item =>
                        item.session
                )
                .filter(Boolean)
        );


    $("totalSessions").textContent =
        uniqueSessions.size;


    /*
        IMPORTANT:
        ONLY is_current=true controls
        the current session/term cards.
    */

    const current =
        sessions.find(
            item =>
                item.is_current === true
        );


    $("activeSession").textContent =
        current
            ? current.session
            : "-";


    $("currentTerm").textContent =
        current
            ? current.term
            : "-";


    const completedSessions =
        new Set(
            sessions
                .filter(
                    item =>
                        item.status ===
                        "completed"
                )
                .map(
                    item =>
                        item.session
                )
        );


    $("completedSessions").textContent =
        completedSessions.size;
}


/* =========================================
   SET CURRENT SESSION / TERM
========================================= */

window.setCurrentSession =
    async function (
        id
    ) {

        const selected =
            sessions.find(
                item =>
                    String(item.id) ===
                    String(id)
            );


        if (!selected) {

            alert(
                "Session / term could not be found."
            );

            return;
        }


        const confirmed =
            confirm(
                `Make ${selected.session} - ${selected.term} the current academic term?`
            );


        if (!confirmed) return;


        try {

            /*
                STEP 1:
                Clear is_current from ALL rows.
            */

            const {
                error: clearCurrentError
            } =
                await supabaseClient
                    .from("sessions_terms")
                    .update({
                        is_current: false
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
                STEP 2:
                Any previously active row
                should become completed.
            */

            const {
                error: oldActiveError
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
                        id
                    );


            if (
                oldActiveError
            ) {

                throw oldActiveError;
            }


            /*
                STEP 3:
                Set EXACT selected row
                to current + active.
            */

            const {
                data,
                error: setCurrentError
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
                        id
                    )
                    .select();


            if (
                setCurrentError
            ) {

                throw setCurrentError;
            }


            if (
                !data ||
                !data.length
            ) {

                throw new Error(
                    "The selected session could not be updated."
                );
            }


            /*
                STEP 4:
                Reload everything.
            */

            await loadSessions();


            alert(
                `${selected.session} - ${selected.term} is now the current academic term.`
            );


        } catch (error) {

            console.error(
                "Set current session error:",
                error
            );


            alert(
                "Could not set current session: " +
                error.message
            );
        }
    };


/* =========================================
   OPEN MODAL
========================================= */

function openSessionModal(
    item = null
) {

    $("sessionForm")
        ?.reset();


    $("sessionRecordId").value =
        item?.id || "";


    $("sessionModalTitle").textContent =
        item
            ? "Edit Session / Term"
            : "Add Session / Term";


    $("sessionName").value =
        item?.session || "";


    $("sessionTerm").value =
        item?.term ||
        "First Term";


    $("startDate").value =
        item?.start_date || "";


    $("endDate").value =
        item?.end_date || "";


    $("sessionStatus").value =
        item?.status ||
        "upcoming";


    $("sessionModal")
        ?.classList
        .add("active");
}


/* =========================================
   CLOSE MODAL
========================================= */

function closeSessionModal() {

    $("sessionModal")
        ?.classList
        .remove("active");
}


/* =========================================
   SAVE SESSION
========================================= */

async function saveSession(
    event
) {

    event.preventDefault();


    const id =
        $("sessionRecordId")
            ?.value || "";


    const sessionData = {

        session:
            $("sessionName")
                ?.value
                .trim() || "",

        term:
            $("sessionTerm")
                ?.value ||
            "First Term",

        start_date:
            $("startDate")
                ?.value || "",

        end_date:
            $("endDate")
                ?.value || "",

        status:
            $("sessionStatus")
                ?.value ||
            "upcoming"
    };


    if (
        !sessionData.session ||
        !sessionData.term ||
        !sessionData.start_date ||
        !sessionData.end_date
    ) {

        alert(
            "Please complete all session information."
        );

        return;
    }


    if (
        new Date(
            sessionData.end_date
        )
        <
        new Date(
            sessionData.start_date
        )
    ) {

        alert(
            "End date cannot be before start date."
        );

        return;
    }


    /*
        Prevent duplicate
        Session + Term.
    */

    const duplicate =
        sessions.find(
            item =>

                String(
                    item.session
                )
                    .trim()
                    .toLowerCase()

                ===

                sessionData.session
                    .toLowerCase()

                &&

                item.term ===
                sessionData.term

                &&

                String(
                    item.id
                )
                !==
                String(
                    id
                )
        );


    if (
        duplicate
    ) {

        alert(
            `${sessionData.term} already exists for ${sessionData.session}.`
        );

        return;
    }


    const button =
        $("saveSessionBtn");


    button.disabled =
        true;


    button.textContent =
        "Saving...";


    try {

        let result;


        if (
            id
        ) {

            const existing =
                sessions.find(
                    item =>
                        String(item.id) ===
                        String(id)
                );


            result =
                await supabaseClient
                    .from("sessions_terms")
                    .update({

                        ...sessionData,

                        is_current:
                            existing?.is_current ===
                            true

                    })
                    .eq(
                        "id",
                        id
                    );


        } else {

            result =
                await supabaseClient
                    .from("sessions_terms")
                    .insert([
                        {
                            ...sessionData,

                            is_current:
                                false
                        }
                    ]);
        }


        if (
            result.error
        ) {

            throw result.error;
        }


        /*
            IMPORTANT:
            If Admin chooses "Active"
            while saving, make that exact
            row the current term too.
        */

        if (
            sessionData.status ===
            "active"
        ) {

            let targetId =
                id;


            /*
                New record:
                find the new exact row first.
            */

            if (
                !targetId
            ) {

                const {
                    data:
                    newRecord,
                    error:
                    findError
                } =
                    await supabaseClient
                        .from(
                            "sessions_terms"
                        )
                        .select("id")
                        .eq(
                            "session",
                            sessionData.session
                        )
                        .eq(
                            "term",
                            sessionData.term
                        )
                        .maybeSingle();


                if (
                    findError
                ) {

                    throw findError;
                }


                targetId =
                    newRecord?.id;
            }


            if (
                targetId
            ) {

                await makeCurrentWithoutConfirm(
                    targetId
                );
            }
        }


        closeSessionModal();


        await loadSessions();


        alert(
            id
                ? "Session / term updated successfully."
                : "Session / term added successfully."
        );


    } catch (error) {

        console.error(
            "Save session error:",
            error
        );


        alert(
            "Could not save session: " +
            error.message
        );


    } finally {

        button.disabled =
            false;


        button.textContent =
            "Save Term";
    }
}


/* =========================================
   MAKE CURRENT WITHOUT CONFIRM
========================================= */

async function makeCurrentWithoutConfirm(
    id
) {

    const clear =
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
        clear.error
    ) {

        throw clear.error;
    }


    const oldActive =
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
                id
            );


    if (
        oldActive.error
    ) {

        throw oldActive.error;
    }


    const current =
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
                id
            );


    if (
        current.error
    ) {

        throw current.error;
    }
}


/* =========================================
   EDIT SESSION
========================================= */

window.editSession =
    function (
        id
    ) {

        const item =
            sessions.find(
                session =>
                    String(session.id) ===
                    String(id)
            );


        if (
            item
        ) {

            openSessionModal(
                item
            );
        }
    };


/* =========================================
   DELETE SESSION
========================================= */

window.deleteSession =
    async function (
        id
    ) {

        const item =
            sessions.find(
                session =>
                    String(session.id) ===
                    String(id)
            );


        if (!item) return;


        if (
            item.is_current
        ) {

            alert(
                "You cannot delete the current academic term. Set another term as current first."
            );

            return;
        }


        try {

            const [
                resultsCheck,
                reportsCheck
            ] =
                await Promise.all([

                    supabaseClient
                        .from("results")
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "session",
                            item.session
                        )
                        .eq(
                            "term",
                            item.term
                        ),

                    supabaseClient
                        .from(
                            "student_reports"
                        )
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )
                        .eq(
                            "session",
                            item.session
                        )
                        .eq(
                            "term",
                            item.term
                        )

                ]);


            const records =
                Number(
                    resultsCheck.count || 0
                )
                +
                Number(
                    reportsCheck.count || 0
                );


            if (
                records > 0
            ) {

                alert(
                    `${item.session} - ${item.term} already has academic records.\n\n` +
                    `Change its status to Completed instead of deleting it.`
                );

                return;
            }


            const confirmed =
                confirm(
                    `Delete ${item.session} - ${item.term}?`
                );


            if (!confirmed) return;


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "sessions_terms"
                    )
                    .delete()
                    .eq(
                        "id",
                        id
                    );


            if (error) {
                throw error;
            }


            await loadSessions();


            alert(
                "Session / term deleted successfully."
            );


        } catch (error) {

            console.error(
                "Delete session error:",
                error
            );


            alert(
                "Could not delete session: " +
                error.message
            );
        }
    };


/* =========================================
   HELPERS
========================================= */

function formatDate(date) {

    if (!date) {
        return "-";
    }


    return new Date(
        date + "T00:00:00"
    )
        .toLocaleDateString(
            "en-GB",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric"
            }
        );
}


function capitalize(value) {

    const text =
        String(
            value || ""
        );


    return (
        text
            .charAt(0)
            .toUpperCase()
        +
        text.slice(1)
    );
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