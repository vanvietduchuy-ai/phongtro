# SECURITY — Huy Rooms v4.1

## Mô hình tin cậy
- **Mọi kiểm tra quyền có hiệu lực nằm ở Apps Script** (`Code.gs`). Giao diện chỉ ẩn/hiện nút cho dễ dùng — ẩn nút KHÔNG phải là bảo mật.
- 3 lớp danh tính: khách (không key), quản trị (token owner/staff hoặc writeKey), cư dân (phiên thiết bị).

## Phân quyền quản trị
| Vai trò | Sync ghi được | Action đặc biệt |
|---|---|---|
| owner | tất cả (trừ auditLog — máy chủ tự ghi) | tất cả |
| manager | tất cả trừ nhân sự | setTenantPin/deleteImage/unlockReading (đúng căn), sendZalo |
| accountant | hóa đơn, sổ thu*, sổ cọc*, nhắc nợ, dịch vụ | sendZalo |
| staff | lịch hẹn, sự cố, điện nước, thông báo | — |

\* sổ thu/sổ cọc: chỉ THÊM (append-only) — xem "Tài chính".

Phạm vi căn (`propertyIds`) lọc cả đọc lẫn ghi tại máy chủ qua `propertyIdOfRecord`. `[]` = tất cả căn (tương thích dữ liệu cũ).

## Tài chính
- `payments`/`depositLedger` append-only; sửa/xóa → `rejected[]`. Sai sổ = tạo giao dịch đảo (`kind:'reversal'`, số âm, `reversalOf`).
- Hóa đơn đã thu tiền không xóa; chống trùng phòng+tháng; kiểm tra tenant/room tồn tại; trần 500 triệu/giao dịch.
- Chỉ số final chỉ mở khóa qua action `unlockReading` (owner/manager, đúng căn, bắt buộc lý do, có audit).

## Đồng bộ & xung đột
- Mỗi bản ghi đẩy lên kèm `baseUpdatedAt`; lệch với máy chủ → `conflicts[]` + bản máy chủ, KHÔNG ghi đè. Client giữ bản máy chủ và báo người dùng; muốn áp lại thì sửa tiếp trên bản mới (thao tác thủ công có chủ đích).
- Client đời cũ không gửi `baseUpdatedAt` vẫn ghi được (tương thích ngược) — các bảng tài chính vẫn được bảo vệ bằng luật append-only ở trên.

## Phiên cư dân
- Token/thiết bị, máy chủ chỉ lưu SHA-256; hết hạn `RESIDENT_SESSION_HOURS` (mặc định 12h); logout 1 thiết bị / tất cả / đổi PIN thu hồi hết. Brute-force: khóa 10 phút sau 20 lần sai.
- Dữ liệu cư dân qua 13 DTO whitelist — thêm trường mới phải chủ động khai báo, quên khai báo = KHÔNG lộ.

## Ảnh
- Kho public: ảnh quảng cáo căn/phòng (`ANYONE_WITH_LINK`).
- Kho PRIVATE (không chia sẻ): ảnh công tơ, ảnh sự cố. Đọc qua `getPrivateImage` (quản trị, đúng phạm vi) hoặc `residentImage` (cư dân, đúng hồ sơ của mình). Người có URL Drive nhưng chưa đăng nhập KHÔNG xem được.
- Upload: giới hạn 6MB, MIME kiểm bằng magic bytes (JPEG/PNG/WebP/GIF).

## XSS
- Không còn inline handler chứa dữ liệu nội suy; handler động qua `data-call` + dispatcher với WHITELIST tên hàm — `data-aN` chỉ là tham số chuỗi, không bao giờ được eval.
- Mọi dữ liệu render qua `esc()`; enum lạ bị máy chủ từ chối và client hiển thị "Không xác định".
- Không `eval`/`new Function` trong app.

## Giới hạn còn lại (trung thực)
1. **CSP `script-src` vẫn còn `'unsafe-inline'`**: còn ~200 handler TĨNH (`onclick="openLeaseForm()"` — không chứa dữ liệu) trong template. Vector XSS thực (dữ liệu nội suy vào JS) đã loại bỏ và có test chặn tái phát (`grep on*="...${`), nhưng defense-in-depth của CSP chưa trọn. Lộ trình: chuyển nốt handler tĩnh sang delegation rồi bỏ `'unsafe-inline'`.
2. `style-src 'unsafe-inline'` giữ lại (style inline trong template — rủi ro thấp).
3. Apps Script không cho biết IP → rate limit đăng nhập là bộ đếm toàn cục (8 lần/10 phút), có thể bị lợi dụng để khóa nhầm (DoS nhẹ) thay vì dò mật khẩu.
4. Lọc phạm vi căn đọc toàn bộ sheet liên quan mỗi lần sync có scope → chậm hơn ~1 lượt đọc/collection với nhân viên bị giới hạn căn. Trong ngưỡng vận hành (≤60 phòng) không đáng kể.
5. Cư dân đăng nhập lại MỘT lần sau nâng cấp (seed cũ hết hiệu lực) — chủ đích, để chuyển sang phiên có hạn.
