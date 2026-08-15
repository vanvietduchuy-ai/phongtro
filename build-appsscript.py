# Gộp toàn bộ website thành 1 file Index.html để dán vào Apps Script
import re, pathlib
d = pathlib.Path(__file__).parent
html = (d/'index.html').read_text()

def inline_css(m):
    name = m.group(1)
    return '<style>\n' + (d/name).read_text() + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([\w.-]+)" />', inline_css, html)
html = re.sub(r'\s*<link rel="manifest"[^>]*/>', '', html)

def inline_js(m):
    name = m.group(1)
    return '<script>\n' + (d/name).read_text() + '\n</script>'
html = re.sub(r'<script src="([\w.-]+)"></script>', inline_js, html)
# Chỉ chèn base vào <head> của website. Dùng replace toàn cục sẽ làm
# biến đổi chuỗi template HTML trong app.js (hóa đơn/biên nhận PDF).
html = html.replace('<head>', '<head>\n  <base target="_top">', 1)

out = d/'apps-script'/'Index.html'
out.write_text(html)
print('Đã tạo', out, len(html), 'ký tự')
