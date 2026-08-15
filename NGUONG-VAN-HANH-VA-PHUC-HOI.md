# Ngưỡng vận hành và phục hồi

Tài liệu này đặt ngưỡng nội bộ thận trọng cho kiến trúc Vercel + Apps Script + Google Sheets. Đây không phải giới hạn cứng của Google; mục đích là biết lúc nào cần đo và lập kế hoạch nâng cấp.

## Ngưỡng khuyến nghị

| Mức | Quy mô tham chiếu | Hành động |
|---|---|---|
| Vận hành bình thường | ≤ 100 phòng, ≤ 3 quản lý thao tác cùng lúc, ≤ 30.000 dòng nghiệp vụ | Dùng kiến trúc hiện tại; xem chấm đồng bộ và backup hằng tuần. |
| Bắt đầu theo dõi | 101–200 phòng, 4–5 người cùng thao tác hoặc 30.000–50.000 dòng | Ghi nhận thời gian sync, số lỗi/timeout và xung đột; chuẩn bị kế hoạch CSDL nhưng chưa di chuyển nếu hệ thống vẫn ổn định. |
| Nên lập kế hoạch chuyển CSDL | > 200 phòng, > 5 người cùng thao tác, > 50.000 dòng hoặc có timeout/xung đột lặp lại | Lập migration theo giai đoạn, chạy song song và đối soát; không chuyển gấp khi chưa có log đo lường. |

Mỗi gói đẩy được giới hạn 300 bản ghi trên một collection. Đây là hàng rào chống gói bất thường; luồng dùng thật thường chỉ đẩy vài bản ghi sau mỗi thao tác.

## Dấu hiệu cần điều tra

- Chấm đồng bộ đỏ lặp lại trong ngày dù Internet ổn định.
- Một lần lưu thường xuyên mất trên 20–30 giây.
- Cùng một bản ghi tài chính báo xung đột nhiều lần.
- Apps Script báo hết thời gian thực thi hoặc hết quota theo chu kỳ.
- Full pull trên điện thoại yếu làm giao diện khựng đáng kể.

## Lịch sao lưu

| Lớp | Tần suất | Giữ lại | Mục đích |
|---|---|---|---|
| Google Drive | Hằng ngày trong khung 03:00 | 14 bản | Khôi phục toàn bộ spreadsheet khi xóa/sửa nhầm. |
| Trình duyệt cục bộ | Mỗi ngày khi có mở app | 7 bản | Quay lại nhanh trạng thái thiết bị. |
| JSON tải tay | Trước thao tác lớn/cuối tháng | Do chủ nhà lưu | Bản đối soát độc lập với Drive. |

## Diễn tập phục hồi hằng quý

1. Tại file JSON từ Cài đặt và cất bản gốc.
2. Dùng một bản thử nghiệm không kết nối máy chủ để nhập JSON.
3. Đối chiếu tối thiểu: số phòng, hợp đồng hiệu lực, tổng công nợ, 5 hóa đơn gần nhất và sổ cọc.
4. Trong Drive, mở thư mục `Huy Rooms - Sao luu`, xác nhận có bản trong 24 giờ gần nhất.
5. Ghi ngày diễn tập và kết quả; không thay dữ liệu production trong buổi thử.

## Quy tắc khi có xung đột

- Hóa đơn, thanh toán, sổ cọc, hợp đồng và chỉ số điện nước không được ghi đè âm thầm; client phải nhận cảnh báo/xung đột từ máy chủ.
- Nếu vừa mất mạng, không lặp lại nghiệp vụ nhiều bảng như thu cọc, nhận phòng, chuyển phòng hoặc thanh lý; đợi chấm đồng bộ xanh và kiểm tra sổ.
- Khi phục hồi, luôn xuất bản hiện tại trước khi áp bản cũ.
