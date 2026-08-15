# Huy Rooms v4.6.2 — hoàn thiện P2 giao diện

Ngày: 2026-08-15

## Đã sửa

- Sắp xếp lại dashboard theo thứ tự: KPI cần chú ý → việc cần xử lý → KPI tham khảo → biểu đồ.
- Tách 10 KPI thành hai tầng để giảm tải nhận thức nhưng giữ nguyên công thức và bộ lọc tháng/căn.
- Đưa công nợ, đã thu, tỷ lệ lấp đầy, khách mới và sự cố vào nhóm chỉ số chính.
- Đổi hành động nhanh desktop sang Người ở, Ghi điện nước và Lập hóa đơn; giữ Tìm nhanh Ctrl/Cmd+K.
- Đổi nhãn điều hướng `Lịch hẹn` thành `Khách & lịch hẹn` ở sidebar, tiêu đề trang và menu mobile.
- Sửa tab cổng cư dân sticky theo đúng tổng chiều cao thanh đồng bộ và header trên màn hình hẹp.
- Bổ sung `aria-label="Đóng"` cho 8 modal cũ; toàn bộ nút đóng modal nay đều có tên truy cập.
- Tăng cỡ chữ badge mobile, nhãn bảng phòng, tiện nghi, mô tả 3 bước và chú thích form quan trọng.
- Tăng phiên bản cache service worker lên `huy-rooms-v4.6.2-p2-ux`.

## Tương thích

- Giữ nguyên toàn bộ logic, schema, migration và API P0/P1/P2 của v4.6.1.
- Không thêm sheet/cột; nâng từ v4.6.1 không cần chạy lại `setup()`.
- Vẫn dùng HTML/CSS/JavaScript thuần + Vercel + Apps Script + Google Sheets.

## Triển khai

1. Redeploy toàn bộ thư mục web lên Vercel.
2. Nếu chạy trực tiếp Apps Script, dán `apps-script/Index.html` mới và deploy **New version**.
3. Tải lại trang một lần để nhận service worker mới.
