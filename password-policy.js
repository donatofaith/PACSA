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

    window.PACSA_PASSWORD_POLICY = Object.freeze({
        minLength: 8,
        pattern: "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}",
        help: "At least 8 characters with uppercase, lowercase, a number and a special character.",
        validate,
        isValid(password) {
            return validate(password).valid;
        }
    });
})();
