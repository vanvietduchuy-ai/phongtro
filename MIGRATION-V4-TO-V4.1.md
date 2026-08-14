# Nâng cấp v4 production → v4.1 (KHÔNG mất dữ liệu)

Toàn bộ sheet, tên sheet, công thức tính tiền GIỮ NGUYÊN. Không có cột bắt buộc mới; migration idempotent.

## Bước 1 — Apps Script
1. Mở project Apps Script hiện tại → dán đè `Code.gs` và `Index.html` mới.
2. Run hàm `setup` một lần (bổ sung sheet/cột còn thiếu nếu có — chạy lại vô hại).
3. **Deploy → Manage deployments → Edit → New version** (giữ nguyên URL /exec cũ).

## Bước 2 — Vercel
- Đẩy code mới (git push hoặc `vercel --prod`). Biến môi trường `APPS_SCRIPT_URL` giữ nguyên.

## Bước 3 — Sau nâng cấp, ai phải làm gì
| Ai | Việc | Vì sao |
|---|---|---|
| Cư dân | Đăng nhập lại MỘT lần (SĐT + PIN cũ) | chuyển sang phiên theo thiết bị có hạn 12h |
| Nhân viên | Không cần làm gì; nếu đăng nhập từ trước v4 giai đoạn 6 thì đăng nhập lại | token cũ thiếu hồ sơ vai trò sẽ được máy chủ xác minh tự động qua `ping` |
| Chủ nhà | Không cần làm gì | |

## Tự động tạo khi dùng lần đầu
- Thư mục Drive "Huy Rooms - Anh nghiep vu (private)" (khi có ảnh công tơ/sự cố mới). Ảnh nghiệp vụ CŨ đã lỡ nằm kho public vẫn xem được như trước; muốn kín hoàn toàn: tải xuống và đính lại trong app để ảnh đi vào kho private.
- Script property `RSESS` (phiên cư dân), `RESIDENT_SESSION_HOURS` (tùy chọn, mặc định 12).

## Rollback
1. Apps Script: Manage deployments → Edit → chọn version trước → Deploy.
2. Vercel: Deployments → bản trước → Promote to Production.
3. Dữ liệu Sheets không đổi schema nên rollback không mất gì. Cư dân đăng nhập lại lần nữa (seed flow cũ).
