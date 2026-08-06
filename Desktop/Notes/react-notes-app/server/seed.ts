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
// Seed default user. Credentials from env vars — never commit real ones.
// Set ADMIN_NAME + ADMIN_PASSCODE in Render environment variables.
const adminName = process.env.ADMIN_NAME || "admin";
const adminPass = process.env.ADMIN_PASSCODE || "change-me";

if (count.c === 0) {
  db.prepare("INSERT INTO users (name, passcode) VALUES (?, ?)").run(adminName, adminPass);
  console.log(`✅ Seeded user: ${adminName} / ${adminPass}`);
} else {
  console.log(`ℹ️  Users already exist (${count.c} total)`);
}

console.log("Done.");
