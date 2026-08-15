# Báo cáo kiểm thử Huy Rooms v4.6.1 — P1 audit fixes

Ngày kiểm thử: 2026-08-15 (Asia/Ho_Chi_Minh)

## Phạm vi mới

1. Slug căn trọ được lưu/đọc lại từ schema máy chủ.
2. API giờ trống chỉ trả `busyTimes`, loại lead đã đóng và không lộ số điện thoại.
3. Phòng đang thuê lâu dài bị từ chối đặt lịch; phòng có ngày sắp trống được phép kiểm tra lịch.
4. Đăng nhập cục bộ lưu quyền nhưng không dùng cờ đó để vượt đăng nhập online.
5. Tìm kiếm debounce, giữ focus; bảng mobile gắn lại nhãn sau render.
6. Công nợ theo đúng tháng/căn; cư dân chỉ render sau xác minh và đăng xuất có thu hồi phiên.

## Lệnh kiểm thử

| Kiểm thử | Kết quả |
|---|---|
| `node tests/p0-regression.test.js` | PASS |
| `node tests/p1-regression.test.js` | PASS |
| `node tests/p2-regression.test.js` | PASS |
| `node tests/p1-audit-regression.test.js` | PASS |
| `node --check app.js` | PASS |
| `node --check sync.js` | PASS |
| `node --check p2.js` | PASS |
| `node --check api/sheets.js` | PASS |
| Parse `index.html` | PASS |
| `python3 build-appsscript.py` | PASS |
| Parse `apps-script/Index.html` | PASS |

## Giới hạn

Bộ test xác nhận logic máy chủ trong bộ nhớ và kiểm tra tĩnh mã giao diện. Sau khi deploy cần smoke test trên URL production với hai trình duyệt/thiết bị để xác nhận cạnh tranh đặt lịch thật, session Apps Script và responsive thực tế.

