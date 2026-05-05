import { apiFetch, applyTheme, redirectIfAuthenticated, setCurrentUser, showToast } from "./api.js";
import { setButtonLoading } from "./app.js";

applyTheme(localStorage.getItem("ssms-theme") || "light");

if (!redirectIfAuthenticated()) {
  const form = document.getElementById("signupForm");
  const submitButton = document.getElementById("signupButton");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = form.elements;

    const payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      role: fields.role.value.trim() || "Faculty",
      password: fields.password.value.trim()
    };
    const confirmPassword = fields.confirmPassword.value.trim();

    if (!payload.name || !payload.email || !payload.password) {
      showToast("Name, email, and password are required.", "error");
      return;
    }

    if (payload.password.length < 6) {
      showToast("Password should be at least 6 characters.", "error");
      return;
    }

    if (payload.password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    try {
      setButtonLoading(submitButton, true, "Creating account...");
      const response = await apiFetch("/auth/signup", {
        method: "POST",
        body: payload
      });

      setCurrentUser(response.user);
      applyTheme(response.user.theme || "light");
      showToast("Your account is ready.");
      window.location.href = "/dashboard";
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
