import {
  apiFetch,
  debounce,
  formatDateLabel,
  getRoleCapabilities,
  normalizeRole,
  requireAuth,
  showToast
} from "./api.js";
import { renderEmptyState } from "./app.js";
import { renderShell } from "../components/layout.js";

const state = {
  currentUser: null,
  capabilities: null,
  contacts: [],
  messages: [],
  search: ""
};

function getAllowedContacts(users) {
  return users.filter((user) => {
    if (user.id === state.currentUser.id) {
      return false;
    }

    const role = normalizeRole(user.role);

    if (state.capabilities.isStudent) {
      return role === "Teacher" || role === "Admin";
    }

    if (state.capabilities.isAdmin) {
      return true;
    }

    return role === "Student" || role === "Teacher" || role === "Admin";
  });
}

function getContactRoleLabel(role) {
  return role === "Announcement" ? "Announcement" : normalizeRole(role);
}

function buildContent() {
  const page = renderShell("messages", {
    title: "Communication Portal",
    subtitle: "Simple teacher-student messaging with a clear compose and history workflow.",
    searchPlaceholder: "Search subjects, names, or message content..."
  });

  page.innerHTML = `
    <section class="message-layout">
      <article class="panel" data-animate>
        <div class="section-head">
          <div>
            <h3>Send Message</h3>
            <p>Share classroom updates, progress notes, clarifications, or admin announcements.</p>
          </div>
        </div>
        <form id="messageForm" class="form-grid">
          <div class="full-span">
            <label class="input-label" for="recipientId">Recipient</label>
            <select id="recipientId" name="recipientId" required></select>
          </div>
          <div class="full-span">
            <label class="input-label" for="messageSubject">Subject</label>
            <input id="messageSubject" name="subject" placeholder="Progress discussion" required />
          </div>
          <div class="full-span">
            <label class="input-label" for="messageContent">Message</label>
            <textarea id="messageContent" name="content" placeholder="Write your message here..." required></textarea>
          </div>
          <div class="full-span inline-actions">
            <button class="btn btn-primary" type="submit">Send Message</button>
          </div>
        </form>
      </article>

      <article class="panel" data-animate>
        <div class="section-head">
          <div>
            <h3>Message History</h3>
            <p>Messages sent and received in your role-aware workspace.</p>
          </div>
        </div>
        <div class="list-grid" id="messageList"></div>
      </article>
    </section>
  `;
}

function renderContacts() {
  const select = document.getElementById("recipientId");

  if (!state.contacts.length) {
    select.innerHTML = `<option value="">No recipients available</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = state.contacts
    .concat(
      state.capabilities.isAdmin
        ? [
            {
              id: "__broadcast__",
              name: "Broadcast Notice",
              role: "Announcement"
            }
          ]
        : []
    )
    .map((contact) => `<option value="${contact.id}">${contact.name} - ${getContactRoleLabel(contact.role)}</option>`)
    .join("");
}

function renderMessages() {
  const filteredMessages = state.messages.filter((message) => {
    const keyword = state.search.toLowerCase();
    return (
      !keyword ||
      message.subject.toLowerCase().includes(keyword) ||
      message.content.toLowerCase().includes(keyword) ||
      message.senderName.toLowerCase().includes(keyword) ||
      message.recipientName.toLowerCase().includes(keyword)
    );
  });

  document.getElementById("messageList").innerHTML = filteredMessages.length
    ? filteredMessages.map(
        (message) => `
          <article class="message-card">
            <div class="task-card-header">
              <div>
                <h4>${message.subject}</h4>
                <p class="muted">${message.senderName} to ${message.recipientName}</p>
              </div>
              <span class="badge primary">${formatDateLabel(message.createdAt)}</span>
            </div>
            ${message.category === "announcement" ? '<span class="pill primary">Broadcast Notice</span>' : ""}
            <p class="muted">${message.content}</p>
          </article>
        `
      ).join("")
    : renderEmptyState("No messages found", "Send a new message or try a different search.");
}

async function loadMessages() {
  const [users, messages] = await Promise.all([
    apiFetch("/auth/users"),
    apiFetch(`/messages?userId=${state.currentUser.id}`)
  ]);

  state.contacts = getAllowedContacts(users);
  state.messages = messages;

  renderContacts();
  renderMessages();
}

function bindEvents() {
  document.getElementById("messageForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = form.elements;

    try {
      await apiFetch("/messages", {
        method: "POST",
        body: {
          recipientId: fields.recipientId.value,
          subject: fields.subject.value.trim(),
          content: fields.content.value.trim()
        }
      });

      form.reset();
      showToast("Message sent successfully.");
      await loadMessages();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  window.addEventListener(
    "ssms:search",
    debounce((event) => {
      state.search = event.detail;
      renderMessages();
    })
  );
}

async function initMessages() {
  state.currentUser = requireAuth();

  if (!state.currentUser) {
    return;
  }

  state.capabilities = getRoleCapabilities(state.currentUser);
  buildContent();
  bindEvents();
  await loadMessages();
}

initMessages();
