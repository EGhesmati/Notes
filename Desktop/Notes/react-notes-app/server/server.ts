import { Pool } from "@neondatabase/serverless";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- backfill sort_order for existing notes so drag reordering works on old data
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  UPDATE notes SET sort_order = id WHERE sort_order = 0;

  -- soft-delete support: trashed notes have a non-null deleted_at timestamp
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

  -- password hashing support: new/changed passwords are stored here as scrypt hashes;
  -- legacy rows keep a plaintext passcode until they next verify (upgraded on login/change)
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

  -- token_version is bumped on password change to invalidate all previously issued JWTs
  ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

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

async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number; version?: number };
    const { rows } = await pool.query("SELECT token_version FROM users WHERE id = $1", [payload.userId]);
    if (rows.length === 0 || Number(rows[0].token_version) !== (payload.version ?? 0)) {
      return res.status(401).json({ error: "invalid token" });
    }
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

// ---- Password hashing (Node built-in scrypt, no external deps) ----
// Stored format: "scrypt$<saltHex>$<hashHex>"

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

app.post("/api/auth/login", async (req, res) => {
  const name = (req.body.name || "").trim();
  const passcode = req.body.passcode;
  if (!name || !passcode) return res.status(400).json({ error: "name and passcode required" });
  const { rows } = await pool.query("SELECT id, name, is_admin, passcode, password_hash, token_version FROM users WHERE name = $1", [name]);
  if (rows.length === 0) return res.status(401).json({ error: "invalid credentials" });
  const user = rows[0];

  const hash = user.password_hash as string | null;
  const ok = hash
    ? verifyPassword(String(passcode), hash)
    : String(user.passcode) === String(passcode);

  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  // Legacy plaintext passcode → upgrade to a scrypt hash on successful login.
  if (!hash) {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(String(passcode)), user.id]);
  }

  const token = jwt.sign({ userId: user.id, version: Number(user.token_version) ?? 0 }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name, isAdmin: !!user.is_admin } });
});

app.post("/api/auth/register", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const passcode = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  try {
    const { rows } = await pool.query("INSERT INTO users (name, passcode) VALUES ($1, $2) RETURNING id, name, is_admin, token_version", [name, passcode]);
    const user = rows[0];
    const token = jwt.sign({ userId: user.id, version: Number(user.token_version) ?? 0 }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, passcode, user: { id: user.id, name: user.name, isAdmin: !!user.is_admin } });
  } catch {
    res.status(409).json({ error: "name already taken" });
  }
});

// Returns the current user's fresh profile (used by the client to sync isAdmin).
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const { rows } = await pool.query("SELECT id, name, is_admin FROM users WHERE id = $1", [(req as any).userId]);
  if (rows.length === 0) return res.status(404).json({ error: "user not found" });
  const u = rows[0];
  res.json({ id: u.id, name: u.name, isAdmin: !!u.is_admin });
});

// Change the authenticated user's passcode (verifies the current one first).
app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
  const { currentPasscode, newPasscode } = req.body;
  if (!currentPasscode || !newPasscode) return res.status(400).json({ error: "current and new passcode required" });
  if (String(newPasscode).length < 4) return res.status(400).json({ error: "new passcode must be at least 4 characters" });

  const { rows } = await pool.query("SELECT passcode, password_hash FROM users WHERE id = $1", [(req as any).userId]);
  if (rows.length === 0) return res.status(404).json({ error: "user not found" });
  const user = rows[0];
  const hash = user.password_hash as string | null;
  const ok = hash
    ? verifyPassword(String(currentPasscode), hash)
    : String(user.passcode) === String(currentPasscode);
  if (!ok) return res.status(401).json({ error: "current passcode is incorrect" });

  await pool.query("UPDATE users SET passcode = $1, password_hash = $2, token_version = token_version + 1 WHERE id = $3", [
    String(newPasscode),
    hashPassword(String(newPasscode)),
    (req as any).userId,
  ]);
  res.json({ ok: true, versionBumped: true });
});

// Change the authenticated user's display name (verifies the current passcode, checks uniqueness).
app.post("/api/auth/change-username", authMiddleware, async (req, res) => {
  const { newName, currentPasscode } = req.body;
  const clean = (newName || "").trim();
  if (!clean) return res.status(400).json({ error: "new name required" });

  const { rows } = await pool.query("SELECT passcode, password_hash FROM users WHERE id = $1", [(req as any).userId]);
  if (rows.length === 0) return res.status(404).json({ error: "user not found" });
  const user = rows[0];
  const hash = user.password_hash as string | null;
  const ok = hash
    ? verifyPassword(String(currentPasscode || ""), hash)
    : String(user.passcode) === String(currentPasscode || "");
  if (!ok) return res.status(401).json({ error: "current passcode is incorrect" });

  try {
    const updated = await pool.query(
      "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, is_admin",
      [clean, (req as any).userId],
    );
    const u = updated.rows[0];
    res.json({ ok: true, user: { id: u.id, name: u.name, isAdmin: !!u.is_admin } });
  } catch {
    res.status(409).json({ error: "name already taken" });
  }
});

// ---- Notes ----

app.get("/api/notes", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM notes WHERE user_id = $1 AND deleted_at IS NULL ORDER BY pinned DESC, sort_order ASC, created_at DESC",
    [(req as any).userId],
  );
  res.json(rows.map((n: any) => ({
    ...n,
    dueDate: n.due_date || undefined,
    pinned: !!n.pinned,
  })));
});

// List trashed (soft-deleted) notes, most recently deleted first.
app.get("/api/notes/trash", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM notes WHERE user_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    [(req as any).userId],
  );
  res.json(rows.map((n: any) => ({
    ...n,
    dueDate: n.due_date || undefined,
    pinned: !!n.pinned,
  })));
});

// Restore a soft-deleted note back to the active list.
app.post("/api/notes/:id/restore", authMiddleware, async (req, res) => {
  await pool.query(
    "UPDATE notes SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
    [req.params.id, (req as any).userId],
  );
  res.json({ ok: true });
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

// Soft-delete: hide the note from the active list and put it in the trash.
app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
  await pool.query(
    "UPDATE notes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2",
    [req.params.id, (req as any).userId],
  );
  res.json({ ok: true });
});

// Permanently remove a note (only from the trash view).
app.delete("/api/notes/:id/permanent", authMiddleware, async (req, res) => {
  await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [req.params.id, (req as any).userId]);
  res.json({ ok: true });
});

// ---- Reorder notes ----

app.put("/api/notes/reorder", authMiddleware, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: "order array required" });
  // order: array of note ids in their desired display order
  for (let i = 0; i < order.length; i++) {
    const noteId = Number(order[i]);
    if (!Number.isFinite(noteId)) continue;
    await pool.query(
      "UPDATE notes SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
      [i, noteId, (req as any).userId],
    );
  }
  res.json({ ok: true });
});

// ---- Safe admin user summary ----

async function adminMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number; version?: number };
    const { rows } = await pool.query("SELECT token_version FROM users WHERE id = $1", [payload.userId]);
    if (rows.length === 0 || Number(rows[0].token_version) !== (payload.version ?? 0)) {
      return res.status(401).json({ error: "invalid token" });
    }
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

app.get("/api/admin/users", adminMiddleware, async (req, res) => {
  const { rows: currentRows } = await pool.query("SELECT is_admin FROM users WHERE id = $1", [(req as any).userId]);
  if (!currentRows[0]?.is_admin) return res.status(403).json({ error: "forbidden" });
  const { rows } = await pool.query("SELECT id, name, created_at, is_admin FROM users ORDER BY id");
  res.json(rows.map((u: any) => ({
    id: u.id,
    name: u.name,
    createdAt: u.created_at,
    isAdmin: !!u.is_admin,
  })));
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
