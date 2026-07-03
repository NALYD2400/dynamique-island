## 2024-07-04 - Fix XSS in URI attributes
**Vulnerability:** XSS vulnerability through user-controlled URIs injected directly into HTML src/href attributes without proper scheme sanitation (e.g., javascript:, vbscript:, data:text/html).
**Learning:** `escapeHtml` only escapes HTML characters (e.g. `<` and `>`), it does not sanitize the contents of attributes like `src` or `href`. If a user supplies a URI starting with `javascript:`, the browser will execute it.
**Prevention:** Implement and use a `sanitizeUri` function alongside `escapeHtml` when injecting user-controlled URIs into attributes.
