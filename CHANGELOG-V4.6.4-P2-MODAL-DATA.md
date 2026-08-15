# Huy Rooms v4.6.4 — hoàn thiện P2 popup, bố cục và nhập liệu

Ngày hoàn thành: 2026-08-15 (Asia/Bangkok)

## Đã sửa

1. Chuẩn hóa lớp phủ cho toàn bộ popup cũ/mới; bấm vùng ngoài popup có hành vi đóng thống nhất.
2. Bổ sung kích thước thật cho `modal-wide` để bảng hóa đơn hàng loạt, sổ thu, hợp đồng, bàn giao và tài sản không bị bó hẹp.
3. Khóa cuộn nền khi popup mở; hàng nhiều nút tự xuống dòng và chuyển thành nút toàn chiều rộng trên điện thoại nhỏ.
4. Bảo vệ dữ liệu chưa lưu: X, Hủy, vùng ngoài và Escape đều đi qua `requestCloseModal`; nếu form đã thay đổi phải xác nhận trước khi bỏ.
5. Không cho đóng popup khi nút đang ở trạng thái xử lý, tránh ghi dữ liệu nửa chừng.
6. Focus tự vào ô nhập đầu tiên, Tab/Shift+Tab không thoát khỏi popup, đóng xong trả focus về đúng vị trí trước đó.
7. Sửa lỗi hồ sơ người ở mới bị chèn sớm trước khi kiểm tra sức chứa; chỉ commit sau khi form hợp lệ.
8. Số lượng tài sản khi sửa luôn tối thiểu 1.
9. Thêm bộ hồi quy `tests/p2-modal-data-regression.test.js`.
10. Tăng cache service worker thành `huy-rooms-v4.6.4-p2-modal-data`.

## Tương thích

- Không đổi ID dữ liệu, schema, sheet hay API.
- Giữ nguyên ma trận quyền v4.6.3 và toàn bộ transaction giữ chỗ/nhận/chuyển/trả phòng.
- Cần build lại `apps-script/Index.html` và deploy Apps Script bằng **New version**.
