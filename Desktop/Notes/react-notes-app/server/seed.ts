import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    passcode TEXT NOT NULL UNIQUE
  );
`);

const { rows } = await pool.query("SELECT COUNT(*) as c FROM users");
const count = parseInt(rows[0].c, 10);

if (count === 0) {
  const adminName = process.env.ADMIN_NAME || "admin";
  const adminPass = process.env.ADMIN_PASSCODE || "change-me";
  await pool.query("INSERT INTO users (name, passcode) VALUES ($1, $2)", [adminName, adminPass]);
  console.log(`✅ Seeded user: ${adminName} / ${adminPass}`);
} else {
  console.log(`ℹ️  Users already exist (${count} total)`);
}

await pool.end();
console.log("Done.");
