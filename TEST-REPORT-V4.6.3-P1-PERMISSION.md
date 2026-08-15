# Báo cáo kiểm thử Huy Rooms v4.6.3 — P1 phân quyền

Ngày kiểm thử: 2026-08-15 (Asia/Bangkok)

## Phạm vi

1. Ma trận quyền Owner / Manager / Accountant / Staff giữa client và Apps Script.
2. Nút nhanh desktop, FAB mobile và hành động trong từng module.
3. Guard tại hàm mở form, submit và handler thay đổi dữ liệu.
4. Quyền đặc biệt chỉ Owner hoặc Owner/Manager.
5. Hạn thanh toán hóa đơn lẻ và hàng loạt.
6. Chạy lại toàn bộ hồi quy P0, P1, P1 audit, P2 và P2 UX.

## Kết quả

| Kiểm thử | Kết quả |
|---|---|
| `node tests/p0-regression.test.js` | PASS |
| `node tests/p1-regression.test.js` | PASS |
| `node tests/p1-audit-regression.test.js` | PASS |
| `node tests/p1-permission-regression.test.js` | PASS |
| `node tests/p2-regression.test.js` | PASS |
| `node tests/p2-ux-regression.test.js` | PASS |
| `node --check app.js` | PASS |
| `node --check sync.js` | PASS |
| `node --check p2.js` | PASS |
| `node --check api/sheets.js` | PASS |
| Parse `index.html` | PASS |
| Build và parse `apps-script/Index.html` | PASS |

## Ghi chú

Bộ test xác nhận logic và cấu trúc quyền ở mức mã nguồn/server giả lập. Sau khi deploy vẫn nên đăng nhập thử bốn vai trò trên URL production để kiểm tra phiên, cache và giao diện thực tế của thiết bị.
