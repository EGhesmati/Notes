import { Pool } from "@neondatabase/serverless";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const PORT = parseInt(process.env.PORT || "3001", 10);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// init tables
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    passcode TEXT NOT NULL UNIQUE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'border-l-sky-400',
    priority TEXT,
    due_date TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS pomodoros (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    ts BIGINT NOT NULL,
    duration INTEGER NOT NULL,
    phase TEXT NOT NULL,
    note_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

app.post("/api/auth/login", async (req, res) => {
  const name = (req.body.name || "").trim();
  const passcode = req.body.passcode;
  if (!name || !passcode) return res.status(400).json({ error: "name and passcode required" });
  const { rows } = await pool.query("SELECT id, name, is_admin FROM users WHERE name = $1 AND passcode = $2", [name, passcode]);
  if (rows.length === 0) return res.status(401).json({ error: "invalid credentials" });
  const user = rows[0];
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name, isAdmin: !!user.is_admin } });
});

app.post("/api/auth/register", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const passcode = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  try {
    const { rows: adminRows } = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE is_admin = TRUE");
    const isAdmin = adminRows[0]?.count === 0;
    const { rows } = await pool.query("INSERT INTO users (name, passcode) VALUES ($1, $2) RETURNING id, name, is_admin", [name, passcode]);
    const user = rows[0];
    if (isAdmin) {
      await pool.query("UPDATE users SET is_admin = TRUE WHERE id = $1", [user.id]);
      user.is_admin = true;
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, passcode, user: { id: user.id, name: user.name, isAdmin: !!user.is_admin } });
  } catch {
    res.status(409).json({ error: "name already taken" });
  }
});

// ---- Notes ----

app.get("/api/notes", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM notes WHERE user_id = $1 ORDER BY pinned DESC, created_at DESC",
    [(req as any).userId],
  );
  res.json(rows.map((n: any) => ({
    ...n,
    dueDate: n.due_date || undefined,
    pinned: !!n.pinned,
  })));
});

app.post("/api/notes", authMiddleware, async (req, res) => {
  const { text, color, priority, dueDate, pinned } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO notes (user_id, text, color, priority, due_date, pinned) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [(req as any).userId, text, color, priority || null, dueDate || null, pinned ? 1 : 0],
  );
  const note = rows[0];
  res.json({ ...note, dueDate: note.due_date || undefined, pinned: !!note.pinned });
});

app.put("/api/notes/:id", authMiddleware, async (req, res) => {
  const { text, color, priority, dueDate, pinned } = req.body;
  await pool.query(
    "UPDATE notes SET text = COALESCE($1, text), priority = $2, due_date = $3, pinned = COALESCE($4, pinned), updated_at = NOW() WHERE id = $5 AND user_id = $6",
    [text, priority || null, dueDate || null, pinned != null ? (pinned ? 1 : 0) : null, req.params.id, (req as any).userId],
  );
  res.json({ ok: true });
});

app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
  await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [req.params.id, (req as any).userId]);
  res.json({ ok: true });
});

// ---- Pomodoro endpoints ----

app.post("/api/pomodoros", authMiddleware, async (req, res) => {
  const { ts, duration, phase, noteId } = req.body;
  if (!ts || !duration || !phase) return res.status(400).json({ error: "ts, duration and phase required" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO pomodoros (user_id, ts, duration, phase, note_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [(req as any).userId, ts, duration, phase, noteId || null],
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to save" });
  }
});

app.get("/api/pomodoros", authMiddleware, async (req, res) => {
  const since = req.query.since ? Number(req.query.since) : null;
  const params: any[] = [(req as any).userId];
  let q = "SELECT id, ts, duration, phase, note_id FROM pomodoros WHERE user_id = $1";
  if (since) {
    q += " AND ts >= $2";
    params.push(since);
  }
  q += " ORDER BY ts DESC LIMIT 1000";
  try {
    const { rows } = await pool.query(q, params);
    res.json(rows.map((r: any) => ({ ts: Number(r.ts), duration: r.duration, phase: r.phase, noteId: r.note_id })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch" });
  }
});

// ---- Admin ----

function adminMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number };
    (req as any).userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
  next();
}

async function loadCurrentUser(userId: number) {
  const { rows } = await pool.query("SELECT id, name, is_admin FROM users WHERE id = $1", [userId]);
  return rows[0] ?? null;
}

app.get("/api/admin/me", adminMiddleware, async (req, res) => {
  const user = await loadCurrentUser((req as any).userId);
  if (!user?.is_admin) return res.status(403).json({ error: "forbidden" });
  res.json({ isAdmin: true });
});

app.get("/api/admin/users", adminMiddleware, async (req, res) => {
  const user = await loadCurrentUser((req as any).userId);
  if (!user?.is_admin) return res.status(403).json({ error: "forbidden" });
  const { rows } = await pool.query("SELECT id, name, is_admin, created_at FROM users ORDER BY id");
  res.json(rows.map((u: any) => ({
    id: u.id,
    name: u.name,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
  })));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
