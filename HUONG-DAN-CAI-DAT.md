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
   Chạy xong, Google tự tạo bảng **Huy Rooms - Dữ liệu** và thư mục ảnh trong Drive của anh.
4. **Deploy → New deployment** → bánh răng **Select type → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → copy đường dẫn kết thúc bằng `/exec`.

Mở thử đường dẫn đó, hiện dòng chữ *“Máy chủ Huy Rooms đang chạy”* là đúng.

## Bước 2 — Đưa website lên Vercel

Cách nhanh (máy có Node):

```bash
npm i -g vercel
cd huy-rooms-v3
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
2. Mở tên miền vừa gắn → bấm **Quản lý** → mật khẩu **123456** → vào **Cài đặt** đổi mật khẩu ngay.
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

**Đồng bộ**: lưu là đẩy lên sau ~1 giây, máy khác nhận trong 20 giây. Chấm tròn góc dưới: xanh xong, vàng đang chạy, đỏ lỗi (bấm để thử lại). Mất mạng vẫn thao tác, có mạng tự đẩy lên; ai lưu sau thì giữ dữ liệu người đó.

**Bảo mật**: máy chưa đăng nhập quản lý chỉ tải được căn trọ và phòng — người thuê, hóa đơn, điện nước máy chủ không gửi. PIN cư dân không bao giờ trả về trình duyệt; sai PIN 5 lần khóa 10 phút.

**Ảnh**: tự nén rồi lưu vào thư mục Drive *Huy Rooms - Anh phong*, máy nào cũng xem được. Ảnh tải lúc chưa đăng nhập quản lý chỉ nằm trên máy đó — mở phòng, xóa và tải lại.

**Sửa tay trong Google Sheet** cũng đồng bộ ngược về app. Đừng đổi dòng tiêu đề và cột `id`. Xóa trong app chỉ đánh dấu `deleted = TRUE`, không mất lịch sử.

## Khi sửa lại code

- Sửa file web (`app.js`, `styles.css`…) → chạy `vercel --prod` là xong.
- Sửa `Code.gs` → Apps Script → **Deploy → Manage deployments → bút chì → Version: New version → Deploy**. Đường dẫn giữ nguyên, không phải sửa biến môi trường.

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
