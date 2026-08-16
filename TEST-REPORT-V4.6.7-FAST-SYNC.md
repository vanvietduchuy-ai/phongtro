# Test report v4.6.7 — Fast sync

## Phạm vi

- Public fast path trước bước nạp token.
- Public poll không đổi không đọc sheet và không tăng `LAST_STAMP`.
- Thay đổi giá phòng xuất hiện ở snapshot công khai kế tiếp.
- Admin pull rỗng không tăng stamp.
- Nhịp poll 6/8 giây, push debounce 250 ms.
- Wake-up trên focus/pageshow/online và tín hiệu giữa các tab.
- Timeout/no-store cho request sync.
- Hồi quy P0–P3, hotfix v4.6.6, syntax và Apps Script build.

## Kết quả

| Nhóm | Kết quả |
|---|---|
| Public poll không đổi: số lần đọc sheet | PASS — 0 |
| Public poll không đổi: tăng timestamp | PASS — không tăng |
| Public snapshot sau thay đổi giá | PASS |
| Admin empty pull không tăng stamp | PASS |
| Push 250 ms; admin/public poll 6/8 giây | PASS |
| Focus/pageshow/BroadcastChannel | PASS |
| Request timeout và no-store | PASS |
| P0/P1/P2/P3 + v4.6.6 | PASS |
| JavaScript syntax và build đồng nhất | PASS |

Tổng cộng: **10 tệp kiểm thử, tất cả PASS**.

## Giới hạn

Kiến trúc Google Apps Script không cung cấp WebSocket tới trình duyệt, vì vậy đồng bộ giữa hai thiết bị khác nhau là near-real-time theo polling, không phải push tức thời tuyệt đối. Mục tiêu khi tab đang hoạt động là phát hiện trong tối đa khoảng 8 giây cộng độ trễ mạng/Apps Script. Cần smoke test sau deploy bằng đúng tên miền Production trên một máy tính và một điện thoại.
