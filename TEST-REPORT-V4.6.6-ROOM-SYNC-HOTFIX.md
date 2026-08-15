# Test report v4.6.6 — Room sync hotfix

## Phạm vi xác minh

- Xung đột hai phiên và tính đơn điệu của `baseStamp`.
- Lưu trữ/xóa căn, phòng, người đại diện khi còn vòng đời mở.
- Ưu tiên trạng thái `occupied` / `reserved` / `maintenance` / `available`.
- Hợp đồng nháp đã hoàn hết cọc.
- Tự sửa dữ liệu hợp đồng sống bị mất người đại diện hiện tại.
- Hồi quy toàn bộ P0, P1, P2 và P3; cú pháp JavaScript và độ khớp Apps Script build.

## Kết quả

| Nhóm | Kết quả |
|---|---|
| P0 reservation, ledger, authoritative recovery | PASS |
| P1 lifecycle, audit, permissions | PASS |
| P2 CRM, UX, popup và nhập liệu | PASS |
| P3 render, retry, backup/restore, scale guard | PASS |
| V4.6.6 sync timestamp monotonic | PASS |
| Chặn half-state tenant/lease/occupant | PASS |
| Chặn archive căn/phòng còn vòng đời mở | PASS |
| Ưu tiên trạng thái và no-op reconcile | PASS |
| Refunded draft không khóa phòng | PASS |
| Migration tự sửa idempotent | PASS |
| JavaScript syntax + Apps Script build | PASS |

Tổng cộng: **9 tệp kiểm thử, tất cả PASS**.

## Giới hạn xác minh

Môi trường build không có trình duyệt đồ họa, vì vậy việc căn chỉnh pixel và thao tác cảm ứng cần smoke test tay sau deploy trên một desktop và một điện thoại. Logic popup, liên kết control, handler và cấu trúc giao diện tiếp tục được kiểm tra tĩnh trong các bộ hồi quy hiện có.
