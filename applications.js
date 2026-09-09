/* =========================================
   PACSA APPLICATION MANAGEMENT
   ADMIN AUTH + STUDENT CREATION
========================================= */

let applications = [];

const $ = id =>
    document.getElementById(id);


/* =========================================
   HELPERS
========================================= */

function normalize(value) {

    return String(value || "")
        .trim()
        .toLowerCase();
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function capitalize(value) {

    const text =
        String(value || "");

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}


function splitFullName(fullName) {

    const parts =
        String(fullName || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return {
            first_name: "",
            last_name: ""
        };
    }


    if (parts.length === 1) {

        return {
            first_name: parts[0],
            last_name: ""
        };
    }


    return {
        first_name: parts[0],
        last_name: parts.slice(1).join(" ")
    };
}


function getStudentDisplayName(student) {

    return [
        student?.first_name,
        student?.last_name
    ]
        .filter(Boolean)
        .join(" ")
        .trim() ||
        "Student";
}


function formatDate(value) {

    if (!value) {
        return "--";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--";
    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================
   RENDER APPLICATIONS
========================================= */

function renderApplications() {

    const searchText =
        normalize(
            $("applicationSearch")?.value
        );


    const selectedClass =
        $("classFilter")?.value || "";


    const selectedStatus =
        $("statusFilter")?.value || "";


    const filtered =
        applications.filter(
            app => {

                const searchable =
                    normalize(
                        [
                            app.full_name,
                            app.parent_name,
                            app.email,
                            app.phone,
                            app.class
                        ].join(" ")
                    );


                const matchesSearch =
                    !searchText ||
                    searchable.includes(
                        searchText
                    );


                const matchesClass =
                    !selectedClass ||
                    app.class === selectedClass;


                const matchesStatus =
                    !selectedStatus ||
                    normalize(
                        app.status || "pending"
                    ) ===
                    normalize(
                        selectedStatus
                    );


                return (
                    matchesSearch &&
                    matchesClass &&
                    matchesStatus
                );
            }
        );


    const table =
        $("applicationsTableBody");


    if (!table) {
        return;
    }


    table.innerHTML =
        filtered
            .map(
                app => {

                    const status =
                        normalize(
                            app.status || "pending"
                        );


                    return `
                        <tr>
                            <td>
                                <strong>
                                    ${escapeHtml(app.full_name || "-")}
                                </strong>

                                ${app.email
                                    ? `
                                        <br>
                                        <small>${escapeHtml(app.email)}</small>
                                    `
                                    : ""
                                }
                            </td>

                            <td>${escapeHtml(app.gender || "-")}</td>
                            <td>${escapeHtml(app.class || "-")}</td>
                            <td>${escapeHtml(app.parent_name || "-")}</td>
                            <td>${formatDate(app.created_at)}</td>

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
                                        onclick="viewApplication('${app.id}')"
                                    >
                                        View
                                    </button>

                                    ${status === "pending"
                                        ? `
                                            <button
                                                type="button"
                                                class="btn btn-light"
                                                onclick="approveApplication('${app.id}')"
                                            >
                                                Approve
                                            </button>

                                            <button
                                                type="button"
                                                class="btn btn-light"
                                                onclick="rejectApplication('${app.id}')"
                                            >
                                                Reject
                                            </button>
                                        `
                                        : ""
                                    }

                                    <button
                                        type="button"
                                        class="btn btn-light"
                                        onclick="deleteApplication('${app.id}')"
                                        style="color:#DC2626;border-color:#FECACA;"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }
            )
            .join("");


    $("emptyApplicationState") &&
        ($("emptyApplicationState").style.display =
            filtered.length ? "none" : "block");

    $("applicationCount") &&
        ($("applicationCount").textContent = filtered.length);

    $("totalApplications") &&
        ($("totalApplications").textContent = applications.length);

    $("pendingApplications") &&
        ($("pendingApplications").textContent =
            applications.filter(
                app => normalize(app.status || "pending") === "pending"
            ).length);

    $("approvedApplications") &&
        ($("approvedApplications").textContent =
            applications.filter(
                app => normalize(app.status) === "approved"
            ).length);

    $("rejectedApplications") &&
        ($("rejectedApplications").textContent =
            applications.filter(
                app => normalize(app.status) === "rejected"
            ).length);
}


/* =========================================
   LOAD APPLICATIONS
========================================= */

async function loadApplications() {

    const table =
        $("applicationsTableBody");


    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="7">Loading applications...</td>
            </tr>
        `;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("applications")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        applications =
            data || [];


        populateClassFilter();
        renderApplications();


    } catch (error) {

        console.error(
            "Load applications error:",
            error
        );


        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="7">
                        Could not load applications: ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;
        }
    }
}


function populateClassFilter() {

    const filter =
        $("classFilter");


    if (!filter) {
        return;
    }


    const currentValue =
        filter.value;


    const classes =
        [...new Set(
            applications
                .map(app => app.class)
                .filter(Boolean)
        )].sort();


    filter.innerHTML =
        `<option value="">All Classes</option>`;


    classes.forEach(className => {

        const option =
            document.createElement("option");

        option.value =
            className;

        option.textContent =
            className;

        filter.appendChild(option);
    });


    if (classes.includes(currentValue)) {
        filter.value = currentValue;
    }
}


/* =========================================
   VIEW APPLICATION
========================================= */

window.viewApplication =
    function(id) {

        const app =
            applications.find(
                item =>
                    String(item.id) ===
                    String(id)
            );


        if (!app) {
            return;
        }


        alert(
            `Applicant: ${app.full_name || "--"}\n\n` +
            `Date of Birth: ${app.date_of_birth || "--"}\n` +
            `Gender: ${app.gender || "--"}\n` +
            `Class: ${app.class || "--"}\n` +
            `Parent/Guardian: ${app.parent_name || "--"}\n` +
            `Phone: ${app.phone || "--"}\n` +
            `Email: ${app.email || "--"}\n` +
            `Address: ${app.address || "--"}\n` +
            `Previous School: ${app.previous_school || "--"}\n` +
            `Additional Information: ${app.additional_information || "--"}\n\n` +
            `Status: ${capitalize(app.status || "pending")}`
        );
    };


/* =========================================
   GENERATE STUDENT ID
========================================= */

async function generateStudentId() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("students")
            .select("student_id");


    if (error) {
        throw error;
    }


    let highestNumber = 0;


    (data || [])
        .forEach(student => {

            const value =
                String(student.student_id || "")
                    .trim()
                    .toUpperCase();


            const match =
                value.match(/^PACSA(\d+)$/);


            if (!match) {
                return;
            }


            const number =
                Number(match[1]);


            if (
                Number.isFinite(number) &&
                number > highestNumber
            ) {
                highestNumber = number;
            }
        });


    return (
        "PACSA" +
        String(highestNumber + 1).padStart(3, "0")
    );
}


/* =========================================
   FIND EXISTING STUDENT
========================================= */

async function findExistingStudent(app) {

    if (!app.email) {
        return null;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("students")
            .select(`
                student_id,
                first_name,
                last_name,
                email,
                class,
                status,
                portal_status
            `)
            .ilike(
                "email",
                app.email.trim()
            )
            .limit(1);


    if (error) {
        throw error;
    }


    return data?.[0] || null;
}


/* =========================================
   CREATE STUDENT
========================================= */

async function createStudentFromApplication(app) {

    const existing =
        await findExistingStudent(app);


    if (existing) {
        return existing;
    }


    const studentId =
        await generateStudentId();


    const names =
        splitFullName(app.full_name);


    const studentData = {
        student_id: studentId,
        first_name: names.first_name,
        last_name: names.last_name,
        email: app.email || null,
        phone: app.phone || null,
        class: app.class || null,
        status: "Active",
        portal_status: "not_activated",
        auth_user_id: null
    };


    const {
        data,
        error
    } =
        await supabaseClient
            .from("students")
            .insert([
                studentData
            ])
            .select(`
                student_id,
                first_name,
                last_name,
                email,
                class,
                status,
                portal_status
            `)
            .single();


    if (error) {
        throw error;
    }


    return data;
}


/* =========================================
   APPROVE APPLICATION
========================================= */

window.approveApplication =
    async function(id) {

        const app =
            applications.find(
                item =>
                    String(item.id) ===
                    String(id)
            );


        if (!app) {
            return;
        }


        const confirmed =
            confirm(
                `Approve ${app.full_name}'s application?\n\n` +
                `A student record will be created and the applicant will be able to activate the Student Portal.`
            );


        if (!confirmed) {
            return;
        }


        try {

            const {
                data: freshApp,
                error: freshError
            } =
                await supabaseClient
                    .from("applications")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();


            if (freshError) {
                throw freshError;
            }


            if (!freshApp) {
                throw new Error("This application no longer exists.");
            }


            if (normalize(freshApp.status || "pending") !== "pending") {

                alert(`This application is already ${freshApp.status}.`);
                await loadApplications();
                return;
            }


            if (!freshApp.email) {
                alert("This applicant has no email address. Student Portal activation requires an email.");
                return;
            }


            const student =
                await createStudentFromApplication(freshApp);


            const {
                data: updatedApplication,
                error: approvalError
            } =
                await supabaseClient
                    .from("applications")
                    .update({
                        status: "approved"
                    })
                    .eq("id", id)
                    .eq("status", freshApp.status)
                    .select();


            if (approvalError) {
                throw approvalError;
            }


            if (!updatedApplication || updatedApplication.length !== 1) {

                alert("The application changed before approval completed.");
                await loadApplications();
                return;
            }


            await loadApplications();


            let emailSent = false;


            try {

                const {
                    error: emailError
                } =
                    await supabaseClient
                        .functions
                        .invoke(
                            "smooth-api",
                            {
                                body: {
                                    application_id: freshApp.id,
                                    full_name: freshApp.full_name,
                                    email: freshApp.email,
                                    class: freshApp.class,
                                    student_id: student.student_id,
                                    portal_status: student.portal_status
                                }
                            }
                        );


                if (!emailError) {
                    emailSent = true;
                } else {
                    console.error("Approval email error:", emailError);
                }


            } catch (emailError) {
                console.error("Approval email error:", emailError);
            }


            const studentName =
                getStudentDisplayName(student);


            if (emailSent) {

                alert(
                    `Application approved successfully!\n\n` +
                    `Student: ${studentName}\n` +
                    `Student ID: ${student.student_id}\n` +
                    `Class: ${student.class || freshApp.class || "--"}\n\n` +
                    `A congratulatory email has been sent to ${freshApp.email}.`
                );

            } else {

                alert(
                    `Application approved successfully.\n\n` +
                    `Student: ${studentName}\n` +
                    `Student ID: ${student.student_id}\n` +
                    `Class: ${student.class || freshApp.class || "--"}\n\n` +
                    `The student record was created, but the email could not be sent.`
                );
            }


        } catch (error) {

            console.error("Approve application error:", error);

            alert(
                "Could not approve application: " +
                (error?.message || "Unknown error")
            );
        }
    };


/* =========================================
   REJECT APPLICATION
========================================= */

window.rejectApplication =
    async function(id) {

        const app =
            applications.find(
                item =>
                    String(item.id) ===
                    String(id)
            );


        if (!app) {
            return;
        }


        if (!confirm(`Reject ${app.full_name}'s application?`)) {
            return;
        }


        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("applications")
                    .update({
                        status: "rejected"
                    })
                    .eq("id", id)
                    .eq("status", app.status || "pending")
                    .select();


            if (error) {
                throw error;
            }


            if (!data || data.length !== 1) {

                alert("This application has already been changed.");
                await loadApplications();
                return;
            }


            await loadApplications();
            alert("Application rejected successfully.");


        } catch (error) {

            console.error("Reject application error:", error);

            alert(
                "Could not reject application: " +
                (error?.message || "Unknown error")
            );
        }
    };


/* =========================================
   DELETE APPLICATION
========================================= */

window.deleteApplication =
    async function(id) {

        const app =
            applications.find(
                item =>
                    String(item.id) ===
                    String(id)
            );


        if (!app) {
            return;
        }


        const status =
            normalize(app.status || "pending");


        let message =
            `Delete ${app.full_name}'s application?`;


        if (status === "approved") {
            message +=
                `\n\nThis application was already approved.` +
                `\nThe student's PACSA student record will NOT be deleted.`;
        }


        if (!confirm(message)) {
            return;
        }


        if (!confirm("This application record will be permanently deleted.\n\nContinue?")) {
            return;
        }


        try {

            const {
                error
            } =
                await supabaseClient
                    .from("applications")
                    .delete()
                    .eq("id", id);


            if (error) {
                throw error;
            }


            await loadApplications();
            alert("Application deleted successfully.");


        } catch (error) {

            console.error("Delete application error:", error);

            alert(
                "Could not delete application: " +
                (error?.message || "Unknown error")
            );
        }
    };


/* =========================================
   CLEAR FILTERS
========================================= */

function clearFilters() {

    if ($("applicationSearch")) {
        $("applicationSearch").value = "";
    }


    if ($("classFilter")) {
        $("classFilter").value = "";
    }


    if ($("statusFilter")) {
        $("statusFilter").value = "";
    }


    renderApplications();
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


        $("applicationSearch")
            ?.addEventListener("input", renderApplications);


        $("classFilter")
            ?.addEventListener("change", renderApplications);


        $("statusFilter")
            ?.addEventListener("change", renderApplications);


        $("clearFiltersBtn")
            ?.addEventListener("click", clearFilters);


        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {
                    $("sidebar")?.classList.toggle("active");
                }
            );


        await loadApplications();
    }
);
