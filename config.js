/* ============================================================
   Cấu hình backend cho bản Vercel. Khi chạy thẳng trên Apps Script,
   google.script.run vẫn được ưu tiên nên file này không đổi chế độ rollback.

   - Bản v4.7 dùng Supabase làm nguồn chính qua API Vercel cùng tên miền.
     URL và key Supabase chỉ đặt trong biến môi trường Vercel.
   - Hosting khác (không có serverless): thay bằng đường dẫn /exec đầy đủ.
   ============================================================ */
window.HUY_CONFIG = {
  apiUrl: location.protocol.indexOf('http') === 0 ? '/api/supabase' : '',
  backendId: 'supabase-v1',
  forceApi: true
};
