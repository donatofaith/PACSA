const togglePassword =
document.getElementById("togglePassword");

const passwordInput =
document.getElementById("password");

togglePassword.addEventListener("click", () => {

  if(passwordInput.type === "password"){

    passwordInput.type = "text";
    togglePassword.textContent = "🙈";

  }else{

    passwordInput.type = "password";
    togglePassword.textContent = "👁";

  }

});

document
.getElementById("studentLoginForm")
.addEventListener("submit", async function(e){

  e.preventDefault();

  const studentId =
  document.getElementById("studentId").value.trim();

  const password =
  document.getElementById("password").value.trim();

  try {

    const { data, error } =
    await supabaseClient
    .from("students")
    .select("*")
    .eq("student_id", studentId)
    .eq("password", password)
    .single();

    if(error){
      console.log(error);
      alert("Invalid Student ID or Password");
      return;
    }

    if(!data){
      alert("Student not found");
      return;
    }

    localStorage.setItem(
      "student",
      JSON.stringify(data)
    );

    alert("Login Successful");

    window.location.href =
    "student-dashboard.html";

  } catch(err){

    console.log(err);

    alert("Connection Error");

  }

});