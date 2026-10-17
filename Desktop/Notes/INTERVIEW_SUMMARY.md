# Notes App — Interview Summary Diagrams

---

## 1. System Architecture (High Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    React 19 Frontend                     │   │
│  │                                                          │   │
│  │  ┌─────────┐  ┌──────────────┐  ┌──────────────────┐    │   │
│  │  │  Notes   │  │   Pomodoro   │  │    Statistics     │    │   │
│  │  │  CRUD    │  │    Timer     │  │    Dashboard      │    │   │
│  │  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘    │   │
│  │       │               │                    │              │   │
│  │  ┌────┴───────────────┴────────────────────┴─────────┐    │   │
│  │  │              Custom React Hooks                    │    │   │
│  │  │  use-user-notes  use-pomodoro-stats  use-debounce │    │   │
│  │  └──────────────────────┬────────────────────────────┘    │   │
│  │                         │                                 │   │
│  │  ┌──────────────────────┴────────────────────────────┐    │   │
│  │  │           API Client (fetch wrapper)              │    │   │
│  │  │              api.ts + JWT Auth headers             │    │   │
│  │  └──────────────────────┬────────────────────────────┘    │   │
│  └─────────────────────────┼─────────────────────────────────┘   │
│                            │ HTTP/REST                           │
│                            │ (Bearer JWT)                        │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Express.js)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Middleware: CORS → JSON Parser → Auth JWT Verify        │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────┐  ┌───────────┴──────────┐  ┌────────────────┐    │
│  │   Auth   │  │      REST API        │  │  Admin Panel   │    │
│  │ Endpoints│  │  Notes + Pomodoros   │  │   Endpoints    │    │
│  └──────────┘  └───────────┬──────────┘  └────────────────┘    │
│                            │                                    │
│  ┌─────────────────────────┴────────────────────────────────┐   │
│  │              Neon PostgreSQL (Serverless)                 │   │
│  │         users  │  notes  │  pomodoros                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

```
┌──────────────────────────────┐
│           users              │
├──────────────────────────────┤
│ id          SERIAL PK        │
│ name        TEXT UNIQUE      │
│ passcode    TEXT UNIQUE      │
│ is_admin    BOOLEAN          │
│ created_at  TIMESTAMPTZ      │
└──────────┬───────────────────┘
           │ 1
           │
           │ *          *                *
┌──────────┴───────────┐  ┌──────────────────────────┐
│        notes         │  │        pomodoros          │
├──────────────────────┤  ├──────────────────────────┤
│ id       SERIAL PK   │  │ id         SERIAL PK      │
│ user_id  FK → users  │  │ user_id    FK → users     │
│ text     TEXT         │  │ ts         BIGINT         │
│ color    TEXT         │  │ duration   INTEGER        │
│ priority TEXT         │  │ phase      TEXT            │
│ due_date TEXT         │  │ note_id    FK → notes (opt)│
│ pinned   INTEGER(0/1)│  │ created_at TIMESTAMPTZ     │
│ created_at TIMESTAMPTZ│  └──────────────────────────┘
│ updated_at TIMESTAMPTZ│
└──────────────────────┘

ERD:
  users  1 ──── * notes
  users  1 ──── * pomodoros
  notes  1 ──── * pomodoros  (optional link)
```

---

## 3. Authentication Flow

```
  Login Flow                    Register Flow
  ──────────                    ─────────────
  
  User enters                   User enters
  name + passcode               name only
       │                             │
       ▼                             ▼
  POST /api/auth/login        POST /api/auth/register
       │                             │
       ▼                             ▼
  ┌──────────────┐            ┌───────────────────┐
  │ Query users  │            │ Auto-generate      │
  │ table for    │            │ 8-char passcode    │
  │ match        │            │ (a-z, 0-9)         │
  └──────┬───────┘            └────────┬──────────┘
         │                             │
    ┌────┴────┐                   ┌────┴────┐
    │ Match?  │                   │ Insert  │
    │  YES/NO │                   │ into DB │
    └────┬────┘                   └────┬────┘
         │                             │
         ▼                             ▼
    ┌──────────────────────────────────────┐
    │        Sign JWT Token                │
    │  payload: { userId: id }             │
    │  expiry:  30 days                    │
    └──────────────────┬───────────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────┐
    │  Return: { token, user: { id, name } }│
    │  Store token in localStorage          │
    └──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │  Subsequent API Requests  │
         │  Header:                  │
         │  Authorization: Bearer <token>│
         │           │               │
         │           ▼               │
         │  ┌────────────────┐       │
         │  │ JWT Verify     │       │
         │  │ Extract userId │       │
         │  └────────────────┘       │
         └───────────────────────────┘
```

---

## 4. React Component Tree

```
<App>
  │
  ├── <AuthProvider>              ← Context: token, user, login/register/logout
  │     │
  │     ├── [Not Authenticated]
  │     │     └── <LoginPage>     ← Passcode login/register + offline mode
  │     │
  │     └── [Authenticated]
  │           │
  │           ├── <AppHeader>     ← Theme toggle, user menu, stats summary
  │           │
  │           ├── <NotesGrid>     ← CRUD: create/edit/delete/pin/search notes
  │           │     │
  │           │     ├── <NoteCard /> (per note)
  │           │     │     ├── Priority badge
  │           │     │     ├── Due date / urgency badge
  │           │     │     └── Pin toggle
  │           │     │
  │           │     └── Search bar with debounce
  │           │
  │           ├── <PomodoroTimer> ← Auto-cycling focus/break timer
  │           │     │
  │           │     ├── Duration selector (25/60/90 min)
  │           │     ├── <TimeSpinner /> (custom time input)
  │           │     ├── <NoteSelect /> (link timer to a note)
  │           │     └── Sound + browser notifications
  │           │
  │           └── <PomodoroStats> ← Statistics dashboard
  │                 │
  │                 ├── Today / Week / Month summaries
  │                 ├── Bar chart (last 7 days)
  │                 ├── Streaks (current + longest)
  │                 ├── Completion rate
  │                 ├── Per-note breakdown
  │                 └── <DailyGoal /> (progress bar: 2/4/6/8 hrs)
  │
  └── <AppLoadingScreen />         ← Suspense fallback
```

---

## 5. Data Flow — Notes CRUD

```
┌──────────┐    ┌────────────┐    ┌──────────┐    ┌────────────┐
│  User    │───▶│  React     │───▶│  api.ts  │───▶│  Express   │
│  Action  │    │  State     │    │  fetch   │    │  Server    │
└──────────┘    └─────┬──────┘    └──────────┘    └─────┬──────┘
                      │                                 │
       ┌──────────────┼─────────────────────────────────┤
       │              │                                 │
       ▼              ▼                                 ▼
  ┌─────────┐   ┌───────────┐                    ┌──────────┐
  │  User   │   │  Hook:    │                    │ PostgreSQL│
  │  sees   │   │  useUser  │                    │  notes   │
  │  update │◀──│  Notes    │◀───────────────────│  table   │
  └─────────┘   └───────────┘    GET /api/notes  └──────────┘
                      ▲
                      │
  ┌──────────┐   ┌────┴─────┐    ┌────────────┐
  │ Offline  │──▶│ localStorage│◀▶│  Fallback  │
  │ Mode     │   │  (no API) │   │  (no backend)│
  └──────────┘   └──────────┘    └────────────┘

  CRUD Operations:
  ────────────────
  Create:  POST   /api/notes     → INSERT INTO notes
  Read:    GET    /api/notes     → SELECT * FROM notes WHERE user_id=?
  Update:  PUT    /api/notes/:id → UPDATE notes SET ... WHERE id=? AND user_id=?
  Delete:  DELETE /api/notes/:id → DELETE FROM notes WHERE id=? AND user_id=?
```

---

## 6. Pomodoro Timer State Machine

```
                    ┌──────────────────┐
         ┌────────▶│   IDLE (Ready)   │◀────────┐
         │         └────────┬─────────┘         │
         │                  │ Start             │
         │                  ▼                   │
         │         ┌──────────────────┐         │
         │         │   FOCUSING       │         │
         │         │  (25/60/90 min)  │         │
         │         └────────┬─────────┘         │
         │                  │ Timer done        │
         │                  ▼                   │
         │         ┌──────────────────┐         │
         │         │  SHORT BREAK     │         │
         │    ┌───▶│  (5/10/15 min)   │────┐    │
         │    │    └────────┬─────────┘    │    │
         │    │             │              │    │
         │    │    4th cycle│              │    │
         │    │             ▼              │    │
         │    │    ┌──────────────────┐    │    │
         │    │    │  LONG BREAK      │    │    │
         │    │    │  (30 min)        │    │    │
         │    │    └────────┬─────────┘    │    │
         │    │             │              │    │
         │    └─────────────┴──────────────┘    │
         │              Auto-cycle              │
         │                                      │
         └───────────── Stop ──────────────────┘

  On session end:
  ┌─────────────────────────────────────────┐
  │  1. Save session to DB (phase + duration)│
  │  2. Update statistics in real-time       │
  │  3. Play sound + browser notification    │
  │  4. Persist timer state (page reload OK) │
  └─────────────────────────────────────────┘
```

---

## 7. Deployment Architecture

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                      DEVELOPMENT                                │
  │                                                                 │
  │  localhost:5173 (Vite dev)  ────▶  localhost:3001 (Express)     │
  │         │                                    │                   │
  │         │ hot reload                         │                   │
  │         ▼                                    ▼                   │
  │  React + TypeScript                    Express + PostgreSQL      │
  └─────────────────────────────────────────────────────────────────┘

                         │ npm run build
                         ▼

  ┌─────────────────────────────────────────────────────────────────┐
  │                      PRODUCTION                                 │
  │                                                                 │
  │  ┌──────────────────────┐      ┌────────────────────────────┐   │
  │  │    GitHub Pages       │      │       Render               │   │
  │  │    (Frontend)         │      │       (Backend)            │   │
  │  │                       │      │                            │   │
  │  │  Built static files:  │      │  Express.js server         │   │
  │  │  • index.html         │      │  • REST API                │   │
  │  │  • JS bundles         │      │  • JWT Auth                │   │
  │  │  • CSS                │      │  • CORS enabled            │   │
  │  │  • favicon.svg        │      │                            │   │
  │  │                       │      │  Auto-deploy from main     │   │
  │  │  eghesmati.github.io  │      │  branch via Render         │   │
  │  │  /Notes               │      │                            │   │
  │  └──────────┬────────────┘      └─────────────┬──────────────┘   │
  │             │                                  │                  │
  │             │         REST API calls           │                  │
  │             └──────────────────────────────────┘                  │
  │                              │                                   │
  │                              ▼                                   │
  │               ┌────────────────────────────┐                     │
  │               │    Neon PostgreSQL          │                     │
  │               │    (Serverless Database)    │                     │
  │               │                            │                     │
  │               │  Tables: users, notes,     │                     │
  │               │          pomodoros          │                     │
  │               └────────────────────────────┘                     │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 8. Tech Stack Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        TECH STACK                                │
├──────────────┬──────────────────────────────────────────────────┤
│   Layer      │   Technology                                     │
├──────────────┼──────────────────────────────────────────────────┤
│   UI         │   React 19 + TypeScript 6 + Vite 8              │
│   Styling    │   Tailwind CSS 4 + shadcn/ui + Glassmorphism    │
│   Icons      │   Lucide React                                   │
│   State      │   Custom React Hooks + localStorage             │
│   Auth       │   JWT (30-day tokens) + passcode-based          │
│   Backend    │   Express.js 4 + TypeScript                     │
│   Database   │   Neon PostgreSQL (serverless)                   │
│   Hosting    │   GitHub Pages (FE) + Render (BE)               │
│   Deploy     │   gh-pages npm + Git auto-deploy                 │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## 9. Key Features Cheat Sheet (For Interview)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FEATURES AT A GLANCE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NOTES                                                          │
│  ├── CRUD (Create, Read, Update, Delete) with inline editing    │
│  ├── Priority badges (Low / Medium / High)                      │
│  ├── Due dates with urgency display (Today / Tomorrow / Overdue)│
│  ├── Pin notes (pinned notes sort to top)                       │
│  ├── Real-time search with debounce                             │
│  └── Color-coded left border (12 colors)                        │
│                                                                  │
│  POMODORO TIMER                                                  │
│  ├── Auto-cycling focus → short break → long break              │
│  ├── Configurable durations (25/60/90 min focus)                │
│  ├── Link timer to specific notes (track time per note)         │
│  ├── Sound effects + browser notifications                      │
│  └── Persists state on page reload                              │
│                                                                  │
│  STATISTICS                                                      │
│  ├── Today / This Week / This Month summaries                   │
│  ├── Last 7 Days bar chart                                      │
│  ├── Streak tracking (current + longest)                        │
│  ├── Completion rate (finished vs abandoned)                    │
│  ├── Per-note time breakdown                                    │
│  └── Daily focus goal (2/4/6/8 hours)                           │
│                                                                  │
│  AUTH & OFFLINE                                                  │
│  ├── Passcode-based login (no email required)                   │
│  ├── Per-user data isolation                                    │
│  ├── Admin panel (view users, manage accounts)                  │
│  └── Full offline fallback via localStorage                     │
│                                                                  │
│  DESIGN                                                          │
│  ├── Dark + Light theme                                         │
│  ├── Responsive grid layout                                     │
│  ├── Glassmorphism UI                                           │
│  └── Lazy-loaded components (code splitting)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Interview Talking Points

```
1. ARCHITECTURE DECISIONS
   • Why React 19? → Latest concurrent features, better performance
   • Why custom hooks? → Clean separation of concerns, reusable logic
   • Why localStorage fallback? → Graceful degradation, offline-first

2. CHALLENGES SOLVED
   • GitHub Pages SPA routing → 404.html redirect trick
   • Nested .git repo → deployment debugging (see agents.md)
   • Serverless DB → Neon PostgreSQL for zero-config scaling
   • Timer persistence → localStorage sync across page reloads

3. TECHNICAL HIGHLIGHTS
   • Debounced search for performance
   • JWT auth with 30-day expiry for UX
   • Lazy-loaded components for code splitting
   • Glassmorphism design with Tailwind CSS
   • Per-user data isolation for security

4. IMPACT
   • Full-stack project: frontend + backend + database + deployment
   • Real-world features: auth, stats, timer, search
   • Production deployed on GitHub Pages + Render
```
