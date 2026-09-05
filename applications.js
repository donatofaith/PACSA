let applications = [];

const table = document.getElementById("applicationsTableBody");
const search = document.getElementById("applicationSearch");
const classFilter = document.getElementById("classFilter");
const statusFilter = document.getElementById("statusFilter");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function capitalize(value) {
    value = String(value || "");
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderApplications() {
    const text = search.value.trim().toLowerCase();

    const filtered = applications.filter(app => {
        const matchesSearch =
            `${app.full_name || ""} ${app.parent_name || ""} ${app.email || ""} ${app.phone || ""} ${app.class || ""}`
                .toLowerCase()
                .includes(text);

        const matchesClass =
            !classFilter.value || app.class === classFilter.value;

        const matchesStatus =
            !statusFilter.value ||
            (app.status || "pending") === statusFilter.value;

        return matchesSearch && matchesClass && matchesStatus;
    });

    table.innerHTML = filtered.map(app => {
        const status = app.status || "pending";

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(app.full_name)}</strong>
                </td>

                <td>${escapeHtml(app.gender)}</td>

                <td>${escapeHtml(app.class)}</td>

                <td>${escapeHtml(app.parent_name)}</td>

                <td>
                    ${app.created_at
                        ? new Date(app.created_at).toLocaleDateString()
                        : "--"}
                </td>

                <td>
                    <span class="status-badge ${escapeHtml(status)}">
                        ${escapeHtml(capitalize(status))}
                    </span>
                </td>

                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">

                        <button
                            type="button"
                            class="btn btn-light"
                            onclick="viewApplication('${app.id}')">
                            View
                        </button>

                        ${
                            status === "pending"
                                ? `
                                    <button
                                        type="button"
                                        class="btn btn-light"
                                        onclick="approveApplication('${app.id}')">
                                        Approve
                                    </button>

                                    <button
                                        type="button"
                                        class="btn btn-light"
                                        onclick="rejectApplication('${app.id}')">
                                        Reject
                                    </button>
                                `
                                : ""
                        }

                    </div>
                </td>
            </tr>
        `;
    }).join("");

    document.getElementById("emptyApplicationState").style.display =
        filtered.length ? "none" : "block";

    document.getElementById("applicationCount").textContent =
        filtered.length;

    document.getElementById("totalApplications").textContent =
        applications.length;

    document.getElementById("pendingApplications").textContent =
        applications.filter(a => (a.status || "pending") === "pending").length;

    document.getElementById("approvedApplications").textContent =
        applications.filter(a => a.status === "approved").length;

    document.getElementById("rejectedApplications").textContent =
        applications.filter(a => a.status === "rejected").length;
}


/* LOAD APPLICATIONS */

async function loadApplications() {
    table.innerHTML = `
        <tr>
            <td colspan="7">Loading applications...</td>
        </tr>
    `;

    const { data, error } = await supabaseClient
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    Could not load applications:
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

        return;
    }

    applications = data || [];
    renderApplications();
}


/* VIEW APPLICATION */

window.viewApplication = function(id) {
    const app = applications.find(
        a => String(a.id) === String(id)
    );

    if (!app) return;

    alert(
        `Applicant: ${app.full_name}\n\n` +
        `Date of Birth: ${app.date_of_birth || "--"}\n` +
        `Gender: ${app.gender || "--"}\n` +
        `Class: ${app.class || "--"}\n` +
        `Parent/Guardian: ${app.parent_name || "--"}\n` +
        `Phone: ${app.phone || "--"}\n` +
        `Email: ${app.email || "--"}\n` +
        `Address: ${app.address || "--"}\n` +
        `Previous School: ${app.previous_school || "--"}\n` +
        `Additional Information: ${app.additional_information || "--"}\n\n` +
        `Status: ${app.status || "pending"}`
    );
};


/* APPROVE APPLICATION */

window.approveApplication = async function(id) {
    const app = applications.find(
        a => String(a.id) === String(id)
    );

    if (!app) return;

    if (!confirm(
        `Approve ${app.full_name}'s application?\n\n` +
        `A congratulatory email will be sent to ${app.email}.`
    )) {
        return;
    }

    const { error } = await supabaseClient
        .from("applications")
        .update({
            status: "approved"
        })
        .eq("id", id);

    if (error) {
        console.error(error);

        alert(
            `Could not approve application:\n${error.message}`
        );

        return;
    }

    app.status = "approved";
    renderApplications();


    /* SEND CONGRATULATORY EMAIL */

    try {
        const { error: emailError } =
            await supabaseClient.functions.invoke(
                "smooth-api",
                {
                    body: {
                        application_id: app.id,
                        full_name: app.full_name,
                        email: app.email,
                        class: app.class
                    }
                }
            );

        if (emailError) {
            console.error("Email error:", emailError);

            alert(
                "Application approved, but the congratulatory email could not be sent."
            );

            return;
        }

        alert(
            `Application approved successfully!\n\n` +
            `A congratulatory email has been sent to ${app.email}.`
        );

    } catch (error) {
        console.error("Email error:", error);

        alert(
            "Application approved, but there was a problem sending the email."
        );
    }
};


/* REJECT APPLICATION */

window.rejectApplication = async function(id) {
    const app = applications.find(
        a => String(a.id) === String(id)
    );

    if (!app) return;

    if (!confirm(
        `Reject ${app.full_name}'s application?`
    )) {
        return;
    }

    const { error } = await supabaseClient
        .from("applications")
        .update({
            status: "rejected"
        })
        .eq("id", id);

    if (error) {
        console.error(error);

        alert(
            `Could not reject application:\n${error.message}`
        );

        return;
    }

    app.status = "rejected";

    renderApplications();

    alert("Application rejected successfully.");
};


/* FILTERS */

search.addEventListener("input", renderApplications);
classFilter.addEventListener("change", renderApplications);
statusFilter.addEventListener("change", renderApplications);

document.getElementById("clearFiltersBtn")
    .addEventListener("click", () => {
        search.value = "";
        classFilter.value = "";
        statusFilter.value = "";

        renderApplications();
    });


/* MOBILE MENU */

document.getElementById("menuBtn")
    .addEventListener("click", () => {
        document.getElementById("sidebar")
            .classList.toggle("active");
    });


/* LOGOUT */

document.getElementById("logoutBtn")
    .addEventListener("click", async e => {
        e.preventDefault();

        if (!confirm("Are you sure you want to logout?")) {
            return;
        }

        try {
            await supabaseClient.auth.signOut();
        } catch (error) {
            console.error(error);
        }

        window.location.href = "login.html";
    });


/* START */

loadApplications();