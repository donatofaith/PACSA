const settingsForm = document.getElementById("settingsForm");

document.getElementById("saveSettingsBtn").addEventListener("click", () => {

    if (!settingsForm.checkValidity()) {
        settingsForm.reportValidity();
        return;
    }

    alert("Settings saved successfully.");
});

document.getElementById("menuBtn").addEventListener("click", () => {

    document.getElementById("sidebar").classList.toggle("open");

});

document.getElementById("logoutBtn").addEventListener("click", e => {

    e.preventDefault();

    if (confirm("Are you sure you want to logout?")) {
        window.location.href = "login.html";
    }

});