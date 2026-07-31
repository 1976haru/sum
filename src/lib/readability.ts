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
// Phase 1-3 이전부터 쓰이던 함수 — 삭제하지 않는다(커버 등 다른 호출부, 회귀 비교용).
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
// Phase 1-3 이전부터 쓰이던 함수 — 삭제하지 않는다. 색상표(문턱값 0.55, 색상 4종)는 여기
// 한 곳에서만 관리하고, decideReadabilityFromProfile()도 이 함수를 그대로 재사용한다
// (평균 대신 p50을 넣어서 부르는 차이뿐 — "왜 0.55인지"를 두 군데서 따로 답하지 않게 한다).
export function decideReadability(backgroundLuminance: number): ReadabilityDecision {
  if (backgroundLuminance > 0.55) {
    return { textColor: READABLE_DARK_TEXT, scrimRGB: [250, 244, 232] };
  }
  return { textColor: READABLE_LIGHT_TEXT, scrimRGB: [18, 14, 10] };
}

// ---------------------------------------------------------------------------
// Phase 1-3: 평균 하나로는 "절반 검정 + 절반 흰색" 같은 반반 배경을 구분하지 못한다
// (평균이 약 0.5로 나와 흰 글자가 선택되지만, 흰 영역 위의 흰 글자는 안 보인다).
// percentile 분포 + WCAG 대비비 기반 판정으로 교체한다. 캔버스 의존(getImageData)과
// 순수 판정 로직을 분리해 vitest에서 픽셀 배열만으로 검증 가능하게 만든다.
// ---------------------------------------------------------------------------

export interface LuminanceProfile {
  p10: number; // 하위 10퍼센타일
  p50: number; // 중앙값
  p90: number; // 상위 10퍼센타일
  mean: number;
}

function percentileOf(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

// 순수 함수 — RGBA 평탄 배열(길이가 4의 배수, [r,g,b,a,r,g,b,a,...])만 받는다. 캔버스 의존 없음.
export function analyzeLuminance(data: Uint8ClampedArray | number[]): LuminanceProfile {
  const samples: number[] = [];
  for (let i = 0; i + 2 < data.length; i += 4) {
    samples.push(relativeLuminance(data[i], data[i + 1], data[i + 2]));
  }
  if (!samples.length) return { p10: 0.5, p50: 0.5, p90: 0.5, mean: 0.5 };

  samples.sort((a, b) => a - b);
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  return {
    p10: percentileOf(samples, 0.1),
    p50: percentileOf(samples, 0.5),
    p90: percentileOf(samples, 0.9),
    mean
  };
}

// analyzeLuminance()의 캔버스 의존 버전 — getImageData 후 순수 함수에 넘긴다.
// percentile은 평균보다 표본이 더 필요해 sampleAverageLuminance보다 목표 샘플 수를 올렸다.
export function sampleLuminanceProfile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): LuminanceProfile {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const rx = Math.max(0, Math.floor(x));
  const ry = Math.max(0, Math.floor(y));
  const rw = Math.max(1, Math.min(Math.floor(w), canvasWidth - rx));
  const rh = Math.max(1, Math.min(Math.floor(h), canvasHeight - ry));
  if (rw <= 0 || rh <= 0) return { p10: 0.5, p50: 0.5, p90: 0.5, mean: 0.5 };

  const { data } = ctx.getImageData(rx, ry, rw, rh);
  const pixelCount = rw * rh;
  const targetSamples = 4000;
  const stridePixels = Math.max(1, Math.floor(pixelCount / targetSamples));
  const step = stridePixels * 4;

  const strided: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    strided.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
  }
  return analyzeLuminance(strided);
}

// 순수 함수 — WCAG 대비비. (L밝은 + 0.05) / (L어두운 + 0.05). 인자 순서는 상관없다(내부에서 정렬).
export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

// #rrggbb → [r,g,b] (0~255). 3자리 축약형(#abc)도 허용한다.
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const expanded = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(expanded, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function srgbToLinear01(v: number): number {
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function linearToSrgb01(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// 스크림 합성은 캔버스가 실제로 하는 방식(sRGB 정수 공간에서 알파 블렌드)을 그대로 흉내낸다.
// profile/luminance 값은 전부 선형(상대휘도) 공간이라 여기서 바로 섞으면 실제 렌더 결과와
// 어긋난다 — sRGB로 변환 → 그 공간에서 블렌드 → 다시 선형으로 변환해야 맞는다.
function blendedLuminance(bgLinear: number, scrimLinear: number, alpha: number): number {
  const bgSrgb = linearToSrgb01(bgLinear);
  const scrimSrgb = linearToSrgb01(scrimLinear);
  const blendedSrgb = bgSrgb * (1 - alpha) + scrimSrgb * alpha;
  return srgbToLinear01(blendedSrgb);
}

export interface ScrimAlphaResult {
  alpha: number;
  achievedContrast: number;
  // true면 maxAlpha까지 올려도 targetContrast를 만족하지 못했다는 뜻 — 조용히 포기하지 않고
  // 호출부(thumbnail.ts)가 화면에 경고를 띄울 수 있도록 함께 돌려준다.
  warning: boolean;
}

// 목표 대비비를 만족하는 최소 스크림 알파를 찾는다. 배경 쪽은 profile에서 텍스트 휘도와
// 가장 대비가 낮게 나오는 쪽(p10 또는 p90)을 최악값으로 골라 쓴다 — "흰 글자면 p90, 다크
// 글자면 p10"이라는 지시서 표현과 결과는 같지만, 어느 쪽 색을 골랐는지 이 함수가 몰라도
// 되도록 대비값 자체로 판단해 더 일반적으로 만들었다.
export function requiredScrimAlpha(
  profile: LuminanceProfile,
  textLuminance: number,
  scrimLuminance: number,
  targetContrast: number,
  currentAlpha: number,
  maxAlpha: number
): ScrimAlphaResult {
  const ALPHA_STEP = 0.05;
  const MAX_ITERATIONS = 20; // 0.05 스텝 기준 상한 — 지시서 명시

  const worstBgLuminance = contrastRatio(textLuminance, profile.p10) <= contrastRatio(textLuminance, profile.p90)
    ? profile.p10
    : profile.p90;

  let alpha = Math.max(0, Math.min(maxAlpha, currentAlpha));
  let achieved = contrastRatio(textLuminance, blendedLuminance(worstBgLuminance, scrimLuminance, alpha));

  let iterations = 0;
  while (achieved < targetContrast && alpha < maxAlpha && iterations < MAX_ITERATIONS) {
    iterations++;
    alpha = Math.min(maxAlpha, alpha + ALPHA_STEP);
    achieved = contrastRatio(textLuminance, blendedLuminance(worstBgLuminance, scrimLuminance, alpha));
  }

  if (achieved < targetContrast) {
    return { alpha: maxAlpha, achievedContrast: achieved, warning: true };
  }
  return { alpha, achievedContrast: achieved, warning: false };
}

export const TARGET_CONTRAST = 4.5; // WCAG AA 본문 기준
export const MAX_AUTO_ALPHA = 0.85; // 이 이상은 사진이 안 보인다

export interface AutoReadabilityResult {
  textColor: string;
  scrimRGB: [number, number, number];
  scrimAlpha: number;
  contrastRatio: number;
  contrastWarning: boolean;
}

// decideReadability(p50) + requiredScrimAlpha()를 묶은 오케스트레이션.
// thumbnail.ts/cover.ts가 이 함수 하나만 부르면 색·스크림 알파·최종 대비비까지 한 번에 나온다.
export function decideReadabilityFromProfile(
  profile: LuminanceProfile,
  baseAlpha: number,
  targetContrast: number = TARGET_CONTRAST,
  maxAlpha: number = MAX_AUTO_ALPHA
): AutoReadabilityResult {
  const decision = decideReadability(profile.p50); // 평균이 아니라 중앙값으로 색을 정한다
  const [tr, tg, tb] = hexToRgb(decision.textColor);
  const textLuminance = relativeLuminance(tr, tg, tb);
  const scrimLuminance = relativeLuminance(...decision.scrimRGB);
  const { alpha, achievedContrast, warning } = requiredScrimAlpha(profile, textLuminance, scrimLuminance, targetContrast, baseAlpha, maxAlpha);
  return {
    textColor: decision.textColor,
    scrimRGB: decision.scrimRGB,
    scrimAlpha: alpha,
    contrastRatio: achievedContrast,
    contrastWarning: warning
  };
}
