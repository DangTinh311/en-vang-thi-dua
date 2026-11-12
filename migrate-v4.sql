-- Thêm bảng lịch làm việc. Giữ nguyên dữ liệu hiện có. Chạy được nhiều lần.
-- Mỗi đàm mỗi ngày xếp một tài xế chạy ca 24 giờ.
CREATE TABLE IF NOT EXISTS schedule (
  date TEXT NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_driver ON schedule(driver_id);
