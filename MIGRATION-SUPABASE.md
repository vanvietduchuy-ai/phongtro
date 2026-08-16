# Migration Supabase/Postgres — v4.7.0 đã triển khai

Supabase là nguồn dữ liệu chính. Google Sheets/Apps Script được giữ nguyên để đối chiếu, xuất nhập và rollback trong ít nhất 3 tháng; không còn nằm trên đường đồng bộ hằng ngày của website Vercel.

## Kiến trúc

- `huy_private.records`: dữ liệu theo `collection + id`, giữ nguyên toàn bộ ID v4.6.7.
- `huy_private.clock`: revision toàn cục tăng đơn điệu.
- `public.huy_sync_signals`: chỉ có revision, được Realtime phát cho trình duyệt; không có ID hay nội dung nghiệp vụ.
- `/api/supabase`: API Vercel giữ secret key, phân quyền, lọc DTO công khai/cư dân, xử lý conflict và action nhiều bảng.
- `huy-private` / `huy-public`: hai bucket Storage tách hồ sơ riêng tư và ảnh công khai.
- Google Sheets: bản đối chiếu/rollback; không dual-write mù quáng vì có thể tạo hai nguồn sự thật.

Luồng thay đổi:

1. Máy A gửi delta tới `/api/supabase`.
2. API đọc revision, kiểm tra quyền/xung đột/bất biến, rồi gọi một RPC transaction.
3. Postgres ghi tất cả collection và cập nhật `huy_sync_signals` trong cùng transaction.
4. Realtime đánh thức máy B; máy B kéo delta đúng quyền ngay lập tức.
5. Poll 6–8 giây chỉ còn là đường dự phòng; khi Realtime khỏe, poll kiểm tra toàn vẹn mỗi 30 giây.

## Bất biến được giữ

- Trạng thái phòng: `occupied > reserved > maintenance > available`.
- Hợp đồng nháp chỉ khóa phòng khi sổ cọc còn tiền đang giữ.
- Không lưu trữ/xóa phòng/căn còn hợp đồng, giữ chỗ hoặc người ở.
- Không ngừng người thuê chính khi hợp đồng còn hiệu lực.
- Một chỉ số điện nước cho mỗi `roomId + month`.
- `payments` và `depositLedger` append-only; hoàn/đảo tạo bút toán mới.
- `createReservation`, `cancelReservation`, nhận/chuyển/trả phòng ghi nhiều collection trong một transaction CAS.
- Client cũ không thể xóa `pinHashV2/passHashV2` khi sửa hồ sơ vì API giữ trường server-only.

## Chạy migration

Thực hiện đúng quy trình trong `HUONG-DAN-SUPABASE-REALTIME.md`. Tóm tắt:

1. Tải JSON sao lưu từ v4.6.7 và sao lưu spreadsheet.
2. Chạy `supabase/schema.sql`.
3. Khai báo biến môi trường Vercel.
4. Deploy preview v4.7.0.
5. Chạy `node scripts/import-supabase.mjs ...`.
6. Chạy `node scripts/verify-supabase.mjs ...` và đối chiếu số phòng, hóa đơn, sổ thu, sổ cọc.
7. Chỉ promote Production khi tất cả khớp.

Importer idempotent: chạy lại cùng một file sẽ trả `alreadyUpToDate`; dữ liệu khác bị chặn trừ khi có `--force`.

## Rollback

1. Trước rollback, chạy `scripts/export-supabase.mjs`.
2. Giữ file JSON Supabase cùng bản copy Google Sheets.
3. Redeploy bản v4.6.7 và đổi `config.js` về `/api/sheets`.
4. Nạp phần phát sinh từ file JSON vào một bản copy Sheets, đối chiếu tài chính rồi mới thay bản chính.

Không chạy `--force`, không xóa project Supabase và không xóa spreadsheet nếu chưa có cả hai bản backup đã kiểm tra đọc được.
