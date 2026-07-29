import html2canvas from "html2canvas";

/**
 * Rasterise the rendered mockup surface only. Editor panels, labels, selection
 * affordances, and the viewport transform intentionally live outside this
 * element and therefore cannot leak into an export.
 */
export async function renderScreenToPng(scale = 2): Promise<Blob> {
  const surface = document.querySelector<HTMLElement>(
    '[data-protota-render-surface="true"]',
  );
  if (!surface) throw new Error("No rendered screen is available to export");

  const canvas = await html2canvas(surface, {
    scale,
    backgroundColor: null,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode rendered screen as PNG"));
    }, "image/png");
  });
}

export function downloadPng(blob: Blob, filename = "protota-screen.png") {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
