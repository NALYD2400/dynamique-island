## 2024-07-08 - [Sanitize URIs for image src]
**Vulnerability:** XSS vulnerability through `javascript:` or `data:text/html` schemes in `img` `src` attributes, specifically when interpolating untrusted variables like `appIcon`, `displayArt`, and `icon`.
**Learning:** In Electron or general web, setting `src` with an unsanitized URI string can lead to malicious script execution if the source data is manipulated by an attacker to include `javascript:...` or `data:text/html,...`. Memory explicitly mentioned that `sanitizeUri(uri)` must be used alongside `escapeHtml(value)` when injecting user-controlled data into URI attributes like `src` or `href`.
**Prevention:** Implement and use a `sanitizeUri` utility function to strip dangerous protocols before assigning them to URI attributes.
