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
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (text.trim().charAt(0) !== '{') {
      return res.status(502).json({
        ok: false,
        error: 'Apps Script không trả về dữ liệu. Kiểm tra deployment để Who has access = Anyone.'
      });
    }
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Không gọi được Apps Script: ' + err.message });
  }
};
