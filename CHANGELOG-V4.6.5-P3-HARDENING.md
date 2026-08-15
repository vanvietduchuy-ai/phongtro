# Changelog v4.6.5 — P3 hardening

## Hiệu năng giao diện

- `renderAdmin()` chỉ dựng màn hình quản lý đang hoạt động; màn hình khác được dựng khi người dùng chuyển đến.
- Nhãn bảng responsive và hydrate ảnh chỉ chạy trong view hiện tại.
- Giữ nguyên các renderer riêng và handler P0/P1/P2 để không đổi nghiệp vụ.

## Đồng bộ và mạng

- Thay `setInterval` cố định bằng một scheduler `setTimeout` duy nhất.
- Không còn gắn trùng listener `visibilitychange`/`online` sau mỗi `fullPull()`.
- Khi lỗi mạng, thời gian thử lại tăng dần, có jitter và không vượt 5 phút; khi thành công trở lại nhịp 20 giây cho quản lý/60 giây cho khách.
- Trạng thái offline được phát hiện trước khi gọi máy chủ; khi có mạng lại, hệ thống thử ngay.

## Sao lưu và phục hồi

- `setup()` gọi `ensureBackupTrigger()` để tự cài sao lưu Google Sheets hằng ngày trong khung 03:00.
- Chạy `setup()` nhiều lần không tạo trùng trigger.
- Bản sao lưu máy chủ tiếp tục giữ 14 bản gần nhất; sao lưu cục bộ giữ 7 ngày.
- Màn Cài đặt hiển thị rõ chính sách sao lưu máy chủ.

## Kiểm thử và giới hạn

- Thêm `tests/p3-hardening-regression.test.js` cho active-view rendering, retry/backoff, trigger idempotent, xác thực file khôi phục, batch read và trần gói sync.
- Tập thử tự động: 120 phòng, 1.200 hóa đơn lịch sử.
- Giữ trần an toàn 300 bản ghi/collection trong một lần đẩy.
- Sửa build Apps Script chỉ chèn `<base target="_top">` vào `<head>` chính; không còn vô tình biến đổi template hóa đơn/biên nhận nằm trong `app.js`.

## Tương thích

- Không đổi schema Google Sheets, collection, API, công thức hóa đơn hay quy tắc sổ cọc.
- Không chuyển sang Supabase/Postgres trong P3.
- Apps Script `Index.html` phải được build lại từ cùng nguồn web trước khi bàn giao.
