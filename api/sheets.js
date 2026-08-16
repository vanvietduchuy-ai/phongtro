/**
 * Cầu nối Vercel → Apps Script.
 * Website gọi /api/sheets (cùng tên miền, không lo CORS), hàm này chuyển tiếp
 * sang đường dẫn /exec khai trong biến môi trường APPS_SCRIPT_URL của Vercel.
 * Đổi đường dẫn Apps Script chỉ cần sửa biến môi trường, không phải sửa code.
 */
module.exports = async (req, res) => {
  const target = process.env.APPS_SCRIPT_URL;

  res.setHeader('Cache-Control', 'no-store');

  if (!target) {
    return res.status(500).json({
      ok: false,
      error: 'Chưa khai báo APPS_SCRIPT_URL trong Vercel → Settings → Environment Variables'
    });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Chỉ nhận POST' });
  }

  let body = '';
  if (typeof req.body === 'string') {
    body = req.body;
  } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    body = JSON.stringify(req.body);
  } else {
    body = await new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => resolve(raw));
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    const started = Date.now();
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    const text = await upstream.text();
    res.setHeader('Server-Timing', `apps-script;dur=${Date.now() - started}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (text.trim().charAt(0) !== '{') {
      // Chẩn đoán rõ nguyên nhân thay vì gộp chung một câu chung chung
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
      const looksLikeLogin = /accounts\.google\.com|ServiceLogin|Sign in|Đăng nhập/i.test(text);
      const looksLikeAuthz = /Authorization is required|cần được uỷ quyền|needs authorization/i.test(text);
      const looksLikeError = /Script function not found|TypeError|ReferenceError|Exception/i.test(text);
      let error;
      if (looksLikeLogin) {
        error = 'Apps Script đang đòi đăng nhập Google. Vào Deploy → Manage deployments → Edit → đặt "Who has access" = Anyone, rồi Deploy lại.';
      } else if (looksLikeAuthz) {
        error = 'Apps Script chưa được cấp quyền. Mở Apps Script, Run một hàm bất kỳ (vd: setup) và bấm Review permissions → Allow, rồi Deploy lại.';
      } else if (looksLikeError) {
        error = 'Apps Script báo lỗi khi chạy: ' + snippet;
      } else if (upstream.status >= 400) {
        error = 'Apps Script trả mã lỗi ' + upstream.status + '. Kiểm tra APPS_SCRIPT_URL có đúng đường dẫn /exec của bản deploy mới nhất.';
      } else {
        error = 'Apps Script không trả về JSON (mã ' + upstream.status + '). Nội dung nhận được: ' + snippet;
      }
      return res.status(502).json({ ok: false, code: 'gateway', upstreamStatus: upstream.status, error: error });
    }
    return res.status(200).send(text);
  } catch (err) {
    const message = err && err.name === 'AbortError'
      ? 'Apps Script phản hồi quá chậm (quá 18 giây). Hệ thống sẽ tự thử lại.'
      : 'Không gọi được Apps Script: ' + err.message;
    return res.status(502).json({ ok: false, error: message });
  }
};
