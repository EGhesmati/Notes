# Agents.md — Project Setup, Deployment & Troubleshooting

> Auto-generated: 2026-08-06  
> Project: **Notes App** — React 19 + TypeScript + Vite + shadcn/ui  
> Repo: `EGhesmati/Notes` | Live: [eghesmati.github.io/Notes](https://EGhesmati.github.io/Notes)

---

## 1. Project Structure

```
Desktop/Notes/                  # Git repo root (main branch)
├── README.md                   # Repo-level readme
├── package-lock.json
├── agents.md                   # This file
├── react-notes-app/            # React frontend (Vite + React 19)
│   ├── index.html              # Vite entry HTML template
│   ├── package.json            # Frontend deps + deploy script
│   ├── vite.config.ts          # Vite config (base: '/Notes/')
│   ├── tsconfig.json           # TS project references
│   ├── tsconfig.app.json       # App TS config (strict, paths)
│   ├── tsconfig.node.json      # Node TS config (Vite)
│   ├── public/                 # Static assets
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   ├── 404.html            # SPA fallback for GitHub Pages
│   │   └── .nojekyll           # Disable Jekyll processing
│   ├── src/
│   │   ├── main.tsx            # App entry, wraps with AuthProvider
│   │   ├── App.tsx             # Main app component
│   │   ├── index.css           # Tailwind + shadcn + theme vars
│   │   ├── types.ts            # NoteItem, Priority, etc.
│   │   ├── components/         # UI components
│   │   │   ├── ui/             # shadcn/base-ui primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   └── badge.tsx
│   │   │   ├── NotesGrid.tsx
│   │   │   ├── PomodoroTimer.tsx
│   │   │   ├── PomodoroStats.tsx
│   │   │   ├── DailyGoal.tsx
│   │   │   ├── TimeChips.tsx
│   │   │   ├── TimeSpinner.tsx
│   │   │   ├── NoteSelect.tsx
│   │   │   └── AppLoadingScreen.tsx
│   │   ├── hooks/
│   │   │   ├── use-theme.ts
│   │   │   ├── use-debounce.ts
│   │   │   ├── use-local-storage.ts
│   │   │   ├── use-user-notes.ts
│   │   │   └── use-pomodoro-stats.ts
│   │   ├── lib/
│   │   │   ├── api.ts          # REST API client (notes, sessions)
│   │   │   ├── auth-context.tsx # Auth provider + context
│   │   │   └── utils.ts        # cn() utility
│   │   └── pages/
│   │       └── LoginPage.tsx
│   ├── server/                 # (backend related, not deployed to Pages)
│   └── dist/                   # Build output (gitignored, deployed to gh-pages)
└── .git/                       # Main repo git data
```

---

## 2. Deployment Architecture

### How It Works

```
  [main branch]                    [gh-pages branch]
  source code                      built static files
       │                                  ▲
       │ npm run build                    │ gh-pages -d dist
       ▼                                  │
  react-notes-app/dist/  ─────────────────┘
  (index.html, assets/, favicon.svg, ...)
```

- **Build**: `npm run build` → runs `tsc -b && vite build` → outputs to `react-notes-app/dist/`
- **Deploy**: `npx gh-pages -d react-notes-app/dist` (from repo root) pushes `dist/` **contents** to the root of the `gh-pages` branch
- **Serve**: GitHub Pages serves the `gh-pages` branch at `https://EGhesmati.github.io/Notes/`

### Vite Base Path

`vite.config.ts` has `base: '/Notes/'` so all built asset paths are prefixed:
- `/Notes/assets/index-XXX.js`
- `/Notes/assets/index-XXX.css`
- `/Notes/favicon.svg`

This is correct because the site is served from a **project page** (`username.github.io/Notes/`), not a user page.

### Public Files (copied to dist/)

| File | Purpose |
|------|---------|
| `favicon.svg` | App icon |
| `icons.svg` | SVG sprite |
| `404.html` | SPA redirect for client-side routing on GitHub Pages |
| `.nojekyll` | Tells GitHub Pages to skip Jekyll processing |

---

## 3. Known Issues & Fixes

### Issue 1: Deployment Stuck in `deployment_queued`

**Symptoms**:
```
Getting Pages deployment status...
Current status: deployment_queued
... (repeats for ~2 minutes)
Error: Timeout reached, aborting!
```

**Root Cause**: The `gh-pages` branch contains **source code instead of built output**. GitHub Pages can't build a Vite/React app from raw source — it needs the compiled static files (`index.html`, JS bundles, CSS).

This happened because a nested `.git` repo existed inside `react-notes-app/` (now deleted). The `gh-pages` npm package found the wrong git context and pushed source code instead of built output.

**How it was fixed**:
1. Deleted the nested `.git` directory inside `react-notes-app/` (it was a broken artifact with no remote, on `gh-pages` branch, single commit "Deploy v2")
2. The `gh-pages` tool now correctly finds the outer repo's `.git` and pushes to `EGhesmati/Notes`

### Issue 2: Favicon Not Loading

**Symptoms**: Console 404 for `/favicon.svg`

**Root Cause**: `index.html` had `<link href="/favicon.svg?v=2">` (absolute path). On a project page, this resolves to `username.github.io/favicon.svg` instead of `username.github.io/Notes/favicon.svg`.

**Fix**: Changed to `href="favicon.svg?v=2"` (relative path). Vite transforms this to `/Notes/favicon.svg?v=2` during build because of `base: '/Notes/'`.

### Issue 3: Nested .git Repository

**Symptoms**: `gh-pages` deploy fails or pushes wrong content

**Root Cause**: `react-notes-app/.git` was a separate git repo (on `gh-pages` branch, no remote). This was a corrupted artifact from a failed `gh-pages` deployment run.

**Fix**: Deleted `react-notes-app/.git` entirely.

### Issue 4: `gh-pages` Cache Stuck / "nothing to commit"

**Symptoms**: Deploy says "nothing to commit, working tree clean" but remote gh-pages branch is wrong, or `find-cache-dir` returns `undefined`.

**Root Cause**: `gh-pages` caches a clone in `node_modules/.cache/gh-pages/`. If this cache is stale or corrupted, the deploy won't push new changes. Running from repo root also fails because `find-cache-dir` can't find `node_modules/`.

**Fix**:
1. Always run deploy **from inside `react-notes-app/`** (not repo root)
2. If stuck, run `./node_modules/.bin/gh-pages-clean` to clear the cache, then redeploy

---

## 4. How to Deploy

### Prerequisites
- Node.js 18+ installed
- Git configured with push access to `EGhesmati/Notes`
- All changes committed on `main` branch

### Standard Deploy

```bash
# From repo root, go into the frontend directory
cd Desktop/Notes/react-notes-app

# Build
npm run build              # runs tsc -b && vite build

# Deploy (must run FROM react-notes-app/, not repo root)
npm run deploy              # runs gh-pages -d dist

# Or manually:
./node_modules/.bin/gh-pages -d dist
```

> **⚠️ Important**: The deploy command MUST be run from inside `react-notes-app/` (where `node_modules/` is), NOT from the repo root. The `find-cache-dir` package in `gh-pages` needs to find `node_modules/` in the current working tree.

### If Deploy Gets Stuck / Cache Issues

```bash
cd Desktop/Notes/react-notes-app

# Clean the gh-pages cache
./node_modules/.bin/gh-pages-clean

# Rebuild and redeploy
npm run build
./node_modules/.bin/gh-pages -d dist
```

### Verify

Visit: [https://EGhesmati.github.io/Notes](https://EGhesmati.github.io/Notes) — deployment usually completes in 30-60 seconds.

---

## 5. Development

```bash
cd Desktop/Notes/react-notes-app
npm install
npm run dev        # starts Vite dev server at http://localhost:5173
```

The dev server uses Vite's proxy/hot reload. Auth requires the backend at `http://localhost:3001` (configured via `VITE_API_URL` env var in `src/lib/api.ts` and `src/lib/auth-context.tsx`).

### Offline Mode
The app has an offline fallback. Click "Continue offline (localStorage)" on the login page to use the app without a backend. Notes are stored in localStorage.

### Key Configuration

| File | What it does |
|------|-------------|
| `vite.config.ts` | `base: '/Notes/'` for GitHub Pages, path alias `@/` → `src/` |
| `tsconfig.json` | Project references to `tsconfig.app.json` + `tsconfig.node.json` |
| `tsconfig.app.json` | Strict TS, bundler mode, `@/*` paths |
| `package.json` | `homepage: "https://EGhesmati.github.io/Notes"` for gh-pages |

---

## 6. Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | ^19.2.8 | UI framework |
| TypeScript | ~6.0.2 | Type safety |
| Vite | ^8.2.0 | Build tool |
| Tailwind CSS | ^4.3.3 | Utility CSS |
| shadcn/ui | ^4.16.1 | Component primitives |
| @base-ui/react | ^1.6.0 | Headless UI components |
| lucide-react | ^1.28.0 | Icons |
| gh-pages | ^6.3.0 | Deploy to GitHub Pages |

---

## 7. Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `tsc -b` fails | TypeScript errors in source | Run `npx tsc --noEmit` to check types |
| `vite build` fails | Missing imports or broken config | Check `vite.config.ts` and import paths |
| Pages 404 for assets | Wrong `base` in vite config | Verify `base: '/Notes/'` in `vite.config.ts` |
| Auth errors in console | Backend not running | Use offline mode or start backend at `:3001` |
| `gh-pages` timeout | Bad gh-pages branch content | Re-deploy with correct `dist/` contents |
| Nested `.git` reappears | `gh-pages` cache corruption | Delete `node_modules/.cache/gh-pages/` |
