const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'medrag.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

const initDb = () => {
  const usersSchema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `;

  const documentsSchema = `
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `;

  const queryHistorySchema = `
    CREATE TABLE IF NOT EXISTS query_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      response TEXT NOT NULL, -- Stored as JSON string
      timestamp TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `;

  db.serialize(() => {
    db.exec(usersSchema, (err) => {
      if (err) console.error('Error creating users table:', err.message);
    });
    db.exec(documentsSchema, (err) => {
      if (err) console.error('Error creating documents table:', err.message);
    });
    db.exec(queryHistorySchema, (err) => {
      if (err) console.error('Error creating query_history table:', err.message);
    });
  });

  console.log('Database tables initialized.');
};

module.exports = { db, initDb };
