import {
  apiFetch,
  debounce,
  formatDateLabel,
  getRoleCapabilities,
  requireAuth,
  showToast
} from "./api.js";
import { confirmAction, renderEmptyState } from "./app.js";
import { renderShell } from "../components/layout.js";

const state = {
  currentUser: null,
  capabilities: null,
  tasks: [],
  search: "",
  page: 1,
  pageSize: 6
};

function buildContent() {
  const page = renderShell("tasks", {
    title: "Tasks",
    subtitle: "Keep admin work moving with clean tracking, strong visibility, and quick status updates.",
    searchPlaceholder: "Search tasks..."
  });

  page.innerHTML = `
    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Create Task</h3>
          <p>Add operational work with priority and due date details.</p>
        </div>
      </div>
      <form id="taskForm" class="form-grid">
        <div class="full-span">
          <label class="input-label" for="taskTitle">Task Title</label>
          <input id="taskTitle" name="title" placeholder="Schedule PTM follow-up" required />
        </div>
        <div>
          <label class="input-label" for="taskDueDate">Due Date</label>
          <input id="taskDueDate" name="dueDate" type="date" />
        </div>
        <div>
          <label class="input-label" for="taskPriority">Priority</label>
          <select id="taskPriority" name="priority">
            <option value="High">High</option>
            <option value="Medium" selected>Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div class="full-span inline-actions">
          <button class="btn btn-primary" type="submit">Add Task</button>
        </div>
      </form>
    </section>

    <section class="summary-grid">
      <article class="mini-card" data-animate>
        <span class="muted">Pending</span>
        <strong id="pendingTasks">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Completed</span>
        <strong id="completedTasks">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Completion Rate</span>
        <strong id="completionRate">0%</strong>
      </article>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Task Board</h3>
          <p>Manage tasks with fast completion toggles and delete actions.</p>
        </div>
      </div>
      <div class="task-grid" id="taskGrid"></div>
      <div class="pagination-bar">
        <span id="taskPaginationLabel" class="muted">Showing 0 tasks</span>
        <div class="inline-actions">
          <button class="btn btn-secondary" id="taskPrevPage" type="button">Previous</button>
          <button class="btn btn-secondary" id="taskNextPage" type="button">Next</button>
        </div>
      </div>
    </section>
  `;
}

function updateSummary() {
  const pending = state.tasks.filter((task) => !task.completed).length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const completionRate = state.tasks.length
    ? Number(((completed / state.tasks.length) * 100).toFixed(0))
    : 0;

  document.getElementById("pendingTasks").textContent = pending;
  document.getElementById("completedTasks").textContent = completed;
  document.getElementById("completionRate").textContent = `${completionRate}%`;
}

function renderTasks() {
  const grid = document.getElementById("taskGrid");
  const filteredTasks = state.tasks.filter((task) => {
    const keyword = state.search.toLowerCase();
    return !keyword || task.title.toLowerCase().includes(keyword);
  });
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const startIndex = (state.page - 1) * state.pageSize;
  const visibleTasks = filteredTasks.slice(startIndex, startIndex + state.pageSize);

  document.getElementById("taskPaginationLabel").textContent = filteredTasks.length
    ? `Showing ${startIndex + 1}-${Math.min(startIndex + state.pageSize, filteredTasks.length)} of ${filteredTasks.length} tasks`
    : "Showing 0 tasks";
  document.getElementById("taskPrevPage").disabled = state.page <= 1;
  document.getElementById("taskNextPage").disabled = state.page >= pageCount;

  if (!filteredTasks.length) {
    grid.innerHTML = renderEmptyState("No tasks found", "Create a new task or refine your search.");
    updateSummary();
    return;
  }

  grid.innerHTML = visibleTasks
    .map(
      (task) => `
        <article class="task-card ${task.completed ? "complete" : ""}">
          <div class="task-card-header">
            <div>
              <h4 class="task-title">${task.title}</h4>
              <p class="muted">${formatDateLabel(task.dueDate)}</p>
            </div>
            <span class="badge ${
              task.completed ? "success" : task.priority === "High" ? "danger" : task.priority === "Medium" ? "warning" : "primary"
            }">${task.completed ? "Done" : task.priority}</span>
          </div>
          <div class="task-actions">
            <button class="btn ${task.completed ? "btn-secondary" : "btn-success"} toggle-task" data-id="${task.id}" data-completed="${task.completed}" type="button">
              ${task.completed ? "Reopen" : "Complete"}
            </button>
            <button class="btn btn-danger delete-task" data-id="${task.id}" type="button">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  updateSummary();
}

async function loadTasks() {
  state.tasks = await apiFetch("/tasks");
  renderTasks();
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;

  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: {
        title: fields.title.value.trim(),
        dueDate: fields.dueDate.value,
        priority: fields.priority.value
      }
    });

    form.reset();
    showToast("Task created successfully.");
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function toggleTask(id, completed) {
  try {
    await apiFetch(`/tasks/${id}`, {
      method: "PUT",
      body: {
        completed: !completed
      }
    });
    showToast("Task updated successfully.");
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteTask(id) {
  const confirmed = await confirmAction({
    title: "Delete task?",
    message: "This removes the task from the board and records the action in logs.",
    confirmLabel: "Delete Task"
  });

  if (!confirmed) {
    return;
  }

  try {
    await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    showToast("Task deleted successfully.");
    await loadTasks();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function bindEvents() {
  document.getElementById("taskForm")?.addEventListener("submit", handleTaskSubmit);
  document.getElementById("taskPrevPage")?.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderTasks();
  });
  document.getElementById("taskNextPage")?.addEventListener("click", () => {
    state.page += 1;
    renderTasks();
  });

  document.getElementById("taskGrid")?.addEventListener("click", async (event) => {
    const toggleButton = event.target.closest(".toggle-task");
    const deleteButton = event.target.closest(".delete-task");

    if (toggleButton) {
      await toggleTask(toggleButton.dataset.id, toggleButton.dataset.completed === "true");
    }

    if (deleteButton) {
      await deleteTask(deleteButton.dataset.id);
    }
  });

  window.addEventListener(
    "ssms:search",
    debounce((event) => {
      state.search = event.detail;
      state.page = 1;
      renderTasks();
    })
  );
}

async function initTasks() {
  state.currentUser = requireAuth();

  if (!state.currentUser) {
    return;
  }

  state.capabilities = getRoleCapabilities(state.currentUser);

  if (!state.capabilities.canManageTasks) {
    showToast("Tasks management is available for Admin and Teacher roles.", "info");
    window.location.href = "/dashboard";
    return;
  }

  buildContent();
  bindEvents();
  await loadTasks();
}

initTasks();
