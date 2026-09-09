/* =========================================
   PACSA APPLICATION APPROVAL HOTFIX
   Fixes student schema mismatch: students table uses
   first_name + last_name (no fullname column).
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


async function createStudentFromApplication(app) {

    const existing =
        await findExistingStudent(app);

    if (existing) {
        return existing;
    }

    const studentId =
        await generateStudentId();

    const names =
        splitFullName(
            app.full_name
        );

    const studentData = {
        student_id:
            studentId,

        first_name:
            names.first_name,

        last_name:
            names.last_name,

        email:
            app.email || null,

        phone:
            app.phone || null,

        class:
            app.class || null,

        status:
            "Active",

        portal_status:
            "not_activated",

        auth_user_id:
            null
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
