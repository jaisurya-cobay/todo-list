/**
 * Zero-dependency TODO app.
 * Data model intentionally simple and resilient to schema changes.
 * @version 2.0
 */

const STORAGE_KEY = "todo-app:v2";

/**
 * @typedef {Object} Todo
 * @property {string} id
 * @property {string} title
 * @property {boolean} completed
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {"low"|"medium"|"high"} priority
 * @property {string|null} dueDate
 */

/**
 * @typedef {"all"|"active"|"completed"} Filter
 */

function createId() {
  // Compact, collision-resistant enough for local apps.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeTrimTitle(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * @returns {Todo[]}
 */
function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => {
        const title = safeTrimTitle(t?.title);
        if (!title) return null;
        return {
          id: typeof t?.id === "string" && t.id ? t.id : createId(),
          title,
          completed: Boolean(t?.completed),
          createdAt: Number.isFinite(t?.createdAt) ? t.createdAt : Date.now(),
          updatedAt: Number.isFinite(t?.updatedAt) ? t.updatedAt : Date.now(),
          priority: ["low", "medium", "high"].includes(t?.priority) ? t.priority : "medium",
          dueDate: typeof t?.dueDate === "string" ? t.dueDate : null,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {Todo[]} todos
 */
function saveTodos(todos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // If storage is unavailable/quota exceeded, keep the app usable in-memory.
  }
}

function byUpdatedDesc(a, b) {
  return b.updatedAt - a.updatedAt;
}

/**
 * @param {Todo[]} todos
 * @param {Filter} filter
 */
function applyFilter(todos, filter) {
  if (filter === "active") return todos.filter((t) => !t.completed);
  if (filter === "completed") return todos.filter((t) => t.completed);
  return todos;
}

function countActive(todos) {
  return todos.reduce((acc, t) => acc + (t.completed ? 0 : 1), 0);
}

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

const createForm = el("create-form");
const newTodoInput = /** @type {HTMLInputElement} */ (el("new-todo"));
const listEl = el("list");
const countEl = el("count");
const toggleAllBtn = el("toggle-all");
const clearCompletedBtn = el("clear-completed");
const taskCountBadge = el("task-count-badge");
const lastUpdatedEl = el("last-updated");
const template = /** @type {HTMLTemplateElement} */ (el("todo-item-template"));

/** @type {Filter} */
let currentFilter = "all";
/** @type {Todo[]} */
let todos = loadTodos().sort(byUpdatedDesc);

function setFilter(next) {
  currentFilter = next;
  for (const btn of document.querySelectorAll("[data-filter]")) {
    const b = /** @type {HTMLButtonElement} */ (btn);
    const isActive = b.dataset.filter === next;
    b.setAttribute("aria-pressed", String(isActive));
  }
  render();
}

function updateMeta() {
  const active = countActive(todos);
  const total = todos.length;
  const completed = total - active;
  const itemLabel = active === 1 ? "item" : "items";
  countEl.textContent = `${active} ${itemLabel} left · ${completed} completed`;

  taskCountBadge.textContent = String(total);

  if (todos.length > 0) {
    const latest = new Date(Math.max(...todos.map((t) => t.updatedAt)));
    lastUpdatedEl.textContent = `Last updated: ${latest.toLocaleString()}`;
  } else {
    lastUpdatedEl.textContent = "";
  }

  toggleAllBtn.disabled = total === 0;
  clearCompletedBtn.disabled = completed === 0;
}

/**
 * @param {Todo} todo
 * @returns {HTMLElement}
 */
function renderItem(todo) {
  const fragment = template.content.cloneNode(true);
  const li = /** @type {HTMLElement} */ (fragment.querySelector("li"));
  const titleEl = /** @type {HTMLElement} */ (fragment.querySelector(".title"));
  const editInput = /** @type {HTMLInputElement} */ (fragment.querySelector(".edit"));
  const toggle = /** @type {HTMLInputElement} */ (fragment.querySelector(".toggle"));

  li.dataset.id = todo.id;
  li.dataset.completed = String(todo.completed);
  li.dataset.editing = "false";

  titleEl.textContent = todo.title;
  editInput.value = todo.title;
  toggle.checked = todo.completed;

  // Toggle
  toggle.addEventListener("change", () => {
    setCompleted(todo.id, toggle.checked);
  });

  // Delete
  const deleteBtn = /** @type {HTMLButtonElement} */ (fragment.querySelector('[data-action="delete"]'));
  deleteBtn.addEventListener("click", () => removeTodo(todo.id));

  // Edit (double click or Enter on title)
  function startEditing() {
    li.dataset.editing = "true";
    editInput.value = todo.title;
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }

  function stopEditing({ commit } = { commit: true }) {
    li.dataset.editing = "false";
    if (!commit) return;
    const nextTitle = safeTrimTitle(editInput.value);
    if (!nextTitle) {
      // If cleared, delete the todo (common UX).
      removeTodo(todo.id);
      return;
    }
    if (nextTitle !== todo.title) updateTitle(todo.id, nextTitle);
  }

  titleEl.addEventListener("dblclick", startEditing);
  titleEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startEditing();
  });

  editInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") stopEditing({ commit: true });
    if (e.key === "Escape") stopEditing({ commit: false });
  });
  editInput.addEventListener("blur", () => stopEditing({ commit: true }));

  return /** @type {HTMLElement} */ (fragment.firstElementChild);
}

function render() {
  listEl.replaceChildren();
  const visible = applyFilter(todos, currentFilter);

  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.style.color = "rgba(255,255,255,0.55)";
    empty.style.padding = "10px 4px 2px";
    empty.textContent =
      todos.length === 0
        ? "No todos yet. Add your first task above."
        : "No todos match this filter.";
    listEl.appendChild(empty);
  } else {
    for (const todo of visible) {
      listEl.appendChild(renderItem(todo));
    }
  }

  updateMeta();
}

function upsert(nextTodos) {
  todos = nextTodos.sort(byUpdatedDesc);
  saveTodos(todos);
  render();
}

function addTodo(title) {
  const clean = safeTrimTitle(title);
  if (!clean) return;
  const now = Date.now();
  const todo = {
    id: createId(),
    title: clean,
    completed: false,
    createdAt: now,
    updatedAt: now,
    priority: "medium",
    dueDate: null,
  };
  upsert([todo, ...todos]);
  showToast(`Task added: "${clean}"`, "success");
}

function removeTodo(id) {
  const todo = todos.find((t) => t.id === id);
  upsert(todos.filter((t) => t.id !== id));
  if (todo) showToast(`Task deleted: "${todo.title}"`, "warning");
}

function setCompleted(id, completed) {
  const now = Date.now();
  upsert(
    todos.map((t) =>
      t.id === id ? { ...t, completed: Boolean(completed), updatedAt: now } : t,
    ),
  );
}

function updateTitle(id, title) {
  const clean = safeTrimTitle(title);
  if (!clean) return;
  const now = Date.now();
  upsert(todos.map((t) => (t.id === id ? { ...t, title: clean, updatedAt: now } : t)));
}

function toggleAll() {
  if (todos.length === 0) return;
  const allCompleted = todos.every((t) => t.completed);
  const now = Date.now();
  upsert(todos.map((t) => ({ ...t, completed: !allCompleted, updatedAt: now })));
  showToast(allCompleted ? "All tasks marked active" : "All tasks completed", "success");
}

function clearCompleted() {
  const count = todos.filter((t) => t.completed).length;
  upsert(todos.filter((t) => !t.completed));
  if (count > 0) showToast(`Cleared ${count} completed task${count > 1 ? "s" : ""}`, "info");
}

function exportAsCSV() {
  const header = "id,title,completed,priority,dueDate,createdAt,updatedAt";
  const rows = todos.map((t) =>
    `"${t.id}","${t.title}",${t.completed},"${t.priority}","${t.dueDate || ""}",${t.createdAt},${t.updatedAt}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "todos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Character count
const charCountEl = el("char-count");
newTodoInput.addEventListener("input", () => {
  const len = newTodoInput.value.length;
  charCountEl.textContent = `${len} / 200`;
  charCountEl.style.color = len > 180 ? "var(--destructive-foreground)" : "";
});

// Events
createForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(newTodoInput.value);
  newTodoInput.value = "";
  charCountEl.textContent = "0 / 200";
  charCountEl.style.color = "";
  newTodoInput.focus();
});

document.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  const btn = target.closest("[data-filter]");
  if (!btn) return;
  const filter = /** @type {Filter} */ (/** @type {HTMLButtonElement} */ (btn).dataset.filter);
  if (filter) setFilter(filter);
});

toggleAllBtn.addEventListener("click", toggleAll);
clearCompletedBtn.addEventListener("click", clearCompleted);
el("export-csv").addEventListener("click", exportAsCSV);

// Keyboard shortcut: press "/" to focus the input
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== newTodoInput) {
    e.preventDefault();
    newTodoInput.focus();
  }
});

// Toast notification system
const toastContainer = el("toast-container");

function showToast(message, type = "info", duration = 2500) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, duration);
}

// Keyboard shortcuts panel toggle
el("shortcuts-toggle").addEventListener("click", () => {
  const panel = el("shortcuts-panel");
  panel.hidden = !panel.hidden;
});

// Initial render
render();
