# TEST REPORT — Huy Rooms v4.1 Production Fixed
Môi trường: Node 22, jsdom (UI), mock Apps Script (SpreadsheetApp/PropertiesService/CacheService/Utilities/DriveApp) chạy Code.gs thật.
**Tổng: 604 kiểm thử / 604 đạt, 18 suite.**

## Suite mới v4.1
| Suite | Kết quả | Phủ mục IX |
|---|---|---|
| v41-hardening-gas (41) | 41/41 | 1,2,3,4,5,7,8,10,11,12,13,14,15,16,17,18,20,21,22,23,24,25 |
| v41-hardening-ui (23) | 23/23 | 6,19,26,27,30,31,33,34,35 + sw.js + 0-inline-interpolated |

Điểm nhấn đã chứng minh bằng test:
- Reload giữ vai trò accountant + phạm vi căn; token cũ thiếu hồ sơ → trạng thái `pending`, mọi `can()` = false (IX.6).
- QL căn A không ĐỌC được phòng/người thuê căn B; GHI phòng căn B bị bỏ qua + báo `scopeSkipped`; staff căn A không tạo được lịch căn B (IX.4-5).
- `handleBook` → thiết bị quản trị nhận lịch mới bằng incremental sync, khớp full sync (IX.8,10,13).
- Conflict: base cũ → máy chủ trả bản hiện tại, giá KHÔNG bị đè; base=0 trên id tồn tại → không chiếm id (IX.11-12).
- Sửa/xóa payment bị `rejected`; reversal hợp lệ; trùng hóa đơn phòng+tháng bị chặn; chỉ số final chỉ mở qua action, accountant bị `forbidden` (IX.14-18).
- Payload `<svg onload>` trong status → máy chủ TỪ CHỐI enum; client render "Không xác định"; `window.__xss` không bao giờ được đặt (IX.19-20).
- Bundle cư dân không chứa passHash/pinHash/sessionSeed/note nội bộ; phiên hết hạn/đăng xuất từng thiết bị/tất cả đúng ngữ nghĩa; ảnh private chưa xác thực bị chặn (IX.21-25).
- Trang phòng KHÔNG ảnh: fallback tĩnh, nút Đặt lịch click được qua dispatcher (IX.26-27).
- `today()` khớp Asia/Ho_Chi_Minh; chart không còn `preserveAspectRatio="none"`; không ID HTML trùng; JSON hợp lệ; icon PWA tồn tại (IX.30-35).

## Suite hồi quy (giữ từ giai đoạn 1–6, chạy trên code v4.1)
| Suite | Kết quả |
|---|---|
| gas-mock (nền tảng backend) | 45/45 |
| gas-roles (phân quyền + audit p6) | 27/27 |
| gas-billing p3 | 15/15 · gas-lease p2 20/20 · gas-resident p4 35/35 · gas-sale p5 10/10 · gas-security 15/15 |
| admin-ux p6 | 55/55 |
| dom p3 48/48 · lease p2 60/60 · online e2e 20/20 · billing 57/57 · resident 48/48 · sale 48/48 |
| money-edge 15/15 · conflict+smoke 22/22 |

Build (IX.32,36,37): `node --check` đạt cho app.js/sync.js/sw.js/api/sheets.js; `build-appsscript.py` tái tạo `apps-script/Index.html` (418KB) và kiểm PARITY: bundle chứa đúng từng byte đầu/cuối của app.js + sync.js → hai bản triển khai chung một logic.

## Chưa phủ tự động (trung thực)
- IX.9 `onEdit` stamp: mock không mô phỏng event Sheets — xác nhận bằng code review (touchColStamp trong onEdit). Kiểm tay: sửa 1 ô trên Sheet → thiết bị khác thấy sau 1 lần sync.
- IX.28-29 tràn ngang desktop/390px: jsdom không dựng layout thật — cần mở bằng trình duyệt/DevTools. CSS không đặt width cố định mới nào.
- Payload XSS kiểm trong jsdom, không phải 4 trình duyệt thật.
