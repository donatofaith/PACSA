let sessions = [];

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {

    $("menuBtn")?.addEventListener("click", () => {
        $("sidebar")?.classList.toggle("active");
    });

    $("logoutBtn")?.addEventListener("click", e => {
        e.preventDefault();

        if (confirm("Are you sure you want to logout?")) {
            window.location.href = "login.html";
        }
    });

    $("sessionSearch")?.addEventListener("input", renderSessions);
    $("statusFilter")?.addEventListener("change", renderSessions);

    $("clearFiltersBtn")?.addEventListener("click", () => {
        $("sessionSearch").value = "";
        $("statusFilter").value = "";
        renderSessions();
    });

    $("addSessionBtn")?.addEventListener(
        "click",
        () => openSessionModal()
    );

    $("emptyAddSessionBtn")?.addEventListener(
        "click",
        () => openSessionModal()
    );

    $("closeSessionModal")?.addEventListener(
        "click",
        closeSessionModal
    );

    $("cancelSessionBtn")?.addEventListener(
        "click",
        closeSessionModal
    );

    $("sessionForm")?.addEventListener(
        "submit",
        saveSession
    );

    loadSessions();
});


/* LOAD */

async function loadSessions() {

    const { data, error } = await supabaseClient
        .from("sessions_terms")
        .select(`
            id,
            session,
            term,
            start_date,
            end_date,
            status,
            is_current
        `)
        .order("start_date", { ascending: false });

    if (error) {
        console.error(error);

        alert(
            "Could not load sessions: " +
            error.message
        );

        return;
    }

    sessions = data || [];

    renderSessions();
    updateStatistics();
}


/* RENDER */

function renderSessions() {

    const search =
        $("sessionSearch").value
            .toLowerCase()
            .trim();

    const selectedStatus =
        $("statusFilter").value;

    const filtered = sessions.filter(item => {

        const sessionName =
            String(item.session || "")
                .toLowerCase();

        return (
            sessionName.includes(search) &&
            (
                !selectedStatus ||
                item.status === selectedStatus
            )
        );
    });

    $("sessionsTableBody").innerHTML =
        filtered.map(item => {

            const status =
                item.status || "upcoming";

            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(item.session || "-")}
                        </strong>
                    </td>

                    <td>
                        ${formatDate(item.start_date)}
                    </td>

                    <td>
                        ${formatDate(item.end_date)}
                    </td>

                    <td>
                        ${escapeHtml(item.term || "-")}
                    </td>

                    <td>
                        <span class="status-badge ${
                            status === "active"
                                ? "active-status"
                                : status === "completed"
                                    ? "completed"
                                    : "pending"
                        }">
                            ${escapeHtml(status)}
                        </span>
                    </td>

                    <td>
                        <div class="table-action-buttons">

                            <button
                                class="table-btn edit-table-btn"
                                onclick="editSession(${item.id})"
                                title="Edit Session">
                                ✏
                            </button>

                            <button
                                class="table-btn delete-table-btn"
                                onclick="deleteSession(${item.id})"
                                title="Delete Session">
                                🗑
                            </button>

                        </div>
                    </td>

                </tr>
            `;

        }).join("");

    $("emptySessionState").style.display =
        filtered.length ? "none" : "block";

    $("sessionCount").textContent =
        filtered.length;
}


/* STATISTICS */

function updateStatistics() {

    $("totalSessions").textContent =
        new Set(
            sessions.map(item => item.session)
        ).size;

    const active =
        sessions.find(
            item =>
                item.is_current === true ||
                item.status === "active"
        );

    $("activeSession").textContent =
        active?.session || "-";

    $("currentTerm").textContent =
        active?.term || "-";

    $("completedSessions").textContent =
        new Set(
            sessions
                .filter(item => item.status === "completed")
                .map(item => item.session)
        ).size;

    $("sessionCount").textContent =
        sessions.length;
}


/* OPEN */

function openSessionModal(session = null) {

    $("sessionForm").reset();

    $("sessionRecordId").value =
        session?.id || "";

    $("sessionModalTitle").textContent =
        session
            ? "Edit Session"
            : "Add New Session";

    $("sessionName").value =
        session?.session || "";

    $("sessionTerm").value =
        session?.term || "First Term";

    $("startDate").value =
        session?.start_date || "";

    $("endDate").value =
        session?.end_date || "";

    $("sessionStatus").value =
        session?.status || "upcoming";

    $("sessionModal")
        .classList.add("active");
}


/* CLOSE */

function closeSessionModal() {

    $("sessionModal")
        .classList.remove("active");
}


/* SAVE */

async function saveSession(event) {

    event.preventDefault();

    const id =
        $("sessionRecordId").value;

    const sessionData = {

        session:
            $("sessionName")
                .value.trim(),

        term:
            $("sessionTerm")
                .value,

        start_date:
            $("startDate")
                .value,

        end_date:
            $("endDate")
                .value,

        status:
            $("sessionStatus")
                .value,

        is_current:
            $("sessionStatus").value === "active"
    };


    if (
        !sessionData.session ||
        !sessionData.start_date ||
        !sessionData.end_date
    ) {

        alert(
            "Please enter the session name, start date and end date."
        );

        return;
    }


    if (
        new Date(sessionData.end_date) <
        new Date(sessionData.start_date)
    ) {

        alert(
            "End date cannot be before start date."
        );

        return;
    }


    const button =
        $("sessionForm")
            .querySelector("button[type='submit']");

    button.disabled = true;
    button.textContent = "Saving...";


    let result;


    if (id) {

        result = await supabaseClient
            .from("sessions_terms")
            .update(sessionData)
            .eq("id", id);

    } else {

        result = await supabaseClient
            .from("sessions_terms")
            .insert([sessionData]);
    }


    button.disabled = false;
    button.textContent = "Save Session";


    if (result.error) {

        console.error(result.error);

        alert(
            "Could not save session: " +
            result.error.message
        );

        return;
    }


    /*
       If this session is active,
       make other sessions inactive.
    */

    if (sessionData.is_current) {

        await supabaseClient
            .from("sessions_terms")
            .update({
                is_current: false
            })
            .neq(
                "id",
                id || 0
            );

        await supabaseClient
            .from("sessions_terms")
            .update({
                is_current: true
            })
            .eq(
                "session",
                sessionData.session
            );
    }


    closeSessionModal();

    await loadSessions();

    alert(
        id
            ? "Session updated successfully."
            : "Session added successfully."
    );
}


/* EDIT */

window.editSession = function(id) {

    const session =
        sessions.find(
            item => String(item.id) === String(id)
        );

    if (session) {
        openSessionModal(session);
    }
};


/* DELETE */

window.deleteSession = async function(id) {

    const session =
        sessions.find(
            item => String(item.id) === String(id)
        );

    if (!session) return;

    if (
        !confirm(
            `Are you sure you want to delete "${session.session}"?`
        )
    ) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("sessions_terms")
            .delete()
            .eq("id", id);

    if (error) {

        console.error(error);

        alert(
            "Could not delete session: " +
            error.message
        );

        return;
    }

    await loadSessions();

    alert(
        "Session deleted successfully."
    );
};


/* HELPERS */

function formatDate(date) {

    if (!date) return "-";

    return new Date(date + "T00:00:00")
        .toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}