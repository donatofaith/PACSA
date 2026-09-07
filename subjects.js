/* =========================================
   PACSA SUBJECTS MANAGEMENT
   ADMIN AUTH + SAFE SUBJECT MANAGEMENT
========================================= */

let subjects = [];

let teacherAssignments = [];
let studentSubjectRegistrations = [];
let resultSubjects = [];

const $ = id =>
    document.getElementById(id);


/* =========================================
   START
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
            ADMIN AUTH FIRST
        */

        const admin =
            await window.adminAuthReady;

        if (!admin) {
            return;
        }


        /* MOBILE MENU */

        $("menuBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("sidebar")
                        ?.classList
                        .toggle("active");
                }
            );


        /* ADD */

        $("addSubjectBtn")
            ?.addEventListener(
                "click",
                () => {

                    openSubjectModal();
                }
            );


        $("emptyAddSubjectBtn")
            ?.addEventListener(
                "click",
                () => {

                    openSubjectModal();
                }
            );


        /* CLOSE */

        $("closeSubjectModal")
            ?.addEventListener(
                "click",
                closeSubjectModal
            );


        $("cancelSubjectBtn")
            ?.addEventListener(
                "click",
                closeSubjectModal
            );


        $("subjectModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("subjectModal")
                    ) {

                        closeSubjectModal();
                    }
                }
            );


        /* SAVE */

        $("subjectForm")
            ?.addEventListener(
                "submit",
                saveSubject
            );


        /* FILTERS */

        $("subjectSearch")
            ?.addEventListener(
                "input",
                renderSubjects
            );


        $("categoryFilter")
            ?.addEventListener(
                "change",
                renderSubjects
            );


        $("statusFilter")
            ?.addEventListener(
                "change",
                renderSubjects
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                () => {

                    $("subjectSearch").value =
                        "";

                    $("categoryFilter").value =
                        "";

                    $("statusFilter").value =
                        "";

                    renderSubjects();
                }
            );


        /* NOTIFICATION */

        document
            .querySelector(
                ".notification-btn"
            )
            ?.addEventListener(
                "click",
                () => {

                    alert(
                        "Your subject records are up to date."
                    );
                }
            );


        await loadSubjects();
    }
);


/* =========================================
   LOAD EVERYTHING
========================================= */

async function loadSubjects() {

    showLoading(
        true
    );


    try {

        const [
            subjectResult,
            teacherAssignmentResult,
            studentSubjectResult,
            resultsResult
        ] =
            await Promise.all([

                supabaseClient
                    .from("subjects")
                    .select(`
                        id,
                        name,
                        code,
                        category,
                        status
                    `)
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    ),


                supabaseClient
                    .from(
                        "teacher_assignments"
                    )
                    .select(`
                        teacher_id,
                        class,
                        subject
                    `),


                supabaseClient
                    .from(
                        "student_subjects"
                    )
                    .select(`
                        student_id,
                        class,
                        subject,
                        session
                    `),


                supabaseClient
                    .from("results")
                    .select(`
                        subject,
                        class
                    `)

            ]);


        if (
            subjectResult.error
        ) {

            throw subjectResult.error;
        }


        subjects =
            subjectResult.data ||
            [];


        if (
            teacherAssignmentResult.error
        ) {

            console.error(
                "Teacher assignment loading error:",
                teacherAssignmentResult.error
            );


            teacherAssignments =
                [];

        } else {

            teacherAssignments =
                teacherAssignmentResult.data ||
                [];
        }


        if (
            studentSubjectResult.error
        ) {

            console.error(
                "Student subject loading error:",
                studentSubjectResult.error
            );


            studentSubjectRegistrations =
                [];

        } else {

            studentSubjectRegistrations =
                studentSubjectResult.data ||
                [];
        }


        if (
            resultsResult.error
        ) {

            console.error(
                "Result subject loading error:",
                resultsResult.error
            );


            resultSubjects =
                [];

        } else {

            resultSubjects =
                resultsResult.data ||
                [];
        }


        renderSubjects();

        updateStatistics();


    } catch (error) {

        console.error(
            "Load subjects error:",
            error
        );


        alert(
            "Could not load subjects: " +
            error.message
        );


        if (
            $("emptySubjectState")
        ) {

            $("emptySubjectState")
                .style
                .display =
                "block";
        }


    } finally {

        showLoading(
            false
        );
    }
}


/* =========================================
   LOADING
========================================= */

function showLoading(
    loading
) {

    if (
        $("subjectsLoading")
    ) {

        $("subjectsLoading")
            .style
            .display =
            loading
                ? "block"
                : "none";
    }


    if (
        loading &&
        $("emptySubjectState")
    ) {

        $("emptySubjectState")
            .style
            .display =
            "none";
    }
}


/* =========================================
   NORMALIZE
========================================= */

function normalize(
    value
) {

    return String(
        value ||
        ""
    )
        .trim()
        .toLowerCase();
}


/* =========================================
   SUBJECT CLASS COVERAGE
========================================= */

function getSubjectClasses(
    subjectName
) {

    const subjectKey =
        normalize(
            subjectName
        );


    const classes =
        new Set();


    teacherAssignments
        .filter(
            assignment =>
                normalize(
                    assignment.subject
                )
                ===
                subjectKey
        )
        .forEach(
            assignment => {

                if (
                    assignment.class
                ) {

                    classes.add(
                        assignment.class
                    );
                }
            }
        );


    studentSubjectRegistrations
        .filter(
            registration =>
                normalize(
                    registration.subject
                )
                ===
                subjectKey
        )
        .forEach(
            registration => {

                if (
                    registration.class
                ) {

                    classes.add(
                        registration.class
                    );
                }
            }
        );


    return [
        ...classes
    ].sort();
}


/* =========================================
   RENDER
========================================= */

function renderSubjects() {

    const search =
        normalize(
            $("subjectSearch")
                ?.value
        );


    const category =
        $("categoryFilter")
            ?.value ||
        "";


    const status =
        $("statusFilter")
            ?.value ||
        "";


    const filtered =
        subjects.filter(
            subject => {

                const matchesSearch =
                    normalize(
                        subject.name
                    )
                        .includes(
                            search
                        )

                    ||

                    normalize(
                        subject.code
                    )
                        .includes(
                            search
                        );


                const matchesCategory =
                    !category

                    ||

                    subject.category ===
                    category;


                const matchesStatus =
                    !status

                    ||

                    subject.status ===
                    status;


                return (
                    matchesSearch &&
                    matchesCategory &&
                    matchesStatus
                );
            }
        );


    if (
        $("subjectsTableBody")
    ) {

        $("subjectsTableBody")
            .innerHTML =

            filtered
                .map(
                    subject => {

                        const classes =
                            getSubjectClasses(
                                subject.name
                            );


                        const classHtml =
                            classes.length

                                ? classes
                                    .map(
                                        className => `

                                            <span class="subject-class-badge">
                                                ${escapeHtml(
                                                    className
                                                )}
                                            </span>
                                        `
                                    )
                                    .join("")

                                : `

                                    <span class="subject-no-class">
                                        Not assigned
                                    </span>
                                `;


                        const currentStatus =
                            subject.status ||
                            "active";


                        return `

                            <tr>

                                <td>

                                    <strong>
                                        ${escapeHtml(
                                            subject.name ||
                                            "-"
                                        )}
                                    </strong>

                                </td>


                                <td>

                                    ${escapeHtml(
                                        subject.code ||
                                        "-"
                                    )}

                                </td>


                                <td>

                                    ${escapeHtml(
                                        subject.category ||
                                        "-"
                                    )}

                                </td>


                                <td>

                                    <div class="subject-class-summary">
                                        ${classHtml}
                                    </div>

                                </td>


                                <td>

                                    <span
                                        class="status-badge ${
                                            currentStatus ===
                                            "active"

                                                ? "active-status"

                                                : "pending"
                                        }"
                                    >

                                        ${escapeHtml(
                                            capitalize(
                                                currentStatus
                                            )
                                        )}

                                    </span>

                                </td>


                                <td>

                                    <div class="table-action-buttons">

                                        <button
                                            type="button"
                                            class="table-btn edit-table-btn"
                                            onclick="editSubject('${subject.id}')"
                                            title="Edit Subject"
                                        >
                                            ✏
                                        </button>


                                        <button
                                            type="button"
                                            class="table-btn delete-table-btn"
                                            onclick="deleteSubject('${subject.id}')"
                                            title="Delete Subject"
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
    }


    if (
        $("emptySubjectState")
    ) {

        $("emptySubjectState")
            .style
            .display =

            filtered.length
                ? "none"
                : "block";
    }


    if (
        $("subjectCount")
    ) {

        $("subjectCount")
            .textContent =
            filtered.length;
    }
}


/* =========================================
   STATISTICS
========================================= */

function updateStatistics() {

    if (
        $("totalSubjects")
    ) {

        $("totalSubjects")
            .textContent =
            subjects.length;
    }


    if (
        $("activeSubjects")
    ) {

        $("activeSubjects")
            .textContent =

            subjects.filter(
                subject =>
                    normalize(
                        subject.status
                    )
                    ===
                    "active"
            )
                .length;
    }


    if (
        $("coreSubjects")
    ) {

        $("coreSubjects")
            .textContent =

            subjects.filter(
                subject =>
                    normalize(
                        subject.category
                    )
                    ===
                    "core"
            )
                .length;
    }


    const allClasses =
        new Set();


    subjects.forEach(
        subject => {

            getSubjectClasses(
                subject.name
            )
                .forEach(
                    className => {

                        allClasses.add(
                            className
                        );
                    }
                );
        }
    );


    if (
        $("classesCovered")
    ) {

        $("classesCovered")
            .textContent =
            allClasses.size;
    }


    if (
        $("subjectCount")
    ) {

        $("subjectCount")
            .textContent =
            subjects.length;
    }
}


/* =========================================
   OPEN MODAL
========================================= */

function openSubjectModal(
    subject = null
) {

    $("subjectForm")
        ?.reset();


    if (
        $("subjectRecordId")
    ) {

        $("subjectRecordId")
            .value =
            subject?.id ||
            "";
    }


    if (
        $("subjectModalTitle")
    ) {

        $("subjectModalTitle")
            .textContent =

            subject
                ? "Edit Subject"
                : "Add New Subject";
    }


    if (
        $("subjectName")
    ) {

        $("subjectName")
            .value =
            subject?.name ||
            "";
    }


    if (
        $("subjectCode")
    ) {

        $("subjectCode")
            .value =
            subject?.code ||
            "";
    }


    if (
        $("subjectCategory")
    ) {

        $("subjectCategory")
            .value =
            subject?.category ||
            "Core";
    }


    if (
        $("subjectStatus")
    ) {

        $("subjectStatus")
            .value =
            subject?.status ||
            "active";
    }


    $("subjectModal")
        ?.classList
        .add(
            "active"
        );
}


/* =========================================
   CLOSE
========================================= */

function closeSubjectModal() {

    $("subjectModal")
        ?.classList
        .remove(
            "active"
        );
}


/* =========================================
   SAVE SUBJECT
========================================= */

async function saveSubject(
    event
) {

    event.preventDefault();


    const recordId =
        $("subjectRecordId")
            ?.value ||
        "";


    const existingSubject =
        recordId

            ? subjects.find(
                subject =>
                    String(
                        subject.id
                    )
                    ===
                    String(
                        recordId
                    )
            )

            : null;


    const oldSubjectName =
        existingSubject?.name ||
        "";


    const subjectData = {

        name:
            $("subjectName")
                ?.value
                .trim() ||
            "",

        code:
            $("subjectCode")
                ?.value
                .trim()
                .toUpperCase() ||
            "",

        category:
            $("subjectCategory")
                ?.value ||
            "Core",

        status:
            $("subjectStatus")
                ?.value ||
            "active"
    };


    if (
        !subjectData.name ||
        !subjectData.code
    ) {

        alert(
            "Please enter Subject Name and Subject Code."
        );

        return;
    }


    /*
        DUPLICATE NAME
    */

    const duplicateName =
        subjects.find(
            subject =>

                normalize(
                    subject.name
                )
                ===
                normalize(
                    subjectData.name
                )

                &&

                String(
                    subject.id
                )
                !==
                String(
                    recordId
                )
        );


    if (
        duplicateName
    ) {

        alert(
            "Another subject already uses this subject name."
        );

        return;
    }


    /*
        DUPLICATE CODE
    */

    const duplicateCode =
        subjects.find(
            subject =>

                normalize(
                    subject.code
                )
                ===
                normalize(
                    subjectData.code
                )

                &&

                String(
                    subject.id
                )
                !==
                String(
                    recordId
                )
        );


    if (
        duplicateCode
    ) {

        alert(
            "Another subject already uses this subject code."
        );

        return;
    }


    const button =
        $("saveSubjectBtn");


    if (
        button
    ) {

        button.disabled =
            true;


        button.textContent =
            "Saving...";
    }


    try {

        /*
            UPDATE EXISTING SUBJECT
        */

        if (
            recordId
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from("subjects")
                    .update(
                        subjectData
                    )
                    .eq(
                        "id",
                        recordId
                    );


            if (error) {
                throw error;
            }


            /*
                IF SUBJECT NAME CHANGED,
                UPDATE ACTIVE ASSIGNMENT TABLES.

                We do NOT rewrite historical results.
            */

            if (
                oldSubjectName &&
                normalize(
                    oldSubjectName
                )
                !==
                normalize(
                    subjectData.name
                )
            ) {

                const [
                    teacherUpdate,
                    studentUpdate
                ] =
                    await Promise.all([

                        supabaseClient
                            .from(
                                "teacher_assignments"
                            )
                            .update({

                                subject:
                                    subjectData.name

                            })
                            .eq(
                                "subject",
                                oldSubjectName
                            ),


                        supabaseClient
                            .from(
                                "student_subjects"
                            )
                            .update({

                                subject:
                                    subjectData.name

                            })
                            .eq(
                                "subject",
                                oldSubjectName
                            )

                    ]);


                if (
                    teacherUpdate.error
                ) {

                    throw teacherUpdate.error;
                }


                if (
                    studentUpdate.error
                ) {

                    throw studentUpdate.error;
                }


                /*
                    Keep compatibility field in
                    Teachers table in sync too.
                */

                const {
                    error:
                    teacherCompatibilityError
                } =
                    await supabaseClient
                        .from("Teachers")
                        .update({

                            subject:
                                subjectData.name

                        })
                        .eq(
                            "subject",
                            oldSubjectName
                        );


                if (
                    teacherCompatibilityError
                ) {

                    console.error(
                        "Teacher compatibility subject update error:",
                        teacherCompatibilityError
                    );
                }
            }


        } else {

            /*
                CREATE NEW SUBJECT
            */

            const {
                error
            } =
                await supabaseClient
                    .from("subjects")
                    .insert([
                        subjectData
                    ]);


            if (error) {
                throw error;
            }
        }


        closeSubjectModal();


        await loadSubjects();


        alert(
            recordId
                ? "Subject updated successfully."
                : "Subject added successfully."
        );


    } catch (error) {

        console.error(
            "Save subject error:",
            error
        );


        alert(
            "Could not save subject: " +
            error.message
        );


    } finally {

        if (
            button
        ) {

            button.disabled =
                false;


            button.textContent =
                "Save Subject";
        }
    }
}


/* =========================================
   EDIT SUBJECT
========================================= */

window.editSubject =
    function (
        id
    ) {

        const subject =
            subjects.find(
                item =>
                    String(
                        item.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (
            subject
        ) {

            openSubjectModal(
                subject
            );
        }
    };


/* =========================================
   DELETE SUBJECT
========================================= */

window.deleteSubject =
    async function (
        id
    ) {

        const subject =
            subjects.find(
                item =>
                    String(
                        item.id
                    )
                    ===
                    String(
                        id
                    )
            );


        if (!subject) {
            return;
        }


        /*
            HISTORICAL RESULTS CHECK

            Do not allow deleting a subject
            that already has academic results.
        */

        const hasResults =
            resultSubjects.some(
                result =>
                    normalize(
                        result.subject
                    )
                    ===
                    normalize(
                        subject.name
                    )
            );


        if (
            hasResults
        ) {

            alert(
                `"${subject.name}" already has student results. ` +
                `Do not delete it because that could damage historical records. ` +
                `Edit the subject and change its status to Inactive instead.`
            );

            return;
        }


        const confirmed =
            confirm(
                `Delete "${subject.name}"?\n\n` +
                `Its teacher assignments and student subject registrations will also be removed.`
            );


        if (!confirmed) {
            return;
        }


        try {

            /*
                REMOVE TEACHER ASSIGNMENTS
            */

            const {
                error:
                teacherAssignmentError
            } =
                await supabaseClient
                    .from(
                        "teacher_assignments"
                    )
                    .delete()
                    .eq(
                        "subject",
                        subject.name
                    );


            if (
                teacherAssignmentError
            ) {

                throw teacherAssignmentError;
            }


            /*
                REMOVE STUDENT REGISTRATIONS
            */

            const {
                error:
                studentRegistrationError
            } =
                await supabaseClient
                    .from(
                        "student_subjects"
                    )
                    .delete()
                    .eq(
                        "subject",
                        subject.name
                    );


            if (
                studentRegistrationError
            ) {

                throw studentRegistrationError;
            }


            /*
                DELETE SUBJECT
            */

            const {
                error:
                subjectDeleteError
            } =
                await supabaseClient
                    .from("subjects")
                    .delete()
                    .eq(
                        "id",
                        id
                    );


            if (
                subjectDeleteError
            ) {

                throw subjectDeleteError;
            }


            await loadSubjects();


            alert(
                "Subject deleted successfully."
            );


        } catch (error) {

            console.error(
                "Delete subject error:",
                error
            );


            alert(
                "Could not delete subject: " +
                error.message
            );
        }
    };


/* =========================================
   HELPERS
========================================= */

function capitalize(
    value
) {

    const text =
        String(
            value ||
            ""
        );


    return (
        text
            .charAt(0)
            .toUpperCase()

        +

        text.slice(1)
    );
}


function escapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}