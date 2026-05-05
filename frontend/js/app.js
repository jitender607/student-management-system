export const SUBJECTS = ["Mathematics", "Science", "English", "Computer", "History"];

export function setButtonLoading(button, isLoading, loadingLabel = "Please wait...") {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span>${loadingLabel}`;
    button.disabled = true;
    return;
  }

  button.innerHTML = button.dataset.originalText || button.innerHTML;
  button.disabled = false;
}

export function renderEmptyState(title, description) {
  return `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${description}</p>
    </div>
  `;
}

export function createModalController(selector) {
  return {
    open() {
      const modal = document.querySelector(selector);
      modal?.classList.add("open");
    },
    close() {
      const modal = document.querySelector(selector);
      modal?.classList.remove("open");
    }
  };
}

export function average(values = []) {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Number((total / values.length).toFixed(2));
}

export function getRemark(averageScore) {
  if (averageScore >= 80) {
    return "Excellent";
  }

  if (averageScore >= 60) {
    return "Good";
  }

  return "Needs Improvement";
}

export function getGrade(averageScore) {
  if (averageScore >= 90) {
    return "A+";
  }

  if (averageScore >= 80) {
    return "A";
  }

  if (averageScore >= 70) {
    return "B";
  }

  if (averageScore >= 60) {
    return "C";
  }

  if (averageScore >= 50) {
    return "D";
  }

  return "Needs Support";
}

export function confirmAction({
  title = "Confirm action",
  message = "Are you sure you want to continue?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel"
} = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal confirm-modal open";
    modal.innerHTML = `
      <div class="modal-content confirm-card">
        <div class="modal-head">
          <div>
            <h3>${title}</h3>
            <p class="muted">${message}</p>
          </div>
        </div>
        <div class="inline-actions confirm-actions">
          <button class="btn btn-danger" data-confirm="true" type="button">${confirmLabel}</button>
          <button class="btn btn-secondary" data-confirm="false" type="button">${cancelLabel}</button>
        </div>
      </div>
    `;

    function close(result) {
      modal.remove();
      resolve(result);
    }

    modal.addEventListener("click", (event) => {
      const button = event.target.closest("[data-confirm]");

      if (button) {
        close(button.dataset.confirm === "true");
        return;
      }

      if (event.target === modal) {
        close(false);
      }
    });

    document.body.appendChild(modal);
  });
}
