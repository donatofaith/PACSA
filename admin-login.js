const togglePassword =
document.getElementById("togglePassword");

const password =
document.getElementById("password");

togglePassword.addEventListener("click",()=>{

if(password.type === "password"){

password.type = "text";

}else{

password.type = "password";

}

});

document
.getElementById("loginForm")
.addEventListener("submit",function(e){

e.preventDefault();

const username =
document.getElementById("username").value;

const pwd =
document.getElementById("password").value;

/* Demo Login */

if(
username === "admin" &&
pwd === "admin123"
){

window.location.href =
"admin-dashboard.html";

}else{

alert(
"Invalid Username or Password"
);

}

});