import { apiFetch, applyTheme, redirectIfAuthenticated, setCurrentUser, showToast } from "./api.js";
import { setButtonLoading } from "./app.js";

applyTheme(localStorage.getItem("ssms-theme") || "light");

if (!redirectIfAuthenticated()) {
  const form = document.getElementById("loginForm");
  const submitButton = document.getElementById("loginButton");
  const demoLoginCards = document.querySelectorAll("[data-demo-email]");

  demoLoginCards.forEach((card) => {
    card.addEventListener("click", () => {
      form.elements.email.value = card.dataset.demoEmail || "";
      form.elements.password.value = card.dataset.demoPassword || "";
      form.elements.email.focus();
      showToast("Jitender student login added to the form.", "info");
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = form.elements;

    const email = fields.email.value.trim();
    const password = fields.password.value.trim();

    if (!email || !password) {
      showToast("Enter your email and password to continue.", "error");
      return;
    }

    try {
      setButtonLoading(submitButton, true, "Signing in...");
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password }
      });

      setCurrentUser(response.user);
      applyTheme(response.user.theme || "light");
      showToast("Welcome back to SSMS Pro.");
      window.location.href = "/dashboard";
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
