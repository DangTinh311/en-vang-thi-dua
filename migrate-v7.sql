-- Thêm nhóm tài xế "Xe 7 chỗ" bên cạnh nhóm 1 lái / 2 lái. seven = 1 nghĩa là tài xế thuộc nhóm xe 7 chỗ.
-- Dùng cột mới thay vì sửa ràng buộc grp để khỏi phải dựng lại bảng drivers (doanh thu và lịch đang trỏ tới). Chạy MỘT lần.
ALTER TABLE drivers ADD COLUMN seven INTEGER NOT NULL DEFAULT 0 CHECK (seven IN (0, 1));
