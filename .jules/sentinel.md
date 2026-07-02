## YYYY-MM-DD - [Prevent XSS via DOM and innerHTML]
**Vulnerability:** User-controlled metadata (album art URLs, track metadata, app icons) were being injected into the DOM via innerHTML without URL sanitization.
**Learning:** `src` attributes are susceptible to execution of arbitrary JavaScript through `javascript:` or `vbscript:` schemes. `escapeHtml` alone only encodes characters but doesn't prevent scheme-based attacks.
**Prevention:** In the Electron frontend, `sanitizeUri` should always be used alongside `escapeHtml` whenever dynamically rendering data into URI attributes like `src` or `href` via innerHTML or DOM properties.
