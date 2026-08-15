# Huy Rooms v4.5 P1

## Vòng đời hợp đồng

- Nhận phòng, chuyển phòng, trả phòng và hủy hợp đồng nháp chạy bằng action máy chủ có `ScriptLock`; các sheet liên quan dùng chung một mốc ghi.
- Chặn nhận phòng trùng, chuyển vào phòng bảo trì/đã giữ/đã có hợp đồng, vượt sức chứa và ngày hiệu lực không hợp lệ.
- Chuyển phòng có biên bản bàn giao phòng cũ và phòng mới, giữ lịch sử phòng và lịch sử giá.
- Thanh lý bắt buộc lý do; nếu trừ cọc phải có nội dung đối chiếu. Giao dịch lặp không tạo thêm bút toán.

## Người ở và tiền cọc

- Tách rõ màn “Người ở & tài khoản”; một hợp đồng có nhiều người ở nhưng đúng một đại diện thanh toán.
- Không cho trả/chuyển phòng hoặc sửa số cọc từ form hồ sơ người ở; phải dùng nghiệp vụ hợp đồng.
- Số cọc đang giữ luôn tính từ `SoCoc` (`collect - refund - deduct`). Không thể giảm cọc bằng cách sửa hợp đồng.
- Hợp đồng nháp còn số dư cọc không thể hủy hoặc xóa.

## Hồ sơ và trải nghiệm quản lý

- Gắn PDF/ảnh riêng tư vào hợp đồng; file được kiểm tra chữ ký thật, giới hạn 6MB và kiểm tra quyền theo căn ở máy chủ.
- Danh sách hợp đồng có tìm kiếm, lọc, sắp xếp và phân trang.
- Sửa các nút “Sao chép hóa đơn”, “Sửa hợp đồng”, “Hủy hợp đồng” và “Thu/Hoàn cọc” từng bị sai thuộc tính sự kiện.
- Các thao tác hợp đồng nhạy cảm chỉ hiện với vai trò có quyền; hồ sơ hợp đồng chỉ chủ nhà/quản lý được mở.
