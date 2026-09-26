# Assets

Cutout mockups (phones, devices, framed screenshots) keep a **transparent** background. Never flatten that onto black.

- File format: PNG or WebP **with alpha**. Never JPEG for cutouts (JPEG turns transparency into black).
- Corner pixels of the file must be fully transparent (`alpha = 0`).
- CSS: no `overflow: hidden`, extra `border-radius`, fill, or inset `box-shadow` on the cutout. Use `filter: drop-shadow(...)` so the shadow follows the silhouette.
- If a source is labeled `.png` but is actually JPEG, recrop from an RGBA original or flood-fill black corners to alpha. Do not copy the JPEG bytes through.
