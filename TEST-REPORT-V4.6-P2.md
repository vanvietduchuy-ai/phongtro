# Báo cáo kiểm thử Huy Rooms v4.6 P2

Ngày kiểm thử: 2026-08-15 (Asia/Ho_Chi_Minh)

## Phạm vi

- Hồi quy P0: phiếu giữ chỗ, sổ cọc, khóa phòng, từ chối bản ghi phụ thuộc khi giữ chỗ trùng.
- Hồi quy P1: nhận/chuyển/trả phòng nguyên tử, sổ cọc thanh lý, chặn thao tác lặp, chữ ký file hồ sơ.
- P2: phễu CRM 7 bước, lọc lịch hẹn, chống trùng, công suất phòng, URL bản đồ và đổi lịch nguyên tử trên máy chủ.
- Kiểm tra cú pháp JavaScript, parse HTML nguồn/bản Apps Script và build gộp.

## Kết quả tự động

| Kiểm thử | Kết quả |
|---|---|
| `node tests/p0-regression.test.js` | PASS |
| `node tests/p1-regression.test.js` | PASS |
| `node tests/p2-regression.test.js` | PASS |
| `node --check app.js` | PASS |
| `node --check sync.js` | PASS |
| `node --check p2.js` | PASS |
| Parse `index.html` | PASS |
| `python3 build-appsscript.py` | PASS |
| Parse `apps-script/Index.html` | PASS |

## Ca P2 đã xác nhận

1. Phễu có đúng 7 mã và 7 nhãn tiếng Việt theo thứ tự yêu cầu.
2. Lịch đã đóng (`lost`) không khóa khung giờ; một lịch không tự trùng với chính nó.
3. Hai khách đang mở không thể cùng phòng/ngày/giờ.
4. Máy chủ từ chối đổi vào khung bận mà không sửa bản ghi gốc.
5. Đổi sang khung trống thành công và tạo lịch sử `careLog`.
6. Tìm theo tên tiếng Việt, lọc trạng thái và khoảng ngày trả đúng tập kết quả.
7. Tỷ lệ lấp đầy không tính phòng giữ chỗ là phòng đang thuê.
8. Địa chỉ được mã hóa thành URL Google Maps an toàn.
9. DTO cư dân trả đủ dòng tiền phòng/điện/nước/dịch vụ, bàn giao và ngày nhận phòng nhưng không làm lộ trường ngoài whitelist.

## Ghi chú triển khai

Kiểm thử trên đây chạy bằng máy chủ Apps Script mô phỏng trong bộ nhớ và kiểm tra tĩnh. Sau khi deploy thật, cần smoke test một vòng trên URL production cho Apps Script, VietQR, Google Drive và thao tác mobile thực tế.
