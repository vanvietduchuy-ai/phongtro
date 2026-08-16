# v4.7.1 — Sửa lỗi đồng bộ Supabase làm MẤT dữ liệu vừa nhập

## Hiện tượng
Sau khi nhập dữ liệu: người ở vào đủ nhưng **mục Hợp đồng thuê trống trơn**, kèm thông báo
"Máy chủ từ chối lưu: depositLedger … Sổ tài chính bất biến … Dữ liệu được đồng bộ lại theo bản máy chủ".

## Nguyên nhân
Khi máy chủ từ chối một bản ghi **chưa từng tồn tại trên máy chủ**, nó trả về một bản ghi rỗng
đánh dấu đã xóa: `{ id, deleted: true }` — có ở **16 chỗ** trong `api/_supabase-core.js`.
Máy nhận bản đó rồi **áp thẳng xuống dữ liệu địa phương**, nên bản ghi người dùng vừa nhập
**bị xóa mất**. Người dùng chỉ thấy dữ liệu biến mất mà không hiểu vì sao.

Với dữ liệu nhập từ hệ thống cũ, việc bị từ chối là chuyện thường gặp: máy chủ 4.7 có luật
"mỗi phòng chỉ một hợp đồng đang mở", trong khi dữ liệu cũ có nhiều hợp đồng trùng phòng do
quá trình chuyển đổi tự sinh.

**Đo được:** 3 hợp đồng trước khi đồng bộ → còn 1 sau khi đồng bộ, **2 bản ghi bị xóa oan**.
Sau khi sửa: giữ nguyên đủ 3.

## Cách sửa (phía máy, không đụng máy chủ)
- `Sync.isPhantomTombstone()` nhận diện "bản ghi rỗng đã xóa" do từ chối: nếu trên máy vẫn đang
  có bản sống cùng mã thì đây **không phải lệnh xóa thật** → **không áp dụng**, giữ nguyên dữ liệu.
- `Sync.blockPush()` đánh dấu bản ghi vừa bị từ chối để **ngừng đẩy lại** cho tới khi người dùng
  sửa nội dung — tránh lặp vô hạn và tránh spam thông báo.
- Người dùng sửa bản ghi (nội dung đổi) → tự động được phép đẩy lên lại.
- Lệnh **xóa thật** từ máy chủ (bản ghi trên máy không có, hoặc đã đánh dấu xóa) vẫn được áp dụng
  bình thường — không làm hỏng cơ chế đồng bộ xóa.
- Áp dụng cho cả `rejected` lẫn `scopeSkipped`.
- **Chỉ bảo vệ dữ liệu gốc** (căn trọ, phòng, người ở, hợp đồng, người ở cùng, tài khoản, tài sản,
  bàn giao, dịch vụ, nhân sự, sự cố, thông báo, lịch hẹn, chỉ số điện nước).
  **KHÔNG áp dụng** cho phiếu giữ chỗ và các sổ tiền (`reservations`, `depositLedger`, `payments`,
  `invoices`): ở đó bản trên máy bắt buộc phải khớp máy chủ — khi hai thiết bị tranh nhau giữ một
  phòng, bên thua phải bị gỡ ngay, giữ lại sẽ hiện phòng đã giữ trong khi máy chủ đã trao cho người
  khác. Bộ kiểm thử p0 sẵn có của dự án bảo vệ đúng tính chất này và vẫn đạt sau khi vá.

## Thông báo cho người dùng
Thay câu "Dữ liệu được đồng bộ lại theo bản máy chủ" (gây hiểu nhầm là dữ liệu đã bị thay) bằng
thông báo gom theo bảng + lý do, và nói rõ: **"Dữ liệu trên máy vẫn còn nguyên — sửa lại rồi lưu để đẩy lên."**

## Kiểm thử
`tests/v47-sync-fix-test.js` — 10 phép thử, chạy đối chiếu trên cả bản cũ và bản sửa:
bản cũ hỏng 4 mục, bản sửa đạt 10/10. Kèm phép đo số bản ghi bị xóa oan (2 → 0).

## Giới hạn còn lại
Đây là bản vá phía máy. Gốc rễ nằm ở máy chủ: nên trả `serverRecord: null` kèm cờ
"chưa từng tồn tại" thay vì dựng bản ghi xóa giả. Khi sửa được phía máy chủ, bản vá này vẫn
tương thích và có thể giữ lại như lớp phòng vệ.
