import Database from "better-sqlite3";

const db = new Database("notes.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL UNIQUE
  );
`);

// Seed a default user if table is empty
const count = db.prepare("SELECT COUNT(*) as c FROM users").get() as any;
if (count.c === 0) {
  db.prepare("INSERT INTO users (name, passcode) VALUES (?, ?)").run("erfan", "abc123");
  console.log("✅ Seeded user: erfan / abc123");
} else {
  console.log(`ℹ️  Users already exist (${count.c} total)`);
}

console.log("Done.");
