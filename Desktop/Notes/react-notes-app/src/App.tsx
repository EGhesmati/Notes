import { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Sun,
  Moon,
  Loader2,
  Heart,
  LogOut,
  Shield,
  X,
  LayoutGrid,
  List,
  Columns3,
  Trash2,
  RotateCcw,
  Inbox,
  UserRound,
  KeyRound,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { useTheme } from "@/hooks/use-theme";
import { useDebounce } from "@/hooks/use-debounce";
import { useUserNotes } from "@/hooks/use-user-notes";
import { usePomodoroStats, timePerNoteMap } from "@/hooks/use-pomodoro-stats";
import { changePassword, changeUsername } from "@/lib/api";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import PomodoroStats from "@/components/PomodoroStats";
import { TimeChips } from "@/components/TimeChips";
import { useAuth } from "@/lib/auth-context";
import { LoginPage } from "@/pages/LoginPage";
import { NOTE_COLORS, PRIORITY_BADGE } from "@/types";
import type { NoteItem, Priority } from "@/types";

const NotesGrid = lazy(() => import("@/components/NotesGrid"));

function toISO(date: string | undefined, time: string | undefined): string | undefined {
  if (!date) return undefined;
  const t = time || "23:59";
  return new Date(`${date}T${t}:00`).toISOString();
}

export default function App() {
  const { isLoggedIn, signOut } = useAuth();
  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return <AppShell signOut={signOut} />;
}

function AppShell({ signOut }: { signOut: () => void }) {
  const { user, updateUser } = useAuth();
  const userId = user?.id ?? 0;
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority | undefined>();
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const { notes, trash, setNotes: addNoteApi, editNote: editNoteApi, deleteNote: deleteNoteApi, restoreNote, deleteNotePermanent, reorder: reorderNotesApi } = useUserNotes();
  // complete pomodoro dataset (local + server) → total focus time per note
  const { stats: pomoStats } = usePomodoroStats(userId);
  const timeOnNote = useMemo(() => timePerNoteMap(pomoStats), [pomoStats]);
  const [search, setSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const { theme, toggle } = useTheme();

  type ViewMode = "grid" | "list" | "kanban";
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem("notes_view_mode");
      return saved === "list" || saved === "kanban" ? saved : "grid";
    } catch {
      return "grid";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("notes_view_mode", view);
    } catch {
      // ignore
    }
  }, [view]);

  useEffect(() => {
    const id = setTimeout(() => setHydrated(true), 400);
    return () => clearTimeout(id);
  }, []);

  const debouncedSearch = useDebounce(search, 200);

  const addNote = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const color =
      NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)].name;
    addNoteApi({
      text: trimmed,
      color,
      priority,
      dueDate: toISO(dueDate, dueTime),
    });
    setText("");
    setPriority(undefined);
    setDueDate("");
    setDueTime("");
  }, [text, priority, dueDate, dueTime, addNoteApi]);

  const editNote = useCallback(
    (id: number, newText: string, newPriority?: Priority, newDueDate?: string, newDueTime?: string) => {
      editNoteApi(id, {
        text: newText,
        priority: newPriority || null,
        dueDate: toISO(newDueDate, newDueTime) || null,
      });
    },
    [editNoteApi],
  );

  const deleteNote = useCallback(
    (id: number) => deleteNoteApi(id),
    [deleteNoteApi],
  );

  const togglePin = useCallback(
    (id: number) => {
      const note = notes.find((n) => n.id === id);
      if (note) {
        editNoteApi(id, { pinned: !note.pinned });
      }
    },
    [notes, editNoteApi],
  );

  const handleReorder = useCallback(
    (orderedIds: number[]) => {
      reorderNotesApi(orderedIds);
    },
    [reorderNotesApi],
  );

  const filtered = useMemo(() => {
    const matches = debouncedSearch
      ? notes.filter((n) =>
          n.text.toLowerCase().includes(debouncedSearch.toLowerCase()),
        )
      : notes;
    return [...matches].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0; // stable: preserve custom drag order within groups
    });
  }, [notes, debouncedSearch]);

  if (!hydrated) return <AppLoadingScreen />;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <AppIcon className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Hello, {user?.name ?? "there"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTrash(true)}
              className={`relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground ${trash.length > 0 ? "text-muted-foreground" : ""}`}
              title="Trash"
            >
              <Trash2 className="h-[16px] w-[16px]" />
              {trash.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-white">
                  {trash.length}
                </span>
              )}
            </Button>
            <PomodoroTimer />
            <PomodoroStats />
            {user?.isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setShowUsers(true)} className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" title="Users">
                <Shield className="h-[16px] w-[16px]" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAccount(true)}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Account"
            >
              <UserRound className="h-[16px] w-[16px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSignOut(true)}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-[16px] w-[16px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            <AppIcon className="mr-2 inline-block h-8 w-8 align-middle" />
            Notes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">write it down, keep it safe</p>
        </div>

        <div className="mb-2 flex gap-3">
          <Input
            placeholder="Write a note..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            className="h-12 border-border bg-card/80 backdrop-blur-xl placeholder:text-muted-foreground/60 focus-visible:ring-ring"
          />
          <Button onClick={addNote} size="lg" className="h-12 px-5 shadow-lg shadow-foreground/10 transition-all hover:shadow-xl hover:shadow-foreground/15 active:scale-95">
            <Plus className="h-5 w-5" />
            Add
          </Button>
        </div>
        <div className="mb-1 ml-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Priority</span>
          {(["low", "medium", "high"] as Priority[]).map((p) => {
            const sel = priority === p;
            const b = PRIORITY_BADGE[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority((prev) => (prev === p ? undefined : p))}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  sel ? `${b.className} ring-2 ring-offset-1 ring-offset-background` : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {b.label}
              </button>
            );
          })}
          <span className="text-[10px] text-muted-foreground/60">|</span>
          <span className="text-[11px] font-medium text-muted-foreground">Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); if (!e.target.value) setDueTime(""); }}
            className="h-7 w-32 rounded-md border border-border bg-card/80 px-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {dueDate && <TimeChips value={dueTime} onChange={setDueTime} />}
        </div>
        <p className="mb-5 ml-1 mt-1 text-xs text-muted-foreground">
          {text.length} character{text.length !== 1 && "s"}
        </p>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 border-border bg-card/80 pl-10 backdrop-blur-xl focus-visible:ring-ring"
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {notes.length} note{notes.length !== 1 && "s"}
            </Badge>
            {debouncedSearch && (
              <Badge variant="outline" className="text-xs">
                {filtered.length} match{filtered.length !== 1 && "es"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 backdrop-blur-xl">
            {(
              [
                { key: "grid", label: "Grid", Icon: LayoutGrid },
                { key: "list", label: "List", Icon: List },
                { key: "kanban", label: "Board", Icon: Columns3 },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                title={`${label} view`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  view === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {notes.length === 0 && !debouncedSearch ? (
          <p className="py-16 text-center text-sm italic text-muted-foreground">
            No notes yet. Add your first one!
          </p>
        ) : (
          <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <NotesGrid notes={filtered} onDelete={deleteNote} onEdit={editNote} onTogglePin={togglePin} onReorder={handleReorder} timeOnNote={timeOnNote} view={view} />
          </Suspense>
        )}
      </main>

      {showUsers && user?.isAdmin && <UsersModal onClose={() => setShowUsers(false)} />}
      {showAccount && (
        <AccountModal
          user={user}
          onUserUpdated={updateUser}
          onClose={() => setShowAccount(false)}
          onSignOut={signOut}
        />
      )}
      {showTrash && (
        <TrashModal
          trash={trash}
          onRestore={restoreNote}
          onDelete={deleteNotePermanent}
          onClose={() => setShowTrash(false)}
        />
      )}
      {showSignOut && (
        <ConfirmModal
          title="Sign out"
          description="Did you really want to sign out?"
          confirmLabel="Sign out"
          onConfirm={() => {
            setShowSignOut(false);
            signOut();
          }}
          onClose={() => setShowSignOut(false)}
        />
      )}

      <footer className="border-t border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 py-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            made with{" "}
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />{" "}
            by ErfanGhesmati
          </p>
        </div>
      </footer>
    </div>
  );
}

function AccountModal({
  user,
  onUserUpdated,
  onClose,
  onSignOut,
}: {
  user: { id: number; name: string; isAdmin?: boolean } | null;
  onUserUpdated: (patch: { name?: string; isAdmin?: boolean }) => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const [username, setUsername] = useState(user?.name ?? "");
  const [passcodeForUser, setPasscodeForUser] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const flash = (kind: "ok" | "err", text: string) => setMsg({ kind, text });

  const saveUsername = async () => {
    const clean = username.trim();
    if (!clean) return flash("err", "Username cannot be empty");
    if (clean === user?.name) return flash("err", "Username is unchanged");
    if (!passcodeForUser) return flash("err", "Enter your current passcode");
    setBusy(true);
    setMsg(null);
    try {
      const res = await changeUsername(clean, passcodeForUser);
      onUserUpdated(res.user ?? { name: clean });
      setPasscodeForUser("");
      flash("ok", "Username updated");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed to update username");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (pwNew.length < 4) return flash("err", "New passcode must be at least 4 characters");
    if (pwNew !== pwConfirm) return flash("err", "New passcodes do not match");
    if (!pwCurrent) return flash("err", "Enter your current passcode");
    setBusy(true);
    setMsg(null);
    try {
      await changePassword(pwCurrent, pwNew);
      // Invalidate the live session so the user signs in fresh with the new passcode.
      onClose();
      onSignOut();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed to update passcode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-16 w-[min(100%-2rem,30rem)] max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserRound className="h-5 w-5 text-muted-foreground" />
            Account
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {msg && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                msg.kind === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Change username */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              Change username
            </h3>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="New username"
              className="border-border bg-background/70"
            />
            <Input
              type="password"
              value={passcodeForUser}
              onChange={(e) => setPasscodeForUser(e.target.value)}
              placeholder="Current passcode"
              className="border-border bg-background/70"
            />
            <div className="flex justify-end">
              <Button onClick={saveUsername} disabled={busy} className="bg-foreground text-primary-foreground hover:bg-foreground/90">
                Save username
              </Button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Change password */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Change passcode
            </h3>
            <Input
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              placeholder="Current passcode"
              className="border-border bg-background/70"
            />
            <Input
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              placeholder="New passcode (4+ chars)"
              className="border-border bg-background/70"
            />
            <Input
              type="password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              placeholder="Confirm new passcode"
              className="border-border bg-background/70"
            />
            <div className="flex justify-end">
              <Button onClick={savePassword} disabled={busy} className="bg-foreground text-primary-foreground hover:bg-foreground/90">
                Save passcode
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashModal({
  trash,
  onRestore,
  onDelete,
  onClose,
}: {
  trash: readonly NoteItem[];
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-20 w-[min(100%-2rem,36rem)] rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Inbox className="h-5 w-5 text-muted-foreground" />
            Trash
            <Badge variant="outline" className="ml-1">{trash.length}</Badge>
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-3 py-2">
          {trash.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Trash is empty.</p>
          ) : (
            trash.map((n) => (
              <div key={n.id} className="flex items-center gap-3 border-b border-border/50 px-2 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-muted-foreground">{n.text || "(empty note)"}</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Deleted {n.deletedAt ? new Date(n.deletedAt).toLocaleString() : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onRestore(n.id)} className="shrink-0">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Restore
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(n.id)} className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete forever">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="mx-auto mt-20 w-[min(100%-2rem,28rem)] rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function UsersModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<Array<{ id: number; name: string; createdAt: string; isAdmin: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "forbidden");
        }
        const data = await res.json();
        if (mounted) setUsers(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "forbidden");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="mx-auto mt-6 w-[min(100%-1rem,56rem)] rounded-2xl border border-border bg-card shadow-2xl sm:mt-10">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <AppIcon className="h-8 w-8" />
            <h2 className="text-lg font-semibold">Users</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : error ? (
            <p className="text-sm text-rose-500">{error}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-background">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-4 py-3">{u.id}</td>
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.isAdmin ? "default" : "secondary"} className="text-[10px]">
                          {u.isAdmin ? "Admin" : "User"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
