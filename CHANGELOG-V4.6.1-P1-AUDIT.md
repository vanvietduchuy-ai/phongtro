# Huy Rooms v4.6.1 — sửa P1 sau kiểm tra vận hành

Ngày: 2026-08-15

## Đã sửa

- Đăng nhập quản lý cục bộ bằng `123456` lưu đúng quyền trên máy; cờ cục bộ bị vô hiệu khi ứng dụng đang kết nối máy chủ.
- Thêm action công khai `publicAvailability`, chỉ trả mảng giờ bận của một phòng/ngày và không trả dữ liệu nhận dạng khách.
- Trang khách tải lại giờ bận từ máy chủ, tự cập nhật lựa chọn khi khung vừa bị người khác đặt.
- Phòng đang thuê lâu dài không còn được bán/nhận lịch; phòng trống hoặc có `availableFrom`/hợp đồng hết trong 45 ngày vẫn được nhận lịch.
- Khách nhận snapshot phòng có ngày sắp trống suy ra từ hợp đồng, kể cả khi bản ghi phòng chưa thay đổi.
- Thêm cột `slug` vào schema `CanTro` để URL căn trọ ổn định giữa các thiết bị.
- Tìm kiếm trong bảng được debounce 180 ms, giữ focus/con trỏ và gắn lại `data-label` cho thẻ mobile sau mỗi lần render.
- Dashboard lọc biểu đồ công nợ đúng cả `reportState.month` và `propertyId`.
- Cổng cư dân hiển thị màn xác minh trước khi render dữ liệu cache; khi mất kết nối không hiển thị dữ liệu riêng tư cũ.
- Nút đăng xuất cư dân gọi action `residentLogout` để thu hồi đúng phiên máy chủ.
- Tăng phiên bản cache service worker lên `huy-rooms-v4.6.1-p1-audit`.

## Tương thích

- Giữ nguyên ID và migration dữ liệu P0–P2.
- Không xóa module hoặc thay đổi cấu trúc các sheet hiện có ngoài việc bổ sung cột `slug` cho `CanTro`.
- Vẫn dùng HTML/CSS/JavaScript thuần + Vercel + Apps Script + Google Sheets.

## Triển khai bắt buộc

1. Dán `apps-script/Code.gs` mới và chạy `setup()`.
2. Deploy một **New version** của Apps Script.
3. Redeploy website lên Vercel; nếu chạy trực tiếp Apps Script, dán thêm `apps-script/Index.html` mới.

