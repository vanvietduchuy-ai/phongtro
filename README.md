# Huy Rooms v3 — Website bán phòng + quản lý nhà trọ

Bản v3 giữ nguyên toàn bộ nghiệp vụ của v2 và bổ sung 3 việc:

1. **Giao diện thao tác được bằng một tay trên điện thoại.**
2. **Kết nối Google Sheets qua Apps Script** để dùng thật.
3. **Đồng bộ nhiều máy**, có phân quyền quản lý / khách / cư dân.

## Cài đặt

Bản chính: **Vercel + tên miền riêng**. Bốn bước, không phải sửa dòng code nào — dán `apps-script/Code.gs` vào Google Apps Script, chạy hàm `setup`, Deploy lấy đường dẫn `/exec`, đưa thư mục này lên Vercel rồi khai đường dẫn đó vào biến môi trường `APPS_SCRIPT_URL`. Chi tiết trong `HUONG-DAN-CAI-DAT.md`.

Không muốn dùng hosting thì dán thêm `apps-script/Index.html` vào Apps Script — đường dẫn `/exec` khi đó chính là website.

- Đăng nhập quản lý lần đầu: mật khẩu **123456**, đổi ngay trong Cài đặt.
- Cư dân đăng nhập bằng số điện thoại + PIN do quản lý cấp.
- Mở `index.html` bằng trình duyệt cũng chạy được để xem thử (dữ liệu mẫu, mật khẩu `123456`, cư dân `0935123456` / PIN `2580`).

## Giao diện điện thoại

- **Thanh tab dưới màn hình**: Tổng quan · Phòng · Điện nước · Hóa đơn · Lịch hẹn, có chấm đỏ báo số lịch hẹn mới.
- **Nút tròn “+”**: thêm căn trọ, phòng, người thuê, ghi chỉ số, lập hóa đơn — không cần vào từng mục.
- **Bảng biến thành thẻ**: mỗi dòng là một thẻ có nhãn từng cột, hết cảnh vuốt ngang tìm cột.
- **Form mở dạng tấm kéo từ dưới lên**, ô nhập cỡ 16px nên iPhone không tự phóng to, nút Lưu luôn nằm trong tầm ngón cái.
- **Cài như ứng dụng**: thêm vào màn hình chính, mở toàn màn hình, mất mạng vẫn xem được dữ liệu đã tải.

## Đồng bộ

- Lưu là đẩy lên Sheets sau ~1 giây; các máy khác lấy về mỗi 20 giây và ngay khi mở lại màn hình.
- Chấm trạng thái ở góc dưới: xanh (xong) · vàng (đang chạy) · đỏ (lỗi, bấm để thử lại).
- Mất mạng vẫn thao tác bình thường, có mạng lại tự đẩy lên; ai lưu sau thì giữ dữ liệu người đó.
- Ảnh tự nén rồi lưu vào Google Drive nên mọi máy đều xem được.
- Sửa tay trực tiếp trong Google Sheet cũng đồng bộ ngược về app.

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
app.js                    toàn bộ nghiệp vụ
sync.js                   lớp đồng bộ
config.js                 mặc định gọi /api/sheets, không cần sửa
manifest.json / sw.js     cài như ứng dụng, chạy khi mất mạng
vercel.json               cấu hình cache cho Vercel
build-appsscript.py       gộp lại thành apps-script/Index.html sau khi sửa code
```

## Nghiệp vụ giữ nguyên từ v2

Nhiều căn trọ – nhiều phòng, ảnh từng phòng, lọc theo khu vực/giá/trạng thái, đặt lịch xem phòng; người thuê và tài khoản cư dân; ghi chỉ số điện nước với đầu kỳ tự lấy từ tháng trước; lập hóa đơn gộp tiền phòng + điện + nước + phí khác + cọc còn thiếu; ghi nhận thanh toán từng phần; cảnh báo hóa đơn quá hạn; soạn sẵn tin nhắn nhắc thu tiền để dán vào Zalo.

Gửi Zalo tự động vẫn cần Zalo Official Account và một backend riêng — không đặt access token Zalo trong file web công khai.
