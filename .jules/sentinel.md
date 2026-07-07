## 2024-05-18 - [Fix XSS vulnerability via malicious schemes]
**Vulnerability:** User-controlled data was injected into URI attributes like `src` without proper sanitization to prevent malicious schemes (e.g., `javascript:`, `vbscript:`, `data:text/html`).
**Learning:** The application relies on `data:image` for base64 images, so we cannot block all `data:` URIs.
**Prevention:** Always use `sanitizeUri(uri)` alongside `escapeHtml(value)` when injecting user-controlled data into URI attributes like `src` or `href`.
