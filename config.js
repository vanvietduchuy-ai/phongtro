/* ============================================================
   Chỉ dùng khi đặt website trên hosting riêng (Vercel, Netlify…).
   Chạy thẳng trên Apps Script thì file này không có tác dụng gì.

   - Để nguyên như dưới nếu deploy lên Vercel: web gọi /api/sheets,
     đường dẫn Apps Script khai trong biến môi trường APPS_SCRIPT_URL.
   - Hosting khác (không có serverless): thay bằng đường dẫn /exec đầy đủ.
   ============================================================ */
window.HUY_CONFIG = {
  apiUrl: location.protocol.indexOf('http') === 0 ? '/api/sheets' : ''
};
