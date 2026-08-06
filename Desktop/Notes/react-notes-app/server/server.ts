import pg from "pg";
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

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// init tables
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL UNIQUE
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
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    duration INTEGER NOT NULL,
    note_id INTEGER,
    note_title TEXT,
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
  const { name, passcode } = req.body;
  if (!name || !passcode) return res.status(400).json({ error: "name and passcode required" });
  const { rows } = await pool.query("SELECT id, name FROM users WHERE name = $1 AND passcode = $2", [name, passcode]);
  if (rows.length === 0) return res.status(401).json({ error: "invalid credentials" });
  const user = rows[0];
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: user.id, name: user.name } });
});

app.post("/api/auth/register", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const passcode = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  try {
    const { rows } = await pool.query("INSERT INTO users (name, passcode) VALUES ($1, $2) RETURNING id, name", [name, passcode]);
    const user = rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, passcode, user: { id: user.id, name: user.name } });
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

// ---- Sessions ----

app.get("/api/sessions", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500",
    [(req as any).userId],
  );
  res.json(rows);
});

app.post("/api/sessions", authMiddleware, async (req, res) => {
  const { duration, noteId, noteTitle } = req.body;
  await pool.query("INSERT INTO sessions (user_id, duration, note_id, note_title) VALUES ($1, $2, $3, $4)", [
    (req as any).userId, duration, noteId || null, noteTitle || null,
  ]);
  res.json({ ok: true });
});

// ---- Admin ----

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin-secret-token";

app.get("/admin", (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Admin - Notes App</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;max-width:600px;margin:40px auto;padding:0 16px;background:#0f0f0f;color:#e0e0e0}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #222}
th{color:#888;font-size:11px;text-transform:uppercase}
input,button{padding:6px 10px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#e0e0e0;font-size:13px}
button{background:#7c3aed;border:none;color:white;cursor:pointer;margin-left:6px}
.delete-btn{background:#dc2626;font-size:11px;padding:4px 8px}
h1{font-size:18px;margin-bottom:4px}h1 span{color:#7c3aed}p{color:#666;font-size:13px;margin:0}</style></head>
<body>
<h1>Notes App <span>Admin</span></h1>
<p>Users registered on this server</p>
<div><input id="token" placeholder="Admin token" type="password" style="width:200px"><button onclick="load()">Load</button></div>
<table id="table"></table>
<script>
async function load(){
  const t=document.getElementById('token').value;
  const r=await fetch('/api/admin/users',{headers:{'x-admin-token':t}});
  const users=await r.json();
  document.getElementById('table').innerHTML=
    '<tr><th>ID</th><th>Name</th><th>Passcode</th><th></th></tr>'+
    users.map(u=>'<tr><td>'+u.id+'</td><td>'+u.name+'</td><td><code>'+u.passcode+'</code></td><td><button class="delete-btn" onclick="del('+u.id+')">Delete</button></td></tr>').join('');
  window._token=t;
}
async function del(id){
  if(!confirm('Delete user '+id+' and all their data?'))return;
  await fetch('/api/admin/users/'+id,{method:'DELETE',headers:{'x-admin-token':window._token}});
  load();
}
</script></body></html>`);
});

app.get("/api/admin/users", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) return res.status(403).json({ error: "forbidden" });
  const { rows } = await pool.query("SELECT id, name, passcode FROM users ORDER BY id");
  res.json(rows);
});

app.put("/api/admin/users/:id/passcode", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) return res.status(403).json({ error: "forbidden" });
  const { passcode } = req.body;
  if (!passcode) return res.status(400).json({ error: "passcode required" });
  await pool.query("UPDATE users SET passcode = $1 WHERE id = $2", [passcode, req.params.id]);
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", async (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) return res.status(403).json({ error: "forbidden" });
  await pool.query("DELETE FROM notes WHERE user_id = $1", [req.params.id]);
  await pool.query("DELETE FROM sessions WHERE user_id = $1", [req.params.id]);
  await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
