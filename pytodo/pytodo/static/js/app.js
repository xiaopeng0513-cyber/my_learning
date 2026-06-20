/**
 * PyTodo - Client-side application logic.
 *
 * Ported from todo.html — replaces localStorage with REST API calls
 * to the Flask backend.  Supports:
 *  - Auth (login / register / guest / JWT)
 *  - Task CRUD with filters, sorting, progress bars, deadline warnings
 *  - URL sharing via server-side short tokens
 *  - Offline queue with automatic sync on reconnect
 *  - Backward-compatible legacy #d=<base64> URL handling
 *
 * Dependencies: none (vanilla JS, no framework).
 */

// ========== API helpers ==========

const API_BASE = ""; // same-origin

function getToken() {
  return localStorage.getItem("pytodo_token");
}

function setToken(t) {
  localStorage.setItem("pytodo_token", t);
}

function clearToken() {
  localStorage.removeItem("pytodo_token");
}

function authHeader() {
  const t = getToken();
  return t ? { Authorization: "Bearer " + t } : {};
}

async function apiCall(url, method, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let resp;
  try {
    resp = await fetch(API_BASE + url, opts);
  } catch (e) {
    // Network error — queue write operations for offline sync
    if (method !== "GET" && !navigator.onLine) {
      queueOfflineAction({ url, method, body });
      return { offline: true };
    }
    throw e;
  }

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || resp.statusText);
  return data;
}

// Convenience wrappers
const api = {
  get: (url) => apiCall(url, "GET"),
  post: (url, body) => apiCall(url, "POST", body),
  put: (url, body) => apiCall(url, "PUT", body),
  del: (url) => apiCall(url, "DELETE"),
};

// ========== Toast notifications ==========

function showToast(msg, type) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 2500);
}

// ========== HTML escape ==========

function escapeHtml(text) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ========== Offline queue ==========

const OFFLINE_QUEUE_KEY = "pytodo_offline_queue";

function queueOfflineAction(action) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  queue.push({ ...action, timestamp: Date.now() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  if (queue.length === 0) return;

  let synced = 0;
  const remaining = [];
  for (var i = 0; i < queue.length; i++) {
    const action = queue[i];
    try {
      await apiCall(action.url, action.method, action.body);
      synced++;
    } catch (e) {
      remaining.push(action);
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  if (synced > 0) {
    showToast("Synced " + synced + " offline change(s)", "success");
    await loadTodos();
    render();
  }
}

// ========== URL share helpers ==========

function getShareTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("share");
}

// Legacy #d=<base64> support
function decodeBase64(b64) {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return null;
  }
}

function getLegacySharedTasks() {
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/^#d=(.+)/);
  const encoded = match ? match[1] : null;
  if (!encoded) return null;
  const json = decodeBase64(encoded);
  if (!json) return null;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

// ========== Auth state ==========

let currentUser = null; // decoded JWT payload
let isSharedMode = false;

async function loadSharedTasks(token) {
  try {
    const data = await api.get("/api/share/" + token);
    todos = data.tasks;
    isSharedMode = true;
    showShareBanner(true);
    showToast("Loaded shared task list", "info");
    // Auto-convert to guest mode so user can edit
    if (!getToken()) {
      await loginAsGuest();
    }
  } catch (e) {
    showToast("Shared link not found or expired", "error");
  }
}

async function handleLegacyShare(tasks) {
  todos = tasks;
  isSharedMode = true;
  showShareBanner(true);
  if (!getToken()) {
    await loginAsGuest();
  }
  // Clear the hash so we don't re-import on refresh
  history.replaceState(null, "", window.location.pathname);
  render();
  showToast("Imported shared tasks from legacy link", "info");
}

async function loginAsGuest() {
  try {
    const data = await api.post("/api/auth/guest");
    setToken(data.token);
    currentUser = data.user;
  } catch (e) {
    showToast("Failed to create guest session", "error");
  }
}

async function checkAuth() {
  const token = getToken();
  if (!token) return false;
  try {
    const data = await api.get("/api/auth/me");
    currentUser = data.user;
    return true;
  } catch (e) {
    clearToken();
    return false;
  }
}

// ========== Todo state ==========

let todos = [];
let currentFilter = "all";
let currentSort = "deadline-asc";
let editingTaskId = null;

// ========== Todo CRUD ==========

async function loadTodos() {
  if (!getToken()) {
    todos = [];
    return;
  }
  try {
    const data = await api.get("/api/tasks/");
    todos = data.tasks;
  } catch (e) {
    if (!navigator.onLine) {
      // Try to load from local cache
      const cached = localStorage.getItem("pytodo_task_cache");
      if (cached) todos = JSON.parse(cached);
    } else {
      throw e;
    }
  }
}

function cacheTasksLocally() {
  localStorage.setItem("pytodo_task_cache", JSON.stringify(todos));
}

async function saveTodo(op, taskData, taskId) {
  try {
    if (op === "create") {
      const data = await api.post("/api/tasks/", taskData);
      todos.push(data.task);
    } else if (op === "update") {
      const data = await api.put("/api/tasks/" + taskId, taskData);
      const idx = todos.findIndex(function (t) { return t.id === taskId; });
      if (idx !== -1) todos[idx] = data.task;
    } else if (op === "delete") {
      await api.del("/api/tasks/" + taskId);
      todos = todos.filter(function (t) { return t.id !== taskId; });
    }
    cacheTasksLocally();
  } catch (e) {
    showToast(e.message, "error");
    throw e;
  }
}

// ========== Sorting & filtering ==========

function sortTodos(list) {
  var arr = list.slice();
  switch (currentSort) {
    case "deadline-asc":
      return arr.sort(function (a, b) {
        if (!a.deadline && !b.deadline) return b.id - a.id;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    case "deadline-desc":
      return arr.sort(function (a, b) {
        if (!a.deadline && !b.deadline) return b.id - a.id;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(b.deadline) - new Date(a.deadline);
      });
    case "created-desc":
      return arr.sort(function (a, b) { return b.id - a.id; });
    case "created-asc":
      return arr.sort(function (a, b) { return a.id - b.id; });
    case "status":
      var order = { "in-progress": 0, "not-started": 1, completed: 2 };
      return arr.sort(function (a, b) {
        return (order[a.status] || 1) - (order[b.status] || 1);
      });
    default:
      return arr;
  }
}

function getFilteredTodos() {
  var result = todos;
  if (currentFilter === "not-started")
    result = todos.filter(function (t) { return t.status === "not-started"; });
  if (currentFilter === "in-progress")
    result = todos.filter(function (t) { return t.status === "in-progress"; });
  if (currentFilter === "completed")
    result = todos.filter(function (t) { return t.status === "completed"; });
  return sortTodos(result);
}

// ========== Helpers ==========

function calcProgress(task) {
  if (!task.startTime || !task.deadline) return null;
  var now = Date.now();
  var start = new Date(task.startTime).getTime();
  var end = new Date(task.deadline).getTime();
  if (end <= start) return null;
  var pct = Math.round(((now - start) / (end - start)) * 100);
  return Math.max(0, Math.min(100, pct));
}

function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  var d = new Date(isoStr);
  var pad = function (n) { return String(n).padStart(2, "0"); };
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function isOverdue(task) {
  if (!task.deadline || task.status === "completed") return false;
  return new Date(task.deadline) < new Date();
}

function isDueSoon(task) {
  if (!task.deadline || task.status === "completed") return false;
  var diff = new Date(task.deadline) - new Date();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

// ========== Show / hide share banner ==========

function showShareBanner(on) {
  var banner = document.getElementById("share-banner");
  if (banner) {
    if (on) banner.classList.add("active");
    else banner.classList.remove("active");
  }
}

// ========== Render ==========

function render() {
  var filtered = getFilteredTodos();
  var counts = {
    "not-started": todos.filter(function (t) { return t.status === "not-started"; })
      .length,
    "in-progress": todos.filter(function (t) { return t.status === "in-progress"; })
      .length,
    completed: todos.filter(function (t) { return t.status === "completed"; }).length,
  };
  var total = todos.length;

  var countText = document.getElementById("count-text");
  if (countText)
    countText.textContent =
      "共 " +
      total +
      " 项 · 未开始 " +
      counts["not-started"] +
      " · 进行中 " +
      counts["in-progress"] +
      " · 已完成 " +
      counts.completed;

  var todoList = document.getElementById("todo-list");
  if (filtered.length === 0) {
    var msgs = {
      all: "还没有任务，点击上方按钮创建一个吧！",
      "not-started": "没有“未开始”的任务",
      "in-progress": "没有“进行中”的任务",
      completed: "还没有已完成的任务",
    };
    todoList.innerHTML =
      '<li class="empty-state"><div class="icon">📋</div><p>' +
      msgs[currentFilter] +
      "</p></li>";
    return;
  }

  var statusLabels = {
    "not-started": "未开始",
    "in-progress": "进行中",
    completed: "已完成",
  };
  var statusIcons = {
    "not-started": "⏳",
    "in-progress": "🔄",
    completed: "✅",
  };

  todoList.innerHTML = filtered
    .map(function (task) {
      var progress = calcProgress(task);
      var overdue = isOverdue(task);
      var dueSoon = isDueSoon(task);
      var deadlineClass = "";
      if (overdue) deadlineClass = "overdue";
      else if (dueSoon) deadlineClass = "due-soon";

      return (
        '<li class="task-card status-' +
        task.status +
        '" data-id="' +
        task.id +
        '">' +
        '<div class="task-header">' +
        '<div class="task-left">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<span class="task-title">' +
        escapeHtml(task.title) +
        "</span>" +
        '<span class="status-badge ' +
        task.status +
        '">' +
        statusIcons[task.status] +
        " " +
        statusLabels[task.status] +
        "</span>" +
        "</div>" +
        '<div class="task-meta">' +
        '<span><span class="meta-icon">🕐</span> 开始：' +
        formatDateTime(task.startTime) +
        "</span>" +
        '<span class="' +
        deadlineClass +
        '"><span class="meta-icon">🎯</span> 截止：' +
        formatDateTime(task.deadline) +
        "</span>" +
        (overdue && task.status !== "completed"
          ? '<span style="color:#ff6b6b;border-color:#ff6b6b;">⚠️ 已超期</span>'
          : "") +
        (dueSoon
          ? '<span style="color:#f0ad4e;border-color:#f0ad4e;">⚡ 即将到期</span>'
          : "") +
        "</div>" +
        (task.notes
          ? '<div class="task-notes">💬 ' +
            escapeHtml(task.notes) +
            "</div>"
          : "") +
        (progress !== null && task.status !== "completed"
          ? '<div class="progress-bar-wrap">' +
            '<div class="progress-info"><span>时间进度</span><span>' +
            progress +
            "%</span></div>" +
            '<div class="progress-bar"><div class="progress-fill" style="width:' +
            progress +
            "%;background:" +
            (progress > 80 ? "#ff6b6b" : progress > 50 ? "#f0ad4e" : "#667eea") +
            '"></div></div>' +
            "</div>"
          : "") +
        "</div>" +
        '<div class="task-actions">' +
        '<button class="icon-btn edit-btn" onclick="openEditModal(' +
        task.id +
        ')" title="编辑">✎</button>' +
        '<button class="icon-btn delete-btn" onclick="confirmDelete(' +
        task.id +
        ')" title="删除">×</button>' +
        "</div>" +
        "</div>" +
        "</li>"
      );
    })
    .join("");
}

// ========== Modal logic ==========

function openNewTaskModal() {
  editingTaskId = null;
  document.getElementById("modal-title").innerHTML =
    '➕ <span>新建任务</span>';
  document.getElementById("task-title-input").value = "";
  document.getElementById("task-status-select").value = "not-started";
  document.getElementById("task-start-time").value = "";
  document.getElementById("task-deadline").value = "";
  document.getElementById("task-notes").value = "";
  document.getElementById("modal-delete-group").style.display = "none";
  document.getElementById("task-modal-overlay").classList.add("active");
  document.getElementById("task-title-input").focus();
}

function openEditModal(id) {
  var task = null;
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].id === id) { task = todos[i]; break; }
  }
  if (!task) return;
  editingTaskId = id;
  document.getElementById("modal-title").innerHTML =
    '✎ <span>编辑任务</span>';
  document.getElementById("task-title-input").value = task.title;
  document.getElementById("task-status-select").value = task.status;
  document.getElementById("task-start-time").value = task.startTime || "";
  document.getElementById("task-deadline").value = task.deadline || "";
  document.getElementById("task-notes").value = task.notes || "";
  document.getElementById("modal-delete-group").style.display = "flex";
  document.getElementById("task-modal-overlay").classList.add("active");
  document.getElementById("task-title-input").focus();
}

function closeModal() {
  document.getElementById("task-modal-overlay").classList.remove("active");
  editingTaskId = null;
}

function closeImportModal() {
  document.getElementById("import-modal-overlay").classList.remove("active");
}

function confirmDelete(id) {
  if (
    !confirm(
      "确定要删除这个任务吗？此操作不可恢复。"
    )
  )
    return;
  saveTodo("delete", null, id)
    .then(function () {
      render();
      showToast("任务已删除", "success");
    })
    .catch(function () {});
}

// ========== Share ==========

async function shareTasks() {
  if (todos.length === 0) {
    showToast("请先创建任务再分享", "error");
    return;
  }
  try {
    const data = await api.post("/api/share/", { tasks: todos });
    const url = data.url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("✅ 分享链接已复制到剪贴板！", "success");
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function importShareLink() {
  var raw = document.getElementById("import-textarea").value.trim();
  if (!raw) {
    showToast("请粘贴分享链接或编码数据", "error");
    return;
  }
  // Extract token from URL if needed
  var token = raw;
  var m = raw.match(/\/s\/([a-zA-Z0-9_-]+)/);
  if (m) token = m[1];
  m = raw.match(/[?&]share=([a-zA-Z0-9_-]+)/);
  if (m) token = m[1];

  try {
    var data = await api.get("/api/share/" + token);
    todos = data.tasks;
    isSharedMode = true;
    showShareBanner(true);
    if (!getToken()) await loginAsGuest();
    cacheTasksLocally();
    render();
    closeImportModal();
    showToast(
      "✅ 成功导入 " + data.tasks.length + " 条任务！",
      "success"
    );
  } catch (e) {
    showToast("无法解析分享数据，请检查链接是否完整", "error");
  }
}

// ========== Auth UI ==========

var authMode = "login";

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById("tab-login").classList.toggle("active", mode === "login");
  document
    .getElementById("tab-register")
    .classList.toggle("active", mode === "register");
  document.getElementById("confirm-group").style.display =
    mode === "register" ? "block" : "none";
  document.getElementById("auth-btn").textContent =
    mode === "login" ? "登 录" : "注 册";
  clearAuthMsg();
}

function clearAuthMsg() {
  var el = document.getElementById("auth-msg");
  el.textContent = "";
  el.className = "auth-msg";
}

function showAuthMsg(msg, type) {
  var el = document.getElementById("auth-msg");
  el.textContent = msg;
  el.className = "auth-msg " + type;
}

async function handleAuth() {
  var username = document.getElementById("username").value.trim();
  var password = document.getElementById("password").value;

  if (!username) {
    showAuthMsg("请输入用户名", "error");
    return;
  }
  if (username.length < 2) {
    showAuthMsg("用户名至少需要 2 个字符", "error");
    return;
  }
  if (!password) {
    showAuthMsg("请输入密码", "error");
    return;
  }
  if (password.length < 4) {
    showAuthMsg("密码至少需要 4 个字符", "error");
    return;
  }

  try {
    var data;
    if (authMode === "register") {
      var confirmPwd = document.getElementById("confirm-password").value;
      if (password !== confirmPwd) {
        showAuthMsg("两次输入的密码不一致", "error");
        return;
      }
      data = await api.post("/api/auth/register", {
        username: username,
        password: password,
      });
      showAuthMsg("注册成功！正在登录...", "success");
    } else {
      data = await api.post("/api/auth/login", {
        username: username,
        password: password,
      });
    }
    setToken(data.token);
    currentUser = data.user;
    showMainPage();
  } catch (e) {
    showAuthMsg(e.message, "error");
  }
}

async function showMainPage() {
  document.getElementById("auth-page").style.display = "none";
  document.getElementById("main-page").classList.add("visible");
  var av = document.getElementById("user-avatar");
  if (av && currentUser) {
    av.textContent = (currentUser.username || "?")
      .charAt(0)
      .toUpperCase();
  }

  // Check for shared data
  var shareToken = getShareTokenFromURL();
  if (shareToken) {
    await loadSharedTasks(shareToken);
  } else {
    // Check legacy URL hash
    var legacy = getLegacySharedTasks();
    if (legacy) {
      await handleLegacyShare(legacy);
    } else {
      await loadTodos();
    }
  }

  render();
  var input = document.getElementById("todo-input");
  if (input) input.focus();
}

function logout() {
  clearToken();
  currentUser = null;
  todos = [];
  isSharedMode = false;
  showShareBanner(false);
  document.getElementById("main-page").classList.remove("visible");
  document.getElementById("auth-page").style.display = "block";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  var cp = document.getElementById("confirm-password");
  if (cp) cp.value = "";
  clearAuthMsg();
  var u = document.getElementById("username");
  if (u) u.focus();
}

// ========== Password toggle ==========

function setupPwdToggle(toggleBtnId, inputId) {
  var btn = document.getElementById(toggleBtnId);
  var input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", function () {
    var isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.textContent = isPassword ? "🙈" : "👁️";
    btn.title = isPassword ? "隐藏密码" : "显示密码";
  });
}

// ========== Boot ==========

async function init() {
  // Wire up auth tab clicks
  document.getElementById("tab-login").addEventListener("click", function () {
    switchAuthTab("login");
  });
  document.getElementById("tab-register").addEventListener("click", function () {
    switchAuthTab("register");
  });

  // Password visibility toggles
  setupPwdToggle("pwd-toggle", "password");
  setupPwdToggle("confirm-pwd-toggle", "confirm-password");

  // Auth button
  document.getElementById("auth-btn").addEventListener("click", handleAuth);

  // Enter key on auth inputs
  document.getElementById("username").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (authMode === "register")
        document.getElementById("confirm-password").focus();
      else document.getElementById("password").focus();
    }
  });
  document.getElementById("password").addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleAuth();
  });
  var cpEl = document.getElementById("confirm-password");
  if (cpEl) {
    cpEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleAuth();
    });
  }

  // Skip login
  var skipLink = document.getElementById("skip-login");
  if (skipLink) {
    skipLink.addEventListener("click", async function (e) {
      e.preventDefault();
      await loginAsGuest();
      showMainPage();
    });
  }

  // Logout
  document.getElementById("logout-btn").addEventListener("click", logout);

  // New task button
  document
    .getElementById("open-modal-btn")
    .addEventListener("click", openNewTaskModal);

  // Share button
  document.getElementById("share-btn").addEventListener("click", shareTasks);

  // Import button
  document.getElementById("import-btn").addEventListener("click", function () {
    document.getElementById("import-textarea").value = "";
    document.getElementById("import-modal-overlay").classList.add("active");
    document.getElementById("import-textarea").focus();
  });
  document
    .getElementById("import-cancel-btn")
    .addEventListener("click", closeImportModal);
  document
    .getElementById("import-confirm-btn")
    .addEventListener("click", importShareLink);
  document
    .getElementById("import-modal-overlay")
    .addEventListener("click", function (e) {
      if (e.target === e.currentTarget) closeImportModal();
    });

  // Export JSON
  document
    .getElementById("export-json-btn")
    .addEventListener("click", function () {
      if (todos.length === 0) {
        showToast("没有任务可导出", "error");
        return;
      }
      var json = JSON.stringify(todos, null, 2);
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download =
        "todo-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("JSON 文件已下载", "success");
    });

  // Import JSON file (right-click on export button)
  document
    .getElementById("export-json-btn")
    .addEventListener("contextmenu", function (e) {
      e.preventDefault();
      document.getElementById("import-file-input").click();
    });
  document
    .getElementById("import-file-input")
    .addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          if (!Array.isArray(data)) throw new Error("format");
          todos = data;
          isSharedMode = false;
          showShareBanner(false);
          cacheTasksLocally();
          render();
          showToast(
            "✅ 已导入 " + data.length + " 条任务",
            "success"
          );
        } catch (err) {
          showToast("JSON 文件格式不正确", "error");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

  // Modal save
  document.getElementById("modal-save-btn").addEventListener("click", function () {
    var title = document.getElementById("task-title-input").value.trim();
    if (!title) {
      showToast("请输入任务名称", "error");
      return;
    }
    var data = {
      title: title,
      status: document.getElementById("task-status-select").value,
      startTime: document.getElementById("task-start-time").value || null,
      deadline: document.getElementById("task-deadline").value || null,
      notes: document.getElementById("task-notes").value.trim() || null,
    };
    var op = editingTaskId ? "update" : "create";
    saveTodo(op, data, editingTaskId)
      .then(function () {
        render();
        showToast(
          op === "create"
            ? "任务已创建"
            : "任务已更新",
          "success"
        );
        closeModal();
      })
      .catch(function () {});
  });

  // Modal cancel
  document
    .getElementById("modal-cancel-btn")
    .addEventListener("click", closeModal);

  // Modal delete
  document
    .getElementById("modal-delete-btn")
    .addEventListener("click", function () {
      if (editingTaskId) {
        confirmDelete(editingTaskId);
        closeModal();
      }
    });

  // Close modal on overlay click
  document
    .getElementById("task-modal-overlay")
    .addEventListener("click", function (e) {
      if (e.target === e.currentTarget) closeModal();
    });

  // ESC to close modals
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (
        document
          .getElementById("task-modal-overlay")
          .classList.contains("active")
      )
        closeModal();
      if (
        document
          .getElementById("import-modal-overlay")
          .classList.contains("active")
      )
        closeImportModal();
    }
  });

  // Sort
  document.getElementById("sort-select").addEventListener("change", function () {
    currentSort = this.value;
    render();
  });

  // Filters
  var filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) {
        return b.classList.remove("active");
      });
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      render();
    });
  });

  // Online sync
  window.addEventListener("online", syncOfflineQueue);

  // PWA service worker registration
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/static/js/sw.js").catch(function () {});
  }

  // ---- Determine initial state ----
  // Priority: 1) URL share token  2) Legacy #d= hash  3) Existing JWT session  4) Login page
  var shareToken = getShareTokenFromURL();
  var legacyTasks = getLegacySharedTasks();

  if (shareToken || legacyTasks) {
    // Go straight to main page (shared mode)
    if (!getToken()) await loginAsGuest();
    if (shareToken) await loadSharedTasks(shareToken);
    else if (legacyTasks) await handleLegacyShare(legacyTasks);
    showMainPage();
  } else if (await checkAuth()) {
    // Existing valid session
    showMainPage();
  }
  // Otherwise stay on the login page
}

// Fire when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
