/* PACSA shared password policy */
(function () {
    const rules = {
        minLength: 8,
        uppercase: /[A-Z]/,
        lowercase: /[a-z]/,
        number: /[0-9]/,
        special: /[^A-Za-z0-9]/
    };

    function validate(password) {
        const value = String(password ?? "");
        if (value.length < rules.minLength) {
            return { valid: false, message: "Password must contain at least 8 characters." };
        }
        if (!rules.uppercase.test(value)) {
            return { valid: false, message: "Password must include at least one uppercase letter." };
        }
        if (!rules.lowercase.test(value)) {
            return { valid: false, message: "Password must include at least one lowercase letter." };
        }
        if (!rules.number.test(value)) {
            return { valid: false, message: "Password must include at least one number." };
        }
        if (!rules.special.test(value)) {
            return { valid: false, message: "Password must include at least one special character." };
        }
        return { valid: true, message: "" };
    }

    const policy = Object.freeze({
        minLength: 8,
        pattern: "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}",
        help: "At least 8 characters with uppercase, lowercase, a number and a special character.",
        validate,
        isValid(password) {
            return validate(password).valid;
        }
    });

    window.PACSA_PASSWORD_POLICY = policy;

    function applyToPage() {
        const passwordInputs = [
            document.getElementById("password"),
            document.getElementById("newPassword"),
            document.getElementById("confirmPassword")
        ].filter(Boolean);

        passwordInputs.forEach(input => {
            input.minLength = policy.minLength;
            input.pattern = policy.pattern;
            input.title = policy.help;
        });

        document.querySelectorAll(".password-help").forEach(help => {
            help.textContent = policy.help;
        });

        const forms = [
            document.getElementById("studentRegisterForm"),
            document.getElementById("teacherRegisterForm"),
            document.getElementById("resetForm")
        ].filter(Boolean);

        forms.forEach(form => {
            form.addEventListener("submit", event => {
                const passwordInput = form.querySelector("#password, #newPassword");
                const confirmInput = form.querySelector("#confirmPassword");
                if (!passwordInput) return;

                passwordInput.setCustomValidity("");
                if (confirmInput) confirmInput.setCustomValidity("");

                const result = validate(passwordInput.value);
                if (!result.valid) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    passwordInput.setCustomValidity(result.message);
                    passwordInput.reportValidity();
                    return;
                }

                if (confirmInput && passwordInput.value !== confirmInput.value) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    confirmInput.setCustomValidity("Passwords do not match.");
                    confirmInput.reportValidity();
                }
            }, true);

            const passwordInput = form.querySelector("#password, #newPassword");
            const confirmInput = form.querySelector("#confirmPassword");
            passwordInput?.addEventListener("input", () => passwordInput.setCustomValidity(""));
            confirmInput?.addEventListener("input", () => confirmInput.setCustomValidity(""));
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyToPage, { once: true });
    } else {
        applyToPage();
    }
})();
