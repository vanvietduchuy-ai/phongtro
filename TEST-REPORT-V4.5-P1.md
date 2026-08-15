# Báo cáo kiểm thử v4.5 P1

Ngày kiểm thử: 2026-08-15

## Kết quả tự động

- `node tests/p0-regression.test.js` → PASS.
- `node tests/p1-regression.test.js` → PASS.
- Kiểm tra cú pháp `app.js`, `sync.js`, `apps-script/Code.gs` → PASS.
- Phân tích `index.html` và `apps-script/Index.html` → PASS.
- `python3 build-appsscript.py` → tạo bản Apps Script nhúng thành công.

## Tình huống P1 đã kiểm thử

1. Nhận phòng cập nhật cùng lúc hợp đồng, trạng thái phòng, hồ sơ người ở, liên kết người ở và biên bản bàn giao.
2. Chuyển phòng giải phóng phòng cũ, chiếm phòng mới, đổi phòng của người ở, lưu giá mới và hai biên bản bàn giao.
3. Thanh lý lấy số dư từ sổ cọc, ghi riêng bút toán trừ và hoàn, đóng người ở và giải phóng phòng.
4. Gửi lại yêu cầu thanh lý không sinh giao dịch cọc trùng.
5. Từ chối nhận phòng khi phòng có hợp đồng hiệu lực khác.
6. Từ chối hủy hợp đồng nháp khi còn tiền cọc đang giữ.
7. Toàn bộ kiểm thử P0 về giữ chỗ và phục hồi client tiếp tục đạt.

## Cần thử sau khi deploy thật

- Tải một PDF nhỏ lên hồ sơ hợp đồng, mở lại bằng một tài khoản quản lý đúng phạm vi căn và thử bằng vai trò không có quyền.
- Thực hiện một chuỗi nhận → chuyển → trả phòng trên deployment Apps Script thật để xác nhận quyền Google Sheets/Drive.
- Xác nhận thư mục hồ sơ hợp đồng trên Drive vẫn ở chế độ riêng tư.
