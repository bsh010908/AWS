CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS ledger_db;

USE ledger_db;

INSERT IGNORE INTO categories (name, type, user_id) VALUES
('식비','EXPENSE',NULL),
('교통','EXPENSE',NULL),
('쇼핑','EXPENSE',NULL),
('생활','EXPENSE',NULL),
('문화','EXPENSE',NULL),
('기타','EXPENSE',NULL);