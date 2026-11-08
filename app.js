import {
  auth,
  googleProvider,
  db,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "./firebase.js";

const LIST_ICONS = ["📋", "🚀", "🛒", "🏠", "💡", "🎯", "📅", "✨"];
const LIST_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
const CATEGORIES = ["工作", "開發", "設計", "採購", "生活", "其他"];

// Application State
let currentUser = null;
let lists = [];
let activeListId = null;
let tasks = [];
let editingTaskId = null;
let statusFilter = "all";
let priorityFilter = "all";
let searchQuery = "";
let selectedNewIcon = "📋";
let selectedNewColor = "#4f46e5";

let unsubLists = null;
let unsubTasks = null;
let toastTimer = null;

// DOM Elements
const loadingScreen = document.getElementById("loading-screen");
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authToast = document.getElementById("auth-toast");
const mainToast = document.getElementById("main-toast");
const googleLoginBtn = document.getElementById("google-login-btn");
const googleLoginText = document.getElementById("google-login-text");
const logoutBtn = document.getElementById("logout-btn");

const userAvatarContainer = document.getElementById("user-avatar-container");
const userNameEl = document.getElementById("user-name");
const userEmailEl = document.getElementById("user-email");

const listsCountLabel = document.getElementById("lists-count-label");
const listsNav = document.getElementById("lists-nav");
const joinCodeForm = document.getElementById("join-code-form");
const joinCodeInput = document.getElementById("join-code-input");

const noListState = document.getElementById("no-list-state");
const activeListWorkspace = document.getElementById("active-list-workspace");
const activeListIcon = document.getElementById("active-list-icon");
const activeListTitle = document.getElementById("active-list-title");
const activeListAccessBadge = document.getElementById("active-list-access-badge");
const activeListCodeBadge = document.getElementById("active-list-code-badge");
const activeListDesc = document.getElementById("active-list-desc");
const collaboratorCount = document.getElementById("collaborator-count");
const collaboratorAvatars = document.getElementById("collaborator-avatars");
const deleteListBtn = document.getElementById("delete-list-btn");
const clearCompletedBtn = document.getElementById("clear-completed-btn");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");

const taskComposerForm = document.getElementById("task-composer-form");
const taskTitleInput = document.getElementById("task-title-input");
const toggleNotesBtn = document.getElementById("toggle-notes-btn");
const taskPrioritySelect = document.getElementById("task-priority-select");
const taskCategorySelect = document.getElementById("task-category-select");
const taskAssigneeSelect = document.getElementById("task-assignee-select");
const taskDuedateInput = document.getElementById("task-duedate-input");
const taskNotesInput = document.getElementById("task-notes-input");

const statusFilterTabs = document.getElementById("status-filter-tabs");
const priorityFilterSelect = document.getElementById("priority-filter-select");
const searchInput = document.getElementById("search-input");
const tasksContainer = document.getElementById("tasks-container");

const newListModal = document.getElementById("new-list-modal");
const newListForm = document.getElementById("new-list-form");
const newListTitleInput = document.getElementById("new-list-title");
const newListDescInput = document.getElementById("new-list-desc");
const newListPublicCheckbox = document.getElementById("new-list-public");
const iconPicker = document.getElementById("icon-picker");
const colorPicker = document.getElementById("color-picker");

const shareModal = document.getElementById("share-modal");
const shareInviteCode = document.getElementById("share-invite-code");
const copyCodeBtn = document.getElementById("copy-code-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");
const inviteEmailForm = document.getElementById("invite-email-form");
const inviteEmailInput = document.getElementById("invite-email-input");
const shareAccessModeTitle = document.getElementById("share-access-mode-title");
const shareAccessModeDesc = document.getElementById("share-access-mode-desc");
const togglePublicBtn = document.getElementById("toggle-public-btn");
const shareMembersLabel = document.getElementById("share-members-label");
const shareMembersList = document.getElementById("share-members-list");
const shareInvitedEmailsSection = document.getElementById("share-invited-emails-section");
const shareInvitedEmailsList = document.getElementById("share-invited-emails-list");

// Helpers
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function renderAvatarHtml(userObj, isSmall = false) {
  const cls = isSmall ? "avatar avatar-sm" : "avatar";
  if (userObj?.photoURL) {
    return `<img src="${escapeHtml(userObj.photoURL)}" alt="${escapeHtml(userObj.displayName || "")}" class="${cls}" referrerpolicy="no-referrer" />`;
  }
  const initial = ((userObj?.displayName || userObj?.email || "U")[0] || "U").toUpperCase();
  return `<div class="${cls}">${escapeHtml(initial)}</div>`;
}

function showMessage(text, type = "success") {
  const target = currentUser ? mainToast : authToast;
  target.className = `alert-banner ${type === "error" ? "alert-error" : "alert-success"}`;
  target.innerHTML = `
    <span>${escapeHtml(text)}</span>
    <button type="button" class="btn-icon" id="dismiss-toast-btn">✕</button>
  `;
  const dismissBtn = target.querySelector("#dismiss-toast-btn");
  if (dismissBtn) {
    dismissBtn.onclick = () => target.classList.add("hidden");
  }
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    target.classList.add("hidden");
  }, 4000);
}

function getActiveList() {
  return lists.find((l) => l.id === activeListId) || null;
}

function getActiveListMembers() {
  const active = getActiveList();
  if (!active || !active.members) return [];
  return Object.values(active.members);
}

// Initialize Icon & Color Pickers in New List Modal
function renderModalPickers() {
  iconPicker.innerHTML = LIST_ICONS.map(
    (ic) =>
      `<button type="button" class="picker-btn ${selectedNewIcon === ic ? "selected" : ""}" data-icon="${ic}">${ic}</button>`
  ).join("");

  colorPicker.innerHTML = LIST_COLORS.map(
    (col) =>
      `<button type="button" class="picker-btn ${selectedNewColor === col ? "selected" : ""}" data-color="${col}" style="background: ${col};"></button>`
  ).join("");
}

iconPicker.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-icon]");
  if (!btn) return;
  selectedNewIcon = btn.dataset.icon;
  renderModalPickers();
});

colorPicker.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-color]");
  if (!btn) return;
  selectedNewColor = btn.dataset.color;
  renderModalPickers();
});

renderModalPickers();

// 1. Observe Authentication State
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  loadingScreen.classList.add("hidden");

  if (!user) {
    if (unsubLists) {
      unsubLists();
      unsubLists = null;
    }
    if (unsubTasks) {
      unsubTasks();
      unsubTasks = null;
    }
    lists = [];
    tasks = [];
    activeListId = null;
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    return;
  }

  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");

  // Render signed-in user bar
  userAvatarContainer.innerHTML = renderAvatarHtml(user, false);
  userNameEl.textContent = user.displayName || "使用者";
  userEmailEl.textContent = user.email || "";

  // Sync user profile to Firestore
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        email: (user.email || "").toLowerCase(),
        displayName: user.displayName || "協作夥伴",
        photoURL: user.photoURL || null,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Could not sync user profile:", err);
  }

  // Check URL for ?join=CODE
  const params = new URLSearchParams(window.location.search);
  const urlJoinCode = params.get("join");
  if (urlJoinCode) {
    joinCodeInput.value = urlJoinCode.toUpperCase();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  subscribeToLists();
});

// 2. Real-time Listener for Collaborative Lists
function subscribeToLists() {
  if (unsubLists) unsubLists();
  if (!currentUser) return;

  unsubLists = onSnapshot(
    collection(db, "lists"),
    (snapshot) => {
      const userEmail = (currentUser.email || "").toLowerCase();
      const accessible = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const isOwner = data.ownerId === currentUser.uid;
        const isMember = Array.isArray(data.memberUids) && data.memberUids.includes(currentUser.uid);
        const isInvited =
          userEmail &&
          Array.isArray(data.invitedEmails) &&
          data.invitedEmails.includes(userEmail);
        const isPublic = data.isPublic === true;

        if (isOwner || isMember || isInvited || isPublic) {
          accessible.push({ id: docSnap.id, ...data });

          if (isInvited && !isMember) {
            updateDoc(doc(db, "lists", docSnap.id), {
              memberUids: arrayUnion(currentUser.uid),
              [`members.${currentUser.uid}`]: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || "協作夥伴",
                email: userEmail,
                photoURL: currentUser.photoURL || null,
                role: "editor"
              },
              updatedAt: serverTimestamp()
            }).catch(() => {});
          }
        }
      });

      accessible.sort((a, b) => {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      });

      lists = accessible;

      const prevActiveId = activeListId;
      if (!activeListId || !lists.some((l) => l.id === activeListId)) {
        activeListId = lists[0]?.id || null;
      }

      renderSidebarLists();
      renderActiveListWorkspace();

      if (activeListId !== prevActiveId) {
        subscribeToTasks();
      }
    },
    (err) => {
      console.error("Lists listener error:", err);
      showMessage(`讀取清單時發生錯誤：${err.message}`, "error");
    }
  );
}

// 3. Real-time Listener for Active List's Tasks
function subscribeToTasks() {
  if (unsubTasks) {
    unsubTasks();
    unsubTasks = null;
  }
  tasks = [];
  if (!currentUser || !activeListId) {
    renderTasksAndProgress();
    return;
  }

  unsubTasks = onSnapshot(
    collection(db, "lists", activeListId, "tasks"),
    (snapshot) => {
      const loaded = [];
      snapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() });
      });

      const priorityWeight = { high: 3, medium: 2, low: 1 };
      loaded.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
        if (pDiff !== 0) return pDiff;
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      });

      tasks = loaded;
      renderTasksAndProgress();
    },
    (err) => {
      console.error("Tasks listener error:", err);
    }
  );
}

// Render Sidebar Lists
function renderSidebarLists() {
  listsCountLabel.textContent = `協作待辦清單 (${lists.length})`;
  if (lists.length === 0) {
    listsNav.innerHTML = `
      <div style="padding: 16px 12px; font-size: 0.83rem; color: var(--text-secondary); text-align: center;">
        尚無待辦清單，可點擊上方「＋」建立或輸入邀請碼加入。
      </div>
    `;
    return;
  }

  listsNav.innerHTML = lists
    .map(
      (list) => `
      <button type="button" class="list-nav-item ${list.id === activeListId ? "active" : ""}" data-list-id="${escapeHtml(list.id)}">
        <div class="list-nav-left">
          <span>${escapeHtml(list.icon || "📋")}</span>
          <span class="list-nav-title">${escapeHtml(list.title)}</span>
        </div>
        <span class="badge ${list.isPublic ? "badge-public" : "badge-private"}">
          ${list.isPublic ? "公開" : "專屬"}
        </span>
      </button>
    `
    )
    .join("");
}

listsNav.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-list-id]");
  if (!btn) return;
  const nextId = btn.dataset.listId;
  if (nextId && nextId !== activeListId) {
    activeListId = nextId;
    editingTaskId = null;
    renderSidebarLists();
    renderActiveListWorkspace();
    subscribeToTasks();
  }
});

// Render Active List Header & Collaborators
function renderActiveListWorkspace() {
  const active = getActiveList();
  if (!active) {
    noListState.classList.remove("hidden");
    activeListWorkspace.classList.add("hidden");
    return;
  }

  noListState.classList.add("hidden");
  activeListWorkspace.classList.remove("hidden");

  activeListIcon.textContent = active.icon || "📋";
  activeListIcon.style.background = active.color || "#4f46e5";
  activeListTitle.textContent = active.title;

  activeListAccessBadge.className = `badge ${active.isPublic ? "badge-public" : "badge-private"}`;
  activeListAccessBadge.textContent = active.isPublic ? "🌐 公開協作" : "🔒 專屬邀請";

  if (active.inviteCode) {
    activeListCodeBadge.classList.remove("hidden");
    activeListCodeBadge.textContent = `邀請碼：${active.inviteCode} 📋`;
  } else {
    activeListCodeBadge.classList.add("hidden");
  }

  activeListDesc.textContent = active.description || "";
  activeListDesc.classList.toggle("hidden", !active.description);

  const members = getActiveListMembers();
  collaboratorCount.textContent = String(members.length);

  if (active.ownerId === currentUser?.uid) {
    deleteListBtn.classList.remove("hidden");
  } else {
    deleteListBtn.classList.add("hidden");
  }

  collaboratorAvatars.innerHTML =
    `<span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">協作成員：</span>` +
    members
      .map(
        (m) => `
      <div class="member-chip">
        ${renderAvatarHtml(m, true)}
        <span>${escapeHtml(m.displayName || m.email || "成員")}</span>
      </div>
    `
      )
      .join("");

  // Populate task assignee dropdown
  const currentAssigneeVal = taskAssigneeSelect.value;
  taskAssigneeSelect.innerHTML =
    `<option value="">👤 指派給：不指定</option>` +
    members
      .map(
        (m) =>
          `<option value="${escapeHtml(m.uid)}">👤 指派給：${escapeHtml(m.displayName || m.email)}</option>`
      )
      .join("");
  taskAssigneeSelect.value = currentAssigneeVal;

  // Update Share Modal if open
  if (!shareModal.classList.contains("hidden")) {
    renderShareModalContent();
  }
}

// Render Tasks & Progress Bar
function renderTasksAndProgress() {
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  progressText.textContent = `已完成 ${completedCount} / ${totalCount} 項 (${percent}%)`;
  progressFill.style.width = `${percent}%`;

  if (completedCount > 0) {
    clearCompletedBtn.classList.remove("hidden");
    clearCompletedBtn.textContent = `清除已完成 (${completedCount})`;
  } else {
    clearCompletedBtn.classList.add("hidden");
  }

  // Update Filter Tab Counts
  const tabBtns = statusFilterTabs.querySelectorAll("[data-filter]");
  tabBtns.forEach((btn) => {
    const f = btn.dataset.filter;
    btn.classList.toggle("active", f === statusFilter);
    if (f === "all") btn.textContent = `全部 (${totalCount})`;
    if (f === "active") btn.textContent = `進行中 (${totalCount - completedCount})`;
    if (f === "completed") btn.textContent = `已完成 (${completedCount})`;
  });

  // Filter Tasks
  const filtered = tasks.filter((t) => {
    if (statusFilter === "active" && t.completed) return false;
    if (statusFilter === "completed" && !t.completed) return false;
    if (statusFilter === "mine" && t.assigneeUid !== currentUser?.uid) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (t.title || "").toLowerCase().includes(q);
      const matchNotes = (t.notes || "").toLowerCase().includes(q);
      const matchCategory = (t.category || "").toLowerCase().includes(q);
      if (!matchTitle && !matchNotes && !matchCategory) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tasksContainer.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 1.8rem;">☑️</div>
        <p>目前沒有符合條件的待辦事項</p>
      </div>
    `;
    return;
  }

  const members = getActiveListMembers();

  tasksContainer.innerHTML = filtered
    .map((task) => {
      const isEditing = editingTaskId === task.id;
      if (isEditing) {
        return `
          <div class="task-card" data-task-id="${escapeHtml(task.id)}">
            <div class="task-left" style="width: 100%;">
              <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                <input type="text" class="composer-input edit-title-input" value="${escapeHtml(task.title)}" />
                <textarea class="composer-input edit-notes-input" rows="2" placeholder="備註說明...">${escapeHtml(task.notes || "")}</textarea>
                <div class="composer-options-row">
                  <select class="select-sm edit-priority-select">
                    <option value="high" ${task.priority === "high" ? "selected" : ""}>🔥 高優先</option>
                    <option value="medium" ${!task.priority || task.priority === "medium" ? "selected" : ""}>⚡ 中優先</option>
                    <option value="low" ${task.priority === "low" ? "selected" : ""}>🌱 低優先</option>
                  </select>
                  <select class="select-sm edit-category-select">
                    ${CATEGORIES.map(
                      (c) => `<option value="${c}" ${task.category === c ? "selected" : ""}>🏷️ ${c}</option>`
                    ).join("")}
                  </select>
                  <select class="select-sm edit-assignee-select">
                    <option value="">👤 不指定</option>
                    ${members
                      .map(
                        (m) =>
                          `<option value="${escapeHtml(m.uid)}" ${task.assigneeUid === m.uid ? "selected" : ""}>👤 ${escapeHtml(m.displayName)}</option>`
                      )
                      .join("")}
                  </select>
                  <input type="date" class="input-sm edit-duedate-input" value="${escapeHtml(task.dueDate || "")}" />
                  <button type="button" class="btn btn-primary save-edit-btn" style="padding: 6px 12px;">✓ 儲存</button>
                  <button type="button" class="btn btn-secondary cancel-edit-btn" style="padding: 6px 12px;">取消</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      const priorityLabel =
        task.priority === "high" ? "高優先" : task.priority === "low" ? "低優先" : "中優先";

      return `
        <div class="task-card ${task.completed ? "completed" : ""}" data-task-id="${escapeHtml(task.id)}">
          <div class="task-left">
            <button type="button" class="check-btn toggle-task-btn ${task.completed ? "checked" : ""}" title="${task.completed ? "標記為未完成" : "標記為已完成"}">
              ${task.completed ? "✓" : ""}
            </button>
            <div class="task-body">
              <div class="task-title">${escapeHtml(task.title)}</div>
              ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ""}
              <div class="task-meta-row">
                <span class="priority-pill priority-${escapeHtml(task.priority || "medium")}">${priorityLabel}</span>
                ${task.category ? `<span class="category-pill">🏷️ ${escapeHtml(task.category)}</span>` : ""}
                ${task.dueDate ? `<span class="category-pill">📅 ${escapeHtml(task.dueDate)}</span>` : ""}
                ${
                  task.assigneeName
                    ? `<span class="category-pill" style="background: #eef2ff; color: #4f46e5;">👤 指派：${escapeHtml(task.assigneeName)}</span>`
                    : ""
                }
                <span>由 ${escapeHtml(task.createdByName || "成員")} 建立</span>
                ${
                  task.completed && task.completedByName
                    ? `<span style="color: var(--success); font-weight: 600;">✓ 由 ${escapeHtml(task.completedByName)} 完成</span>`
                    : ""
                }
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button type="button" class="btn-icon start-edit-btn" title="編輯">✏️</button>
            <button type="button" class="btn-icon delete-task-btn" title="刪除" style="color: var(--danger);">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Event Listeners: Authentication
googleLoginBtn.addEventListener("click", async () => {
  googleLoginBtn.disabled = true;
  googleLoginText.textContent = "正在連接 Google...";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error("Google sign-in error:", err);
    if (err.code === "auth/unauthorized-domain") {
      showMessage("網域尚未授權：請至 Firebase Console 加入目前網域。", "error");
    } else if (err.code !== "auth/popup-closed-by-user") {
      showMessage(`登入失敗：${err.message}`, "error");
    }
  } finally {
    googleLoginBtn.disabled = false;
    googleLoginText.textContent = "使用 Google 帳號登入";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// Event Listeners: Create & Join Lists
function openNewListModal() {
  newListTitleInput.value = "";
  newListDescInput.value = "";
  newListPublicCheckbox.checked = true;
  newListModal.classList.remove("hidden");
  newListTitleInput.focus();
}

function closeNewListModal() {
  newListModal.classList.add("hidden");
}

document.getElementById("open-new-list-btn").addEventListener("click", openNewListModal);
document.getElementById("open-new-list-icon-btn").addEventListener("click", openNewListModal);
document.getElementById("empty-new-list-btn").addEventListener("click", openNewListModal);
document.getElementById("close-new-list-modal-btn").addEventListener("click", closeNewListModal);
document.getElementById("cancel-new-list-btn").addEventListener("click", closeNewListModal);
newListModal.addEventListener("click", (e) => {
  if (e.target === newListModal) closeNewListModal();
});

newListForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const title = newListTitleInput.value.trim() || "團隊協作待辦清單";
  const userEmail = (currentUser.email || "").toLowerCase();
  const inviteCode = generateInviteCode();

  try {
    const docRef = await addDoc(collection(db, "lists"), {
      title,
      description: newListDescInput.value.trim(),
      icon: selectedNewIcon,
      color: selectedNewColor,
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName || "建立者",
      ownerEmail: userEmail,
      memberUids: [currentUser.uid],
      invitedEmails: userEmail ? [userEmail] : [],
      members: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "建立者",
          email: userEmail,
          photoURL: currentUser.photoURL || null,
          role: "owner"
        }
      },
      isPublic: newListPublicCheckbox.checked,
      inviteCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    closeNewListModal();
    activeListId = docRef.id;
    subscribeToTasks();
    showMessage(`已建立清單「${title}」（邀請碼：${inviteCode}）`);
  } catch (err) {
    showMessage(`建立清單失敗：${err.message}`, "error");
  }
});

// Starter List Creation
document.getElementById("create-starter-list-btn").addEventListener("click", async () => {
  if (!currentUser) return;
  const userEmail = (currentUser.email || "").toLowerCase();
  const inviteCode = generateInviteCode();
  try {
    const docRef = await addDoc(collection(db, "lists"), {
      title: "🚀 團隊共同待辦事項",
      description: "支援多人即時同步新增、指派與勾選完成的共享清單",
      icon: "🚀",
      color: "#4f46e5",
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName || "建立者",
      ownerEmail: userEmail,
      memberUids: [currentUser.uid],
      invitedEmails: userEmail ? [userEmail] : [],
      members: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "建立者",
          email: userEmail,
          photoURL: currentUser.photoURL || null,
          role: "owner"
        }
      },
      isPublic: true,
      inviteCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, "lists", docRef.id, "tasks"), {
      title: "點擊右上角「邀請協作」分享邀請碼或輸入夥伴 Email",
      notes: "所有登入的協作成員都能即時看到任務新增與完成狀態！",
      completed: false,
      priority: "high",
      category: "工作",
      dueDate: new Date().toISOString().slice(0, 10),
      assigneeUid: currentUser.uid,
      assigneeName: currentUser.displayName || "我",
      assigneePhoto: currentUser.photoURL || null,
      createdByUid: currentUser.uid,
      createdByName: currentUser.displayName || "我",
      createdByPhoto: currentUser.photoURL || null,
      completedByName: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    activeListId = docRef.id;
    subscribeToTasks();
    showMessage("已為您建立第一個多人協作待辦清單！");
  } catch (err) {
    showMessage(`建立預設清單失敗：${err.message}`, "error");
  }
});

// Join by Invite Code
joinCodeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code || !currentUser) return;

  try {
    const q = query(collection(db, "lists"), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) {
      showMessage(`找不到邀請碼為「${code}」的待辦清單`, "error");
      return;
    }

    const targetDoc = snap.docs[0];
    const userEmail = (currentUser.email || "").toLowerCase();
    await updateDoc(doc(db, "lists", targetDoc.id), {
      memberUids: arrayUnion(currentUser.uid),
      ...(userEmail ? { invitedEmails: arrayUnion(userEmail) } : {}),
      [`members.${currentUser.uid}`]: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "協作夥伴",
        email: userEmail,
        photoURL: currentUser.photoURL || null,
        role: "editor"
      },
      updatedAt: serverTimestamp()
    });

    joinCodeInput.value = "";
    activeListId = targetDoc.id;
    subscribeToTasks();
    showMessage(`已成功加入協作清單「${targetDoc.data().title}」！`);
  } catch (err) {
    showMessage(`加入清單失敗：${err.message}`, "error");
  }
});

// Copy Invite Code from Header Badge
activeListCodeBadge.addEventListener("click", () => {
  const active = getActiveList();
  if (!active?.inviteCode) return;
  navigator.clipboard.writeText(active.inviteCode);
  showMessage(`已複製邀請碼：${active.inviteCode}`);
});

// Delete Active List
deleteListBtn.addEventListener("click", async () => {
  const active = getActiveList();
  if (!active || active.ownerId !== currentUser?.uid) return;
  if (!window.confirm(`確定要刪除清單「${active.title}」嗎？此操作無法復原。`)) return;
  try {
    await deleteDoc(doc(db, "lists", active.id));
    showMessage(`已刪除清單「${active.title}」`);
  } catch (err) {
    showMessage(`刪除清單失敗：${err.message}`, "error");
  }
});

// Share & Collaborators Modal
function renderShareModalContent() {
  const active = getActiveList();
  if (!active) return;

  shareInviteCode.textContent = active.inviteCode || "無";
  shareAccessModeTitle.textContent = active.isPublic ? "🌐 公開協作模式" : "🔒 專屬受邀模式";
  shareAccessModeDesc.textContent = active.isPublic
    ? "任何已登入的使用者皆可看到並參與此清單"
    : "僅限受邀信箱或輸入邀請碼的成員可存取";
  togglePublicBtn.textContent = `切換為${active.isPublic ? "專屬" : "公開"}`;

  const members = getActiveListMembers();
  shareMembersLabel.textContent = `目前已加入的協作成員 (${members.length})`;
  shareMembersList.innerHTML = members
    .map(
      (m) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-subtle); border-radius: var(--radius-sm);">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${renderAvatarHtml(m, true)}
          <div>
            <div style="font-size: 0.88rem; font-weight: 600;">${escapeHtml(m.displayName)}</div>
            <div style="font-size: 0.76rem; color: var(--text-secondary);">${escapeHtml(m.email || "")}</div>
          </div>
        </div>
        <span class="badge badge-public">${m.uid === active.ownerId ? "建立者" : "協作者"}</span>
      </div>
    `
    )
    .join("");

  const invited = Array.isArray(active.invitedEmails) ? active.invitedEmails : [];
  if (invited.length > 0) {
    shareInvitedEmailsSection.classList.remove("hidden");
    shareInvitedEmailsList.innerHTML = invited
      .map(
        (em) => `
        <span class="member-chip" style="padding-left: 10px;">
          <span>${escapeHtml(em)}</span>
          ${
            em !== active.ownerEmail
              ? `<button type="button" class="btn-icon remove-invite-btn" data-email="${escapeHtml(em)}" style="padding: 2px;" title="移除邀請">✕</button>`
              : ""
          }
        </span>
      `
      )
      .join("");
  } else {
    shareInvitedEmailsSection.classList.add("hidden");
  }
}

document.getElementById("open-share-modal-btn").addEventListener("click", () => {
  renderShareModalContent();
  shareModal.classList.remove("hidden");
});

document.getElementById("close-share-modal-btn").addEventListener("click", () => {
  shareModal.classList.add("hidden");
});

shareModal.addEventListener("click", (e) => {
  if (e.target === shareModal) shareModal.classList.add("hidden");
});

copyCodeBtn.addEventListener("click", () => {
  const active = getActiveList();
  if (!active?.inviteCode) return;
  navigator.clipboard.writeText(active.inviteCode);
  showMessage(`已複製邀請碼：${active.inviteCode}`);
});

copyLinkBtn.addEventListener("click", () => {
  const active = getActiveList();
  if (!active?.inviteCode) return;
  const url = `${window.location.origin}${window.location.pathname}?join=${active.inviteCode}`;
  navigator.clipboard.writeText(url);
  showMessage("已複製邀請連結！");
});

inviteEmailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const active = getActiveList();
  const cleanEmail = inviteEmailInput.value.trim().toLowerCase();
  if (!active || !cleanEmail) return;

  try {
    const uQuery = query(collection(db, "users"), where("email", "==", cleanEmail));
    const uSnap = await getDocs(uQuery);

    const updates = {
      invitedEmails: arrayUnion(cleanEmail),
      updatedAt: serverTimestamp()
    };

    if (!uSnap.empty) {
      const foundUser = uSnap.docs[0].data();
      updates.memberUids = arrayUnion(foundUser.uid);
      updates[`members.${foundUser.uid}`] = {
        uid: foundUser.uid,
        displayName: foundUser.displayName || cleanEmail,
        email: cleanEmail,
        photoURL: foundUser.photoURL || null,
        role: "editor"
      };
    }

    await updateDoc(doc(db, "lists", active.id), updates);
    inviteEmailInput.value = "";
    showMessage(`已將 ${cleanEmail} 加入協作名單！`);
  } catch (err) {
    showMessage(`邀請失敗：${err.message}`, "error");
  }
});

shareInvitedEmailsList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".remove-invite-btn");
  if (!btn) return;
  const active = getActiveList();
  const emailToRemove = btn.dataset.email;
  if (!active || !emailToRemove) return;
  try {
    await updateDoc(doc(db, "lists", active.id), {
      invitedEmails: arrayRemove(emailToRemove),
      updatedAt: serverTimestamp()
    });
    showMessage(`已移除 ${emailToRemove} 的邀請`);
  } catch (err) {
    showMessage(`移除失敗：${err.message}`, "error");
  }
});

togglePublicBtn.addEventListener("click", async () => {
  const active = getActiveList();
  if (!active) return;
  try {
    const nextState = !active.isPublic;
    await updateDoc(doc(db, "lists", active.id), {
      isPublic: nextState,
      updatedAt: serverTimestamp()
    });
    showMessage(nextState ? "已切換為公開協作清單" : "已切換為專屬受邀清單");
  } catch (err) {
    showMessage(`更新權限失敗：${err.message}`, "error");
  }
});

// Task Composer & Task Actions
toggleNotesBtn.addEventListener("click", () => {
  const isHidden = taskNotesInput.classList.toggle("hidden");
  toggleNotesBtn.textContent = isHidden ? "更多選項" : "收起選項";
});

async function ensureMemberInActiveList() {
  const active = getActiveList();
  if (!active || !currentUser) return;
  const alreadyIn =
    Array.isArray(active.memberUids) && active.memberUids.includes(currentUser.uid);
  if (!alreadyIn) {
    const userEmail = (currentUser.email || "").toLowerCase();
    await updateDoc(doc(db, "lists", active.id), {
      memberUids: arrayUnion(currentUser.uid),
      [`members.${currentUser.uid}`]: {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "協作夥伴",
        email: userEmail,
        photoURL: currentUser.photoURL || null,
        role: "editor"
      },
      updatedAt: serverTimestamp()
    }).catch(() => {});
  }
}

taskComposerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  if (!title || !activeListId || !currentUser) return;

  const members = getActiveListMembers();
  const assignee = members.find((m) => m.uid === taskAssigneeSelect.value) || null;

  try {
    await ensureMemberInActiveList();
    await addDoc(collection(db, "lists", activeListId, "tasks"), {
      title,
      notes: taskNotesInput.value.trim(),
      completed: false,
      priority: taskPrioritySelect.value,
      category: taskCategorySelect.value,
      dueDate: taskDuedateInput.value || null,
      assigneeUid: assignee ? assignee.uid : null,
      assigneeName: assignee ? assignee.displayName : null,
      assigneePhoto: assignee ? assignee.photoURL : null,
      createdByUid: currentUser.uid,
      createdByName: currentUser.displayName || "協作夥伴",
      createdByPhoto: currentUser.photoURL || null,
      completedByName: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    taskTitleInput.value = "";
    taskNotesInput.value = "";
    taskDuedateInput.value = "";
    taskAssigneeSelect.value = "";
  } catch (err) {
    showMessage(`新增待辦事項失敗：${err.message}`, "error");
  }
});

// Delegate Task List Actions (Toggle, Edit, Save, Cancel, Delete)
tasksContainer.addEventListener("click", async (e) => {
  const card = e.target.closest("[data-task-id]");
  if (!card || !activeListId) return;
  const taskId = card.dataset.taskId;
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (e.target.closest(".toggle-task-btn")) {
    try {
      const nextCompleted = !task.completed;
      await updateDoc(doc(db, "lists", activeListId, "tasks", taskId), {
        completed: nextCompleted,
        completedByName: nextCompleted ? currentUser.displayName || "協作夥伴" : null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      showMessage(`更新狀態失敗：${err.message}`, "error");
    }
    return;
  }

  if (e.target.closest(".start-edit-btn")) {
    editingTaskId = taskId;
    renderTasksAndProgress();
    return;
  }

  if (e.target.closest(".cancel-edit-btn")) {
    editingTaskId = null;
    renderTasksAndProgress();
    return;
  }

  if (e.target.closest(".save-edit-btn")) {
    const newTitle = card.querySelector(".edit-title-input")?.value.trim();
    if (!newTitle) return;
    const newNotes = card.querySelector(".edit-notes-input")?.value.trim() || "";
    const newPriority = card.querySelector(".edit-priority-select")?.value || "medium";
    const newCategory = card.querySelector(".edit-category-select")?.value || "工作";
    const newAssigneeUid = card.querySelector(".edit-assignee-select")?.value || "";
    const newDueDate = card.querySelector(".edit-duedate-input")?.value || null;

    const members = getActiveListMembers();
    const assignee = members.find((m) => m.uid === newAssigneeUid) || null;

    try {
      await updateDoc(doc(db, "lists", activeListId, "tasks", taskId), {
        title: newTitle,
        notes: newNotes,
        priority: newPriority,
        category: newCategory,
        dueDate: newDueDate,
        assigneeUid: assignee ? assignee.uid : null,
        assigneeName: assignee ? assignee.displayName : null,
        assigneePhoto: assignee ? assignee.photoURL : null,
        updatedAt: serverTimestamp()
      });
      editingTaskId = null;
      showMessage("已更新待辦事項");
    } catch (err) {
      showMessage(`更新失敗：${err.message}`, "error");
    }
    return;
  }

  if (e.target.closest(".delete-task-btn")) {
    try {
      await deleteDoc(doc(db, "lists", activeListId, "tasks", taskId));
    } catch (err) {
      showMessage(`刪除失敗：${err.message}`, "error");
    }
  }
});

clearCompletedBtn.addEventListener("click", async () => {
  const completedTasks = tasks.filter((t) => t.completed);
  if (completedTasks.length === 0 || !activeListId) return;
  try {
    await Promise.all(
      completedTasks.map((t) => deleteDoc(doc(db, "lists", activeListId, "tasks", t.id)))
    );
    showMessage(`已清除 ${completedTasks.length} 項已完成任務`);
  } catch (err) {
    showMessage(`清除失敗：${err.message}`, "error");
  }
});

// Filters & Search Listeners
statusFilterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  statusFilter = btn.dataset.filter;
  renderTasksAndProgress();
});

priorityFilterSelect.addEventListener("change", () => {
  priorityFilter = priorityFilterSelect.value;
  renderTasksAndProgress();
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  renderTasksAndProgress();
});
