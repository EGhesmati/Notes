# 📝 Notes

A clean, modern note-taking app built with **React 19**, **shadcn/ui**, and **Tailwind CSS v4**. Create, search, and delete notes in a responsive glassmorphism grid with full dark/light theme support.

![React](https://img.shields.io/badge/react-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/vite-8-646CFF?logo=vite)
![Tailwind](https://img.shields.io/badge/tailwind-4-06B6D4?logo=tailwindcss)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-black?logo=shadcnui)
![Lucide](https://img.shields.io/badge/icons-lucide-F56565?logo=lucide)
![localStorage](https://img.shields.io/badge/storage-localStorage-FFA116?logo=html5)
![Lazy Load](https://img.shields.io/badge/code%20split-lazy%20load-7C3AED)
![GitHub Pages](https://img.shields.io/badge/deployed-github%20pages-222222?logo=github)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features in detail

### Core
| Feature | Details |
|---------|---------|
| **Add notes** | Type and click *Add* or press **Enter**. Empty / whitespace-only notes are rejected. |
| **Delete notes** | Hover over any note to reveal the trash icon. Delete button uses a functional state update to avoid stale closures under rapid clicks. |
| **Search** | Filters notes in real-time as you type. Case-insensitive. A match-count badge appears while searching. |
| **Character counter** | Live character count below the input, updated on every keystroke. |
| **Empty states** | Shows contextual messages: *"No notes yet."* vs *"No matching notes."* when searching. |

### UI
| Feature | Details |
|---------|---------|
| **Dark / light mode** | Toggle via the sun/moon icon in the top-right. Preference persists in `localStorage` and falls back to the system `prefers-color-scheme` media query. |
| **Glassmorphism** | All inputs and note cards use `backdrop-blur-xl` over semi-transparent backgrounds, giving the frosted-glass effect. |
| **Responsive grid** | 1 column on mobile, 2 on tablet (`sm:`), 3 on desktop (`lg:`). Cards stretch to equal height within each row. |
| **Theme-aware colors** | Every component uses shadcn CSS variables (`--background`, `--card`, `--border`, `--primary`, etc.) so the palette switches seamlessly between light and dark. |

### Dev
| Feature | Details |
|---------|---------|
| **State safety** | Both `addNote` and `deleteNote` use React functional state updates (`setNotes(prev => ...)`) to prevent stale-closure bugs. |
| **TypeScript** | Full type safety with TS 6, strict linting (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`). |
| **shadcn components** | `Button`, `Input`, `Card` (+ `CardContent`), and `Badge` — all tree-shakeable and imported individually. |
| **Lucide icons** | `Plus`, `Search`, `Trash2`, `StickyNote`, `Sun`, `Moon` — lightweight SVG icons. |
| **GitHub Pages** | Deployed via `gh-pages` with `base: '/Notes/'` configured in Vite for correct asset paths. |

---

## 🛠 Tech stack

| Layer | Library | Version |
|-------|---------|---------|
| Framework | React | 19 |
| Language | TypeScript | 6 |
| Build tool | Vite | 8 |
| UI primitives | shadcn/ui | latest |
| Styling | Tailwind CSS | 4 |
| Animations | tw-animate-css | 1 |
| Icons | Lucide React | 1 |
| Class merging | clsx + tailwind-merge | 2 / 3 |
| Font | Geist Variable | — |
| Deployment | gh-pages | — |

---

## 🚀 Getting started

```bash
git clone https://github.com/EGhesmati/Notes.git
cd Notes/react-notes-app

npm install
npm run dev        # → http://localhost:5173
```

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check with `tsc` then bundle with Vite |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build + push `dist/` to the `gh-pages` branch |

---

## 🌐 Live demo

👉 **[eghesmati.github.io/Notes](https://EGhesmati.github.io/Notes)**

---

## 🧱 How it works

### Theme system

```
useTheme() hook
  ├── Reads localStorage for saved preference
  ├── Falls back to prefers-color-scheme media query
  ├── Toggles .dark class on <html> element
  └── Listens for system preference changes

index.css
  ├── :root { ... }          → light palette
  ├── .dark { ... }          → dark palette
  └── @theme inline { ... }  → maps CSS vars to Tailwind utilities
```

### Data flow

```
[note state] ──→ Input (controlled)
[notes state] ──→ Grid → Card → deleteNote(index)
[search state] ──→ filter() → filtered array → Grid
```

### Component tree

```
App
├── Theme toggle (Sun / Moon icon)
├── Header (title + subtitle)
├── Input + Add button
├── Character counter
├── Search input
├── Stats badges (note count, match count)
└── Grid
    └── Card (× n)
        ├── Note text
        └── Delete button (reveals on hover)
```

---

## 📁 Project structure

```
react-notes-app/
├── components.json                # shadcn config
├── vite.config.ts                 # Vite + Tailwind plugin + @/ alias
├── tsconfig.app.json              # TS paths & strict options
├── package.json
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Tailwind imports + theme variables
│   ├── App.tsx                    # Main application
│   ├── types.ts                   # TypeScript interfaces
│   ├── hooks/
│   │   ├── use-theme.ts          # Theme toggle + persistence
│   │   ├── use-debounce.ts       # Debounced search input
│   │   └── use-local-storage.ts  # Persistent state sync
│   ├── lib/
│   │   └── utils.ts              # cn() class helper
│   └── components/
│       ├── NotesGrid.tsx          # Lazy-loaded grid (code-split)
│       ├── AppLoadingScreen.tsx   # Initial loading screen
│       └── ui/
│           ├── button.tsx         # shadcn Button
│           ├── input.tsx          # shadcn Input
│           ├── card.tsx           # shadcn Card
│           └── badge.tsx          # shadcn Badge
```

---

## 📄 License

MIT
