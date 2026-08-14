# CHANGELOG — Huy Rooms v4.1 Production Fixed

## P0 — Phân quyền (máy chủ)
- `authContext(req)` tập trung: `{authenticated, role, staffId, staffName, propertyIds, tokenType}` — mọi action quản trị dùng chung; trả lỗi chuẩn `{ok:false, code:'forbidden', error}`.
- `ping` trả hồ sơ vai trò → client khôi phục đúng vai trò sau reload.
- Khóa action: `setPassword`/`logoutAll`/`sessions`/`setStaffPass` chỉ owner; `deleteImage` owner/manager; `setTenantPin` owner/manager **đúng căn**; `sendZalo` owner/manager/accountant; `unlockReading` (MỚI) owner/manager đúng căn.
- **Phạm vi căn thực thi tại máy chủ, cả ĐỌC lẫn GHI**: `buildScopeMaps()` + `propertyIdOfRecord(col, rec)` suy propertyId qua room/lease/invoice cho 16 collection; sync chỉ trả dữ liệu trong phạm vi; ghi ngoài phạm vi bị bỏ qua và báo `scopeSkipped`. `propertyIds: []` vẫn nghĩa "tất cả căn"; owner thấy hết.

## P0 — Đồng bộ
- Sửa lỗ hổng stamp: `handleBook` (đặt lịch của khách), `onEdit` (sửa tay trên Sheet), `accountCell`, cấp PIN/mật khẩu giờ đều `touchColStamp` → **incremental sync không bỏ sót**; lịch khách đặt hiện trên máy quản trị ngay lần sync sau.
- **Optimistic concurrency**: client gửi `baseUpdatedAt` của bản đã đọc; máy chủ lệch stamp → KHÔNG ghi đè, trả `conflicts[]` kèm bản máy chủ; client giữ bản máy chủ, toast rõ, ghi nhật ký xung đột. ID đã tồn tại + base=0 → conflict (không chiếm được ID).
- Client (bản cũ, không gửi base) vẫn ghi được — tương thích ngược, ghi rõ trong SECURITY.md.

## P0 — Tài chính
- `payments` + `depositLedger` **append-only tại máy chủ**: sửa/xóa qua sync bị `rejected` (ngoại lệ duy nhất: đánh dấu `reversedAt` lên giao dịch gốc). Sai thì tạo giao dịch đảo (âm + `reversalOf`).
- Hóa đơn có tiền thu/đã thanh toán không xóa được; hóa đơn mới kiểm tra tenant/room tồn tại + chặn trùng phòng+tháng+HĐ; payment ≤ 500 triệu, không âm ngoài reversal.
- Chỉ số đã khóa không sửa được qua sync; mở khóa chỉ qua action `unlockReading` (bắt buộc lý do, ghi audit).
- Enum whitelist 9 collection: trạng thái/vai trò/loại lạ bị từ chối kèm lý do tiếng Việt.

## P0 — XSS / bảo mật frontend
- **0 inline handler chứa dữ liệu nội suy** (90 chỗ chuyển sang `data-evt/data-call/data-aN` + dispatcher whitelist 55 hàm). Payload `<img onerror>`, `');alert//`, `"><svg onload>` chỉ hiển thị như văn bản (kiểm thử tự động).
- Enum lạ hiển thị "Không xác định", không render chuỗi gốc.
- CSP: `script-src` còn `'unsafe-inline'` cho handler TĨNH (không chứa dữ liệu) — xem SECURITY.md mục "Giới hạn còn lại".

## Session & quyền riêng tư cư dân
- Phiên cư dân **theo từng thiết bị**: token ngẫu nhiên ~130 ký tự, máy chủ chỉ lưu **SHA-256 hash**, hết hạn 12h (cấu hình `RESIDENT_SESSION_HOURS`), đăng xuất đúng thiết bị (`residentLogout` mới) / mọi thiết bị / đổi PIN thu hồi tất cả.
- Bundle cư dân dựng bằng **13 hàm DTO whitelist** (`toResidentXxxDTO`) — không còn "lấy record rồi delete vài trường". Không lộ note nội bộ, hash/salt, seed, Zalo token, dữ liệu người khác.
- **Ảnh nghiệp vụ tách kho PRIVATE** (Drive folder không chia sẻ): ảnh công tơ + ảnh sự cố; xem qua action có xác thực (`getPrivateImage` cho quản trị đúng phạm vi, `residentImage` cho cư dân đúng hồ sơ). Ảnh quảng cáo căn/phòng vẫn public.

## Giao diện & nghiệp vụ
- Trang chi tiết phòng KHÔNG ảnh: fallback tĩnh `.detail-fallback` (aspect-ratio, không phủ) — nút Đặt lịch/Gọi bấm được (kiểm thử click qua dispatcher).
- Ngày giờ VIỆT NAM: `today()`/`monthNow()`/`nextDayISO()`/`dueDateForMonth()` theo Asia/Ho_Chi_Minh — hết sai hạn/quá hạn/tháng điện nước lúc 0h–7h sáng.
- Biểu đồ SVG viết lại: viewBox tọa độ thật, bỏ `preserveAspectRatio="none"` → chữ không méo; tooltip `<title>`.
- Service worker viết lại: fallback `index.html` CHỈ cho navigation; không cache `/api/`; chỉ cache `res.ok`; `event.waitUntil`; cache version mới + dọn cũ.
- Đăng xuất quản trị: `purgeAdminData()` xóa 18 collection nhạy cảm + ghi chú phòng + bản tự lưu + trạng thái bảng khỏi máy; `showAdmin()` chặn khi chưa xác thực.

## Đã sửa từ trước trong dòng production (giữ nguyên)
- SAFE_ID, magic bytes ảnh, backup 14 bản/ngày, LASTSTAMP cache, migration idempotent.

## v4.2 — Luxury Ivory · Espresso · Champagne Gold (theme màu)
- Xây lại hệ biến CSS trong `:root` (styles.css) theo đúng bảng màu Luxury: nền ivory nhiều tầng, espresso làm màu thương hiệu chính, champagne gold làm điểm nhấn, sage/red-earth/warning/info cho trạng thái, dải màu sidebar riêng. Giữ nguyên tên biến cũ (`--bg`, `--ink`, `--accent`…) trỏ sang giá trị mới để không phá vỡ hàng nghìn chỗ dùng `var()` có sẵn.
- Ánh xạ lại toàn bộ ~140 mã màu cứng còn sót trong `styles.css`/`mobile.css` (border, hover, shadow…) bằng thuật toán phân loại theo sắc độ, có xử lý tay các trường hợp mang ý nghĩa nghiệp vụ (danger/warning/lease-alert…) để không lẫn màu.
- Sidebar quản trị: gradient nâu đậm (sidebar-start → sidebar-end), icon menu vàng nhạt, mục active có dải gold bên trái + nền trắng trong suốt.
- Nút: hệ 5 loại (primary espresso / gold CTA / secondary viền be / ghost / danger đỏ đất) đủ trạng thái hover-focus-active-disabled-loading. Nút "Đặt lịch xem phòng" chuyển sang gold CTA — nổi bật nhất trang. Nút "Cư dân"/"Quản lý" trên navbar phân biệt rõ (viền gold / nền espresso).
- Badge & trạng thái phòng: sage (trống) / vàng kem (giữ chỗ) / greige (đang thuê) / đỏ đất nhạt (bảo trì); hóa đơn: sage (đã thu) / kem (một phần) / đỏ đất (quá hạn).
- Bảng dữ liệu: header be nhạt chữ espresso, hover hàng gold nhạt, dòng xen kẽ rất nhẹ.
- Biểu đồ dashboard: đổi màu cột/donut sang espresso — gold — sage — terracotta nhạt.
- Cổng cư dân: số tiền cần thanh toán nổi bật espresso, tiền cọc tô gold, tab active có chấm gold.
- **Kiểm tra tương phản WCAG AA bằng phép tính thực** (không đoán): phát hiện 2 màu trong bảng gốc (vàng cảnh báo, đỏ đất) không đạt AA khi làm chữ trên nền nhạt tương ứng (3.8:1 và 4.47:1) — đã tinh chỉnh thành `#7A5C33` (5.35:1) và `#96473E` (5.4:1), áp dụng nhất quán ở mọi nơi dùng hai màu này.
- Không đổi logic, ID, field, cấu trúc dữ liệu, Apps Script hay chế độ offline. Đã chạy lại 604 kiểm thử hồi quy + 33 kiểm thử theme mới + 11 kiểm tra responsive — toàn bộ đạt.
