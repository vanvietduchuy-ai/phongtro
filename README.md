# Huy Rooms v4.6.6 — Hotfix đồng bộ và trạng thái phòng

V4.6.6 giữ nguyên schema, công thức và kiến trúc Vercel + Apps Script + Google Sheets, đồng thời khóa các lỗi biên có thể làm trạng thái phòng/hợp đồng lệch nhau:

1. Bản máy chủ cũ trong danh sách xung đột không còn ghi đè ngược bản reconcile mới; `baseStamp` chỉ tiến, không tạo vòng conflict vô hạn.
2. Không thể lưu trữ căn/phòng còn hợp đồng nháp/hiệu lực, phiếu giữ chỗ hoặc người ở hoạt động.
3. Không thể lưu trữ riêng người đại diện của hợp đồng đang chạy; nhận/chuyển/trả phòng tiếp tục đi qua action nguyên tử.
4. Trạng thái thương mại có ưu tiên rõ: đang thuê → `occupied`, đang giữ/còn cọc → `reserved`, sau đó mới đến `maintenance`/`available`.
5. Hợp đồng nháp chỉ khóa phòng khi **số dư sổ cọc còn giữ > 0**, không dựa vào số tiền đã từng thu trong quá khứ.
6. Chạy `setup()` một lần sẽ tự sửa idempotent dữ liệu cũ từng bị kẹt: khôi phục liên kết người đại diện, hồ sơ người thuê và trạng thái phòng.

## Nền P3 từ v4.6.5

Bản v4.6.5 giữ nguyên schema, công thức và toàn bộ sửa lỗi P0/P1/P2, đồng thời hoàn thiện P3 cho vận hành dài hạn:

1. Mỗi lần lưu/đồng bộ chỉ render màn hình quản lý đang mở, không còn dựng lại cả 9 màn hình.
2. Đồng bộ dùng một scheduler duy nhất, không gắn trùng listener sau full pull; mất mạng sẽ backoff có jitter và giới hạn 5 phút.
3. `setup()` tự tạo trigger sao lưu Google Sheets hằng ngày trong khung 03:00, chạy lặp không tạo trùng; Drive giữ 14 bản gần nhất.
4. Thêm hồi quy P3 cho render, lỗi mạng, backup/restore, batch read, trần 300 bản ghi/gói và tập thử 120 phòng + 1.200 hóa đơn.
5. Ngưỡng vận hành và kịch bản phục hồi được ghi rõ trong `NGUONG-VAN-HANH-VA-PHUC-HOI.md`.

## Hoàn thiện P2 từ v4.6.4

Bản v4.6.4 giữ nguyên toàn bộ nghiệp vụ và dữ liệu của v4.6.3, đồng thời xử lý các lỗi P2 còn lại sau khi rà soát thao tác thực tế:

1. Popup cũ và mới dùng cùng lớp nền, cùng kích thước; class `modal-wide` nay mở đúng bề rộng cho hóa đơn hàng loạt, hợp đồng, bàn giao và bảng tài sản.
2. Hàng có nhiều nút tự xuống dòng, popup không tràn ngang trên điện thoại và nền trang bị khóa cuộn trong lúc popup mở.
3. Khi form đang có dữ liệu chưa lưu, bấm X, Hủy, vùng ngoài hoặc Escape đều hỏi xác nhận; thao tác đang xử lý không thể bị đóng giữa chừng.
4. Focus đi vào ô nhập đầu tiên, được giữ bên trong popup bằng Tab/Shift+Tab và trở lại đúng nút đã mở khi đóng.
5. Sửa lỗi người ở mới có thể bị chèn thành hồ sơ rác khi form “Thêm người ở” bị từ chối vì phòng đã đủ sức chứa; dữ liệu nay chỉ được chèn sau khi toàn bộ kiểm tra đạt.
6. Số lượng tài sản không còn nhận giá trị 0; thêm hồi quy riêng `tests/p2-modal-data-regression.test.js`.

Bản v4.6.3 giữ nguyên toàn bộ P0/P1/P2 trước đó và xử lý hai lỗi P1 phát hiện khi kiểm tra luồng quản lý thực tế:

1. **Phân quyền hai lớp**: nút/form ngoài quyền được ẩn hoặc khóa theo vai trò; mọi handler ghi dữ liệu vẫn kiểm tra lại quyền để không còn hiện tượng “báo đã lưu rồi dữ liệu biến mất” khi máy chủ từ chối.
2. **Hạn hóa đơn thống nhất**: hóa đơn lẻ và hóa đơn hàng loạt cùng dùng ngày thu hàng tháng của hợp đồng (1–28), không còn cộng nhầm số ngày vào ngày hiện tại.
3. Kế toán chỉ thao tác tiền, hóa đơn, sổ cọc, nhắc nợ và dịch vụ; nhân viên chỉ thao tác CRM, sự cố, điện nước và tạo thông báo; các màn hình còn lại chuyển sang chỉ xem.
4. Action đặc biệt khớp máy chủ: chỉ chủ nhà/quản lý được giữ chỗ, tạo/chuyển/trả phòng và mở khóa kỳ điện nước; chỉ chủ nhà được quản lý nhân sự, đổi mật khẩu chủ và khôi phục dữ liệu.
5. Thêm hồi quy riêng `tests/p1-permission-regression.test.js` để khóa ma trận quyền và công thức hạn thanh toán.

Bản này tiếp tục giữ nguyên các hoàn thiện P2 của v4.6.2:

1. Dashboard đưa **Việc cần xử lý hôm nay** lên trước biểu đồ; KPI tách thành chỉ số cần chú ý và chỉ số tham khảo.
2. Nút nhanh desktop ưu tiên đúng việc hằng ngày: tìm kiếm, người ở, ghi điện nước và lập hóa đơn.
3. Mục CRM được gọi thống nhất là **Khách & lịch hẹn** để người quản lý hiểu ngay chức năng.
4. Tab cổng cư dân không còn bị thanh đồng bộ/header che khi cuộn trên màn hình hẹp.
5. Toàn bộ nút đóng modal có tên truy cập; badge, chú thích và mô tả quan trọng được tăng cỡ chữ.

Các sửa lỗi P1 tiếp tục gồm:

1. Đăng nhập bản mở trực tiếp bằng `index.html` hoạt động đúng; cờ quyền cục bộ không thể mở trang quản lý khi đang kết nối máy chủ.
2. Khách xem được giờ bận thật qua API chỉ trả thời gian, không lộ tên/SĐT/ghi chú; máy chủ vẫn khóa nguyên tử khi gửi lịch.
3. Chỉ phòng trống hoặc thật sự sắp trống mới xuất hiện/nhận lịch; phòng đang thuê lâu dài bị chặn.
4. Slug căn trọ được lưu vào Google Sheets; đường dẫn riêng không đổi giữa các thiết bị.
5. Tìm kiếm có debounce, giữ focus và tự gắn lại nhãn bảng mobile sau khi lọc.
6. Cổng cư dân xác minh phiên trước khi render và thu hồi đúng phiên máy chủ khi đăng xuất.
7. Biểu đồ công nợ tuân theo đúng tháng và căn trọ đang chọn.

Nền tảng v4.6 P2 tiếp tục gồm:

1. **Cổng cư dân đầy đủ**: QR thanh toán, PDF hóa đơn, đổi PIN, báo sự cố, timeline xử lý và thông báo.
2. **CRM đúng 7 bước**: Yêu cầu mới → Đã liên hệ → Đã hẹn → Đã xem → Giữ chỗ → Ký hợp đồng → Không phù hợp.
3. **Đổi lịch nguyên tử trên máy chủ**, chặn hai khách cùng phòng/ngày/giờ; tìm kiếm, lọc ngày và phân trang lịch hẹn.
4. **Dashboard đúng số vận hành**: tỷ lệ lấp đầy chỉ tính phòng đang thuê; giữ chỗ tách riêng; có doanh thu, công nợ, HĐ sắp hết, phòng sắp trống và sự cố chưa xử lý.
5. **Trang phòng tốt hơn**: URL riêng, gallery có điều hướng bàn phím/thumbnail, địa chỉ mở Google Maps, chính sách, ngày trống, Gọi/Zalo.
6. **Dễ đọc và dễ dùng hơn**: tăng cỡ chữ nhỏ, tương phản, vùng bấm, focus/modal và icon Lucide SVG; dữ liệu mẫu bị khóa khi đã kết nối máy chủ.
7. Giữ nguyên P0/P1: một nguồn giữ chỗ, sổ cọc chuẩn, hợp đồng/người ở/tài khoản tách riêng và nhận/chuyển/trả phòng nguyên tử.

## Cài đặt

Bản chính: **Vercel + tên miền riêng**. Bốn bước, không phải sửa dòng code nào — dán `apps-script/Code.gs` vào Google Apps Script, chạy hàm `setup`, Deploy lấy đường dẫn `/exec`, đưa thư mục này lên Vercel rồi khai đường dẫn đó vào biến môi trường `APPS_SCRIPT_URL`. Chi tiết trong `HUONG-DAN-CAI-DAT.md`.

Không muốn dùng hosting thì dán thêm `apps-script/Index.html` vào Apps Script — đường dẫn `/exec` khi đó chính là website.

Khi nâng từ trước P1, chạy lại `setup()` một lần để tự thêm các cột còn thiếu; dữ liệu cũ không bị xóa. Nâng lên v4.6.6 không thêm sheet/cột/API, nhưng **cần chạy lại `setup()` một lần** để sửa dữ liệu vòng đời từng bị kẹt và bảo đảm trigger sao lưu; sau đó deploy **New version** của Apps Script và tải lại trang để nhận cache mới.

- Đăng nhập quản lý lần đầu: mật khẩu **123456**, đổi ngay trong Cài đặt.
- Cư dân đăng nhập bằng số điện thoại + PIN do quản lý cấp.
- Mở `index.html` bằng trình duyệt cũng chạy được để xem thử (dữ liệu mẫu, mật khẩu `123456`, cư dân `0935123456` / PIN `2580`).

## Giao diện điện thoại

- **Thanh tab dưới màn hình**: Tổng quan · Phòng · Điện nước · Hóa đơn · Khác; mục Khác chứa **Khách & lịch hẹn** và có badge báo khách mới.
- **Nút tròn “+”**: thêm căn trọ, phòng, người thuê, ghi chỉ số, lập hóa đơn — không cần vào từng mục.
- **Bảng biến thành thẻ**: mỗi dòng là một thẻ có nhãn từng cột, hết cảnh vuốt ngang tìm cột.
- **Form mở dạng tấm kéo từ dưới lên**, ô nhập cỡ 16px nên iPhone không tự phóng to, nút Lưu luôn nằm trong tầm ngón cái.
- **Cài như ứng dụng**: thêm vào màn hình chính, mở toàn màn hình, mất mạng vẫn xem được dữ liệu đã tải.

## Đồng bộ

- Lưu là đẩy lên Sheets sau ~1 giây; các máy khác lấy về mỗi 20 giây và ngay khi mở lại màn hình.
- Chấm trạng thái ở góc dưới: xanh (xong) · vàng (đang chạy) · đỏ (lỗi, bấm để thử lại).
- Mất mạng vẫn xem dữ liệu đã tải và nhập các thay đổi thông thường. Nghiệp vụ có tiền hoặc đổi trạng thái nhiều bảng (giữ chỗ, nhận/chuyển/trả phòng) cần máy chủ phản hồi để tránh ghi nửa vời.
- Ảnh tự nén rồi lưu vào Google Drive nên mọi máy đều xem được.
- Sửa tay các trường mô tả trong Google Sheet vẫn đồng bộ ngược về app. Không sửa tay `id`, trạng thái phòng/hợp đồng, `roomId`, liên kết người ở, hóa đơn, thanh toán hoặc sổ cọc; các nghiệp vụ này phải thực hiện trong app để giữ giao dịch nguyên tử.

## Phân quyền

| Vai trò | Có gì |
|---|---|
| Khách (mở link) | Xem phòng, ảnh, giá; đặt lịch xem phòng |
| Cư dân (SĐT + PIN) | Xem phòng đang thuê, tiền cọc, điện nước, hóa đơn, công nợ |
| Quản lý (mật khẩu) | Toàn quyền thêm/sửa/xóa, tải ảnh, thu tiền, nhắc Zalo |

Máy chưa đăng nhập quản lý không tải được người thuê và hóa đơn — máy chủ không gửi những bảng đó. Phiên đăng nhập quản lý giữ 60 ngày trên từng máy.

## Cấu trúc file

```
apps-script/Code.gs       máy chủ dữ liệu (dán vào Apps Script) — bắt buộc
apps-script/Index.html    cả website gộp 1 file — chỉ dùng khi không cài hosting

api/sheets.js             cầu nối trên Vercel: /api/sheets → Apps Script
index.html                giao diện 3 phần: khách / cư dân / quản lý
styles.css                giao diện gốc
mobile.css                lớp giao diện cho điện thoại + trạng thái đồng bộ
app.js                    giao diện và nghiệp vụ chính
p2.js                     quy tắc thuần P2: phễu CRM, trùng lịch, công suất, URL bản đồ
sync.js                   lớp đồng bộ
config.js                 mặc định gọi /api/sheets, không cần sửa
manifest.json / sw.js     cài như ứng dụng, chạy khi mất mạng
vercel.json               cấu hình cache cho Vercel
build-appsscript.py       gộp lại thành apps-script/Index.html sau khi sửa code
```

## Nghiệp vụ giữ nguyên từ v2

Nhiều căn trọ – nhiều phòng, ảnh từng phòng, lọc theo khu vực/giá/trạng thái, đặt lịch xem phòng; người thuê và tài khoản cư dân; ghi chỉ số điện nước với đầu kỳ tự lấy từ tháng trước; lập hóa đơn gộp tiền phòng + điện + nước + phí khác + cọc còn thiếu; ghi nhận thanh toán từng phần; cảnh báo hóa đơn quá hạn; soạn sẵn tin nhắn nhắc thu tiền để dán vào Zalo.

Gửi Zalo tự động vẫn cần Zalo Official Account và một backend riêng — không đặt access token Zalo trong file web công khai.


---

## Cập nhật v4 — Giai đoạn 1 (ổn định để nhập dữ liệu thật)

**Bảo mật**
- Mật khẩu quản lý tối thiểu 10 ký tự; đổi mật khẩu tự đăng xuất mọi thiết bị khác (token cũ bị vô hiệu). Có nút "Đăng xuất thiết bị này" / "Đăng xuất tất cả thiết bị" trong Cài đặt.
- PIN cư dân không còn lưu dạng chữ rõ: máy chủ lưu `pinHash + pinSalt` (SHA-256, salt riêng từng người), so sánh constant-time. Sheet cũ còn PIN rõ sẽ tự chuyển sang hash khi chạy `setup()` hoặc ở lần đăng nhập đầu.
- PIN 6 số do máy chủ sinh, chỉ hiển thị đúng một lần khi tạo/đặt lại; danh sách người thuê chỉ hiện "Đã có PIN / Chưa có PIN".
- Giới hạn đăng nhập sai (quản lý và cư dân) bằng CacheService; khách không còn ghi dữ liệu qua sync — đặt lịch dùng action `book` có kiểm tra + honeypot + rate limit + chặn lịch trùng.
- Vercel bổ sung Content-Security-Policy, Permissions-Policy, X-Frame-Options, Referrer-Policy, X-Content-Type-Options (không ảnh hưởng Google Fonts / ảnh Drive).

**Phiên cư dân**
- Khi có máy chủ, cư dân luôn xác thực qua API; dữ liệu trả về nằm trong `residentSession` riêng (sessionStorage, TTL 12 giờ), không trộn vào kho dữ liệu quản trị. Đăng xuất chỉ xóa phiên, không đụng người thuê trên máy chủ. Có nút "Xóa dữ liệu trên thiết bị này".

**Nghiệp vụ**
- `reconcileRoomStatus()`: trạng thái phòng tự tính lại khi thêm/trả/chuyển phòng người thuê; phòng bảo trì không tự đổi.
- Không xóa cứng người thuê đã có hóa đơn / phòng, căn đã có lịch sử — chuyển sang lưu trữ (`archived`, `moveOutDate`), ẩn khỏi trang khách, giữ hóa đơn để đối chiếu; có nút Khôi phục.
- Điện nước: duy nhất 1 bản ghi mỗi phòng/tháng (đã có thì mở để sửa); đầu kỳ lấy đúng cuối kỳ tháng liền trước, cảnh báo khi bỏ trống tháng; chỉ số gắn hóa đơn đã thanh toán phải mở khóa mới sửa/xóa được.
- Hóa đơn duy nhất theo người thuê + phòng + tháng; đổi phòng/tháng trong form sẽ nạp lại toàn bộ số liệu. Thanh toán qua modal (số tiền lần này, ngày thu, phương thức, ghi chú) và ghi vào mảng `payments` chuẩn bị cho giai đoạn sau.

**Khác**
- Điều hướng mobile: thanh 5 nút (Tổng quan · Phòng · Điện nước · Hóa đơn · Khác); "Khác" mở bottom sheet Người thuê / Khách & lịch hẹn (kèm badge số khách mới) / Cài đặt / Quay về trang khách. Vùng bấm ≥44px, có aria-label và focus rõ.
- Tên thương hiệu + hotline lấy từ Cài đặt; cỡ chữ desktop tăng (nội dung ≥13px, chú thích ≥11px); nút lưu có trạng thái đang xử lý, form không tự đóng khi lưu lỗi.
- "Khôi phục dữ liệu mẫu" ẩn ở bản dùng thật (chỉ hiện khi `localStorage.huy_rooms_demo = '1'`). Nhập JSON có kiểm tra cấu trúc, xem trước số bản ghi và tự tải bản sao lưu trước khi áp dụng. File sao lưu: `huy-rooms-backup-v4-phase1.json`.
- Thêm cột schema mới (archived, pinHash/pinSalt/pinUpdatedAt/moveOutDate, payments, brandName): chạy lại `setup()` để tự thêm cột **không mất dữ liệu** (đọc theo tên cột cũ, ghi lại theo cấu trúc mới), chạy nhiều lần vẫn an toàn.


## Cập nhật v4 — Giai đoạn 2: Nghiệp vụ hợp đồng thuê

### Mô hình dữ liệu mới (5 sheet mới, tự tạo khi chạy lại `setup`)
| Sheet | Collection | Nội dung |
|---|---|---|
| `HopDong` | leases | Hợp đồng: phòng, người đại diện thanh toán, ngày bắt đầu/kết thúc, ngày thu tiền, **giá thuê & cọc chốt trên hợp đồng (snapshot)**, trạng thái `draft → active → ending → ended` (hoặc `cancelled`), lịch sử chuyển phòng `roomHistory`, lịch sử gia hạn `renewals`, thanh lý (trừ cọc / hoàn cọc / ghi chú) |
| `NguoiO` | leaseOccupants | Nhiều người ở gắn vào một hợp đồng; vai trò `primary` (đại diện thanh toán) / `member`; ngày vào ở `joinedAt`, ngày rời `leftAt` |
| `TaiKhoan` | accounts | Tài khoản đăng nhập cư dân **tách khỏi hồ sơ người ở** (SĐT + PIN băm); gắn vào occupant qua `occupantId` |
| `TaiSan` | assets | Tài sản theo phòng: tên, số lượng, tình trạng, ghi chú, ảnh |
| `BanGiao` | handoverItems | Biên bản bàn giao theo hợp đồng: `phase=checkin` (đầu vào) / `checkout` (đầu ra), số lượng và tình trạng từng hạng mục |

Hóa đơn (`HoaDon`) có thêm cột `leaseId` gắn về hợp đồng.

### Nguyên tắc nghiệp vụ
- **Giá snapshot**: sửa giá niêm yết của phòng KHÔNG làm đổi giá của hợp đồng đang chạy; hóa đơn lấy giá theo hợp đồng.
- **Một phòng nhiều người ở, một người đại diện thanh toán**: hóa đơn đứng tên người đại diện. Đổi đại diện → hóa đơn cũ giữ nguyên tên người cũ, hóa đơn mới đứng tên người mới.
- **Chuyển phòng có ngày hiệu lực**: phòng cũ được lưu trong `roomHistory` (từ ngày – đến ngày), trạng thái hai phòng tự cập nhật.
- **Thanh lý**: nhập số tiền trừ vào cọc → hệ thống tính tiền hoàn khách; hóa đơn, thanh toán, biên bản bàn giao vẫn xem được trong chi tiết hợp đồng.
- **Không xóa cứng**: hợp đồng/người ở đã phát sinh hóa đơn chỉ được lưu trữ (kết thúc/rời đi), không xóa.

### Quy trình trên giao diện (mục **Hợp đồng** — trên điện thoại nằm trong nút *Khác*)
1. Giữ chỗ / đặt cọc: `+ Hợp đồng mới` → nhập cọc đã nhận → phòng chuyển **Giữ chỗ**.
2. `Nhận phòng`: chọn ngày, kiểm kê bàn giao tài sản đầu vào → hợp đồng **Đang hiệu lực**, phòng **Đã thuê**.
3. Trong *Chi tiết hợp đồng* (trang dòng thời gian): thêm/bớt người ở, đổi đại diện, `Gia hạn`, `Chuyển phòng`, `Trả phòng / Thanh lý`.
4. Tài sản từng phòng khai ở nút `Tài sản` trong bảng phòng.

### Cảnh báo
Bảng điều khiển và mục Hợp đồng tự cảnh báo hợp đồng còn **30 / 15 / 7 ngày** là hết hạn và danh sách **phòng sắp trống**.

### Migration
Chạy lại hàm `setup()` trong Apps Script rồi **Deploy → New deployment**. `setup` sẽ:
- tạo 5 sheet mới và thêm cột `leaseId` cho `HoaDon`;
- chuyển mỗi người thuê đang hoạt động thành một hợp đồng `active` (giá chốt theo giá phòng hiện tại), kèm người ở đại diện và tài khoản đăng nhập (PIN giữ nguyên);
- gắn `leaseId` cho các hóa đơn cũ.
Chạy `setup` nhiều lần **không tạo dữ liệu trùng**. Bản chạy cục bộ (không máy chủ) tự chuyển đổi tương tự ngay khi mở web.


## Cập nhật v4 — Giai đoạn 3: Bộ máy điện nước – dịch vụ – hóa đơn – thanh toán

### Sheet mới (tự tạo khi chạy lại `setup`)
| Sheet | Collection | Nội dung |
|---|---|---|
| `DichVu` | serviceDefinitions | Dịch vụ (wifi, rác, giữ xe…): cách tính **cố định/phòng · theo người · theo số lượng · nhập tay · theo đồng hồ**, đơn giá, thuế, và **lịch sử giá theo tháng** |
| `DVHopDong` | leaseServices | Dịch vụ gắn vào từng hợp đồng: số lượng, giá riêng, miễn giảm, ngày áp dụng/ngừng |
| `ThanhToan` | payments | **Sổ thanh toán**: mỗi lần thu là một giao dịch (invoiceId, amount, paidAt, method, reference, note, createdBy…). Giao dịch đã ghi **không sửa/xóa** — sai thì tạo **giao dịch đảo** (`kind=reversal`, số âm, `reversalOf`). `amountPaid` và trạng thái hóa đơn luôn tính lại từ sổ này |
| `SoCoc` | depositLedger | **Sổ cọc** tách khỏi doanh thu: thu / hoàn / trừ cọc theo hợp đồng, có lịch sử đầy đủ |
| `NhacNo` | reminders | Lịch sử tin nhắn nhắc nợ đã gửi (trước hạn / đến hạn / quá hạn) |
| `GiuCho` | reservations | **Phiếu giữ chỗ P0**: một nguồn duy nhất cho khách, phòng, khoảng ngày, số tiền, trạng thái và liên kết bút toán `SoCoc` |

Bổ sung cột: `KyDienNuoc` thêm `status (nháp/đã chốt), lockedAt, unlockNote, imageIds (ảnh công tơ)`; `HoaDon` thêm `code, serviceLines, adjustAmount, adjustNote, issuedAt`; `CaiDat` thêm `bankCode, bankAccount, bankAccountName` (VietQR).

### Màn “Chốt điện nước tháng” (mục Điện nước)
- Chọn **căn + tháng** → tất cả phòng đang thuê hiện trên **một màn hình**, nhập cuối kỳ liên tục không mở modal từng phòng; đầu kỳ tự lấy từ cuối kỳ tháng trước; mỗi ô lưu **nháp** ngay khi nhập.
- Cảnh báo tự động: **số âm**, **tăng bất thường** (>2,5× tháng trước), **thiếu kỳ trước**, **phòng chưa nhập**.
- Nút 📷 chụp ảnh công tơ, lưu theo bản ghi; cư dân xem được ảnh của phòng mình.
- **Chốt kỳ** khóa toàn bộ số liệu (chặn khi còn số âm, liệt kê phòng bị bỏ qua). Kỳ đã chốt muốn sửa phải **Mở khóa kèm lý do** — lý do được lưu lại.

### Tạo hóa đơn hàng loạt
Nút 🧾 trong mục Điện nước: preview toàn căn/tháng trước khi phát hành; phòng thiếu dữ liệu bị **bỏ qua kèm lý do** (chưa nhập, chưa chốt, số âm, đã có hóa đơn); từng phòng có ô **điều chỉnh ± kèm ghi chú**; phát hành **không bao giờ tạo trùng** (kiểm tra theo hợp đồng + tháng); mỗi hóa đơn có **mã riêng** (HDYYYYMM-Phòng) và chốt sẵn các dòng dịch vụ theo giá của tháng đó.

### Nguyên tắc tiền bạc
- **Đổi giá dịch vụ có tháng hiệu lực** — hóa đơn các tháng trước giữ nguyên giá cũ.
- **Sổ thanh toán bất biến**: 2 lần thu một phần = 2 giao dịch; muốn hủy thì tạo giao dịch đảo (ghi lý do), công nợ tự tính lại; hóa đơn đã có tiền thu không xóa được.
- **Cọc không phải doanh thu**: hóa đơn hàng loạt không gộp cọc; báo cáo loại phần cọc khỏi phải thu/đã thu; sổ cọc theo dõi riêng "đang giữ – đã trừ – đã hoàn".
- **Giữ chỗ luôn có sổ**: mỗi phiếu `GiuCho` phải có đúng một bút toán thu ban đầu trong `SoCoc`; hủy/hết hạn phải ghi hoàn hoặc trừ hết số dư trước khi mở lại phòng.

### PDF & VietQR
Mỗi hóa đơn có nút **PDF** (cả phía quản lý và cư dân) mở bản in thương hiệu kèm mã hóa đơn; khai báo ngân hàng trong Cài đặt thì hóa đơn tự chèn **mã VietQR đúng số tiền còn lại + nội dung = mã hóa đơn**. Mỗi giao dịch thu có **Phiếu thu** in được. (In → chọn "Lưu thành PDF" trên điện thoại/máy tính.)

### Nhắc nợ & báo cáo
- Nút **Nhắc** trên hóa đơn: 3 mẫu tin (trước hạn / đến hạn / quá hạn) kèm thông tin chuyển khoản; bấm gửi sẽ sao chép nội dung và **ghi lịch sử đã gửi**.
- Tổng quan có khối **Thu chi theo tháng/căn**: phải thu, đã thu, còn nợ (không gồm cọc) + cọc đang giữ; nút **xuất Excel/CSV** hóa đơn và sổ thu theo tháng/căn.

### Migration
Chạy lại `setup()` rồi Deploy phiên bản mới: các lần thu cũ trong hóa đơn được chuyển thành giao dịch trong `ThanhToan`, cọc trên hợp đồng chuyển vào `SoCoc` (kể cả trừ/hoàn của hợp đồng đã thanh lý). Chạy nhiều lần không trùng. Bản chạy cục bộ tự chuyển đổi tương tự khi mở web.


## Cập nhật v4 — Giai đoạn 4: Cổng cư dân hoàn chỉnh

### Sheet mới (tự tạo khi chạy lại `setup`)
| Sheet | Collection | Nội dung |
|---|---|---|
| `SuCo` | maintenanceTickets | Sự cố cư dân báo: tiêu đề, loại, mô tả, mức độ (thấp/bình thường/cao/khẩn), ảnh, trạng thái `new → received → in_progress → waiting → done/cancelled`, người phụ trách, **timeline statusHistory** và kết quả xử lý |
| `ThongBao` | notifications | Thông báo cho cư dân: hóa đơn mới, bảo trì, thông báo chung (gửi tất cả hoặc từng người); `readAt` cho thông báo cá nhân |

Bổ sung cột: `TaiKhoan` thêm `sessionSeed` (bí mật phiên — không bao giờ đồng bộ về client); `NguoiThue` thêm `zaloUserId` (dùng cho Zalo OA).

### Cổng cư dân (mobile-first, tốt từ 360px)
5 thẻ: **Trang chủ · Hóa đơn · Hợp đồng · Sự cố · Thông báo** (chấm đỏ đếm chưa đọc / đang mở).
- **Trang chủ**: phòng & hợp đồng, tổng cần thanh toán + hạn gần nhất, cọc đang giữ (từ sổ cọc), thông báo mới, sự cố đang xử lý, khu tài khoản (đổi PIN, đăng xuất mọi thiết bị, xóa dữ liệu máy).
- **Hóa đơn**: chạm từng dòng mở chi tiết — đủ khoản mục + dịch vụ + điều chỉnh, **chỉ số đầu-cuối**, nút xem **ảnh công tơ**, **lịch sử thanh toán** từ sổ (kể cả giao dịch bị hủy), **VietQR đúng số tiền còn lại** và nút PDF.
- **Hợp đồng**: thời hạn, tiền phòng, ngày thu, người ở + vai trò, **tài sản bàn giao khi nhận phòng** (kèm ảnh được phép xem), sổ cọc.
- **Sự cố**: cư dân tạo kèm tối đa 3 ảnh; xem **timeline** tiếp nhận → phân công → xử lý → hoàn tất + kết quả.
- **Thông báo**: hóa đơn mới (tự sinh khi phát hành), sắp đến hạn / quá hạn / hợp đồng sắp hết (tự suy ra), lịch bảo trì và thông báo chung; nút đánh dấu đã đọc.

### Bảo mật cổng cư dân
- Cư dân **không bao giờ** nhận: ghi chú nội bộ (người thuê / phòng / hợp đồng / lý do mở khóa chỉ số), dữ liệu người khác, PIN/hash, `sessionSeed`, token Zalo hay cấu hình quản trị. Bundle chỉ chứa đúng dữ liệu của phòng/hợp đồng mình.
- Sự cố tạo từ cổng cư dân được máy chủ **tự gắn** tenant/lease/room theo phiên — dữ liệu giả mạo từ client bị bỏ qua.
- **Đổi PIN**: bắt buộc nhập đúng PIN cũ (khóa 10 phút sau 5 lần sai); đổi xong tự hủy phiên mọi thiết bị.
- **Đăng xuất mọi thiết bị**: đổi `sessionSeed` → mọi phiên đã lưu (kể cả máy đang dùng) hết hiệu lực; mở lại cổng cư dân sẽ yêu cầu đăng nhập lại.
- Giới hạn tần suất: đăng nhập sai, thao tác phiên, gửi sự cố (10 yêu cầu/ngày/số).

### Quản lý (mục 🔧 Sự cố & thông báo)
Danh sách sự cố có lọc theo trạng thái; nút Tiếp nhận / Phân công / Bắt đầu / Chờ / ✔Xong (nhập kết quả — cư dân nhận thông báo tự động) / Hủy — mỗi bước ghi vào timeline. Bên dưới là khung **gửi thông báo** chung hoặc riêng từng cư dân.

### Zalo OA (adapter — KHÔNG hard-code token)
Nút “Gửi Zalo OA” trong hộp Nhắc thanh toán. Cấu hình bằng **Script Properties** trong Apps Script (Project Settings → Script Properties):
- `ZALO_OA_TOKEN` — access token của Official Account (không bao giờ dán vào code hay file web).
- `ZALO_OA_MOCK` = `1` — chạy thử: phản hồi ghi rõ **mock, KHÔNG gửi thật**; lịch sử nhắc lưu kênh `zalo_mock (thử — chưa gửi thật)`.
- Điền cột `zaloUserId` trong sheet `NguoiThue` (user id người theo dõi OA, không phải SĐT).
Chưa cấu hình thì hệ thống nói thẳng "chưa cấu hình" kèm hướng dẫn — **không bao giờ giả vờ đã gửi**. Gửi thật thành công mới ghi kênh `zalo_oa`.


## Cập nhật v4 — Giai đoạn 5: Trang bán phòng + CRM khách xem

### Trang khách
- **URL riêng cho từng căn và từng phòng**: `#/can/<slug>` và `#/phong/<slug>` (slug tự sinh từ tên, sửa được trong form). Mỗi trang tự đặt title + meta description; trang phòng có gallery, giá/cọc, diện tích, số người, **ngày có thể vào ở**, đơn giá điện nước, tiện nghi và **chính sách**.
- Danh sách **ưu tiên phòng trống**, kế đến phòng **Sắp trống** (đang thuê nhưng có ngày vào ở hoặc hợp đồng hết hạn ≤45 ngày — hiện badge kèm ngày). **Phòng bảo trì không công khai**; ghi chú nội bộ của phòng KHÔNG trả về khách vãng lai (chặn từ máy chủ).
- Bộ lọc: khu vực, giá, **diện tích, loại phòng, số người, tiện nghi (chip), ngày vào ở**.
- Nút **Gọi** (hotline từ Cài đặt), **Zalo** (số Zalo riêng hoặc hotline) và **Đặt lịch** rõ ràng trên trang phòng.
- Hiệu năng & tiếp cận: ảnh `loading="lazy"`, skeleton shimmer khi tải, `prefers-reduced-motion`, `:focus-visible`, aria-label và alt đầy đủ.

### Đặt lịch xem phòng
- Chọn **khung giờ theo giờ làm việc** (Cài đặt: giờ mở–đóng); khung đã có khách tự khóa.
- **Chống trùng lịch thật sự**: mỗi khung giờ của một phòng chỉ nhận một khách (chéo cả SĐT), kiểm tra cả máy chủ lẫn bản chạy máy.
- Bắt buộc **tích đồng ý chính sách bảo mật**; honeypot và rate limit giữ nguyên. Phòng trống *và* phòng sắp trống đều đặt được lịch xem; bảo trì/đang giữ chỗ thì không.

### CRM khách xem phòng (mục Khách & lịch hẹn)
- Phễu chuẩn P2: **new → contacted → appointment_confirmed → viewed → reserved → converted → lost** (Yêu cầu mới → Đã liên hệ → Đã hẹn → Đã xem → Giữ chỗ → Ký hợp đồng → Không phù hợp). Hợp đồng nháp được thể hiện bằng liên kết `convertedLeaseId`, không tạo thêm một tầng làm lệch báo cáo phễu.
- Mỗi lead có **nguồn khách** (website/Facebook/Zalo/ghé trực tiếp/giới thiệu) và **lịch sử chăm sóc** — nút 💬 ghi chú mỗi lần gọi/nhắn; đổi trạng thái, đổi lịch (chống trùng) đều tự ghi log.
- **Giữ chỗ**: ghi tiền giữ + hạn giữ, phòng chuyển "Đã giữ chỗ" và ngừng nhận lịch xem. **Quá hạn chưa ký** → hệ thống cảnh báo, quản lý **xác nhận** mới trả phòng về Đang trống và đóng lead (không tự động âm thầm).
- **Chuyển lead → hợp đồng không nhập lại gì**: bấm "→ Hợp đồng" là form hợp đồng mở sẵn tên, SĐT, phòng; tiền giữ chỗ tự tính vào cọc đã đóng. Lưu xong lead tự thành "Đã ký HĐ" và liên kết tới hợp đồng.

### Cột/sheet thay đổi (chạy lại `setup` là xong)
`CanTro` +slug; `Phong` +slug, availableFrom (ngày có thể vào ở), policies (chính sách); `LichHen` +source, careLog, reserveAmount, reserveUntil, convertedLeaseId; `CaiDat` +workStart, workEnd, slotMinutes, zaloPhone. Migration đổi trạng thái lịch hẹn cũ sang phễu CRM (confirmed→hẹn đã chốt, done→đã xem, cancelled→không thành) — idempotent.


## Cập nhật v4 — Giai đoạn 6: Trải nghiệm quản trị chuẩn SaaS

### Dashboard & biểu đồ
- Bộ lọc **tháng + căn** áp cho toàn bộ chỉ số: tổng phòng (kèm trống/giữ chỗ/bảo trì), tỷ lệ lấp đầy, doanh thu dự kiến – đã thu – công nợ (cọc luôn tách riêng), hợp đồng sắp hết hạn, phòng sắp trống, lịch hẹn mới, sự cố mở quá 3 ngày.
- Khối "Việc cần xử lý hôm nay" nằm ngay sau KPI chính, gom nợ đến hạn, khách mới, hợp đồng sắp hết và sự cố đang mở. Chỉ số tham khảo nằm sau danh sách việc; 3 biểu đồ SVG đặt cuối để không đẩy công việc gấp xuống dưới màn hình.

### Bảng dữ liệu & tìm kiếm
- Hóa đơn, người thuê, hợp đồng, lịch sử chỉ số: **tìm kiếm + lọc + sắp xếp + phân trang**; trạng thái bộ lọc **được lưu** (localStorage) — rời trang quay lại vẫn nguyên.
- **Tìm nhanh Ctrl/Cmd+K** (desktop) và nút tìm ở topbar + menu Khác (mobile): tìm phòng, người thuê, hợp đồng, hóa đơn, lead, sự cố và các hành động (mở trang, tạo mới); điều hướng bằng ↑ ↓ Enter Esc.

### Phân quyền & nhật ký
- 4 vai trò: **Chủ nhà** (tất cả) · **Quản lý** (tất cả trừ nhân sự) · **Kế toán** (hóa đơn, sổ thu, sổ cọc, nhắc nợ, dịch vụ) · **Nhân viên** (lịch hẹn, sự cố, điện nước). Mỗi nhân viên có **tài khoản + mật khẩu riêng** (chủ nhà cấp trong Cài đặt, mật khẩu hiện đúng một lần) và **phạm vi căn**.
- Thực thi 2 tầng: **máy chủ chặn ghi theo collection ngoài vai trò** (thay đổi bị bỏ qua và client được báo rõ); giao diện ẩn thêm nút theo hành động xem/tạo/sửa/duyệt/xuất và lọc theo căn được giao. Lưu ý trung thực: mức hành động/căn là chốt ở giao diện — hàng rào cứng ở máy chủ là theo vai trò × bảng dữ liệu.
- **Nhật ký (sheet NhatKy)**: ai · làm gì · lúc nào · bản ghi nào; dữ liệu quan trọng (hóa đơn, sổ thu, hợp đồng, phòng, chỉ số, nhân sự…) có **before/after**. Máy chủ tự ghi — client không ghi đè được nhật ký, kế toán/nhân viên không tải được nhật ký và danh sách nhân sự. Bản chạy máy (không máy chủ) ghi nhật ký cục bộ cho các thao tác tiền.

### Giao diện
- Icon **Lucide SVG** thay toàn bộ ký hiệu/emoji ở điều hướng và nút nghiệp vụ; tone be–trắng giữ nguyên.
- Đọc dễ hơn: cỡ chữ nền 15.5px, tương phản chữ phụ tăng, bảng thoáng hơn; form dài (phòng, hợp đồng) chia section.
- Mobile: modal thành **bottom sheet**, hàng nút Lưu **dính đáy + chừa safe-area** nên không che trường cuối; cuộn có scroll-padding.
- Empty state nào cũng gợi ý bước tiếp theo (ví dụ: chưa có hóa đơn → nút mở chốt điện nước); skeleton khi chờ; lỗi kèm cách khắc phục (ghi bị chặn do vai trò → toast nêu rõ nhờ ai xử lý).
- prefers-reduced-motion, :focus-visible, aria-label, điều hướng bàn phím trong palette.

### Sửa lỗi quan trọng
- **sync.js thiếu collection từ giai đoạn 3–5**: sổ thu, sổ cọc, dịch vụ, nhắc nợ, sự cố, thông báo trước đây KHÔNG được đẩy/kéo với máy chủ ở bản chạy thật (kiểm thử cũ không phủ tới). Đã bổ sung đủ; auditLog chỉ kéo về, không đẩy lên.

### Sheet mới (chạy lại `setup`): `NhanSu`, `NhatKy`. Không đổi công thức tính tiền hay migration cũ.


## Cập nhật v4 — Bản PRODUCTION (hardening)

### Bảo mật đã siết & đã kiểm thử
- **XSS**: mọi dữ liệu người nhập đi qua `esc()`; smoke test bơm tên phòng/người thuê chứa mã độc và xác nhận không phần tử độc nào được tạo, không script nào chạy (trang khách, bảng quản trị, palette).
- **ID injection từ Sheet**: máy chủ chỉ nhận id dạng `[A-Za-z0-9_-]{1,80}` (sync lẫn action `book`, `setStaffPass`); client lọc thêm một lớp khi nạp dữ liệu. Các bảng hóa đơn / người thuê / CRM đã chuyển sang **`data-act`/`data-id` + event delegation** — không nhét ID từ Sheet vào chuỗi inline handler nữa (các nút còn lại dùng id do app tự sinh, đã qua hàng rào SAFE_ID).
- **CSRF**: API là JSON POST kèm token trong body, không dùng cookie phiên → không có bề mặt CSRF cổ điển; proxy Vercel không đọc credential từ trình duyệt.
- **Token/PIN**: token chỉ nằm trong localStorage máy đã đăng nhập; test khẳng định phản hồi khách không chứa token, gói cư dân và sync quản lý không chứa pin/pinHash/passHash/sessionSeed.
- **Brute force**: mật khẩu quản lý khóa sau 8 lần sai/10 phút; PIN cư dân khóa sau 5 lần sai theo SĐT — cả hai có test.
- **Spam lịch hẹn**: honeypot + 3 lịch/SĐT+phòng/giờ + 30 lịch/giờ toàn hệ thống — test lại sau mọi thay đổi.
- **Upload giả**: máy chủ soi **magic bytes** (JPEG/PNG/WebP/GIF); file text đội lốt `image/png` bị chặn — có test hai chiều.
- **Truy cập chéo cư dân**: giữ nguyên các test phase 4 (2 cư dân khác phòng), chạy lại toàn bộ trên bản này.

### Xung đột 2 thiết bị (dữ liệu tài chính)
Hóa đơn / sổ thu / sổ cọc / hợp đồng / chỉ số: nếu máy này đang sửa dở mà máy khác đã sửa cùng bản ghi, khi đồng bộ về app **hiện cảnh báo đích danh bản ghi** và ghi một dòng `conflict` vào nhật ký (kèm 2 phiên bản) thay vì âm thầm last-write-wins. Bản máy chủ được giữ để hai máy thống nhất; người dùng đối chiếu nhật ký rồi sửa lại nếu cần. Sổ thu vốn append-only nên va chạm thực tế chủ yếu ở hóa đơn/hợp đồng.

### Sao lưu & khôi phục (đã kiểm thử roundtrip)
- **Tự động trên máy**: mỗi ngày một bản vào localStorage, giữ 7 bản; danh sách + nút khôi phục trong Cài đặt. Trước mọi lần khôi phục/nhập, app tự tải một file JSON dữ liệu hiện tại về máy.
- **Tự động trên máy chủ**: hàm `backupSpreadsheet` copy nguyên spreadsheet vào thư mục "Huy Rooms - Sao luu", giữ 14 bản. Vào Apps Script → Triggers → thêm trigger **hằng ngày** cho hàm này (1 phút thao tác).
- **Thủ công**: nút xuất JSON như cũ. Quy trình khôi phục: Cài đặt → Khôi phục dữ liệu → chọn file/bản tự lưu → xem tóm tắt số bản ghi → xác nhận. Test tự động đã diễn tập: xóa sạch hóa đơn + người thuê rồi khôi phục đủ, nội dung khớp.

### Ngưỡng vận hành khuyến nghị (Apps Script + Sheets)
Đo theo giới hạn nền tảng (Sheets 10 triệu ô; Apps Script ~6 phút/lần chạy, ~30 request đồng thời, UrlFetch 20k/ngày):
| Hạng mục | Thoải mái | Bắt đầu chậm | Hành động |
|---|---|---|---|
| Số phòng | ≤ 60 | 100+ | cân nhắc Supabase |
| Hóa đơn tích lũy | ≤ 15.000 dòng (~3 năm × 60 phòng × 12 + lịch sử) | 30.000+ | lưu trữ bớt năm cũ sang file khác |
| Sổ thu/cọc | ≤ 30.000 dòng | 60.000+ | như trên |
| Ảnh | ≤ 1MB/ảnh, ~10 ảnh/phòng (ảnh nằm Drive, Sheet chỉ giữ id → không nặng Sheet) | — | — |
| Người dùng quản trị đồng thời | ≤ 5 | 10+ | Supabase |
| Cư dân đăng nhập/ngày | ≤ 200 | 500+ | Supabase |
| Nhật ký NhatKy | dọn 6 tháng/lần (copy sang file lưu trữ rồi xóa dòng cũ) | — | — |
Bản này đã thêm **đóng dấu LASTSTAMP theo từng sheet**: poll đồng bộ lúc rảnh bỏ qua hẳn các sheet không đổi (test xác nhận), giảm mạnh số lần đọc Sheets ở chế độ nhiều thiết bị mở app cả ngày.
Khi vượt ngưỡng: xem `MIGRATION-SUPABASE.md` (schema + RLS + migration + rollback đầy đủ; KHÔNG tự chuyển khi chưa tạo project).

### Xử lý lỗi thường gặp
| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Vai trò của bạn không được sửa: …" | nhân viên thao tác ngoài quyền | nhờ chủ nhà/quản lý làm, hoặc chủ nhà đổi vai trò trong Cài đặt |
| "XUNG ĐỘT DỮ LIỆU TÀI CHÍNH…" | 2 máy sửa cùng bản ghi | mở Cài đặt → Nhật ký, so 2 phiên bản, sửa lại bản đúng |
| "Nhập sai quá nhiều lần" | brute force guard | chờ 10 phút; nếu quên mật khẩu chủ: Apps Script → Project Settings → Script Properties → sửa `ADMIN_PASSWORD` |
| Nhân viên quên mật khẩu | — | chủ nhà: Cài đặt → Nhân sự → nút Mật khẩu (bản mới hiện một lần) |
| Ảnh tải lên bị từ chối | file không phải ảnh thật | chụp/chọn lại ảnh JPEG/PNG từ máy |
| Mất dữ liệu trên một máy | — | Cài đặt → Khôi phục: bản tự lưu 7 ngày, hoặc file JSON, hoặc bản copy spreadsheet hằng ngày |

### Cài đặt (tóm tắt đầy đủ trong HUONG-DAN-CAI-DAT.md)
1. **Apps Script**: dán `Code.gs` + `Index.html` → Run `setup` → Deploy Web App (Execute as me / Anyone). Script Properties: `ADMIN_PASSWORD` (bắt buộc đổi), `ZALO_OA_TOKEN` + `ZALO_OA_MOCK` (tùy chọn), `IMAGE_FOLDER_ID`/`BACKUP_FOLDER_ID` tự tạo. Thêm trigger hằng ngày cho `backupSpreadsheet`.
2. **Vercel**: import repo, không cần build step; biến môi trường `APPS_SCRIPT_URL` = URL Web App (dùng trong `api/sheets.js`), còn `config.js` giữ `apiUrl:'/api/sheets'`.
3. **Migration**: chạy lại `setup` sau mỗi lần nâng cấp — idempotent, tự thêm sheet/cột mới, không đụng dữ liệu cũ.


## v4.1 Production Fixed — tóm tắt
Phân quyền + phạm vi căn thực thi tại máy chủ (authContext, propertyIdOfRecord, forbidden chuẩn); optimistic concurrency (baseUpdatedAt → conflicts, không ghi đè); sổ thu/sổ cọc append-only + chống trùng hóa đơn/chỉ số + enum whitelist; 0 inline handler chứa dữ liệu (dispatcher data-call); phiên cư dân theo thiết bị (hash, 12h, logout từng máy); DTO cư dân whitelist; ảnh nghiệp vụ kho Drive private; ngày giờ Asia/Ho_Chi_Minh; sw.js an toàn; logout xóa dữ liệu nhạy cảm. Chi tiết: CHANGELOG-V4.1.md · SECURITY.md · MIGRATION-V4-TO-V4.1.md · TEST-REPORT-V4.1.md.
