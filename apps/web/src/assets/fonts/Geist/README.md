# Geist font builds

The original variable fonts are retained as `Geist[wght].woff2` and
`GeistMono[wght].woff2`. Only the optimized files are referenced by the web app and emitted by
Vite.

| File              | Included weights | Purpose                                     |
| ----------------- | ---------------- | ------------------------------------------- |
| `Geist.woff2`     | 400-700          | Default, medium, semibold, and bold UI text |
| `GeistMono.woff2` | 400              | Monospaced UI text                          |

The Sans build retains the common web Latin glyph set. The Mono build retains the same web Latin
glyph set but pins the variable weight axis to 400. Both were produced from the original Geist
variable fonts with FontTools.
