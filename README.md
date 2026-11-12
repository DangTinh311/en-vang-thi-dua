# Doanh thu Én Vàng (Cloudflare Worker + D1)

Cấu trúc dữ liệu: `vehicles` (đàm: số đàm, biển số) · `drivers` (tài xế: họ tên, SĐT, địa chỉ, ghi chú, nhóm 1/2 lái, đang làm/nghỉ việc) · `entries` (mỗi đàm mỗi ngày: tài xế nào nộp bao nhiêu đồng, hoặc đàm nghỉ/sửa).

Nâng cấp từ cấu trúc cũ lên cấu trúc mới (XÓA SẠCH dữ liệu cũ):

    npm run db:migrate
    npm run db:seed-drivers    # tuỳ chọn: nạp tên 32 lái từ Excel cũ vào danh sách tài xế
    npm run deploy

Cài mới: npx wrangler d1 create en-vang-thi-dua, dán database_id vào wrangler.toml, rồi chạy
npm run db:migrate, npx wrangler secret put APP_PASSWORD, npm run deploy.

Thêm cột giấy tờ vào danh sách đàm (giữ nguyên dữ liệu hiện có, chỉ chạy MỘT lần):

    npm run db:migrate3
    npm run db:seed-giay-to    # nạp giấy tờ, ngân hàng, người liên hệ từ file Excel
    npm run deploy

Thêm lịch làm việc tài xế (mỗi đàm mỗi ngày một ca 24 giờ; giữ nguyên dữ liệu, chạy lại không sao):

    npm run db:migrate4
    npm run db:migrate5    # cho phép đánh dấu "Xe sửa" trong lịch (chạy MỘT lần)
    npm run deploy

Thêm mục xe 7 chỗ (mọi đàm hiện có mặc định là xe 4 chỗ; chạy MỘT lần):

    npm run db:migrate6
    npm run db:migrate7    # cột seven của tài xế; giao diện mới không dùng nữa, giữ lại để khỏi mất dữ liệu cũ
    npm run deploy

Giao diện (menu trái + dữ liệu phải, điện thoại dùng thanh menu đáy): `public/index.html` (khung trang), `public/app.css`, `public/app.js`; trang đăng nhập là `public/login.html`.
Số chỗ (4 | 7) là thuộc tính của đàm, sửa ở màn Đàm xe. Số lái (1 lái | 2 lái) là thuộc tính của tài xế, sửa ở màn Tài xế. Không cần chạy thêm migrate nào cho giao diện mới.
