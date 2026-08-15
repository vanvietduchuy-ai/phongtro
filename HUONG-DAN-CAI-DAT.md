# Hướng dẫn cài — bản đặt trên Vercel (có tên miền riêng)

Tổng cộng 4 bước, khoảng 10 phút, **không phải sửa dòng code nào**: đường dẫn máy chủ khai bằng biến môi trường trên Vercel.

Sơ đồ: **tên miền của anh (Vercel) → /api/sheets → Apps Script → Google Sheets + Drive**

---

## Bước 1 — Dựng máy chủ dữ liệu (Apps Script)

1. Mở [script.google.com](https://script.google.com) → **New project** → đổi tên thành **Huy Rooms**.
2. Xóa hết chữ trong `Code.gs`, dán toàn bộ file **apps-script/Code.gs**, bấm **Lưu**.
   *(Chỉ cần file này. File `apps-script/Index.html` dành cho cách không dùng hosting — xem phụ lục.)*
3. Ô chọn hàm trên thanh công cụ → chọn **setup** → **Run**.
   Google hỏi quyền: **Review permissions → chọn tài khoản → Advanced → Go to Huy Rooms (unsafe) → Allow**.
   Chạy xong, Google tự tạo bảng **Huy Rooms - Dữ liệu**, thư mục ảnh và trigger sao lưu hằng ngày trong Drive của anh.
4. **Deploy → New deployment** → bánh răng **Select type → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → copy đường dẫn kết thúc bằng `/exec`.

Mở thử đường dẫn đó, hiện dòng chữ *“Máy chủ Huy Rooms đang chạy”* là đúng.

## Bước 2 — Đưa website lên Vercel

Cách nhanh (máy có Node):

```bash
npm i -g vercel
cd huy-rooms-v4.1-production-fixed
vercel            # lần đầu: đăng nhập, cứ Enter theo mặc định
vercel --prod
```

Hoặc qua GitHub: đẩy thư mục lên repo → [vercel.com/new](https://vercel.com/new) → Import →
Framework Preset **Other**, Build Command và Output Directory **để trống** → Deploy.

## Bước 3 — Khai đường dẫn máy chủ

Trên Vercel: mở project → **Settings → Environment Variables** → **Add**:

| Ô | Điền |
|---|---|
| Key | `APPS_SCRIPT_URL` |
| Value | đường dẫn `/exec` copy ở Bước 1 |
| Environments | chọn cả Production, Preview, Development |

Save xong vào tab **Deployments → dấu ⋯ ở bản mới nhất → Redeploy**. Biến môi trường chỉ có tác dụng sau khi deploy lại.

## Bước 4 — Gắn tên miền và vào quản lý

1. **Settings → Domains → Add** → nhập tên miền → làm theo hướng dẫn trỏ DNS mà Vercel hiện ra.
2. Mở tên miền vừa gắn → bấm **Quản lý** → mật khẩu **123456 (bắt buộc đổi ngay sau khi đăng nhập — tối thiểu 10 ký tự, nên có cả chữ và số)** → vào **Cài đặt** đổi mật khẩu ngay.
3. Thêm căn trọ và phòng bằng nút tròn **+** góc dưới phải.

Xong. Gửi chính tên miền đó cho khách xem phòng và cho cư dân đăng nhập.

---

## Dùng hằng ngày

| Việc | Cách làm |
|---|---|
| Máy/điện thoại khác vào quản lý | Mở tên miền → Quản lý → nhập mật khẩu. Dữ liệu tự về, phiên nhớ 60 ngày |
| Để trên màn hình điện thoại | Chrome ⋮ hoặc Safari Chia sẻ → *Thêm vào màn hình chính* — chạy như app, mất mạng vẫn xem được |
| Cư dân xem hóa đơn | Cùng tên miền → **Cư dân** → số điện thoại + PIN do anh cấp |
| Xem bảng dữ liệu gốc | Drive → **Huy Rooms - Dữ liệu** |
| Quên mật khẩu | Apps Script → chọn hàm `datLaiMatKhau` → Run → về lại `123456` |

**Đồng bộ**: lưu là đẩy lên sau ~1 giây, máy khác nhận trong 20 giây. Chấm tròn góc dưới: xanh xong, vàng đang chạy, đỏ lỗi (bấm để thử lại). Mất mạng vẫn xem dữ liệu đã tải và nhập thay đổi thông thường; giữ chỗ, nhận/chuyển/trả phòng cần kết nối để máy chủ ghi nguyên tử.

**Bảo mật**: máy chưa đăng nhập quản lý chỉ tải được căn trọ và phòng — người thuê, hóa đơn, điện nước máy chủ không gửi. PIN cư dân không bao giờ trả về trình duyệt; sai PIN 5 lần khóa 10 phút.

**Ảnh**: tự nén rồi lưu vào thư mục Drive *Huy Rooms - Anh phong*, máy nào cũng xem được. Ảnh tải lúc chưa đăng nhập quản lý chỉ nằm trên máy đó — mở phòng, xóa và tải lại.

**Sửa tay trong Google Sheet** cũng đồng bộ ngược về app. Đừng đổi dòng tiêu đề và cột `id`. Xóa trong app chỉ đánh dấu `deleted = TRUE`, không mất lịch sử.

## Khi sửa lại code

- Sửa file web (`app.js`, `styles.css`…) → chạy `vercel --prod` là xong.
- Sửa `Code.gs` → Apps Script → **Deploy → Manage deployments → bút chì → Version: New version → Deploy**. Đường dẫn giữ nguyên, không phải sửa biến môi trường.

### Nâng lên v4.5 P1

1. Dán đè `apps-script/Code.gs` và, nếu chạy trực tiếp bằng Apps Script, dán đè `apps-script/Index.html`.
2. Chạy lại hàm **setup()** để thêm cột lịch sử trạng thái và hồ sơ hợp đồng. Migration giữ nguyên dữ liệu cũ.
3. Deploy một **New version** của Apps Script, rồi redeploy website trên Vercel.
4. Thử theo thứ tự: tạo hợp đồng nháp → thu cọc → nhận phòng → chuyển phòng → thanh lý. Kiểm tra các sheet `HopDong`, `NguoiO`, `BanGiao`, `SoCoc`, `Phong` cùng cập nhật.
5. Hồ sơ PDF/ảnh được tạo trong thư mục Drive **Huy Rooms - Ho so hop dong (private)**; không đổi quyền thư mục này thành công khai.

### Nâng từ v4.5 P1 lên v4.6 P2

1. Dán đè `apps-script/Code.gs`; nếu chạy website trực tiếp trong Apps Script, dán đè cả `apps-script/Index.html`.
2. Apps Script → **Deploy → Manage deployments → Edit → New version → Deploy**. Bước này bắt buộc vì P2 có action `rescheduleAppointment` chống trùng lịch ở máy chủ.
3. Redeploy thư mục web lên Vercel. `p2.js` phải nằm cùng cấp với `app.js` và `index.html`.
4. Không có sheet/cột mới ở P2. Có thể chạy lại `setup()` để kiểm tra cấu trúc; thao tác này không xóa dữ liệu.
5. Kiểm tra nhanh: Lịch hẹn → đổi một khách vào khung đã bận (phải bị chặn) → đổi sang khung trống (phải thành công); mở trang phòng và thử gallery, Maps, Gọi/Zalo; đăng nhập cư dân và mở QR/PDF hóa đơn.

### Nâng từ v4.6 lên v4.6.1 — sửa P1 sau kiểm tra

1. Dán đè `apps-script/Code.gs`; nếu chạy website trực tiếp trong Apps Script, dán đè cả `apps-script/Index.html`.
2. Chạy lại **setup()** một lần để sheet `CanTro` có thêm cột `slug`. Dữ liệu cũ không bị xóa; căn cũ được tự tạo slug ổn định và tránh trùng đường dẫn phòng.
3. Deploy → Manage deployments → Edit → **New version**. Bước này bắt buộc vì có API `publicAvailability` trả giờ bận an toàn cho trang khách.
4. Redeploy toàn bộ thư mục web lên Vercel và tải lại trang một lần để service worker nhận cache `v4.6.1-p1-audit`.
5. Kiểm tra nhanh: mở trang khách bằng thiết bị khác → giờ đã có hẹn phải bị khóa; phòng đang thuê lâu dài không xuất hiện; thử tìm kiếm liên tục trên mobile; đăng nhập rồi đăng xuất cổng cư dân.

### Nâng từ v4.6.1 lên v4.6.2 — hoàn thiện P2 giao diện

1. Không có sheet, cột hoặc API mới; không cần chạy lại `setup()` nếu v4.6.1 đã được cài đúng.
2. Redeploy toàn bộ thư mục web lên Vercel. Nếu chạy website trực tiếp trong Apps Script, dán đè `apps-script/Index.html` và deploy **New version**.
3. Tải lại trang một lần để service worker nhận cache `v4.6.2-p2-ux`.
4. Kiểm tra nhanh: dashboard phải hiện việc cần làm trước biểu đồ; topbar desktop có Ghi điện nước/Lập hóa đơn; trên điện thoại 420px, tab cư dân phải nằm dưới thanh đồng bộ và header.

### Nâng từ v4.6.2 lên v4.6.3 — bản vá P1 phân quyền

1. Không có sheet, cột hay API mới; không cần chuyển đổi dữ liệu.
2. Thay toàn bộ file web và thay `apps-script/Index.html`, sau đó Deploy → Manage deployments → Edit → **New version** → Deploy.
3. Tải lại trang một lần để service worker nhận cache `v4.6.3-p1-permission`.
4. Đăng nhập thử lần lượt vai trò Kế toán và Nhân viên: nút ngoài quyền phải được ẩn/khóa; thao tác đúng quyền vẫn lưu và đồng bộ bình thường.

### Nâng từ v4.6.3 lên v4.6.4 — hoàn thiện P2 popup và nhập liệu

1. Không có sheet, cột hay API mới; không cần chạy lại `setup()`.
2. Thay toàn bộ file web và thay `apps-script/Index.html`, sau đó Deploy → Manage deployments → Edit → **New version** → Deploy.
3. Tải lại trang một lần để service worker nhận cache `v4.6.4-p2-modal-data`.
4. Kiểm tra nhanh trên điện thoại: mở Hợp đồng/Hóa đơn hàng loạt, nhập thử rồi bấm X hoặc vùng ngoài popup — hệ thống phải hỏi trước khi bỏ dữ liệu; hàng nhiều nút không được tràn màn hình.

### Nâng từ v4.6.4 lên v4.6.5 — P3 hardening

1. Không có sheet, cột, API hay công thức mới; dữ liệu cũ được giữ nguyên.
2. Dán đè `apps-script/Code.gs`, chạy **setup()** một lần. Bước này cài trigger `backupSpreadsheet` hằng ngày trong khung 03:00; chạy lại nhiều lần không tạo trùng.
3. Thay toàn bộ file web và `apps-script/Index.html`, sau đó Deploy → Manage deployments → Edit → **New version** → Deploy.
4. Tải lại trang một lần để service worker nhận cache `v4.6.5-p3-hardening`.
5. Kiểm tra nhanh: chuyển liên tục giữa Phòng/Hóa đơn/CRM; tắt mạng, tạo một thay đổi thông thường rồi bật mạng; Apps Script → Triggers phải có đúng một trigger `backupSpreadsheet`.

### Nâng từ v4.6.5 lên v4.6.6 — hotfix đồng bộ và trạng thái phòng

1. Không có sheet, cột, API hay công thức mới; dữ liệu lịch sử được giữ nguyên.
2. Dán đè `apps-script/Code.gs`, chạy **setup()** một lần. Migration tự sửa người đại diện/phòng từng bị kẹt và chạy lặp an toàn, không tạo bản ghi trùng.
3. Thay toàn bộ file web và `apps-script/Index.html`, sau đó Deploy → Manage deployments → Edit → **New version** → Deploy.
4. Tải lại trang một lần để service worker nhận cache `v4.6.6-room-sync-hotfix`.
5. Kiểm tra nhanh: phòng có hợp đồng hiệu lực phải hiện **Đã thuê**; nút lưu trữ căn/phòng và hồ sơ người đại diện phải bị chặn cho tới khi dùng đúng nghiệp vụ Trả phòng/Thanh lý.

> Chỉ sửa trực tiếp trên Google Sheet các trường mô tả không làm thay đổi nghiệp vụ. Không sửa tay mã `id`, trạng thái, phòng của hợp đồng/người ở, liên kết người ở, hóa đơn, thanh toán hoặc sổ cọc; hãy thao tác trong ứng dụng để các bảng được cập nhật nguyên tử.

## Lỗi hay gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Chấm đỏ, báo *chưa khai APPS_SCRIPT_URL* | Thêm biến môi trường ở Bước 3 rồi **Redeploy** |
| Báo *kiểm tra deployment Who has access = Anyone* | Apps Script → Manage deployments → sửa quyền thành Anyone |
| Vào tên miền thấy trống trơn | Trên Sheets chưa có phòng nào — đăng nhập quản lý và thêm phòng đầu tiên |
| Link Preview đòi đăng nhập Vercel | Bình thường; chỉ gửi link **Production**/tên miền cho khách |
| Đăng nhập báo sai mật khẩu | Đã đổi ở máy khác; quên thì chạy `datLaiMatKhau` |

---

## Phụ lục — cách không cần hosting

Nếu lúc nào đó không muốn dùng Vercel: trong Apps Script bấm **+ → HTML**, đặt tên đúng chữ `Index`, dán file **apps-script/Index.html**, rồi Deploy lại. Khi đó chính đường dẫn `/exec` đã là website hoàn chỉnh — không cần Vercel, không cần biến môi trường, đổi lại là địa chỉ dài và không gắn được tên miền riêng.


> **Lưu ý v4:** sau khi dán code mới, chạy lại hàm `setup()` một lần để bảng dữ liệu tự thêm các cột mới (không mất dữ liệu cũ), rồi Deploy phiên bản mới.


---
## Nâng cấp lên v4 giai đoạn 2 (hợp đồng thuê)
1. Dán đè `Code.gs` và `Index.html` mới vào Apps Script.
2. Chạy lại hàm **setup** (Run) — dữ liệu cũ được giữ nguyên và tự chuyển sang mô hình hợp đồng.
3. **Deploy → Manage deployments → New version → Deploy.**
4. Tải code mới lên Vercel (hoặc git push). Xong: mục **Hợp đồng** xuất hiện trong trang quản lý.


---
## Nâng cấp lên v4 giai đoạn 3 (điện nước – hóa đơn – thanh toán)
1. Dán đè `Code.gs` và `Index.html` mới vào Apps Script.
2. Chạy lại hàm **setup** — tạo 5 sheet mới (`DichVu`, `DVHopDong`, `ThanhToan`, `SoCoc`, `NhacNo`) và chuyển dữ liệu thu tiền + cọc cũ sang sổ mới, không mất gì.
3. **Deploy → Manage deployments → New version → Deploy.**
4. Tải code mới lên Vercel. Vào **Cài đặt** khai báo Ngân hàng + Số tài khoản để hóa đơn có mã VietQR.


---
## Nâng cấp lên v4 giai đoạn 4 (cổng cư dân)
1. Dán đè `Code.gs` và `Index.html` mới vào Apps Script → chạy **setup** (tạo sheet `SuCo`, `ThongBao`, cột mới).
2. **Deploy → Manage deployments → New version → Deploy.**
3. Tải code mới lên Vercel.
4. (Tùy chọn) Zalo OA: Project Settings → Script Properties → thêm `ZALO_OA_TOKEN`; muốn chạy thử thì thêm `ZALO_OA_MOCK=1`.


---
## Nâng cấp lên v4 giai đoạn 5 (trang bán phòng + CRM)
1. Dán đè `Code.gs` và `Index.html` mới vào Apps Script → chạy **setup** → **Deploy → New version**.
2. Tải code mới lên Vercel.
3. Vào **Cài đặt**: kiểm tra giờ nhận khách xem phòng (mặc định 08:00–20:00) và số Zalo.
4. Mở từng phòng bấm "Sửa & ảnh" để bổ sung **ngày có thể vào ở** và **chính sách** — trang phòng sẽ đẹp và đủ thông tin hơn.


---
## Nâng cấp lên v4 giai đoạn 6 (quản trị SaaS + phân quyền)
1. Dán đè `Code.gs` và `Index.html` mới → chạy **setup** (tạo sheet NhanSu, NhatKy) → **Deploy → New version**.
2. Đẩy code mới lên Vercel.
3. Vào **Cài đặt → Nhân sự & phân quyền**: thêm nhân viên, chọn vai trò + phạm vi căn, bấm **Mật khẩu** để cấp (chỉ hiện một lần).
4. Nhân viên đăng nhập ở nút quản lý: điền **tài khoản + mật khẩu riêng**; chủ nhà để trống ô tài khoản như cũ.
5. Nhật ký thao tác xem ở cuối trang Cài đặt (chủ nhà & quản lý).


---
## Bản PRODUCTION — checklist trước khi dùng thật
1. Dán đè `Code.gs` + `Index.html` → chạy **setup** → **Deploy → New version**.
2. Script Properties: đổi **ADMIN_PASSWORD** (≥10 ký tự). Đây là chìa khóa gốc — quên thì vào chính Script Properties đặt lại.
3. Kiểm tra **Triggers** có `backupSpreadsheet`. Từ v4.6.5, `setup()` tự tạo trigger này; mỗi ngày một bản copy spreadsheet, giữ 14 bản.
4. Vercel: biến môi trường `APPS_SCRIPT_URL` trỏ URL Web App mới nhất; đẩy code.
5. Cài đặt trong app: giờ nhận khách, số Zalo, ngân hàng VietQR; thêm nhân viên + cấp mật khẩu.
6. Diễn tập khôi phục MỘT lần: xuất JSON → mở tab ẩn danh (bản máy) → nhập lại → kiểm số hóa đơn. 5 phút, đáng giá.

---
## Nâng cấp v4.4 P0 (giữ chỗ + sổ cọc an toàn)
1. Dán đè `Code.gs` và `Index.html` trong thư mục `apps-script`.
2. Chạy lại **setup** một lần. Hệ thống tạo sheet `GiuCho`, thêm cột liên kết và tự chuyển dữ liệu giữ chỗ cũ; chạy lại không tạo trùng.
3. **Deploy → Manage deployments → Edit → New version → Deploy**.
4. Đẩy mã website mới lên Vercel, sau đó tải lại trang một lần để service worker nhận cache `v4.4-p0`.
5. Thử 1 phiếu nhỏ: tạo giữ chỗ → kiểm tra `GiuCho` + `SoCoc` → hủy và chọn hoàn tiền → phòng phải về `Đang trống`.
