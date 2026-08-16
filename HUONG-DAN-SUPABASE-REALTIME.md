# Hướng dẫn triển khai Huy Rooms v4.7.0 Supabase Realtime

## 1. Chuẩn bị an toàn

Trên website v4.6.7 đang dùng:

1. Vào **Cài đặt → Tải file sao lưu** và lưu JSON.
2. Tạo một bản copy spreadsheet Google Sheets.
3. Ghi lại tổng số căn, phòng, hợp đồng, hóa đơn; tổng sổ thu và số dư sổ cọc.
4. Không thao tác dữ liệu trong khoảng chuyển production cuối cùng (thường 5–10 phút).

## 2. Tạo Supabase

1. Tạo project gần khu vực người dùng nhất.
2. Mở **SQL Editor**.
3. Dán toàn bộ `supabase/schema.sql` và bấm **Run**.
4. Kiểm tra:
   - schema `huy_private` có `records`, `clock`, `auth_state`, `audit_log`;
   - bảng public `huy_sync_signals` có đúng một dòng `app`;
   - Realtime publication có `huy_sync_signals`;
   - Storage có bucket `huy-public` và `huy-private`.

`schema.sql` chạy lặp được và không xóa dữ liệu.

## 3. Biến môi trường Vercel

Khai báo cho Preview trước, sau khi kiểm tra mới khai báo Production:

| Tên | Giá trị | Có lộ ra trình duyệt? |
|---|---|---|
| `SUPABASE_URL` | Project URL | Có, qua config Realtime |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (hoặc anon key cũ) | Có; chỉ đọc signal |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (hoặc service_role cũ) | Không |
| `HUY_ADMIN_PASSWORD` | Mật khẩu chủ nhà ban đầu, ít nhất 10 ký tự | Không |
| `HUY_MIGRATION_KEY` | Chuỗi ngẫu nhiên dài ít nhất 32 ký tự | Không |
| `HUY_WRITE_KEY` | Tùy chọn, chỉ tương thích công cụ cũ | Không |
| `ZALO_OA_TOKEN` | Tùy chọn, chỉ khi gửi Zalo OA tự động | Không |
| `ZALO_OA_API_URL` | Tùy chọn khi Zalo thay endpoint mặc định | Không |
| `APPS_SCRIPT_URL` | Tùy chọn trong 3 tháng chuyển đổi, để đọc tệp Drive cũ | Không |
| `APPS_SCRIPT_WRITE_KEY` | Tùy chọn; write key cũ dùng riêng cho media legacy | Không |

Không đặt secret/service-role key trong `config.js`, HTML, localStorage hoặc biến `VITE_*`.

## 4. Deploy Preview và kiểm tra kết nối

Deploy thư mục này lên Vercel. Mở:

`https://TEN-PREVIEW.vercel.app/api/supabase?action=config`

Kết quả đúng có `ok:true`, `enabled:true`, URL, publishable key và tên bảng signal. Kết quả này tuyệt đối không có secret key.

## 5. Nhập dữ liệu

Từ thư mục dự án:

```bash
node scripts/import-supabase.mjs huy-rooms-backup-v4.1.json \
  --url https://TEN-PREVIEW.vercel.app \
  --key "HUY_MIGRATION_KEY"
```

Chạy lại cùng file là an toàn. Nếu Supabase có dữ liệu khác, importer dừng. Chỉ dùng `--force` sau khi đã xuất backup Supabase và hiểu rõ dữ liệu nào sẽ được ghi đè.

## 6. Đối chiếu bắt buộc

```bash
node scripts/verify-supabase.mjs \
  --url https://TEN-PREVIEW.vercel.app \
  --password "MAT_KHAU_CHU_NHA"
```

Đối chiếu với JSON và Google Sheets:

- số `properties`, `rooms`, `tenants`, `leases`, `invoices`;
- tổng `payments.amount` theo `kind=payment` trừ bút toán đảo;
- số dư cọc = `collect - refund - deduct`;
- phòng có hợp đồng active/ending phải là `occupied`;
- phòng có reservation active hoặc hợp đồng nháp còn cọc phải là `reserved`.

Sai một con số tài chính thì dừng, không promote Production.

## 7. Thử Realtime hai thiết bị

1. Mở trang quản lý ở máy A và trang khách/ẩn danh ở máy B.
2. Máy A đổi giá hoặc trạng thái bảo trì của một phòng trống.
3. Máy B phải tự cập nhật mà không tải lại trang; thông thường dưới 1 giây sau khi transaction hoàn tất.
4. Mở DevTools → Network: lượt ghi đi tới `/api/supabase`, không đi `/api/sheets`.
5. Tắt mạng máy B, sửa trên A, bật mạng B: máy B phải tự kéo bù delta.
6. Cho hai máy sửa cùng một hóa đơn: máy cũ phải nhận cảnh báo conflict, không âm thầm ghi đè.

## 8. Promote Production

1. Dừng thao tác 5–10 phút.
2. Tải JSON v4.6.7 lần cuối.
3. Import file cuối vào Preview; đối chiếu lại.
4. Đặt cùng biến môi trường cho Production và promote deployment đã kiểm tra.
5. Đăng nhập lại trên từng máy vì token Apps Script cũ không dùng cho Supabase.
6. Đặt lại mật khẩu nhân viên và PIN cư dân khi cần; hash cũ trong Script Properties không thể xuất an toàn từ JSON giao diện.

Giữ spreadsheet và deployment Apps Script ít nhất 3 tháng.

Nếu dữ liệu cũ có ảnh công tơ/hồ sơ hợp đồng `priv:` trên Google Drive, giữ `APPS_SCRIPT_URL` và `APPS_SCRIPT_WRITE_KEY` trong giai đoạn này. Dữ liệu mới vẫn lưu ở Supabase Storage; Apps Script chỉ được gọi khi mở/xóa đúng một tệp legacy.

## 9. Backup và rollback

Xuất Supabase định kỳ hoặc trước thay đổi lớn:

```bash
node scripts/export-supabase.mjs \
  --url https://TEN-MIEN.vercel.app \
  --key "HUY_MIGRATION_KEY" \
  --out huy-rooms-supabase-backup.json
```

File này chứa dữ liệu quản trị và hash xác thực; lưu ở nơi riêng tư.

Rollback khẩn cấp:

1. Xuất Supabase như trên.
2. Redeploy gói v4.6.7 đã lưu.
3. Đổi API về `/api/sheets` và giữ `APPS_SCRIPT_URL` cũ.
4. Nạp dữ liệu phát sinh từ Supabase vào một bản copy Sheets, đối chiếu rồi mới thay production.

## 10. Ngưỡng vận hành

- Realtime khỏe: delta được kéo theo sự kiện; poll toàn vẹn mỗi 30 giây.
- Realtime rớt: poll dự phòng 6 giây quản lý / 8 giây khách.
- Lỗi server: backoff lũy tiến tối đa 5 phút, không tạo bão request.
- Một collection tối đa 300 bản ghi trong một lượt push.
- Ảnh/tệp tối đa 3 MB để nằm dưới giới hạn request/response serverless; chỉ JPG, PNG, WEBP, PDF.
