## 2025-02-18 - [Fix XSS in Mixer App Name Rendering]
**Vulnerability:** Found a Cross-Site Scripting (XSS) vulnerability in `src/components/DynamicIsland.js` where user-controlled variables (`s.name`, `cleanName`, `displayTitle`, and `icon`) were directly injected into HTML template strings without proper sanitization.
**Learning:** The existing `escapeHtml()` function does not sanitize URI schemes (e.g., `javascript:` or `vbscript:`). Manually validating the URIs is required before injecting them into attributes like `src` to fully prevent malicious payload execution.
**Prevention:** Always use the `escapeHtml()` function provided in the codebase for text and attribute values. For URIs, implement manual scheme validation before interpolation.
