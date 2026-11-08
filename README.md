# 📋 MyToDoList — 多人即時協作待辦清單（純原生 JavaScript 版）

基於 **純原生 JavaScript (Vanilla ES6+ Modules) + HTML5 + CSS3 + Firebase (Authentication & Cloud Firestore)** 打造的現代化多人即時協作待辦清單網頁應用程式。無需任何前端框架或複雜打包工具即可直接於瀏覽器執行，並透過 **GitHub Pages** 提供線上服務。

- **🌐 線上正式網址（GitHub Pages）**：https://gohubert.github.io/MyToDoList/

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
| **前端實作** | 原生 HTML5 + CSS3 + Vanilla JavaScript (ES6+ Modules) |
| **身分驗證** | Firebase Authentication (Google Sign-In) |
| **即時資料庫** | Cloud Firestore (Modular Web SDK v11 CDN) |
| **安全控管** | Firestore Security Rules (`firestore.rules`) |
| **網站部署** | GitHub Pages |

---

## 🚀 本地開發與執行

由於採用純原生 ES Modules，只需透過任意靜態伺服器啟動即可：

```bash
python3 -m http.server 5173
```

啟動後於瀏覽器開啟 `http://localhost:5173/` 即可使用。

---

## 📂 專案目錄結構

```text
MyToDoList/
├── index.html               # 應用程式主頁面 HTML5 結構
├── style.css                # 響應式介面與元件樣式表
├── app.js                   # 原生 JavaScript DOM 與即時協作主邏輯
├── firebase.js              # Firebase App / Auth / Firestore ES Module 初始化
├── firebase.json            # Firebase CLI 設定（Firestore / Auth）
├── .firebaserc              # Firebase 預設專案綁定設定
├── firestore.rules          # Cloud Firestore 安全規則
└── firestore.indexes.json   # Cloud Firestore 複合索引設定
```
