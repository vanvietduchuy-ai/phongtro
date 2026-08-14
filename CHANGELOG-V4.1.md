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

## v4.2.1 — Sửa trải nghiệm bộ lọc trang khách trên điện thoại
Phản hồi thực tế trên máy: bộ lọc (loại phòng, diện tích, số người, ngày vào ở, tiện nghi) xếp chồng từng ô full-width chiếm gần hết màn hình, phải cuộn rất nhiều mới thấy được phòng nào.

- Bộ lọc nâng cao (loại phòng/diện tích/số người/ngày vào ở/tiện nghi) **thu gọn mặc định trên điện thoại**, có nút "Lọc theo loại phòng, diện tích, tiện nghi…" để mở khi cần — không mất trường lọc nào, chỉ ẩn/hiện bằng chiều cao (max-height + opacity), giữ nguyên toàn bộ ID và logic lọc.
- Thanh lọc chính (khu vực/trạng thái/giá) chuyển từ xếp dọc từng ô sang **lưới 2 cột** trên điện thoại — gọn hơn khoảng một nửa chiều cao trước đó; ô tìm kiếm và nút "Đặt lại" vẫn full-width để dễ bấm.
- Giảm khoảng trống phía trên khu vực danh sách phòng để phòng hiện ra sớm hơn khi cuộn.
- Không đổi hành vi desktop: bộ lọc nâng cao vẫn luôn hiện sẵn như cũ, nút thu gọn chỉ xuất hiện ở khổ điện thoại/tablet nhỏ (≤860px).

## v4.2.2 — Cân đối lại bố cục quản trị trên điện thoại
Bốn lỗi thấy trên máy thật, đã kiểm chứng và sửa:

1. **Chữ giữa biểu đồ tròn tràn ra ngoài vòng** — "32 phòng" vẽ ở cỡ chữ 8 trong viewBox 42 đơn vị, rộng ~35 đơn vị trong khi lỗ giữa donut chỉ 25,8 đơn vị nên chữ đè lên vành. Tách thành 2 dòng (số lớn / chữ "phòng" nhỏ), tính lại cỡ chữ để nằm gọn trong lỗ.
2. **Biểu đồ doanh thu trống trơn** — khi mọi giá trị bằng 0 thì chỉ còn trục tháng, trông như hỏng. Nay hiện thông báo "Chưa có số liệu cho kỳ này" kèm gợi ý; donut khi chưa có phòng cũng vậy. Có số liệu thật thì vẽ như cũ.
3. **"Tháng" và "Căn trọ" đè lên nhau** — ô chọn tháng nở tự do đẩy nhãn kế bên. Đặt flex-basis + min-width:0 cho từng ô, input/select chiếm đúng bề rộng ô cha; màn hẹp thì mỗi ô một dòng.
4. **Danh sách phòng quá dài, lộn xộn** — ở chế độ điện thoại mỗi phòng bung thành 7 hàng nhãn/giá trị (ẢNH, PHÒNG, DIỆN TÍCH, GIÁ, CỌC, TRẠNG THÁI, thao tác), 32 phòng phải cuộn rất nhiều. Nay mỗi phòng gọn còn ~3 dòng: dòng 1 ảnh nhỏ + **tên phòng nổi bật** + loại + diện tích; dòng 2 giá và cọc chia đôi; dòng 3 trạng thái; nút thao tác gom xuống dưới chia đều 2 cột. Bỏ nhãn thừa "ẢNH"/"PHÒNG". Giữ nguyên toàn bộ chức năng sửa nhanh giá/cọc/trạng thái tại chỗ.

Thẻ KPI cũng được canh chiều cao tối thiểu để các thẻ thẳng hàng nhau khi chữ phụ dài ngắn khác nhau. Không đổi logic, ID hay cấu trúc dữ liệu.

## v4.2.3 — Nút Lưu cho từng phòng + vá lỗi nút thu gọn bộ lọc
- **Thêm nút "Lưu" trên mỗi hàng phòng** trong Căn trọ & phòng. Bấm Lưu sẽ đọc giá / cọc / trạng thái đang hiển thị trên đúng hàng đó, ghi một lượt, rồi **đẩy lên máy chủ ngay** thay vì chờ 900ms gom nhóm — kèm thông báo xác nhận rõ ("Đã lưu và đồng bộ phòng P101"). Ngoại tuyến thì báo đã lưu trên máy và sẽ tự đồng bộ sau.
- **Dấu hiệu "chưa lưu"**: vừa gõ vào ô giá/cọc là hàng sáng lên nền vàng nhạt kèm vạch vàng bên trái, nút Lưu chuyển sang vàng đặc — nhìn là biết còn thay đổi chưa cất.
- Đổi trạng thái qua nút Lưu vẫn đi qua đúng kiểm tra nghiệp vụ cũ (không cho đặt "Đã thuê" khi phòng chưa có người thuê hoạt động) — không lách được bằng đường mới.
- Cơ chế lưu tự động cũ giữ nguyên, nút Lưu chỉ bổ sung thêm, không thay thế.

### Sửa lỗi
- **Nút "Lọc theo loại phòng, diện tích, tiện nghi…" (thêm ở v4.2.1) bấm không có tác dụng** — tên hàm chưa được đăng ký trong danh sách hàm được phép gọi của bộ điều phối sự kiện, nên cú bấm bị bỏ qua. Kiểm thử trước đó gọi thẳng hàm nên không phát hiện ra. Đã đăng ký tên hàm và bổ sung kiểm thử **bấm thật vào nút** cho cả nút này lẫn nút Lưu mới.

## v4.2.4 — Trang khách: giấu ô tìm/lọc sau nút kính lúp, danh sách phòng 2 cột
- **Toàn bộ vùng tìm & lọc gom vào một khối, mặc định ĐÓNG trên điện thoại.** Đầu danh sách có nút kính lúp "Tìm & lọc"; bấm mới mở ra (tự đưa con trỏ vào ô tìm kiếm), bấm lần nữa đóng lại. Khách vào trang là thấy phòng ngay, không phải cuộn qua một màn hình toàn ô lọc.
- **Bỏ card "Tìm phòng nhanh" ở đầu trang trên điện thoại** — trùng chức năng với bộ lọc bên dưới. Desktop giữ nguyên như cũ.
- **Danh sách phòng chia 2 cột**: thẻ phòng xếp dọc (ảnh 4:3 phía trên, tên phòng, giá, tiện nghi, trạng thái, nút "Đặt lịch xem" rộng hết thẻ cao ≥42px). Màn dưới 360px tự quay về 1 cột cho khỏi bóp chữ; trang chi tiết căn trên màn rộng dùng 3 cột.
- Vào trang chi tiết phòng/căn thì ẩn cả vùng lọc lẫn nút kính lúp, quay ra danh sách thì hiện lại.
- Không bỏ trường lọc nào, không đổi logic lọc.

## v4.2.5 — Danh sách phòng dạng list, sửa qua popup; sửa lỗi MẤT GIÁ khi đồng bộ
### Lỗi nghiêm trọng đã tái hiện được và sửa
**Nhập giá xong thấy như bị mất.** Nguyên nhân: ô nhập giá/cọc nằm ngay trong danh sách; khi người dùng đang gõ mà **chưa rời ô** (sự kiện change chưa bắn) thì một đợt đồng bộ về sẽ vẽ lại cả bảng — con số đang gõ bị xóa sạch. Đã dựng phép thử tái hiện đúng hiện tượng này trước khi sửa.
Cách sửa triệt để: **bỏ hẳn ô nhập trong danh sách**, mọi việc sửa chuyển sang popup. Popup nằm ngoài vùng bị vẽ lại nên đồng bộ về không đụng tới số đang gõ — có phép thử chứng minh: mở popup, gõ giá, cho đồng bộ mang thay đổi từ máy khác về, số vẫn nguyên.

### Thay đổi giao diện
- **Danh sách phòng dạng list gọn**: mỗi phòng một dòng — ảnh nhỏ, tên phòng, loại · diện tích · số người, giá và cọc, trạng thái. Bấm vào phòng là **popup sửa nhảy lên**. Hai nút phụ (Tài sản, Lưu trữ/Xóa) nằm gọn bên dưới.
- **Số tiền có dấu ngăn cách 3 chữ số**: gõ 3800000 tự hiện 3.800.000, mở lại popup vẫn hiện dạng đã ngăn cách; khi lưu vẫn quy về số nguyên đúng.
- **Cố định trên màn hình điện thoại**: các ô xếp theo hàng cố định (ảnh+tên / giá+cọc / trạng thái), bỏ trượt ngang trong khu danh sách phòng.
- Gỡ nút "Lưu" trong danh sách (thêm ở v4.2.3) cùng toàn bộ code và CSS liên quan — đã được thay bằng nút Lưu sẵn có trong popup.

## v4.2.6 — Ô số 0 tự xóa · Giảm giá 3 mức · Nhiều người ở (+ sửa 10 nút hỏng)

### Lỗi nghiêm trọng phát hiện trong lúc làm
**10 nút trong bảng chi tiết hợp đồng bấm vào chỉ đóng modal, không mở gì**: Nhận phòng, Ký HĐ, Sửa nháp, **Thêm người ở**, Thêm dịch vụ, Gia hạn, Chuyển phòng, Trả phòng/Thanh lý, Sổ cọc. Nguyên nhân: đợt chuyển handler sang data-* ở v4.1 chỉ giữ lại lệnh ĐẦU TIÊN của các handler nhiều lệnh (`closeModal(...); openX(...)`), vế sau bị cắt thành chuỗi rác trong data-a1. Đã thay bằng hàm điều phối `leaseAction` và kiểm bằng cách BẤM THẬT vào nút. Đây cũng chính là thứ chặn tính năng "thêm người ở" mà anh hỏi.

### Ô nhập số
- Ô tiền/số đang là 0: **bấm vào là tự xóa**, khỏi phải xóa tay. Rời ô mà bỏ trống thì trả lại 0 để không lưu rỗng.
- Các ô tiền trong form hợp đồng cũng chuyển sang dạng có dấu ngăn cách 3 chữ số như form phòng.

### Giảm giá — 3 mức
- **Giảm theo tháng** (gắn hợp đồng): tự trừ vào mọi hóa đơn phát hành từ hợp đồng đó, kèm lý do.
- **Giảm theo đơn** (từng hóa đơn): trường riêng, cộng dồn với giảm theo tháng.
- **Giảm tiền cọc**: giảm số cọc phải đóng của hợp đồng; mọi nơi hiển thị/đối chiếu cọc đều dùng số sau giảm.
- Tổng hóa đơn không bao giờ âm dù giảm quá tay. Dòng "Giảm giá" hiện ở cổng cư dân, bản in hóa đơn và có cột riêng trong CSV xuất.

### Nhiều người ở một phòng
Cơ chế đã có sẵn từ giai đoạn 2 và nay dùng được thật sau khi sửa nút hỏng: một hợp đồng có **một người đứng tên** (`primaryTenantId`, chịu trách nhiệm thanh toán — hóa đơn luôn ghi tên người này) và **nhiều người ở cùng** chỉ để theo dõi (vai trò `member`, có ngày vào/rời). Có thể chuyển vai trò đại diện hoặc đánh dấu người rời đi mà không ảnh hưởng hóa đơn cũ.

Sheet cần chạy lại `setup` để thêm cột mới (idempotent, không mất dữ liệu): HopDong thêm monthlyDiscount/monthlyDiscountNote/depositDiscount/depositDiscountNote; HoaDon thêm discountAmount/discountNote.
