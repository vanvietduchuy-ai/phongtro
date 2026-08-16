# Changelog v4.7.0 — Supabase Realtime

## Kết quả chính

- Supabase/Postgres là nguồn dữ liệu chính cho toàn bộ collection v4.6.7.
- Đồng bộ delta theo revision, index `(updated_at_ms, collection)`; lượt không đổi không đọc snapshot.
- Realtime phát bảng signal không chứa dữ liệu; client nhận event và kéo DTO qua API Vercel.
- Poll dự phòng vẫn 6 giây quản lý / 8 giây khách; Realtime khỏe thì kiểm tra toàn vẹn mỗi 30 giây.
- Backend được version hóa `supabase-v1`, tự bỏ `/api/sheets` và token Apps Script cũ trên trình duyệt khi nâng cấp.

## An toàn dữ liệu

- RPC `huy_commit_batch` dùng global CAS revision và transaction cho gói nhiều collection.
- Optimistic concurrency trả bản máy chủ authoritative, không last-write-wins im lặng.
- Sổ thu/sổ cọc append-only; đảo thanh toán tạo bút toán âm, bản gốc chỉ thêm metadata `reversedAt/reversalReason`.
- Reconcile phòng giữ ưu tiên `occupied > reserved > maintenance > available`.
- Cọc của reservation đã chuyển sang hợp đồng vẫn được tính vào số dư hợp đồng nháp.
- Chặn archive căn/phòng còn vòng đời mở, ngừng người thuê chính, xóa lease active, trùng điện nước/hóa đơn.
- Nhận/chuyển/trả phòng và giữ/hủy giữ chỗ chạy transaction CAS.

## Xác thực và phân quyền

- Secret key chỉ ở API Vercel; frontend chỉ nhận publishable key để đọc một signal RLS.
- Owner/staff password và PIN dùng PBKDF2-SHA256; private fields không được trả về client.
- Backend migration thu hồi token Apps Script cũ; staff role/phạm vi được kiểm tra lại từ DB trên mỗi request.
- Đổi PIN làm phiên cư dân cũ mất hiệu lực bằng `pinVersion`, kể cả khi cleanup session bị gián đoạn.
- DTO cư dân chỉ gồm đúng hợp đồng/phòng/hóa đơn/sự cố/tệp được phép.

## Media và migration

- Ảnh công khai: bucket `huy-public`; ảnh nghiệp vụ/hồ sơ: `huy-private`.
- Tệp giới hạn 3 MB để tải lên/tải xuống an toàn qua Vercel serverless.
- Tệp Drive cũ tiếp tục đọc/xóa qua Apps Script khi cấu hình hai biến legacy; dữ liệu mới không đi Apps Script.
- Import JSON giữ nguyên ID, băm PIN rõ cũ, idempotent với cùng file và chặn dữ liệu khác nếu không `--force`.
- Có script import, export, verify và quy trình preview → đối chiếu → production → rollback.
