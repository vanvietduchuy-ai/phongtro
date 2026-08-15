# Test report v4.6.5 — P3 hardening

## Phạm vi

- Hồi quy toàn bộ P0/P1/P2.
- Render theo view đang hoạt động.
- Scheduler đồng bộ, offline, backoff và listener dedupe.
- Xung đột dữ liệu, gói sync bất thường và batch read.
- Trigger sao lưu idempotent, validation file khôi phục và bản an toàn trước restore.
- Cú pháp JavaScript, build Apps Script và độ khớp nguồn/build.

## Kết quả tự động

| Nhóm | Kết quả |
|---|---|
| P0 reservation/ledger/authoritative recovery | PASS |
| P1 audit, permissions, billing due date | PASS |
| P2 CRM, UX, popup, dirty form, occupant commit | PASS |
| P3 render, retry/backoff, backup/restore, scale guard | PASS |
| Tập dữ liệu 120 phòng + 1.200 hóa đơn | PASS |
| Trần 301 thay đổi trong một collection | PASS — bị từ chối đúng |
| Source web khớp nguyên vẹn trong Apps Script build | PASS |
| JavaScript syntax | PASS |

## Smoke test tĩnh

- ID modal, target nút đóng, handler `data-call` và whitelist được kiểm tra trong bộ hồi quy hiện có.
- Source web và `apps-script/Index.html` được build lại từ cùng file nguồn.
- Không có thay đổi schema/công thức nên không cần migration dữ liệu P3.

## Giới hạn xác minh

Môi trường build không có trình duyệt đồ họa, vì vậy chưa tuyên bố pixel-perfect trên thiết bị thật. Cần smoke tay sau deploy trên một desktop và một điện thoại theo checklist trong `HUONG-DAN-CAI-DAT.md`.
