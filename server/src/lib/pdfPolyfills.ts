// pdf-parse's dependency (pdfjs-dist, legacy build) expects browser-like DOM
// globals for its canvas-rendering fallback path. In Node this is normally
// polyfilled by the optional native package @napi-rs/canvas, but when that
// isn't available in a given runtime (observed on Vercel's Linux Functions —
// works locally because it happens to be present there), pdfjs-dist still
// references these globals directly at module load time and crashes the
// whole process with a ReferenceError instead of just degrading.
//
// This app only ever calls pdf-parse's text-only getText() (see
// pdfService.ts) — never anything rendering-related — so these stubs never
// need real behavior, they just need to exist so module load doesn't crash.
class NoopDOMMatrix {}
class NoopImageData {}
class NoopPath2D {}

const g = globalThis as Record<string, unknown>;
if (!g.DOMMatrix) g.DOMMatrix = NoopDOMMatrix;
if (!g.ImageData) g.ImageData = NoopImageData;
if (!g.Path2D) g.Path2D = NoopPath2D;
