# 📋 MyToDoList — 多人即時協作待辦清單

基於 **React 19 + Vite + Firebase (Authentication & Cloud Firestore)** 打造的現代化多人即時協作待辦清單網頁應用程式。支援 Google 帳號一鍵登入、多清單管理、6 碼邀請碼快速加入、Email 協作邀請以及即時任務狀態同步。

---

## ✨ 功能特色

- **🔐 Google 帳號安全登入**
  - 整合 Firebase Authentication (`GoogleAuthProvider`)，一鍵登入並自動同步使用者頭像與顯示名稱。
- **🤝 多人即時協作清單**
  - **專屬 6 碼邀請碼 & 分享連結**：每個清單自動產生專屬邀請碼（例如 `A7K9X2`），夥伴可輸入邀請碼或點擊 `?join=CODE` 連結立即加入協作。
  - **Email 邀請機制**：可直接輸入協作夥伴的 Google 信箱加入清單授權名單。
  - **公開 / 專屬模式切換**：支援切換「公開協作模式」（所有登入成員皆可共同編輯）或「專屬受邀模式」（僅限受邀成員存取）。
- **⚡ 即時同步任務管理 (`onSnapshot`)**
  - 支援設定任務**標題**、**補充備註**、**優先順序**（高 / 中 / 低）、**分類標籤**（工作、開發、設計、採購、生活等）、**到期日**與**指派對象**。
  - 自動記錄任務建立者與完成者姓名，並提供即時完成度進度條。
  - 支援依狀態（全部 / 進行中 / 已完成 / 指派給我）、優先順序與關鍵字即時篩選。
- **🛡️ 嚴謹的 Firestore 安全規則 (`firestore.rules`)**
  - 針對 `/users/{userId}`、`/lists/{listId}` 與 `/lists/{listId}/tasks/{taskId}` 實作完整的型別檢查、欄位長度限制與協作者權限驗證。

---

## 🛠️ 技術架構

| 類別 | 技術 / 服務 |
| :--- | :--- |
| **前端框架** | React 19 + Vite 6 |
| **圖示庫** | Lucide React (`lucide-react`) |
| **身分驗證** | Firebase Authentication (Google Sign-In) |
| **即時資料庫** | Cloud Firestore (Modular Web SDK v11) |
| **安全控管** | Firestore Security Rules (`firestore.rules`) |

---

## 🚀 本地開發與執行

### 1. 安裝相依套件

```bash
npm install
```

### 2. 啟動本地開發伺服器

```bash
npm run dev
```

啟動後於瀏覽器開啟 `http://localhost:5173/` 即可使用。

### 3. 建置正式版套件

```bash
npm run build
```

---

## 🔥 Firebase 部署指令

若需更新 Firestore 安全規則、索引或驗證設定，可執行：

```bash
# 部署 Firestore 安全規則與索引
npx -y firebase-tools@latest deploy --only firestore

# 部署 Firebase Authentication 設定
npx -y firebase-tools@latest deploy --only auth

# 部署前端靜態網站至 Firebase Hosting
npm run build
npx -y firebase-tools@latest deploy --only hosting
```

---

## 📂 專案目錄結構

```text
MyToDoList/
├── index.html               # 應用程式入口 HTML
├── package.json             # 專案設定與相依套件
├── vite.config.js           # Vite 開發與建置設定
├── firebase.json            # Firebase CLI 設定（Firestore / Hosting / Auth）
├── .firebaserc              # Firebase 預設專案綁定設定
├── firestore.rules          # Cloud Firestore 安全規則
├── firestore.indexes.json   # Cloud Firestore 複合索引設定
└── src/
    ├── main.jsx             # React 應用掛載點
    ├── App.jsx              # 主應用元件（Google 登入、多人清單、即時任務）
    ├── index.css            # 全域樣式與響應式排版設計
    └── firebase.js          # Firebase App / Auth / Firestore 初始化設定
```
