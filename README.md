# Memorial Mason Management App

This is a **Vite + React Router + Supabase** web application for managing memorial mason operations, including orders, messages, and related workflows.

This README explains **how to run the project locally on a Windows computer**, using **Cursor** as the code editor.

---

## 🧰 Prerequisites (one-time setup)

Before running the project, make sure the following are installed on your computer:

### 1. Git

Used to clone the repository.

👉 Download: [https://git-scm.com/download/win](https://git-scm.com/download/win)
After installation, restart your computer.

Verify:

```bash
git --version
```

---

### 2. Node.js (LTS recommended)

This project runs on Node.js.

👉 Download **LTS version** (recommended):
[https://nodejs.org/en](https://nodejs.org/en)

After installation, restart your computer.

Verify:

```bash
node -v
npm -v
```

> If the project later specifies a required Node version, we can lock it with `.nvmrc`.

---

### 3. Cursor (Code Editor)

Cursor is used to open and run the project.

👉 Download: [https://cursor.sh](https://cursor.sh)
Install and sign in.

---

## 📥 Project Setup

### 1. Clone the repository

Open **Git Bash** or **PowerShell**, then run:

```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_FOLDER>
```

Replace `<REPOSITORY_URL>` with the GitHub repo URL.

---

### 2. Open the project in Cursor

From the project root folder:

```bash
cursor .
```

Or:

* Open Cursor
* Click **File → Open Folder**
* Select the project folder

---

## ⚙️ Environment Variables (Required)

The app uses **Supabase** and requires environment variables.

### 1. Create `.env.local`

In the **project root**, create a file named:

```
.env.local
```

You can copy from the example file:

```bash
copy .env.example .env.local
```

(or manually create it)

---

### 2. Fill in Supabase credentials

Open `.env.local` and set the values you were provided:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

⚠️ These values come from the **existing Supabase project** already set up.

> Do **not** commit `.env.local` to GitHub.

---

## 📦 Install Dependencies

In Cursor, open the **terminal** (View → Terminal), then run:

```bash
npm install
```

This may take a few minutes the first time.

---

## ▶️ Run the App (Development Mode)

Start the development server:

```bash
npm run dev
```

You should see output similar to:

```text
Local: http://localhost:5173
```

Open your browser and go to:

👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🧭 Project Structure (High Level)

```
src/
 ├── app/        # App shell (providers, layouts, router wiring)
 ├── pages/      # Legacy/singleton pages used by React Router
 ├── modules/    # Feature modules (orders, inbox, etc.)
 ├── shared/     # Shared UI components and utilities
 └── lib/        # Supabase client and helpers
```

> This project keeps both `src/app/` and `src/pages/` as architectural layers inside a React Router application.

---

## 🗄️ Backend (Supabase)

* The app connects to an **existing Supabase project**
* Database tables and data already exist
* No local database setup is required

If the app fails to load data:

* Check `.env.local`
* Verify Supabase project is active
* Ensure the provided keys are correct

---

## 🔐 Authentication

* Authentication behavior depends on the current app state
* If login is required, use the credentials provided separately
* If auth is not enforced yet, pages should load directly

(We can document this more once auth flow is finalized.)

---

## 🛠 Common Issues & Fixes

### Port already in use

If `5173` is busy:

```bash
npm run dev -- -p 3001
```

Then open:

```
http://localhost:3001
```

---

### Environment variables not loading

* Ensure the file is named **`.env.local`**
* Restart the dev server after changes
* Do not use `.env` or `.env.production` for local dev

---

### Build errors

If needed, test a production build:

```bash
npm run build
npm run preview
```

---

## ✅ How to Verify Everything Works

1. App loads in browser
2. No red errors in terminal
3. Pages render normally
4. Orders and Inbox show data from Supabase

---

## 🧑‍💻 Recommended Workflow in Cursor

* Use **Terminal** inside Cursor for all commands
* Open files via sidebar
* Use Git panel to review changes
* Pull latest changes before starting work

---

## 📌 Notes

* This project is under active development
* Some buttons and features may be read-only placeholders
* Further setup (roles, notifications, inbox actions) will be added incrementally

---

## 📞 Support

If you run into any issues:

* Check terminal output
* Verify `.env.local`
* Contact the developer for assistance

---
