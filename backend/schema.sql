PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Daily log entries (the core tracker)
CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  log_date TEXT NOT NULL, -- Format: YYYY-MM-DD
  result TEXT NOT NULL CHECK(result IN ('positive', 'negative')),
  duration_minutes INTEGER CHECK(duration_minutes >= 0),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, log_date)
);

-- Refresh tokens for auth
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Streak tracking
CREATE TABLE IF NOT EXISTS streaks (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER DEFAULT 0 CHECK(current_streak >= 0),
  best_streak INTEGER DEFAULT 0 CHECK(best_streak >= 0),
  last_log_date TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date 
  ON daily_logs(user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token 
  ON refresh_tokens(token);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user 
  ON refresh_tokens(user_id);

-- 🔄 Trigger to auto-update updated_at (users)
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- 🔄 Trigger for daily_logs
CREATE TRIGGER IF NOT EXISTS trg_daily_logs_updated_at
AFTER UPDATE ON daily_logs
FOR EACH ROW
BEGIN
  UPDATE daily_logs SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- 🔄 Trigger for streaks
CREATE TRIGGER IF NOT EXISTS trg_streaks_updated_at
AFTER UPDATE ON streaks
FOR EACH ROW
BEGIN
  UPDATE streaks SET updated_at = datetime('now') WHERE user_id = OLD.user_id;
END;