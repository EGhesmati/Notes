# Notes

A full-stack note tracking platform with a Pomodoro timer, statistics dashboard, and user authentication — built with React 19, TypeScript, and Express.

> **Live:** [eghesmati.github.io/Notes](https://EGhesmati.github.io/Notes)

![React](https://img.shields.io/badge/react-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/vite-8-646CFF?logo=vite)
![Tailwind](https://img.shields.io/badge/tailwind-4-06B6D4?logo=tailwindcss)
![Express](https://img.shields.io/badge/express-4-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/database-neon%20postgresql-00E599?logo=postgresql)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-black?logo=shadcnui)
![GitHub Pages](https://img.shields.io/badge/frontend-github%20pages-222222?logo=github)
![Render](https://img.shields.io/badge/backend-render-46E3B7?logo=render)

---

## Features

### Notes
- Create, edit, and delete notes with inline editing
- Priority badges — Low / Medium / High with color indicators
- Due dates — Date picker + custom time input
- Urgency display — Today, Tomorrow, Overdue Xd badges
- Pin notes — Pinned notes sort to top
- Search — Real-time filtering with match count

### Pomodoro Timer
- Auto-cycling focus / short break / long break sessions
- 25 / 60 / 90 min focus modes, 5 / 10 / 15 min short breaks
- 30 min long break every 4th cycle
- Link sessions to notes to track time per task
- Sound effects + browser notifications
- Persists state on page reload

### Statistics Dashboard
- Today / This Week / This Month summaries
- Last 7 Days bar chart
- Streaks — current + longest
- Completion rate — finished vs. abandoned sessions
- Per-note breakdown — focus time per linked note
- Daily focus goal — progress bar with targets (2 / 4 / 6 / 8 hrs)

### Auth & Backend
- Passcode-based login/register — no email required
- Per-user data isolation — each user has their own notes
- Admin panel — view users, change passcodes, delete accounts
- JWT authentication — 30-day tokens
- PostgreSQL — persistent cloud storage via Neon
- Full offline fallback — works without a backend via localStorage

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Styling | Tailwind CSS 4, shadcn/ui |
| Icons | Lucide React |
| Backend | Express.js 4, TypeScript |
| Database | Neon PostgreSQL (serverless) |
| Auth | JWT (jsonwebtoken) |
| Hosting | GitHub Pages (frontend) + Render (backend) |

---

## Getting Started

### Frontend

```bash
git clone https://github.com/EGhesmati/Notes.git
cd Notes/react-notes-app

npm install
npm run dev        # → http://localhost:5173
```

### Backend

```bash
cd server
npm install
npm run seed       # creates default admin user
npm run dev        # → http://localhost:3001
```

### Environment Variables

```env
# Frontend (.env.local)
VITE_API_URL=http://localhost:3001

# Backend (server env)
DATABASE_URL=postgres://...
JWT_SECRET=your-secret
ADMIN_TOKEN=admin-secret-token
ADMIN_NAME=admin
ADMIN_PASSCODE=changeme
```

---

## Project Structure

```
react-notes-app/
├── server/
│   ├── server.ts              # Express API (auth, notes, sessions, admin)
│   ├── seed.ts                # Database seeder
│   └── package.json
├── src/
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Main app with auth gate
│   ├── types.ts               # TypeScript types
│   ├── lib/
│   │   ├── api.ts             # API client (fetch wrapper)
│   │   └── auth-context.tsx   # Auth context provider
│   ├── hooks/
│   │   ├── use-user-notes.ts      # Notes CRUD (API + localStorage)
│   │   ├── use-pomodoro-stats.ts  # Pomodoro stats engine
│   │   ├── use-theme.ts           # Dark/light mode
│   │   ├── use-debounce.ts        # Search debouncing
│   │   └── use-local-storage.ts   # localStorage sync
│   ├── components/
│   │   ├── NotesGrid.tsx          # Note cards with edit/pin/delete/urgency
│   │   ├── PomodoroTimer.tsx      # Auto-cycling timer + note linking
│   │   ├── PomodoroStats.tsx      # Statistics dashboard
│   │   ├── DailyGoal.tsx          # Daily focus goal progress bar
│   │   ├── TimeChips.tsx          # Custom time input (HH:MM)
│   │   ├── AppLoadingScreen.tsx   # Loading state
│   │   └── ui/                    # shadcn components
│   └── pages/
│       └── LoginPage.tsx          # Passcode login/register
└── public/
    ├── favicon.svg
    └── 404.html                   # GitHub Pages SPA redirect
```

---

## Deployment

| Part | Platform | Command |
|------|----------|---------|
| Frontend | GitHub Pages | `npm run deploy` |
| Backend | Render | Auto-deploys from `main` branch |
| Database | Neon | Serverless PostgreSQL |

---

## License

MIT
