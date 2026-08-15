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

## v4.2.7 — Bố cục căn trọ → phòng, thanh trạng thái lên đầu, thông báo giữa màn hình, Zalo cho mọi thông báo

### Sửa lỗi
- **Popup chạy khỏi màn hình** (nhãn bị cắt bên trái): thẻ popup có `overflow:auto` nên chỉ cần một phần tử con rộng hơn khung là cả thẻ trượt ngang được. Đã khóa trục ngang cho popup và ép mọi phần tử con nằm gọn trong khung; bảng dài bên trong vẫn cuộn riêng được.
- **Thanh trạng thái đồng bộ bị kéo dãn**: các quy tắc cũ neo thanh ở góc dưới vẫn còn, cộng với neo trên mới sẽ làm thanh cao hết màn hình. Đã dọn hẳn quy tắc cũ.

### Bố cục
- **Danh sách quản trị hiện CĂN TRỌ trước**: mỗi căn là một thẻ nền espresso nổi bật, chữ trắng + vàng champagne, chỉ hiện thông tin cơ bản (khu vực, số phòng, số trống, số đang thuê). **Bấm vào căn mới bung danh sách phòng của căn đó**; trạng thái mở/thu được nhớ lại.
- **Thanh trạng thái đồng bộ đưa lên đầu màn hình** (dải ngang trên cùng) thay vì nổi ở góc dưới che nội dung; các thanh khác và nội dung đã chừa chỗ tương ứng.
- **Thông báo / tips hiện giữa màn hình**, chữ to dễ đọc, nền espresso nổi bật.
- **Trang khách**: "x phòng phù hợp" thành huy hiệu nền vàng nhạt nổi bật, cùng nút Tìm & lọc canh giữa.
- **"Thuê phòng trong 3 bước" chia 3 cột**, thu gọn chữ để vừa màn hình điện thoại.

### Zalo
- **Mọi thông báo đều gửi kèm qua Zalo**: hóa đơn mới, sắp đến hạn, quá hạn, hợp đồng sắp hết, **điện nước**, sự cố, thông báo chung — mỗi tin có nhãn loại rõ ràng kèm tên nhà trọ.
- **Chốt kỳ điện nước nay tự báo cư dân** (chỉ số đầu–cuối, số kWh, thành tiền) — trước đây chỉ có hóa đơn mới báo.
- Công tắc bật/tắt trong Cài đặt. Người thuê chưa có mã Zalo vẫn nhận thông báo trong ứng dụng, không báo lỗi. Việc gửi chạy nền, không chặn thao tác.

## v4.2.8 — Lỗi "không gửi được lịch hẹn": chẩn đoán rõ + không mất khách

**Chẩn đoán:** hai thông báo gặp phải đều đến từ BẢN APPS SCRIPT ĐANG DEPLOY, không phải từ mã nguồn:
- *"Không hiểu yêu cầu"* — bản deploy cũ hơn client, chưa biết yêu cầu mà trang gửi lên.
- *"Apps Script không trả về dữ liệu"* — deployment trả về HTML (thường do "Who has access" chưa đặt Anyone, hoặc chưa cấp quyền).

**Việc đã sửa trong mã nguồn:**
- **Không mất khách khi gửi lỗi**: form giữ nguyên thông tin đã nhập và hiện ngay khung dự phòng — nút Gọi hotline, nút nhắn Zalo, nút sao chép nội dung đã soạn sẵn (tên, SĐT, phòng, ngày giờ). Trước đây chỉ có một dòng báo lỗi rồi cụt đường.
- **Cầu nối Vercel chẩn đoán đúng nguyên nhân** thay vì một câu chung: phân biệt trang đăng nhập Google, chưa cấp quyền, lỗi chạy script, mã lỗi HTTP; kèm trích đoạn nội dung thật nhận được.
- **Máy chủ nêu đích danh yêu cầu không nhận ra** kèm hướng dẫn Deploy → Manage deployments → New version, để nhận ra ngay là bản deploy cũ.
- **Nút "Kiểm tra kết nối" trong Cài đặt**: chạy thử ping và thử đúng chức năng đặt lịch mà khách dùng, rồi chỉ ra khâu hỏng (đường dẫn / quyền truy cập / bản deploy cũ).

**Cách khắc phục trên máy anh:** mở Apps Script → dán Code.gs + Index.html mới → Run `setup` → **Deploy → Manage deployments → Edit (bút chì) → Version: New version → Deploy** → kiểm tra "Who has access" = **Anyone**. Sau đó vào Cài đặt → Kiểm tra kết nối để xác nhận.

## v4.2.9 — Gửi Zalo kiểu "mở thẳng ứng dụng" (không cần token OA)

Cách gửi mới, **mặc định dùng**: bấm Gửi → nội dung được **chép sẵn vào bộ nhớ tạm** → **Zalo mở đúng cửa sổ chat người nhận** → chỉ việc dán và bấm Gửi. Chỉ cần **số điện thoại**, không cần ZALO_OA_TOKEN, không cần mã Zalo (zaloUserId) của từng người.

- Số điện thoại tự đổi sang dạng Zalo hiểu (0935041247 → 84935041247), bỏ khoảng trắng, chấp nhận số đã có sẵn 84.
- **Nút Gửi Zalo** xuất hiện ở: bảng người thuê (chỉ người có SĐT), từng thông báo đã tạo, và bảng nhắc hóa đơn.
- **Tạo thông báo cho một người → Zalo mở ngay** tới đúng người đó, nội dung có sẵn tên nhà trọ + tiêu đề + nội dung.
- Mọi lần gửi đều **ghi vào lịch sử nhắc** (kênh `zalo_link`), phân biệt rõ với gửi tự động qua OA.
- Người chưa có số điện thoại: báo rõ, không mở bừa.
- **Cài đặt → Cách gửi Zalo**: chọn "Mở ứng dụng Zalo" (khuyên dùng) hoặc "Gửi tự động qua Zalo OA". Ở chế độ mở app, hệ thống **không tự gọi OA** nữa nên không còn báo lỗi thiếu token; chuyển sang chế độ OA thì cơ chế tự gửi của v4.2.7 hoạt động như cũ.

### Sửa trong lúc làm
Bộ kiểm thử bắt được việc tên người thuê bị nhét thẳng vào thuộc tính `data-*` — thuộc tính không escape dấu `<` khi tuần tự hóa nên chuỗi thô lộ ra trong HTML. Đã chuyển sang chỉ truyền mã người thuê, lời chào dựng bên trong hàm.

## v4.2.10 — Sửa lỗi do chính bản v4.2.8 gây ra: nuốt mất lý do từ chối đặt lịch

**Chẩn đoán bằng cách chạy lại đúng đường của khách (không có token):** chức năng đặt lịch KHÔNG hỏng. Lần đầu gửi thành công; các lần sau máy chủ từ chối có lý do rõ ràng ("Bạn đã đặt đúng khung giờ này rồi", "quá nhiều yêu cầu"…). Nhưng bản v4.2.8 đã thay mọi thông báo lỗi bằng một câu chung "Chưa gửi được lịch hẹn lên hệ thống", khiến người dùng tưởng hệ thống hỏng và không biết lý do thật.

- **Phân biệt hai loại thất bại**: máy chủ vẫn sống nhưng từ chối có lý do → hiện đúng lý do đó, KHÔNG bày lối gọi/Zalo dự phòng (vì hệ thống không hỏng). Hỏng đường truyền / sai cấu hình / bản deploy cũ → câu chung + mở lối liên hệ trực tiếp như v4.2.8.
- Lỗi trả về từ máy chủ nay giữ nguyên mã lỗi và cờ "máy chủ có trả lời" để phân loại chính xác.
- **Trùng khung giờ thì tự gợi ý khung trống gần nhất** và nhảy sẵn ô giờ sang khung đó, khách chỉ cần bấm Gửi lại; nếu ngày đã kín thì nhắc chọn ngày khác.

## v4.3 — Đặt cọc giữ chỗ theo khoảng ngày

Người thuê đặt cọc giữ phòng **từ ngày → đến ngày**:
- **Phòng** chuyển sang trạng thái **"Đã giữ chỗ"** (không còn nhận đặt lịch như phòng trống).
- **Người thuê** ở trạng thái **"Đang đặt cọc giữ chỗ"**, hiển thị kèm phòng đang giữ, khoảng ngày và số tiền cọc.
- Nút **Giữ chỗ** trong bảng Người thuê mở bảng nhập: chọn phòng (chỉ liệt kê phòng trống), ngày bắt đầu, ngày kết thúc, tiền cọc, ghi chú. Có nút **Hủy giữ chỗ** khi cần.
- **Chặn hai người giữ cùng một phòng**, báo rõ ai đang giữ và giữ tới ngày nào. Đổi phòng giữ chỗ thì phòng cũ tự về Đang trống.
- **Quá hạn giữ**: trạng thái đổi thành "Giữ chỗ đã hết hạn", dòng được tô sáng để chủ nhà xử lý — không tự động nhả phòng, chủ nhà chủ động quyết định.
- **Nhận phòng thật** (có hợp đồng hiệu lực) thì trạng thái tự chuyển sang "Đang thuê", hết giai đoạn giữ chỗ.
- Tự gửi thông báo xác nhận giữ chỗ cho người thuê (kèm Zalo theo chế độ đã chọn).

Sheet `NguoiThue` cần chạy lại `setup` để thêm cột: holdRoomId, holdFrom, holdUntil, holdAmount, holdNote.

## v4.3.1 — Giữ chỗ chỉ Chủ nhà / Quản lý được chỉnh sửa

Vì giữ chỗ gắn với **tiền cọc thật**, quyền đặt và hủy giữ chỗ được siết ở **cả hai tầng**:

- **Máy chủ**: bảng Người thuê và Phòng vốn chỉ cho Chủ nhà / Quản lý ghi — Kế toán và Nhân viên gửi lên sẽ bị bỏ qua và báo về rõ ràng.
- **Máy chủ (mới)**: giữ chỗ **bắt buộc có tiền cọc > 0** và **ngày kết thúc không sớm hơn ngày bắt đầu**; thiếu là từ chối kèm lý do, không ghi nửa vời.
- **Giao diện**: nút "Giữ chỗ" / "Hủy giữ chỗ" chỉ hiện với Chủ nhà và Quản lý. Vai trò khác gọi thẳng hàm cũng bị chặn, kèm giải thích "giữ chỗ đi kèm tiền cọc thật" thay vì im lặng không phản hồi.

Lý do chọn đúng hai vai trò này (không mở cho Kế toán): máy chủ không cho Kế toán ghi bảng Người thuê, nên nếu bày nút ra thì thao tác sẽ bị bỏ qua âm thầm — thà chặn ngay và nói rõ.

## v4.4 P0 — Hợp nhất giữ chỗ, sổ cọc và khôi phục đồng bộ

- Thêm collection/sheet `reservations` / `GiuCho` làm nguồn sự thật duy nhất; CRM và hồ sơ khách cùng dùng một luồng.
- Khóa việc đặt `room.status=reserved` bằng tay. Trạng thái phòng được suy ra từ phiếu chưa xử lý hoặc hợp đồng nháp đã cọc.
- Tạo phiếu trên máy chủ là giao dịch có khóa: kiểm tra quyền, phòng, khách, trùng phiếu, số tiền; ghi phiếu + `SoCoc` + CRM + phòng cùng lúc.
- Phiếu quá hạn không tự nhả phòng. Quản lý phải chọn `HOAN` hoặc `GIU`; số dư tiền về 0 rồi phiếu mới đóng.
- Bổ sung mốc collection cho đồng bộ thường, `baseUpdatedAt` cho xóa, không coi bản bị từ chối là đã lưu.
- Máy chủ trả bản authoritative/tombstone khi xung đột hoặc từ chối; client hoàn nguyên phiếu, sổ cọc, CRM và phòng, không còn dữ liệu nửa vời.
- Có bộ test `tests/p0-regression.test.js` cho tạo/hủy, chặn phiếu thứ hai, thiết bị offline và phục hồi sau từ chối.
