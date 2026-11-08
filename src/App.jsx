import React, { useState, useEffect, useMemo } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
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
} from "firebase/firestore";
import {
  CheckSquare,
  Plus,
  Users,
  LogOut,
  Trash2,
  Edit3,
  Check,
  X,
  Share2,
  Copy,
  Globe,
  Lock,
  Calendar,
  Tag,
  UserPlus,
  Search,
  Sparkles,
  AlertCircle,
  Hash
} from "lucide-react";
import { auth, googleProvider, db } from "./firebase";

const LIST_ICONS = ["📋", "🚀", "🛒", "🏠", "💡", "🎯", "📅", "✨"];
const LIST_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6"
];
const CATEGORIES = ["工作", "開發", "設計", "採購", "生活", "其他"];

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [toast, setToast] = useState(null);

  // Collaborative Lists State
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);

  // Modals State
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // New List Form
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListIcon, setNewListIcon] = useState("📋");
  const [newListColor, setNewListColor] = useState("#4f46e5");
  const [newListPublic, setNewListPublic] = useState(true);

  // Invite Collaborator Form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskCategory, setTaskCategory] = useState("工作");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssigneeUid, setTaskAssigneeUid] = useState("");
  const [showComposerDetails, setShowComposerDetails] = useState(false);

  // Task Editing State
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskNotes, setEditTaskNotes] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskCategory, setEditTaskCategory] = useState("工作");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskAssigneeUid, setEditTaskAssigneeUid] = useState("");

  // Filters State
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | completed | mine
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const showMessage = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // 1. Observe Auth State & Sync User Profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              email: (currentUser.email || "").toLowerCase(),
              displayName: currentUser.displayName || "協作夥伴",
              photoURL: currentUser.photoURL || null,
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
          setJoinCodeInput(urlJoinCode.toUpperCase());
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. Listen to Collaborative Lists in Real Time
  useEffect(() => {
    if (!user) {
      setLists([]);
      setActiveListId(null);
      return;
    }

    const listsRef = collection(db, "lists");
    const unsub = onSnapshot(
      listsRef,
      (snapshot) => {
        const userEmail = (user.email || "").toLowerCase();
        const accessibleLists = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isOwner = data.ownerId === user.uid;
          const isMember = Array.isArray(data.memberUids) && data.memberUids.includes(user.uid);
          const isInvited =
            userEmail &&
            Array.isArray(data.invitedEmails) &&
            data.invitedEmails.includes(userEmail);
          const isPublic = data.isPublic === true;

          if (isOwner || isMember || isInvited || isPublic) {
            accessibleLists.push({ id: docSnap.id, ...data });

            // Automatically promote invited user into memberUids & members map
            if (isInvited && !isMember) {
              const listRef = doc(db, "lists", docSnap.id);
              updateDoc(listRef, {
                memberUids: arrayUnion(user.uid),
                [`members.${user.uid}`]: {
                  uid: user.uid,
                  displayName: user.displayName || "協作夥伴",
                  email: userEmail,
                  photoURL: user.photoURL || null,
                  role: "editor"
                },
                updatedAt: serverTimestamp()
              }).catch(() => {});
            }
          }
        });

        // Sort lists by createdAt desc
        accessibleLists.sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tB - tA;
        });

        setLists(accessibleLists);
        setActiveListId((prevId) => {
          if (prevId && accessibleLists.some((l) => l.id === prevId)) {
            return prevId;
          }
          return accessibleLists[0]?.id || null;
        });
      },
      (err) => {
        console.error("Lists listener error:", err);
        showMessage(`讀取清單時發生錯誤：${err.message}`, "error");
      }
    );

    return () => unsub();
  }, [user]);

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) || null,
    [lists, activeListId]
  );

  // 3. Listen to Active List's Tasks in Real Time
  useEffect(() => {
    if (!user || !activeListId) {
      setTasks([]);
      return;
    }

    const tasksRef = collection(db, "lists", activeListId, "tasks");
    const unsub = onSnapshot(
      tasksRef,
      (snapshot) => {
        const loaded = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Sort: incomplete first, then high -> medium -> low priority, then newest
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        loaded.sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
          if (pDiff !== 0) return pDiff;
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tB - tA;
        });
        setTasks(loaded);
      },
      (err) => {
        console.error("Tasks listener error:", err);
      }
    );

    return () => unsub();
  }, [user, activeListId]);

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (err.code === "auth/unauthorized-domain") {
        showMessage(
          "網域尚未授權：請至 Firebase Console > Authentication > Settings > Authorized domains 加入 localhost。",
          "error"
        );
      } else if (err.code === "auth/operation-not-allowed") {
        showMessage(
          "尚未啟用 Google 登入：請至 Firebase Console > Authentication > Sign-in method 啟用 Google 提供者。",
          "error"
        );
      } else if (err.code !== "auth/popup-closed-by-user") {
        showMessage(`登入失敗：${err.message}`, "error");
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Create Collaborative List
  const handleCreateList = async (e) => {
    e?.preventDefault();
    if (!user) return;
    const title = newListTitle.trim() || "團隊協作待辦清單";
    const userEmail = (user.email || "").toLowerCase();
    const inviteCode = generateInviteCode();

    try {
      const docRef = await addDoc(collection(db, "lists"), {
        title,
        description: newListDesc.trim(),
        icon: newListIcon,
        color: newListColor,
        ownerId: user.uid,
        ownerName: user.displayName || "建立者",
        ownerEmail: userEmail,
        memberUids: [user.uid],
        invitedEmails: userEmail ? [userEmail] : [],
        members: {
          [user.uid]: {
            uid: user.uid,
            displayName: user.displayName || "建立者",
            email: userEmail,
            photoURL: user.photoURL || null,
            role: "owner"
          }
        },
        isPublic: newListPublic,
        inviteCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setNewListTitle("");
      setNewListDesc("");
      setShowNewListModal(false);
      setActiveListId(docRef.id);
      showMessage(`已建立清單「${title}」（邀請碼：${inviteCode}）`);
    } catch (err) {
      console.error("Create list error:", err);
      showMessage(`建立清單失敗：${err.message}`, "error");
    }
  };

  // Quick Starter List Creation
  const handleCreateStarterList = async () => {
    if (!user) return;
    const userEmail = (user.email || "").toLowerCase();
    const inviteCode = generateInviteCode();
    try {
      const docRef = await addDoc(collection(db, "lists"), {
        title: "🚀 團隊共同待辦事項",
        description: "支援多人即時同步新增、指派與勾選完成的共享清單",
        icon: "🚀",
        color: "#4f46e5",
        ownerId: user.uid,
        ownerName: user.displayName || "建立者",
        ownerEmail: userEmail,
        memberUids: [user.uid],
        invitedEmails: userEmail ? [userEmail] : [],
        members: {
          [user.uid]: {
            uid: user.uid,
            displayName: user.displayName || "建立者",
            email: userEmail,
            photoURL: user.photoURL || null,
            role: "owner"
          }
        },
        isPublic: true,
        inviteCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Add 2 sample collaborative tasks
      const tasksCol = collection(db, "lists", docRef.id, "tasks");
      await addDoc(tasksCol, {
        title: "點擊右上角「邀請協作」分享邀請碼或輸入夥伴 Email",
        notes: "所有登入的協作成員都能即時看到任務新增與完成狀態！",
        completed: false,
        priority: "high",
        category: "工作",
        dueDate: new Date().toISOString().slice(0, 10),
        assigneeUid: user.uid,
        assigneeName: user.displayName || "我",
        assigneePhoto: user.photoURL || null,
        createdByUid: user.uid,
        createdByName: user.displayName || "我",
        createdByPhoto: user.photoURL || null,
        completedByName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveListId(docRef.id);
      showMessage("已為您建立第一個多人協作待辦清單！");
    } catch (err) {
      showMessage(`建立預設清單失敗：${err.message}`, "error");
    }
  };

  // Join List by Invite Code
  const handleJoinByCode = async (e) => {
    e?.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || !user) return;

    setJoiningByCode(true);
    try {
      const q = query(collection(db, "lists"), where("inviteCode", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) {
        showMessage(`找不到邀請碼為「${code}」的待辦清單`, "error");
        return;
      }

      const targetDoc = snap.docs[0];
      const userEmail = (user.email || "").toLowerCase();
      await updateDoc(doc(db, "lists", targetDoc.id), {
        memberUids: arrayUnion(user.uid),
        ...(userEmail ? { invitedEmails: arrayUnion(userEmail) } : {}),
        [`members.${user.uid}`]: {
          uid: user.uid,
          displayName: user.displayName || "協作夥伴",
          email: userEmail,
          photoURL: user.photoURL || null,
          role: "editor"
        },
        updatedAt: serverTimestamp()
      });

      setJoinCodeInput("");
      setActiveListId(targetDoc.id);
      showMessage(`已成功加入協作清單「${targetDoc.data().title}」！`);
    } catch (err) {
      console.error("Join by code error:", err);
      showMessage(`加入清單失敗：${err.message}`, "error");
    } finally {
      setJoiningByCode(false);
    }
  };

  // Invite Collaborator by Email
  const handleInviteByEmail = async (e) => {
    e?.preventDefault();
    if (!activeList || !inviteEmail.trim()) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    setInviting(true);

    try {
      // Check if user already registered in /users
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

      await updateDoc(doc(db, "lists", activeList.id), updates);
      setInviteEmail("");
      showMessage(`已將 ${cleanEmail} 加入協作名單！`);
    } catch (err) {
      console.error("Invite email error:", err);
      showMessage(`邀請失敗：${err.message}`, "error");
    } finally {
      setInviting(false);
    }
  };

  // Remove Invited Email
  const handleRemoveInvitedEmail = async (emailToRemove) => {
    if (!activeList) return;
    try {
      await updateDoc(doc(db, "lists", activeList.id), {
        invitedEmails: arrayRemove(emailToRemove),
        updatedAt: serverTimestamp()
      });
      showMessage(`已移除 ${emailToRemove} 的邀請`);
    } catch (err) {
      showMessage(`移除失敗：${err.message}`, "error");
    }
  };

  // Toggle Public / Private List
  const handleToggleListPublic = async () => {
    if (!activeList) return;
    try {
      const nextState = !activeList.isPublic;
      await updateDoc(doc(db, "lists", activeList.id), {
        isPublic: nextState,
        updatedAt: serverTimestamp()
      });
      showMessage(nextState ? "已切換為公開協作清單" : "已切換為專屬受邀清單");
    } catch (err) {
      showMessage(`更新權限失敗：${err.message}`, "error");
    }
  };

  // Delete List (Owner only)
  const handleDeleteList = async () => {
    if (!activeList || activeList.ownerId !== user?.uid) return;
    if (!window.confirm(`確定要刪除清單「${activeList.title}」嗎？此操作無法復原。`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "lists", activeList.id));
      showMessage(`已刪除清單「${activeList.title}」`);
    } catch (err) {
      showMessage(`刪除清單失敗：${err.message}`, "error");
    }
  };

  // List Collaborators Helper
  const listMembers = useMemo(() => {
    if (!activeList) return [];
    const membersMap = activeList.members || {};
    return Object.values(membersMap);
  }, [activeList]);

  // Ensure current user is registered in members map when participating in a public list
  const ensureMemberInActiveList = async () => {
    if (!activeList || !user) return;
    const alreadyIn = Array.isArray(activeList.memberUids) && activeList.memberUids.includes(user.uid);
    if (!alreadyIn) {
      const userEmail = (user.email || "").toLowerCase();
      await updateDoc(doc(db, "lists", activeList.id), {
        memberUids: arrayUnion(user.uid),
        [`members.${user.uid}`]: {
          uid: user.uid,
          displayName: user.displayName || "協作夥伴",
          email: userEmail,
          photoURL: user.photoURL || null,
          role: "editor"
        },
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
  };

  // Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeListId || !user) return;

    const assignee = listMembers.find((m) => m.uid === taskAssigneeUid) || null;

    try {
      await ensureMemberInActiveList();
      await addDoc(collection(db, "lists", activeListId, "tasks"), {
        title: taskTitle.trim(),
        notes: taskNotes.trim(),
        completed: false,
        priority: taskPriority,
        category: taskCategory,
        dueDate: taskDueDate || null,
        assigneeUid: assignee ? assignee.uid : null,
        assigneeName: assignee ? assignee.displayName : null,
        assigneePhoto: assignee ? assignee.photoURL : null,
        createdByUid: user.uid,
        createdByName: user.displayName || "協作夥伴",
        createdByPhoto: user.photoURL || null,
        completedByName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setTaskTitle("");
      setTaskNotes("");
      setTaskDueDate("");
      setTaskAssigneeUid("");
    } catch (err) {
      console.error("Add task error:", err);
      showMessage(`新增待辦事項失敗：${err.message}`, "error");
    }
  };

  // Toggle Task Completion
  const handleToggleTask = async (task) => {
    if (!activeListId || !user) return;
    try {
      const nextCompleted = !task.completed;
      await updateDoc(doc(db, "lists", activeListId, "tasks", task.id), {
        completed: nextCompleted,
        completedByName: nextCompleted ? user.displayName || "協作夥伴" : null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      showMessage(`更新狀態失敗：${err.message}`, "error");
    }
  };

  // Start Editing Task
  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title || "");
    setEditTaskNotes(task.notes || "");
    setEditTaskPriority(task.priority || "medium");
    setEditTaskCategory(task.category || "工作");
    setEditTaskDueDate(task.dueDate || "");
    setEditTaskAssigneeUid(task.assigneeUid || "");
  };

  // Save Edited Task
  const handleSaveTaskEdit = async (taskId) => {
    if (!editTaskTitle.trim() || !activeListId) return;
    const assignee = listMembers.find((m) => m.uid === editTaskAssigneeUid) || null;

    try {
      await updateDoc(doc(db, "lists", activeListId, "tasks", taskId), {
        title: editTaskTitle.trim(),
        notes: editTaskNotes.trim(),
        priority: editTaskPriority,
        category: editTaskCategory,
        dueDate: editTaskDueDate || null,
        assigneeUid: assignee ? assignee.uid : null,
        assigneeName: assignee ? assignee.displayName : null,
        assigneePhoto: assignee ? assignee.photoURL : null,
        updatedAt: serverTimestamp()
      });
      setEditingTaskId(null);
      showMessage("已更新待辦事項");
    } catch (err) {
      showMessage(`更新失敗：${err.message}`, "error");
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    if (!activeListId) return;
    try {
      await deleteDoc(doc(db, "lists", activeListId, "tasks", taskId));
    } catch (err) {
      showMessage(`刪除失敗：${err.message}`, "error");
    }
  };

  // Clear Completed Tasks
  const handleClearCompleted = async () => {
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
  };

  // Filtered Tasks & Progress
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === "active" && t.completed) return false;
      if (statusFilter === "completed" && !t.completed) return false;
      if (statusFilter === "mine" && t.assigneeUid !== user?.uid) return false;
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
  }, [tasks, statusFilter, priorityFilter, searchQuery, user]);

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          載入 MyToDoList 中...
        </div>
      </div>
    );
  }

  // Unauthenticated Screen
  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <CheckSquare size={34} />
          </div>
          <h1 className="auth-title">MyToDoList</h1>
          <p className="auth-subtitle">
            基於 Firebase 的多人即時協作待辦清單
          </p>

          {toast && (
            <div
              className={`alert-banner ${
                toast.type === "error" ? "alert-error" : "alert-success"
              }`}
              style={{ marginBottom: 20, textAlign: "left" }}
            >
              <span>{toast.text}</span>
              <button className="btn-icon" onClick={() => setToast(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          <div className="feature-list">
            <div className="feature-item">
              <Sparkles size={18} color="#4f46e5" />
              <span>Google 帳號一鍵安全登入</span>
            </div>
            <div className="feature-item">
              <Users size={18} color="#10b981" />
              <span>透過 Email、6 碼邀請碼或公開清單多人即時協作</span>
            </div>
            <div className="feature-item">
              <CheckSquare size={18} color="#0ea5e9" />
              <span>支援任務指派、優先順序、到期日與即時同步狀態</span>
            </div>
          </div>

          <button
            className="google-btn"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{signingIn ? "正在連接 Google..." : "使用 Google 帳號登入"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-title">
            <div className="brand-icon">
              <CheckSquare size={18} />
            </div>
            <span>MyToDoList</span>
          </div>
          <span className="badge badge-public">即時同步</span>
        </div>

        {/* Signed-in User Bar */}
        <div className="user-profile-bar">
          <div className="user-info">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="avatar">
                {(user.displayName || user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="user-meta">
              <div className="user-name">{user.displayName || "使用者"}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={handleSignOut}
            title="登出 Google 帳號"
          >
            <LogOut size={17} />
          </button>
        </div>

        {/* Collaborative Lists Navigation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="section-label">
            <span>協作待辦清單 ({lists.length})</span>
            <button
              className="btn-icon"
              onClick={() => setShowNewListModal(true)}
              title="新增協作清單"
              style={{ color: "var(--primary)" }}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="lists-nav">
            {lists.map((list) => (
              <button
                key={list.id}
                className={`list-nav-item ${list.id === activeListId ? "active" : ""}`}
                onClick={() => setActiveListId(list.id)}
              >
                <div className="list-nav-left">
                  <span>{list.icon || "📋"}</span>
                  <span className="list-nav-title">{list.title}</span>
                </div>
                <span className={`badge ${list.isPublic ? "badge-public" : "badge-private"}`}>
                  {list.isPublic ? "公開" : "專屬"}
                </span>
              </button>
            ))}

            {lists.length === 0 && (
              <div
                style={{
                  padding: "16px 12px",
                  fontSize: "0.83rem",
                  color: "var(--text-secondary)",
                  textAlign: "center"
                }}
              >
                尚無待辦清單，可點擊上方「+」建立或輸入邀請碼加入。
              </div>
            )}
          </div>
        </div>

        {/* Join via Invite Code Box */}
        <div className="join-code-box">
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            <Hash size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            輸入邀請碼加入清單
          </div>
          <form className="join-code-form" onSubmit={handleJoinByCode}>
            <input
              type="text"
              className="input-sm"
              placeholder="例如：A7K9X2"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              maxLength={10}
              style={{ flex: 1, background: "#fff", textTransform: "uppercase" }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: "6px 12px", fontSize: "0.82rem" }}
              disabled={joiningByCode || !joinCodeInput.trim()}
            >
              加入
            </button>
          </form>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={() => setShowNewListModal(true)}
        >
          <Plus size={17} />
          <span>建立新協作清單</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {toast && (
          <div
            className={`alert-banner ${
              toast.type === "error" ? "alert-error" : "alert-success"
            }`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={17} />
              <span>{toast.text}</span>
            </div>
            <button className="btn-icon" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        {!activeList ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "var(--primary-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Users size={28} />
            </div>
            <h2 style={{ fontSize: "1.25rem", color: "var(--text-primary)" }}>
              開始您的第一個多人協作待辦清單
            </h2>
            <p style={{ maxWidth: 420, fontSize: "0.92rem" }}>
              建立清單後，您可以透過 Email 邀請團隊夥伴，或分享 6 碼邀請碼讓其他人即時加入同步協作。
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleCreateStarterList}>
                <Sparkles size={16} />
                <span>一鍵建立範例協作清單</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNewListModal(true)}>
                <Plus size={16} />
                <span>自訂新清單</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Active List Header */}
            <section className="list-header-card">
              <div className="list-header-top">
                <div className="list-title-group">
                  <div
                    className="list-icon-badge"
                    style={{ background: activeList.color || "#4f46e5" }}
                  >
                    {activeList.icon || "📋"}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h1 style={{ fontSize: "1.45rem", fontWeight: 700 }}>
                        {activeList.title}
                      </h1>
                      <span
                        className={`badge ${
                          activeList.isPublic ? "badge-public" : "badge-private"
                        }`}
                      >
                        {activeList.isPublic ? (
                          <>
                            <Globe size={12} /> 公開協作
                          </>
                        ) : (
                          <>
                            <Lock size={12} /> 專屬邀請
                          </>
                        )}
                      </span>
                      {activeList.inviteCode && (
                        <span
                          className="badge"
                          style={{
                            background: "#eef2ff",
                            color: "#4f46e5",
                            cursor: "pointer"
                          }}
                          onClick={() => {
                            navigator.clipboard.writeText(activeList.inviteCode);
                            showMessage(`已複製邀請碼：${activeList.inviteCode}`);
                          }}
                          title="點擊複製邀請碼"
                        >
                          邀請碼：{activeList.inviteCode} <Copy size={11} />
                        </span>
                      )}
                    </div>
                    {activeList.description && (
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.9rem",
                          marginTop: 4
                        }}
                      >
                        {activeList.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="list-header-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowShareModal(true)}
                  >
                    <UserPlus size={16} />
                    <span>邀請協作 ({listMembers.length})</span>
                  </button>
                  {activeList.ownerId === user.uid && (
                    <button
                      className="btn btn-danger"
                      onClick={handleDeleteList}
                      title="刪除此清單"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Collaborators Avatar Bar */}
              <div className="collaborator-bar">
                <div className="avatar-stack">
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                    協作成員：
                  </span>
                  {listMembers.map((member) => (
                    <div key={member.uid} className="member-chip">
                      {member.photoURL ? (
                        <img
                          src={member.photoURL}
                          alt={member.displayName}
                          className="avatar avatar-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="avatar avatar-sm">
                          {(member.displayName || member.email || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <span>{member.displayName}</span>
                    </div>
                  ))}
                </div>

                {completedCount > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                    onClick={handleClearCompleted}
                  >
                    清除已完成 ({completedCount})
                  </button>
                )}
              </div>

              {/* Completion Progress */}
              <div className="progress-section">
                <div className="progress-meta">
                  <span>整體完成進度</span>
                  <span>
                    已完成 {completedCount} / {tasks.length} 項 ({progressPercent}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </section>

            {/* Task Composer */}
            <form className="task-composer" onSubmit={handleAddTask}>
              <div className="composer-main-row">
                <input
                  type="text"
                  className="composer-input"
                  placeholder="新增待辦事項...（按 Enter 立即同步給所有協作成員）"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowComposerDetails((v) => !v)}
                >
                  {showComposerDetails ? "收起選項" : "更多選項"}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!taskTitle.trim()}
                >
                  <Plus size={18} />
                  <span>新增</span>
                </button>
              </div>

              <div className="composer-options-row">
                <select
                  className="select-sm"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                >
                  <option value="high">🔥 高優先</option>
                  <option value="medium">⚡ 中優先</option>
                  <option value="low">🌱 低優先</option>
                </select>

                <select
                  className="select-sm"
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      🏷️ {cat}
                    </option>
                  ))}
                </select>

                <select
                  className="select-sm"
                  value={taskAssigneeUid}
                  onChange={(e) => setTaskAssigneeUid(e.target.value)}
                >
                  <option value="">👤 指派給：不指定</option>
                  {listMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      👤 指派給：{m.displayName}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  className="input-sm"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  title="到期日"
                />
              </div>

              {showComposerDetails && (
                <textarea
                  className="composer-input"
                  rows={2}
                  placeholder="補充說明或備註（選填）..."
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                />
              )}
            </form>

            {/* Filters & Search Bar */}
            <div className="filters-bar">
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  全部 ({tasks.length})
                </button>
                <button
                  className={`filter-tab ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() => setStatusFilter("active")}
                >
                  進行中 ({tasks.length - completedCount})
                </button>
                <button
                  className={`filter-tab ${statusFilter === "completed" ? "active" : ""}`}
                  onClick={() => setStatusFilter("completed")}
                >
                  已完成 ({completedCount})
                </button>
                <button
                  className={`filter-tab ${statusFilter === "mine" ? "active" : ""}`}
                  onClick={() => setStatusFilter("mine")}
                >
                  指派給我
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select
                  className="select-sm"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">所有優先順序</option>
                  <option value="high">高優先</option>
                  <option value="medium">中優先</option>
                  <option value="low">低優先</option>
                </select>

                <div style={{ position: "relative" }}>
                  <Search
                    size={15}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)"
                    }}
                  />
                  <input
                    type="text"
                    className="input-sm"
                    style={{ paddingLeft: 32, background: "#fff" }}
                    placeholder="搜尋待辦事項..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Tasks List */}
            <div className="tasks-container">
              {filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <CheckSquare size={32} color="var(--text-muted)" />
                  <p>目前沒有符合條件的待辦事項</p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isEditing = editingTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`task-card ${task.completed ? "completed" : ""}`}
                    >
                      <div className="task-left">
                        <button
                          type="button"
                          className={`check-btn ${task.completed ? "checked" : ""}`}
                          onClick={() => handleToggleTask(task)}
                          title={task.completed ? "標記為未完成" : "標記為已完成"}
                        >
                          {task.completed && <Check size={14} strokeWidth={3} />}
                        </button>

                        {isEditing ? (
                          <div
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              gap: 8
                            }}
                          >
                            <input
                              type="text"
                              className="composer-input"
                              value={editTaskTitle}
                              onChange={(e) => setEditTaskTitle(e.target.value)}
                            />
                            <textarea
                              className="composer-input"
                              rows={2}
                              placeholder="備註說明..."
                              value={editTaskNotes}
                              onChange={(e) => setEditTaskNotes(e.target.value)}
                            />
                            <div className="composer-options-row">
                              <select
                                className="select-sm"
                                value={editTaskPriority}
                                onChange={(e) => setEditTaskPriority(e.target.value)}
                              >
                                <option value="high">🔥 高優先</option>
                                <option value="medium">⚡ 中優先</option>
                                <option value="low">🌱 低優先</option>
                              </select>
                              <select
                                className="select-sm"
                                value={editTaskCategory}
                                onChange={(e) => setEditTaskCategory(e.target.value)}
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    🏷️ {cat}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="select-sm"
                                value={editTaskAssigneeUid}
                                onChange={(e) => setEditTaskAssigneeUid(e.target.value)}
                              >
                                <option value="">👤 不指定</option>
                                {listMembers.map((m) => (
                                  <option key={m.uid} value={m.uid}>
                                    👤 {m.displayName}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="date"
                                className="input-sm"
                                value={editTaskDueDate}
                                onChange={(e) => setEditTaskDueDate(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: "6px 12px" }}
                                onClick={() => handleSaveTaskEdit(task.id)}
                              >
                                <Check size={15} /> 儲存
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px" }}
                                onClick={() => setEditingTaskId(null)}
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="task-body">
                            <div className="task-title">{task.title}</div>
                            {task.notes && <div className="task-notes">{task.notes}</div>}
                            <div className="task-meta-row">
                              <span className={`priority-pill priority-${task.priority || "medium"}`}>
                                {task.priority === "high"
                                  ? "高優先"
                                  : task.priority === "low"
                                  ? "低優先"
                                  : "中優先"}
                              </span>

                              {task.category && (
                                <span className="category-pill">
                                  <Tag size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                                  {task.category}
                                </span>
                              )}

                              {task.dueDate && (
                                <span className="category-pill">
                                  <Calendar
                                    size={11}
                                    style={{ verticalAlign: "-1px", marginRight: 3 }}
                                  />
                                  {task.dueDate}
                                </span>
                              )}

                              {task.assigneeName && (
                                <span
                                  className="category-pill"
                                  style={{ background: "#eef2ff", color: "#4f46e5" }}
                                >
                                  👤 指派：{task.assigneeName}
                                </span>
                              )}

                              <span>由 {task.createdByName || "成員"} 建立</span>

                              {task.completed && task.completedByName && (
                                <span style={{ color: "var(--success)", fontWeight: 600 }}>
                                  ✓ 由 {task.completedByName} 完成
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="task-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => startEditTask(task)}
                            title="編輯"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleDeleteTask(task.id)}
                            title="刪除"
                            style={{ color: "var(--danger)" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      {/* Modal: Create New Collaborative List */}
      {showNewListModal && (
        <div className="modal-backdrop" onClick={() => setShowNewListModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">建立新協作待辦清單</h3>
              <button className="btn-icon" onClick={() => setShowNewListModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleCreateList}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div className="form-group">
                <label className="form-label">清單名稱</label>
                <input
                  type="text"
                  className="composer-input"
                  placeholder="例如：產品上線準備、家庭採購清單..."
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">清單說明（選填）</label>
                <input
                  type="text"
                  className="composer-input"
                  placeholder="簡短描述這個待辦清單的目標..."
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">選擇圖示</label>
                <div className="picker-row">
                  {LIST_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      className={`picker-btn ${newListIcon === ic ? "selected" : ""}`}
                      onClick={() => setNewListIcon(ic)}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">代表色彩</label>
                <div className="picker-row">
                  {LIST_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={`picker-btn ${newListColor === col ? "selected" : ""}`}
                      style={{ background: col }}
                      onClick={() => setNewListColor(col)}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">協作權限模式</label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newListPublic}
                    onChange={(e) => setNewListPublic(e.target.checked)}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      公開協作清單（推薦用於快速多人測試）
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                      開啟後所有登入本系統的成員皆可直接查看並協作；關閉則僅限受邀 Email 或輸入邀請碼加入。
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNewListModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  建立清單
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Share & Manage Collaborators */}
      {showShareModal && activeList && (
        <div className="modal-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">多人協作與分享設定</h3>
              <button className="btn-icon" onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Invite via Code / Link */}
            <div
              style={{
                background: "var(--primary-light)",
                padding: 16,
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600 }}>
                    專屬 6 碼邀請碼
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--primary)" }}>
                    {activeList.inviteCode || "無"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(activeList.inviteCode || "");
                      showMessage(`已複製邀請碼：${activeList.inviteCode}`);
                    }}
                  >
                    <Copy size={15} /> 複製邀請碼
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?join=${activeList.inviteCode}`;
                      navigator.clipboard.writeText(url);
                      showMessage("已複製邀請連結！");
                    }}
                  >
                    <Share2 size={15} /> 複製邀請連結
                  </button>
                </div>
              </div>
            </div>

            {/* Invite by Google Email */}
            <form onSubmit={handleInviteByEmail} className="form-group">
              <label className="form-label">透過 Google Email 邀請協作夥伴</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  className="composer-input"
                  placeholder="輸入夥伴的 Gmail / Google 帳號信箱..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={inviting}>
                  <UserPlus size={16} />
                  <span>{inviting ? "邀請中..." : "新增"}</span>
                </button>
              </div>
            </form>

            {/* Access Mode Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-sm)"
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {activeList.isPublic ? "🌐 公開協作模式" : "🔒 專屬受邀模式"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {activeList.isPublic
                    ? "任何已登入的使用者皆可看到並參與此清單"
                    : "僅限受邀信箱或輸入邀請碼的成員可存取"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleToggleListPublic}
              >
                切換為{activeList.isPublic ? "專屬" : "公開"}
              </button>
            </div>

            {/* Active Members & Invited Emails List */}
            <div className="form-group">
              <label className="form-label">目前已加入的協作成員 ({listMembers.length})</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {listMembers.map((m) => (
                  <div
                    key={m.uid}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--bg-subtle)",
                      borderRadius: "var(--radius-sm)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {m.photoURL ? (
                        <img
                          src={m.photoURL}
                          alt={m.displayName}
                          className="avatar avatar-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="avatar avatar-sm">
                          {(m.displayName || m.email || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                          {m.displayName}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                          {m.email}
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-public">
                      {m.uid === activeList.ownerId ? "建立者" : "協作者"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {Array.isArray(activeList.invitedEmails) && activeList.invitedEmails.length > 0 && (
              <div className="form-group">
                <label className="form-label">受邀信箱名單</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {activeList.invitedEmails.map((em) => (
                    <span
                      key={em}
                      className="member-chip"
                      style={{ paddingLeft: 10 }}
                    >
                      <span>{em}</span>
                      {em !== activeList.ownerEmail && (
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ padding: 2 }}
                          onClick={() => handleRemoveInvitedEmail(em)}
                          title="移除邀請"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
