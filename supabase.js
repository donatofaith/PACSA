const SUPABASE_URL =
"https://wcjjzjyelihefaixwyrh.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_WyUzZ2XoiFpU1N8KWloDpg_cTfaGQq7";

const supabaseClient =
supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================
   PACSA DOCUMENT COLLECTION
   NIN + birth certificate + leaving cert
========================================= */

const PACSA_DOCUMENTS_BUCKET = "pacsa-documents";
const PACSA_MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
const PACSA_ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

function pacsaDoc$(id) {
  return document.getElementById(id);
}

function pacsaClean(value) {
  return String(value ?? "").trim();
}

function pacsaNormalizeEmail(value) {
  return pacsaClean(value).toLowerCase();
}

function pacsaSafeFilePart(value) {
  return pacsaClean(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pacsa";
}

function pacsaIsImageFile(file) {
  return file && PACSA_ALLOWED_DOCUMENT_TYPES.includes(file.type);
}

function pacsaValidateNin(value, required = true) {
  const nin = pacsaClean(value).replace(/\D/g, "");

  if (!nin && !required) return "";

  if (!/^\d{11}$/.test(nin)) {
    throw new Error("NIN must contain exactly 11 digits.");
  }

  return nin;
}

function pacsaValidateDocumentFile(file, label, required = true) {
  if (!file) {
    if (required) {
      throw new Error(`${label} is required.`);
    }

    return null;
  }

  if (!pacsaIsImageFile(file)) {
    throw new Error(`${label} must be JPG, PNG, or WEBP image.`);
  }

  if (file.size > PACSA_MAX_DOCUMENT_SIZE) {
    throw new Error(`${label} must not be larger than 5MB.`);
  }

  return file;
}

async function pacsaUploadDocument(file, folder, kind) {
  const cleanFolder = pacsaSafeFilePart(folder);
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${Date.now()}-${kind}-${Math.random().toString(36).slice(2)}.${extension}`;
  const path = `${cleanFolder}/${fileName}`;

  const { error } = await supabaseClient.storage
    .from(PACSA_DOCUMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  return path;
}

function pacsaDocumentFieldsHtml(prefix, required) {
  return `
    <div class="form-group pacsa-document-field">
      <label for="${prefix}Nin">NIN</label>
      <input
        type="text"
        id="${prefix}Nin"
        inputmode="numeric"
        pattern="\\d{11}"
        maxlength="11"
        placeholder="Enter 11-digit NIN"
        ${required ? "required" : ""}
      >
      <small style="display:block;margin-top:6px;color:#6b7280;font-size:12px;">
        Enter digits only.
      </small>
    </div>

    <div class="form-group pacsa-document-field">
      <label for="${prefix}BirthCertificate">Birth Certificate</label>
      <input
        type="file"
        id="${prefix}BirthCertificate"
        accept="image/jpeg,image/png,image/webp"
        ${required ? "required" : ""}
      >
      <input type="hidden" id="${prefix}BirthCertificatePath">
      <small id="${prefix}BirthCertificateCurrent" style="display:block;margin-top:6px;color:#6b7280;font-size:12px;"></small>
    </div>

    <div class="form-group pacsa-document-field">
      <label for="${prefix}SchoolLeavingCertificate">School Leaving Certificate</label>
      <input
        type="file"
        id="${prefix}SchoolLeavingCertificate"
        accept="image/jpeg,image/png,image/webp"
        ${required ? "required" : ""}
      >
      <input type="hidden" id="${prefix}SchoolLeavingCertificatePath">
      <small id="${prefix}SchoolLeavingCertificateCurrent" style="display:block;margin-top:6px;color:#6b7280;font-size:12px;"></small>
    </div>
  `;
}

function pacsaSetMessage(text, color) {
  const message = pacsaDoc$("formMessage");

  if (!message) return;

  message.style.color = color;
  message.textContent = text;
}

function pacsaGetMinimumAgeDate() {
  const today = new Date();
  const maximumBirthDate = new Date(
    today.getFullYear() - 9,
    today.getMonth(),
    today.getDate()
  );

  const year = maximumBirthDate.getFullYear();
  const month = String(maximumBirthDate.getMonth() + 1).padStart(2, "0");
  const day = String(maximumBirthDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function pacsaIsAtLeastNineYearsOld(dateString) {
  if (!dateString) return false;

  const birthDate = new Date(`${dateString}T00:00:00`);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age >= 9;
}

function pacsaFriendlySubmitError(error) {
  const text = String(error?.message || error || "").toLowerCase();

  if (text.includes("9 years")) {
    return "Applicant must be at least 9 years old.";
  }

  if (
    text.includes("already registered") ||
    text.includes("duplicate") ||
    text.includes("23505")
  ) {
    return "This email is already registered in PACSA. Please use another email or contact the school.";
  }

  if (text.includes("storage") || text.includes("bucket")) {
    return "Could not upload documents. Please make sure the PACSA document storage setup has been completed.";
  }

  return "Could not submit application: " + (error?.message || "Unknown error");
}

function pacsaInstallApplicationDocuments() {
  const form = pacsaDoc$("applicationForm");
  const emailInput = pacsaDoc$("email");

  if (!form || !emailInput || pacsaDoc$("applicationNin")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = pacsaDocumentFieldsHtml("application", true);

  const additionalInfo = pacsaDoc$("additionalInformation")?.closest(".form-group");
  form.insertBefore(wrapper, additionalInfo || pacsaDoc$("formMessage"));

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const submitBtn = pacsaDoc$("submitBtn");
      const dateOfBirth = pacsaDoc$("dateOfBirth")?.value || "";

      pacsaSetMessage("", "");

      try {
        if (!pacsaIsAtLeastNineYearsOld(dateOfBirth)) {
          throw new Error("Applicant must be at least 9 years old.");
        }

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        const nin = pacsaValidateNin(pacsaDoc$("applicationNin")?.value, true);
        const birthFile = pacsaValidateDocumentFile(
          pacsaDoc$("applicationBirthCertificate")?.files?.[0],
          "Birth certificate",
          true
        );
        const leavingFile = pacsaValidateDocumentFile(
          pacsaDoc$("applicationSchoolLeavingCertificate")?.files?.[0],
          "School leaving certificate",
          true
        );

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Uploading documents...";
        }

        const email = pacsaNormalizeEmail(pacsaDoc$("email")?.value);
        const folder = `applications/${email || pacsaDoc$("fullName")?.value || Date.now()}`;

        const birth_certificate_path = await pacsaUploadDocument(
          birthFile,
          folder,
          "birth-certificate"
        );

        const school_leaving_certificate_path = await pacsaUploadDocument(
          leavingFile,
          folder,
          "school-leaving-certificate"
        );

        if (submitBtn) {
          submitBtn.textContent = "Submitting...";
        }

        const application = {
          full_name: pacsaDoc$("fullName")?.value.trim(),
          date_of_birth: dateOfBirth,
          gender: pacsaDoc$("gender")?.value,
          class: pacsaDoc$("classApplying")?.value,
          parent_name: pacsaDoc$("parentName")?.value.trim(),
          phone: pacsaDoc$("phone")?.value.trim(),
          email,
          nin,
          birth_certificate_path,
          school_leaving_certificate_path,
          address: pacsaDoc$("address")?.value.trim(),
          previous_school: pacsaDoc$("previousSchool")?.value.trim(),
          additional_information: pacsaDoc$("additionalInformation")?.value.trim(),
          status: "pending"
        };

        const { data, error } = await supabaseClient
          .from("applications")
          .insert([application])
          .select("id, full_name, email, class, parent_name, phone, status, created_at")
          .single();

        if (error) throw error;

        try {
          await supabaseClient.functions.invoke("smooth-api", {
            body: {
              type: "new_application",
              application_id: data?.id,
              full_name: data?.full_name || application.full_name,
              email: data?.email || application.email,
              class: data?.class || application.class,
              parent_name: data?.parent_name || application.parent_name,
              phone: data?.phone || application.phone
            }
          });
        } catch (noticeError) {
          console.warn("Admin application email notification failed:", noticeError);
        }

        pacsaSetMessage(
          "Application submitted successfully! Our admissions team will contact you.",
          "#15803d"
        );

        form.reset();
        const dob = pacsaDoc$("dateOfBirth");
        if (dob) dob.max = pacsaGetMinimumAgeDate();

      } catch (error) {
        console.error("Application submission error:", error);
        pacsaSetMessage(pacsaFriendlySubmitError(error), "#dc2626");

      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Application";
        }
      }
    },
    true
  );
}

function pacsaInstallStudentDocumentFields() {
  const studentForm = pacsaDoc$("studentForm");
  const formGrid = studentForm?.querySelector(".form-grid");

  if (!studentForm || !formGrid || pacsaDoc$("studentNin")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = pacsaDocumentFieldsHtml("student", false);

  while (wrapper.firstElementChild) {
    formGrid.appendChild(wrapper.firstElementChild);
  }

  const detailsGrid = document.querySelector("#viewStudentModal .profile-details-grid");

  if (detailsGrid && !pacsaDoc$("viewStudentNin")) {
    detailsGrid.insertAdjacentHTML(
      "beforeend",
      `
        <div>
          <span>NIN</span>
          <strong id="viewStudentNin">—</strong>
        </div>
        <div>
          <span>Documents</span>
          <strong id="viewStudentDocuments">—</strong>
        </div>
      `
    );
  }

  document.addEventListener("click", () => {
    setTimeout(pacsaFillStudentDocumentFields, 200);
  });

  studentForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      await pacsaSaveStudentWithDocuments();
    },
    true
  );
}

async function pacsaLoadStudentDocumentInfo(studentId) {
  if (!studentId) return null;

  const { data, error } = await supabaseClient
    .from("students")
    .select("student_id, nin, birth_certificate_path, school_leaving_certificate_path")
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    console.warn("Could not load student documents:", error);
    return null;
  }

  return data;
}

async function pacsaFillStudentDocumentFields() {
  const studentId = pacsaDoc$("studentRecordId")?.value || pacsaDoc$("viewStudentId")?.textContent;
  const cleanedId = pacsaClean(studentId);

  if (!cleanedId || cleanedId === "PACSA000") return;

  const info = await pacsaLoadStudentDocumentInfo(cleanedId);

  if (!info) return;

  if (pacsaDoc$("studentNin")) {
    pacsaDoc$("studentNin").value = info.nin || "";
  }

  if (pacsaDoc$("studentBirthCertificatePath")) {
    pacsaDoc$("studentBirthCertificatePath").value = info.birth_certificate_path || "";
  }

  if (pacsaDoc$("studentSchoolLeavingCertificatePath")) {
    pacsaDoc$("studentSchoolLeavingCertificatePath").value = info.school_leaving_certificate_path || "";
  }

  if (pacsaDoc$("studentBirthCertificateCurrent")) {
    pacsaDoc$("studentBirthCertificateCurrent").textContent = info.birth_certificate_path
      ? "Current birth certificate already uploaded. Select a new image only to replace it."
      : "No birth certificate uploaded yet.";
  }

  if (pacsaDoc$("studentSchoolLeavingCertificateCurrent")) {
    pacsaDoc$("studentSchoolLeavingCertificateCurrent").textContent = info.school_leaving_certificate_path
      ? "Current school leaving certificate already uploaded. Select a new image only to replace it."
      : "No school leaving certificate uploaded yet.";
  }

  if (pacsaDoc$("viewStudentNin")) {
    pacsaDoc$("viewStudentNin").textContent = info.nin || "—";
  }

  if (pacsaDoc$("viewStudentDocuments")) {
    const count = [
      info.birth_certificate_path,
      info.school_leaving_certificate_path
    ].filter(Boolean).length;

    pacsaDoc$("viewStudentDocuments").textContent = `${count}/2 uploaded`;
  }
}

async function pacsaSaveStudentWithDocuments() {
  const oldStudentId = pacsaClean(pacsaDoc$("studentRecordId")?.value);
  const saveButton = pacsaDoc$("saveStudentBtn");

  const studentData = {
    first_name: pacsaClean(pacsaDoc$("studentFirstName")?.value),
    last_name: pacsaClean(pacsaDoc$("studentLastName")?.value),
    student_id: pacsaClean(pacsaDoc$("studentId")?.value),
    email: pacsaClean(pacsaDoc$("studentEmail")?.value),
    phone: pacsaClean(pacsaDoc$("studentPhone")?.value),
    class: pacsaClean(pacsaDoc$("studentClass")?.value),
    gender: pacsaClean(pacsaDoc$("studentGender")?.value),
    status: pacsaClean(pacsaDoc$("studentStatus")?.value) || "active"
  };

  try {
    const nin = pacsaValidateNin(pacsaDoc$("studentNin")?.value, false);
    const birthFile = pacsaValidateDocumentFile(
      pacsaDoc$("studentBirthCertificate")?.files?.[0],
      "Birth certificate",
      false
    );
    const leavingFile = pacsaValidateDocumentFile(
      pacsaDoc$("studentSchoolLeavingCertificate")?.files?.[0],
      "School leaving certificate",
      false
    );

    if (nin) {
      studentData.nin = nin;
    }

    if (!studentData.first_name || !studentData.last_name || !studentData.student_id || !studentData.class) {
      alert("Please enter First Name, Last Name, Student ID and Class.");
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    const folder = `students/${studentData.student_id || studentData.email || Date.now()}`;

    if (birthFile) {
      if (saveButton) saveButton.textContent = "Uploading birth certificate...";
      studentData.birth_certificate_path = await pacsaUploadDocument(
        birthFile,
        folder,
        "birth-certificate"
      );
    }

    if (leavingFile) {
      if (saveButton) saveButton.textContent = "Uploading leaving certificate...";
      studentData.school_leaving_certificate_path = await pacsaUploadDocument(
        leavingFile,
        folder,
        "school-leaving-certificate"
      );
    }

    const existingBirthPath = pacsaClean(pacsaDoc$("studentBirthCertificatePath")?.value);
    const existingLeavingPath = pacsaClean(pacsaDoc$("studentSchoolLeavingCertificatePath")?.value);

    if (!birthFile && existingBirthPath) {
      studentData.birth_certificate_path = existingBirthPath;
    }

    if (!leavingFile && existingLeavingPath) {
      studentData.school_leaving_certificate_path = existingLeavingPath;
    }

    if (oldStudentId) {
      const { error } = await supabaseClient
        .from("students")
        .update(studentData)
        .eq("student_id", oldStudentId);

      if (error) throw error;

      if (oldStudentId !== studentData.student_id) {
        const { error: subjectIdError } = await supabaseClient
          .from("student_subjects")
          .update({ student_id: studentData.student_id })
          .eq("student_id", oldStudentId);

        if (subjectIdError) throw subjectIdError;
      }

      await supabaseClient
        .from("student_subjects")
        .update({ class: studentData.class })
        .eq("student_id", studentData.student_id);

    } else {
      const { error } = await supabaseClient
        .from("students")
        .insert([studentData]);

      if (error) throw error;
    }

    if (typeof closeStudentModal === "function") {
      closeStudentModal();
    } else {
      pacsaDoc$("studentModal")?.classList.remove("active");
    }

    if (typeof loadPageData === "function") {
      await loadPageData();
    }

    alert(oldStudentId ? "Student updated successfully." : "Student added successfully.");

  } catch (error) {
    console.error("Save student error:", error);
    alert("Could not save student: " + (error?.message || "Unknown error"));

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save Student";
    }
  }
}

function pacsaInstallDocumentCollection() {
  pacsaInstallApplicationDocuments();
  pacsaInstallStudentDocumentFields();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pacsaInstallDocumentCollection);
} else {
  pacsaInstallDocumentCollection();
}
