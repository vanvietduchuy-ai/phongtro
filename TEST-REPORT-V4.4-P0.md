# Báo cáo kiểm thử v4.4 P0

Ngày kiểm thử: 2026-08-15

## Kết quả

`node tests/p0-regression.test.js` → **PASS**

Các tình huống đã chạy bằng máy chủ Google Sheets mô phỏng trong bộ nhớ:

1. Tạo phiếu giữ chỗ hợp lệ → có đúng một dòng `GiuCho`, một bút toán thu `SoCoc`, phòng chuyển `reserved`.
2. Tạo phiếu thứ hai khi phiếu cũ chưa xử lý → máy chủ từ chối; không sinh phiếu hoặc bút toán thừa.
3. Hủy phiếu và hoàn tiền → số dư phiếu về 0, phiếu đóng, phòng về `available`.
4. Thiết bị offline gửi phiếu trùng → phiếu và bút toán phụ thuộc đều bị từ chối; CRM được hoàn nguyên; phiếu hợp lệ trước đó vẫn khóa phòng.
5. Client nhận phản hồi từ chối → xóa dữ liệu local bị từ chối theo tombstone của máy chủ.
6. Action nguyên tử không nâng sai mốc `since`, tránh bỏ sót thay đổi từ thiết bị khác.

Kiểm tra build:

- `app.js`, `sync.js`, `apps-script/Code.gs`: kiểm tra cú pháp JavaScript đạt.
- `index.html`, `apps-script/Index.html`: phân tích HTML đạt.
- `python3 build-appsscript.py`: tạo lại file nhúng Apps Script thành công.

## Cần kiểm tra sau khi triển khai thật

Sau khi dán code và chạy `setup()`, nên thử một giao dịch tiền nhỏ trên deployment thật để xác nhận quyền Google Sheets/Apps Script của tài khoản triển khai. Checklist nằm trong `HUONG-DAN-CAI-DAT.md`.
