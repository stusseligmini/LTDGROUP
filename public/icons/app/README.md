# CELORA App Icon Assets

This folder contains a production-ready SVG for the clean Web3-style CELORA icon.

- `celora-app-icon.svg`: Vector icon suitable for browser extensions, iOS/Android assets, and web.

## Export PNGs (optional)
To generate PNG sizes (1024, 512, 192, 128), you can use Figma, Sketch, or a CLI rasterizer like Inkscape or rsvg-convert.

Example using Inkscape:

```powershell
# 1024px
inkscape --export-type=png --export-filename=public\icons\app\celora-app-icon-1024.png --export-width=1024 public\icons\app\celora-app-icon.svg
# 512px
inkscape --export-type=png --export-filename=public\icons\app\celora-app-icon-512.png --export-width=512 public\icons\app\celora-app-icon.svg
# 192px (PWA)
inkscape --export-type=png --export-filename=public\icons\app\celora-app-icon-192.png --export-width=192 public\icons\app\celora-app-icon.svg
# 128px
inkscape --export-type=png --export-filename=public\icons\app\celora-app-icon-128.png --export-width=128 public\icons\app\celora-app-icon.svg
```

If Inkscape isn't installed, you can install it from https://inkscape.org.

## Usage in Next.js
Serve directly from `public/`:

```tsx
<img src="/icons/app/celora-app-icon.svg" alt="CELORA" className="w-12 h-12" />
```

Or import the React component `CeloraAppIcon` from `src/components/ui/CeloraAppIcon.tsx`.
