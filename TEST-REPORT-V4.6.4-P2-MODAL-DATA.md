# Báo cáo kiểm thử Huy Rooms v4.6.4 — P2 popup và nhập liệu

Ngày kiểm thử: 2026-08-15 (Asia/Bangkok)

## Phạm vi

1. Quản lý vòng đời popup, khóa cuộn nền, lớp phủ và kích thước `modal-wide`.
2. Bảo vệ form chưa lưu và chặn đóng khi thao tác đang xử lý.
3. Focus đầu, vòng Tab/Shift+Tab và trả focus sau khi đóng.
4. Hàng nhiều nút trên màn hình nhỏ.
5. Không chèn hồ sơ người ở mới trước khi kiểm tra sức chứa.
6. Số lượng tài sản tối thiểu 1.
7. Chạy lại toàn bộ hồi quy P0, P1, P1 audit, phân quyền, P2 và P2 UX.

## Kết quả

| Kiểm thử | Kết quả |
|---|---|
| `node tests/p0-regression.test.js` | PASS |
| `node tests/p1-regression.test.js` | PASS |
| `node tests/p1-audit-regression.test.js` | PASS |
| `node tests/p1-permission-regression.test.js` | PASS |
| `node tests/p2-regression.test.js` | PASS |
| `node tests/p2-ux-regression.test.js` | PASS |
| `node tests/p2-modal-data-regression.test.js` | PASS |
| `node --check app.js` | PASS |
| `node --check sync.js` | PASS |
| `node --check p2.js` | PASS |
| `node --check api/sheets.js` | PASS |
| Parse `index.html` | PASS |
| Build và parse `apps-script/Index.html` | PASS |

## Ghi chú

Bộ test khóa các lỗi popup và chèn dữ liệu ở mức mã nguồn/logic. Sau khi deploy nên mở thử trên iPhone và desktop để xác nhận cảm giác cuộn, bàn phím ảo và vùng an toàn theo thiết bị thật.
