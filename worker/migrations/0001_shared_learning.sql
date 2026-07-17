CREATE TABLE IF NOT EXISTS learning_event_receipts (
  event_digest TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL DEFAULT (unixepoch())
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS learning_event_receipts_received_at
  ON learning_event_receipts (received_at);

CREATE TABLE IF NOT EXISTS learning_aggregates (
  strategy TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('sente', 'gote')),
  branch_id TEXT NOT NULL,
  games INTEGER NOT NULL DEFAULT 0 CHECK (games >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  score_sum REAL NOT NULL DEFAULT 0 CHECK (score_sum >= 0),
  PRIMARY KEY (strategy, side, branch_id),
  CHECK (wins + draws <= games),
  CHECK (score_sum <= games),
  CHECK (score_sum * 2 = wins * 2 + draws)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS learning_aggregates_public_games
  ON learning_aggregates (games);
