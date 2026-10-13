/**
 * Import Engine Lab: normalized spatial observations from native PDF.js text items.
 * No PDF bytes, filenames or private document content are persisted by this module.
 * This v0.1 adapter supports upright, unrotated, unskewed PDF pages only.
 * Observations are NEVER discarded because their geometry is unsupported.
 */
const clamp01 = x => Math.min(1, Math.max(0, x));
const finite = x => typeof x === 'number' && Number.isFinite(x);
const round = x => Math.round(x * 1000000) / 1000000;

export function rowsFromObservations(observations, pageNumber) {
  const tokens = observations.filter(o => o.page === pageNumber && o.box);
  const sorted = [...tokens].sort((a, b) =>
    (a.box.y0 + a.box.y1 - b.box.y0 - b.box.y1) || (a.box.x0 - b.box.x0));
  const rows = [];
  for (const token of sorted) {
    const center = (token.box.y0 + token.box.y1) / 2;
    const height = token.box.y1 - token.box.y0;
    const row = rows.find(r => Math.abs(center - r.center) <= Math.max(0.0035, Math.min(height, r.height) * 0.44));
    if (row) {
      row.tokens.push(token);
      row.center = row.tokens.reduce((s, t) => s + (t.box.y0 + t.box.y1) / 2, 0) / row.tokens.length;
      row.height = Math.max(row.height, height);
    } else rows.push({ center, height, tokens: [token] });
  }
  return rows.sort((a, b) => a.center - b.center).map((r, i) => ({
    id: `p${pageNumber}-r${i+1}`,
    page: pageNumber,
    y: round(r.center),
    tokenIds: r.tokens.sort((a, b) => a.box.x0 - b.box.x0).map(t => t.id)
  }));
}

export function layoutFromPdfItems(pages) {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('Sivut puuttuvat');
  const all = [], issues = [], layouts = [];
  pages.forEach((page, idx) => {
    const pageNumber = idx + 1;
    const { width, height, items } = page ?? {};
    if (!(finite(width) && finite(height) && width > 0 && height > 0 && Array.isArray(items)))
      throw new Error(`Sivun ${pageNumber} mitat tai tekstielementit puuttuvat`);
    const observed = [];
    items.forEach((item, i) => {
      const raw = String(item?.str ?? '');
      if (!raw.trim()) return;
      const transform = item?.transform;
      const evidence = {
        id: `pdf-p${pageNumber}-t${i + 1}`, kind: 'text', raw,
        page: pageNumber, box: null, method: 'pdfjs-text', ocrConfidence: null,
        sourceIndex: i, status: 'observed'
      };
      if (!Array.isArray(transform) || transform.length < 6 ||
          !transform.slice(0, 6).every(finite) || !finite(item.width) || item.width < 0) {
        issues.push({ code: 'INVALID_GEOMETRY', page: pageNumber, observationId: evidence.id });
      } else {
        const [a, b, c, d, x, y] = transform;
        const textHeight = finite(item.height) && item.height > 0 ? item.height : Math.abs(d);
        // PDF bottom-left origin -> normalized top-left. Do not guess rotated glyph geometry.
        if (Math.abs(b) > 0.0001 || Math.abs(c) > 0.0001 || a <= 0 || d <= 0 || !finite(textHeight)) {
          issues.push({ code: 'UNSUPPORTED_TEXT_ROTATION', page: pageNumber, observationId: evidence.id });
        } else {
          const x0 = x / width, x1 = (x + item.width) / width;
          const y0 = (height - y - textHeight) / height, y1 = (height - y) / height;
          if ([x0, x1, y0, y1].some(v => !finite(v) || v < -0.02 || v > 1.02)) {
            issues.push({ code: 'OUTSIDE_PAGE_GEOMETRY', page: pageNumber, observationId: evidence.id });
          } else evidence.box = { x0:round(clamp01(x0)), y0:round(clamp01(y0)), x1:round(clamp01(x1)), y1:round(clamp01(y1)) };
        }
      }
      observed.push(evidence); all.push(evidence);
    });
    layouts.push({ page: pageNumber, width, height,
      observationIds: observed.map(t => t.id), rows: rowsFromObservations(observed, pageNumber) });
  });
  return { schemaVersion: 1, sourceKind: 'pdf-text', observations: all, pages: layouts, issues };
}

export function rowTokens(layout, row) {
  const byId = new Map(layout.observations.map(t => [t.id,t]));
  return row.tokenIds.map(id => byId.get(id)).filter(Boolean);
}

/**
 * Bridge for an existing PDF.js instance. Not bundled into the lab; external
 * dependency intentionally injected. No page rendering, scans or rotation support yet.
 */
export async function readPdfWithPdfJs(pdfjs, bytes) {
  if (!pdfjs?.getDocument) throw new Error('PDF.js puuttuu');
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({scale: 1});
      // Important: PDF.js text matrix must be transformed for rotated viewports.
      // v0.1 blocks rotated pages instead of returning potentially false geometry.
      if (viewport.rotation !== 0) throw new Error(`PDF:n sivua ${p} on kierretty; v0.1 estää tulkinnan`);
      const view = page.view;
      if (Array.isArray(view) && (Math.abs(view[0]) > 0.0001 || Math.abs(view[1]) > 0.0001 ||
          Math.abs(view[2]-view[0]-viewport.width) > 0.0001 ||
          Math.abs(view[3]-view[1]-viewport.height) > 0.0001))
        throw new Error(`PDF:n sivulla ${p} on rajattu/cropbox-alue; v0.1 estää tulkinnan`);
      const text = await page.getTextContent();
      pages.push({width: viewport.width, height: viewport.height, items: text.items});
      page.cleanup?.();
    }
    return layoutFromPdfItems(pages);
  } finally { await pdf.destroy?.(); }
}
