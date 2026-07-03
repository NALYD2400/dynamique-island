## 2024-07-02 - Add missing standard ARIA labels to Dynamic Island icon buttons
**Learning:** Found several core media and action buttons missing `aria-label` entirely, relying on visually apparent icons or generic French `title` attributes that may not be well-supported for non-sighted users. Using standard English ARIA labels ensures predictability and compatibility with assistive tech in this repository.
**Action:** Always verify custom component icon-only buttons (`.ic-np-btn`, `.control-btn-music`, etc.) and ensure they have explicit standard English `aria-label`s for screen readers.
