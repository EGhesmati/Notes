import Database from "better-sqlite3";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const PORT = parseInt(process.env.PORT || "3001", 10);

const db = new Database("notes.db");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'border-l-sky-400',
    priority TEXT,
    due_date TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    duration INTEGER NOT NULL,
    note_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const app = express();
app.use(cors());
app.use(express.json());

// ---- Auth ----

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

app.post("/api/auth/login", (req, res) => {
  const { name, passcode } = req.body;
  if (!name || !passcode) return res.status(400).json({ error: "name and passcode required" });
  const user = db.prepare("SELECT id, name FROM users WHERE name = ? AND passcode = ?").get(name, passcode) as any;
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name } });
});

app.post("/api/auth/register", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const passcode = crypto.randomBytes(4).toString("hex");
  try {
    const result = db.prepare("INSERT INTO users (name, passcode) VALUES (?, ?)").run(name, passcode);
    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, passcode, user: { id: result.lastInsertRowid, name } });
  } catch {
    res.status(409).json({ error: "name already taken" });
  }
});

// ---- Notes ----

app.get("/api/notes", authMiddleware, (req, res) => {
  const notes = db.prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY pinned DESC, created_at DESC").all((req as any).userId);
  res.json(notes.map((n: any) => ({
    ...n,
    dueDate: n.due_date || undefined,
    pinned: !!n.pinned,
  })));
});

app.post("/api/notes", authMiddleware, (req, res) => {
  const { text, color, priority, dueDate, pinned } = req.body;
  const result = db.prepare(
    "INSERT INTO notes (user_id, text, color, priority, due_date, pinned) VALUES (?, ?, ?, ?, ?, ?)"
  ).run((req as any).userId, text, color, priority || null, dueDate || null, pinned ? 1 : 0);
  const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid) as any;
  res.json({ ...note, dueDate: note.due_date || undefined, pinned: !!note.pinned });
});

app.put("/api/notes/:id", authMiddleware, (req, res) => {
  const { text, color, priority, dueDate, pinned } = req.body;
  db.prepare(
    "UPDATE notes SET text = ?, color = ?, priority = ?, due_date = ?, pinned = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(text, color, priority || null, dueDate || null, pinned ? 1 : 0, req.params.id, (req as any).userId);
  res.json({ ok: true });
});

app.delete("/api/notes/:id", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(req.params.id, (req as any).userId);
  res.json({ ok: true });
});

// ---- Sessions ----

app.get("/api/sessions", authMiddleware, (req, res) => {
  const sessions = db.prepare(
    "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 500"
  ).all((req as any).userId);
  res.json(sessions);
});

app.post("/api/sessions", authMiddleware, (req, res) => {
  const { duration, noteId } = req.body;
  db.prepare("INSERT INTO sessions (user_id, duration, note_id) VALUES (?, ?, ?)")
    .run((req as any).userId, duration, noteId || null);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
