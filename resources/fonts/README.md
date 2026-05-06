# Bundled fonts

Label Studio KH uses Noto Sans (Google) for full Unicode coverage across Latin,
Khmer, Thai, Korean, Chinese (Simplified), and Japanese scripts. Fonts are
bundled with the app so PDF/PNG/JPEG output is identical on every machine,
regardless of which fonts the user has installed locally.

## Required files

Place these files in this folder (`resources/fonts/`):

- `NotoSans-Regular.ttf` — Latin/Greek/Cyrillic
- `NotoSans-Bold.ttf`
- `NotoSansKhmer-Regular.ttf`
- `NotoSansKhmer-Bold.ttf`
- `NotoSansThai-Regular.ttf`
- `NotoSansThai-Bold.ttf`
- `NotoSansKR-Regular.otf` — Korean (Hangul)
- `NotoSansKR-Bold.otf`
- `NotoSansSC-Regular.otf` — Chinese Simplified
- `NotoSansSC-Bold.otf`
- `NotoSansJP-Regular.otf` — Japanese (CJK + Kana)
- `NotoSansJP-Bold.otf`

## Where to download

Visit https://fonts.google.com/noto and download each family.
For SC/KR/JP families, Google ships them as `.otf` files (variable fonts).
For Latin/Khmer/Thai, the static `.ttf` files are fine.

License: Open Font License (OFL). Free to redistribute with this app.

## What happens if files are missing

The app uses `font-display: swap` and falls back to the OS's system font for any
script that doesn't have its file present. PDFs will still render — but they
won't look identical across machines, and labels in non-Latin scripts may show
□ ("tofu") boxes if the user's OS doesn't have a local font for that script.

This is acceptable for development. Before shipping (Phase 4), make sure all
12 files above are committed to this folder.
