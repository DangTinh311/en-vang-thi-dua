-- Lịch làm việc: cho phép đánh dấu "Xe sửa" (không có tài xế). Dựng lại bảng, giữ nguyên lịch đã xếp. Chạy MỘT lần, sau migrate-v4.
CREATE TABLE schedule_v5 (
  date TEXT NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  status TEXT CHECK (status IS NULL OR status = 'sua'),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, vehicle_id),
  CHECK ((driver_id IS NOT NULL AND status IS NULL) OR (driver_id IS NULL AND status IS NOT NULL))
);
INSERT INTO schedule_v5 (date, vehicle_id, driver_id, updated_at) SELECT date, vehicle_id, driver_id, updated_at FROM schedule;
DROP TABLE schedule;
ALTER TABLE schedule_v5 RENAME TO schedule;
CREATE INDEX IF NOT EXISTS idx_schedule_driver ON schedule(driver_id);
