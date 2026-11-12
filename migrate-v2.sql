-- CẢNH BÁO: xóa toàn bộ dữ liệu rồi tạo lại.
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS drivers;
DROP TABLE IF EXISTS vehicles;
-- Đàm (xe): cố định, số đàm là khóa chính.
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL DEFAULT '',
  ins_civil TEXT,      -- Bảo hiểm dân sự (ngày, YYYY-MM-DD)
  inspection TEXT,     -- Đăng kiểm
  road_fee TEXT,       -- Phí đường bộ
  badge TEXT,          -- Phù hiệu
  ins_hull TEXT,       -- Bảo hiểm thân vỏ
  mortgage_doc TEXT,   -- Biên bản thế chấp
  bank TEXT,           -- Ngân hàng
  contact_name TEXT,   -- Người liên hệ
  contact_phone TEXT,  -- SĐT người liên hệ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tài xế: linh động, mỗi ngày có thể chạy đàm khác nhau. Nhóm 1 lái / 2 lái gắn với tài xế.
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  grp INTEGER NOT NULL CHECK (grp IN (1, 2)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mỗi đàm mỗi ngày một dòng: tài xế nào nộp bao nhiêu tiền (đồng), hoặc đàm nghỉ/sửa.
CREATE TABLE IF NOT EXISTS entries (
  date TEXT NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  driver_id INTEGER REFERENCES drivers(id),
  amount INTEGER CHECK (amount IS NULL OR amount > 0),
  status TEXT CHECK (status IS NULL OR status IN ('sua', 'nghi')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, vehicle_id),
  CHECK ((amount IS NOT NULL AND driver_id IS NOT NULL AND status IS NULL) OR (amount IS NULL AND driver_id IS NULL AND status IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_entries_driver ON entries(driver_id);
CREATE INDEX IF NOT EXISTS idx_entries_vehicle ON entries(vehicle_id);
-- 35 đàm hiện có (biển số nhập sau trong tab Danh sách đàm).
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7008', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7011', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7012', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7015', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7016', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7019', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7038', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7047', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7061', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7062', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7063', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7064', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7065', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7066', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7067', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7405', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7408', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7409', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7410', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7411', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7412', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7413', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7414', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7415', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7416', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7417', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7418', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7419', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7420', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7425', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7504', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7505', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7506', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7507', '');
INSERT OR IGNORE INTO vehicles (id, plate) VALUES ('7509', '');
