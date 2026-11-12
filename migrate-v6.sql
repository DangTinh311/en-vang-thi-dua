-- Phân loại xe: 4 chỗ (taxi Én Vàng, mặc định cho mọi đàm hiện có) hoặc 7 chỗ. Giữ nguyên dữ liệu. Chạy MỘT lần.
ALTER TABLE vehicles ADD COLUMN seats INTEGER NOT NULL DEFAULT 4 CHECK (seats IN (4, 7));
