-- Thêm cột giấy tờ vào bảng đàm. Giữ nguyên dữ liệu hiện có. Chỉ chạy MỘT lần.
ALTER TABLE vehicles ADD COLUMN ins_civil TEXT;
ALTER TABLE vehicles ADD COLUMN inspection TEXT;
ALTER TABLE vehicles ADD COLUMN road_fee TEXT;
ALTER TABLE vehicles ADD COLUMN badge TEXT;
ALTER TABLE vehicles ADD COLUMN ins_hull TEXT;
ALTER TABLE vehicles ADD COLUMN mortgage_doc TEXT;
ALTER TABLE vehicles ADD COLUMN bank TEXT;
ALTER TABLE vehicles ADD COLUMN contact_name TEXT;
ALTER TABLE vehicles ADD COLUMN contact_phone TEXT;
