# Huy Rooms v4.6.3 — bản vá P1 phân quyền và hạn hóa đơn

Ngày hoàn thành: 2026-08-15 (Asia/Bangkok)

## Đã sửa

1. Thêm cổng quyền dùng chung tại handler: `requireCan`, `requireOwnerManager`, `requireOwner`.
2. Ẩn hoặc khóa hành động ngoài quyền ở topbar, FAB mobile, căn/phòng, người ở, điện nước, hóa đơn, CRM, sự cố, thông báo, hợp đồng và cài đặt.
3. Chặn trực tiếp tại hàm mở form, submit và hàm thay đổi dữ liệu; không còn lưu cục bộ trước rồi chờ máy chủ từ chối.
4. Kế toán không thể sửa căn/phòng/người ở/điện nước/CRM/sự cố; Nhân viên không thể sửa căn/phòng/người ở/hóa đơn/dịch vụ/hợp đồng.
5. Chỉ Chủ nhà/Quản lý được giữ chỗ, lập/chuyển/trả phòng và mở khóa kỳ điện nước; chỉ Chủ nhà được quản lý nhân sự, đổi mật khẩu chủ và khôi phục dữ liệu.
6. Hóa đơn lẻ dùng `dueDateForMonth(month, billingDay)` giống hóa đơn hàng loạt.
7. Đổi nhãn cài đặt thành “Ngày thu hàng tháng mặc định (1–28)” để đúng bản chất dữ liệu.
8. Tăng phiên bản cache service worker thành `huy-rooms-v4.6.3-p1-permission`.

## Tương thích

- Không đổi ID dữ liệu, schema, sheet hay API.
- Giữ nguyên chống trùng chỉ số phòng + tháng, đồng bộ trạng thái phòng/người ở, form hóa đơn tải lại theo phòng/tháng và các transaction giữ chỗ/nhận/chuyển/trả phòng.
- Cần build lại `apps-script/Index.html` và deploy Apps Script bằng **New version**.
