# Changelog v4.6.7 — Fast sync

## Độ trễ phía trình duyệt

- Giảm debounce đẩy thay đổi từ 900 ms xuống 250 ms.
- Nhịp pull khi tab hoạt động: quản lý 6 giây, trang khách 8 giây.
- Pull ngay khi `visibilitychange`, `focus`, `pageshow` hoặc thiết bị có mạng trở lại; `pageshow` xử lý trường hợp iOS/PWA phục hồi từ back-forward cache.
- `BroadcastChannel` và tín hiệu `storage` giúp các tab cùng trình duyệt báo nhau ngay khi một tab vừa lưu thành công.
- Pull nền không có dữ liệu đẩy chạy im lặng, tránh thanh trạng thái nhấp nháy liên tục.
- Bỏ render màn quản lý đang ẩn trong lần mở trang khách đầu tiên.

## Đường nhanh Apps Script

- Guest sync không còn nạp token/ngữ cảnh quản trị.
- Poll công khai không đổi chỉ so sánh stamp `properties/rooms/leases`; không lấy ScriptLock, không gọi `nextStamp()` và không đọc sheet.
- Khi stamp đổi, request lấy lock sau đó tính lại stamp để snapshot không rơi vào giữa action nhiều bảng.
- Snapshot công khai chỉ trả căn/phòng, xóa ghi chú nội bộ, bổ sung ngày sắp trống và cache 120 giây theo stamp.
- Admin pull không có thay đổi cục bộ dùng đường chỉ đọc riêng, không tạo stamp và không quét CRM/hợp đồng toàn bảng.
- `setup()` chạy `initializeCollectionStamps()` để dữ liệu cũ dùng được đường skip theo stamp ngay sau nâng cấp.

## Mạng và gateway

- Fetch phía trình duyệt dùng `cache: no-store` và timeout 20 giây.
- Cầu nối Vercel dừng upstream sau 18 giây và trả lỗi rõ ràng để scheduler tự retry, không để UI kẹt “Đang đồng bộ…”.
- Response gateway bổ sung `Server-Timing` để đo riêng thời gian Apps Script khi cần chẩn đoán.

## Tương thích

- Không đổi schema, ID, công thức, API nghiệp vụ hoặc kiến trúc Vercel + Apps Script + Google Sheets.
- Giữ nguyên toàn bộ hàng rào vòng đời và trạng thái phòng của v4.6.6.
