# Changelog v4.6.6 — Room sync hotfix

## Đồng bộ nhiều thiết bị

- `applyRemote()` chỉ nhận bản ghi có `updatedAt` mới hơn mốc máy chủ đã áp dụng; bản `serverRecord` cũ trong conflict/rejected không thể làm `baseStamp` lùi.
- Bản ghi xóa giữ lại mốc tombstone để response cũ không làm sống lại dữ liệu.
- `reconcileRoomServer()` không ghi lại phòng nếu trạng thái không đổi, giảm stamp thừa và loại nguyên nhân tạo conflict lặp.

## Bất biến vòng đời

- Giao diện chặn lưu trữ/xóa căn, phòng hoặc người đại diện khi còn hợp đồng nháp/hiệu lực, giữ chỗ hoặc người ở hoạt động.
- Máy chủ áp cùng hàng rào để bảo vệ trước client cũ hoặc payload gửi trực tiếp.
- Không còn kết thúc hợp đồng bằng cách sửa rời `lease`, `tenant` và `leaseOccupant`; người dùng được hướng tới Hủy hợp đồng, Chuyển đại diện hoặc Trả phòng/Thanh lý.
- `setup()` gọi `repairLifecycleIntegrity()` để phục hồi idempotent dữ liệu cũ từng có hợp đồng sống nhưng người đại diện đã inactive/rời liên kết.

## Trạng thái phòng và sổ cọc

- Thứ tự nguồn sự thật: hợp đồng/người ở đang hoạt động → `occupied`; phiếu giữ chỗ/hợp đồng nháp còn cọc → `reserved`; nếu không mới giữ `maintenance` hoặc về `available`.
- Phòng có hợp đồng/giữ chỗ không thể bị trạng thái bảo trì che khuất, nên KPI lấp đầy không bị giảm sai.
- Mọi kiểm tra hợp đồng nháp dùng số dư `collect - refund - deduct` từ sổ cọc, có tính cả bút toán mới trong cùng gói sync.
- Hợp đồng nháp đã hoàn/trừ hết cọc không còn khóa phòng chỉ vì trường tương thích `depositPaid` từng lớn hơn 0.

## Tương thích và vận hành

- Không đổi schema Google Sheets, API, công thức hóa đơn hay kiến trúc triển khai.
- Thêm test hồi quy `tests/v4.6.6-room-sync-hotfix.test.js`.
- Tài liệu nói rõ giới hạn sửa tay Google Sheet đối với trường vòng đời và tài chính.
