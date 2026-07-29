// 배경 밝기를 측정해 글자색(흰 / 다크브라운)과 스크림 색을 자동으로 정한다.

export const READABLE_LIGHT_TEXT = '#fffaf1';
export const READABLE_DARK_TEXT = '#2a1c10';

export interface ReadabilityDecision {
  textColor: string;
  scrimRGB: [number, number, number];
}

function srgbToLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// 텍스트가 놓일 영역의 평균 휘도를 측정한다. 큰 영역에서는 성능을 위해 다운샘플링한다.
export function sampleAverageLuminance(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): number {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const rx = Math.max(0, Math.floor(x));
  const ry = Math.max(0, Math.floor(y));
  const rw = Math.max(1, Math.min(Math.floor(w), canvasWidth - rx));
  const rh = Math.max(1, Math.min(Math.floor(h), canvasHeight - ry));
  if (rw <= 0 || rh <= 0) return 0.5;

  const { data } = ctx.getImageData(rx, ry, rw, rh);
  const pixelCount = rw * rh;
  const targetSamples = 2000;
  const stridePixels = Math.max(1, Math.floor(pixelCount / targetSamples));
  const step = stridePixels * 4;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += relativeLuminance(data[i], data[i + 1], data[i + 2]);
    count++;
  }
  return count ? sum / count : 0.5;
}

// 밝은 배경 → 다크브라운 글자 + 밝은 스크림으로 대비 확보.
// 어두운 배경 → 흰 글자 + 어두운 스크림으로 대비 확보.
export function decideReadability(backgroundLuminance: number): ReadabilityDecision {
  if (backgroundLuminance > 0.55) {
    return { textColor: READABLE_DARK_TEXT, scrimRGB: [250, 244, 232] };
  }
  return { textColor: READABLE_LIGHT_TEXT, scrimRGB: [18, 14, 10] };
}
