# Huy Rooms v4.6 P2

## Mục tiêu

Hoàn thiện lớp trải nghiệm vận hành trên nền P0/P1 mà không thay đổi nguồn dữ liệu, không phá luồng giữ chỗ và không làm sai sổ cọc/hợp đồng.

## Thay đổi chính

### Cổng cư dân

- Giữ đầy đủ QR VietQR, tải/in PDF hóa đơn, lịch sử thanh toán, đổi PIN, đăng xuất mọi thiết bị, báo sự cố kèm ảnh, timeline xử lý và thông báo.
- Bổ sung đúng các trường DTO cư dân cho chi tiết hóa đơn, dịch vụ, bàn giao, tài sản, thanh toán và sổ cọc; PDF của phiên cư dân dùng đúng cấu hình ngân hàng do máy chủ trả về.
- Thay emoji nghiệp vụ chính bằng icon SVG, tăng cỡ chữ nhỏ và vùng bấm.
- Modal có `role=dialog`, `aria-modal`, trả focus về nút mở và đóng bằng Escape; toast có vùng thông báo screen reader.

### CRM và lịch hẹn

- Chuẩn hóa phễu đúng 7 bước: `new → contacted → appointment_confirmed → viewed → reserved → converted → lost`.
- Dữ liệu cũ `lease_draft` tự chuyển về `viewed`; hợp đồng nháp được nhận biết bằng `convertedLeaseId`, không làm phát sinh tầng báo cáo thứ tám.
- Thêm tìm kiếm theo tên/SĐT/phòng/ghi chú, lọc trạng thái, khoảng ngày và phân trang 10 dòng.
- Thêm phễu số lượng trực quan theo từng trạng thái.
- Đổi lịch dùng action máy chủ `rescheduleAppointment` có `ScriptLock`, kiểm tra phạm vi căn, ngày/giờ làm việc, trạng thái và chống trùng phòng/ngày/giờ trước khi ghi.
- Mọi lần đổi lịch ghi vào `careLog` và nhật ký audit.

### Dashboard

- Tỷ lệ lấp đầy chỉ tính phòng `occupied`; phòng `reserved` hiển thị riêng.
- Sự cố chưa xử lý hiển thị tổng số, đồng thời cảnh báo số việc mở quá 3 ngày.
- Khối việc hôm nay có thêm các sự cố đang mở.
- Giữ tách biệt doanh thu thực thu/dự kiến, công nợ và tiền cọc.

### Trang phòng công khai

- Giữ URL riêng theo slug, ngày có thể vào ở, tiện nghi, chính sách, nút Gọi/Zalo/Đặt lịch.
- Thêm liên kết Google Maps từ địa chỉ căn.
- Gallery mới có ảnh lớn, đếm ảnh, thumbnail, nút trước/sau và phím mũi tên trái/phải.

### An toàn và cấu trúc

- Tách quy tắc P2 thuần sang `p2.js` để giảm dần trách nhiệm của `app.js` và cho phép kiểm thử riêng.
- Chế độ khôi phục dữ liệu mẫu bị khóa tuyệt đối khi đã kết nối máy chủ.
- Service worker lên cache `huy-rooms-v4.6-p2` và thêm `p2.js` vào app shell.
- Không thêm database/sheet/cột mới; migration dữ liệu cũ chạy idempotent.

## Nâng cấp

Nâng từ v4.5 P1 không cần đổi cấu trúc Sheet. Phải deploy một **New version** của Apps Script để action đổi lịch mới hoạt động, rồi redeploy website để có `p2.js`, giao diện và service worker P2.
