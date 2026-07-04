## 2024-05-24 - Cross-Site Scripting (XSS) via Unsafe Image Source Schemes
**Vulnerability:** User-controlled image URLs injected directly into `src` attributes of `<img>` tags could contain malicious schemes like `javascript:`, `vbscript:`, or `data:text/html`.
**Learning:** `escapeHtml` only sanitizes HTML structure characters (`<`, `>`, `"`, `'`, `&`), but it does not protect against malicious URI schemes when data is bound to attributes like `src` or `href` where the schemes are directly interpreted by the browser.
**Prevention:** Always validate and sanitize user-provided URIs before injection. Use a `sanitizeUri` function to strip or block unsafe schemas (e.g. returning `about:blank` or an empty string) *before* applying `escapeHtml`.
