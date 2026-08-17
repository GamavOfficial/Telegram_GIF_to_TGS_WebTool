Telegram TGS Studio v6

Files:
- index.html
- css/style.css
- js/app.js
- js/gif-parser.js
- js/tgs.js

Open index.html in Chrome/Edge. The native file input is kept exactly as in
the working v5 UI, while the actual GIF parser and TGS encoder are restored.

No external CDN or third-party JS dependency is required.

The encoder creates a gzipped Lottie JSON .tgs approximation from GIF frames.
TGS is a vector animation format, so raster GIFs are approximated using
colored rectangle shape layers. The result is best with simple transparent
emoji/cartoon animations.

For a first test:
64x64, 30 FPS, 30 frames, Low detail.
