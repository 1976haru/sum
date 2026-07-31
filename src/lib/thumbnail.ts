import type { ThumbnailRenderInput } from '../types';
import { ensureFontsLoaded, titleFont } from './fonts';
import { decideReadabilityFromProfile, hexToRgb, relativeLuminance, requiredScrimAlpha, sampleLuminanceProfile, TARGET_CONTRAST } from './readability';
import { clampVerticalSafeArea, ellipsize, layoutText, letterSpacingPx, makeCanvasMeasurer, type MeasureFn } from './textLayout';
import { REFERENCE_HEIGHT, REFERENCE_WIDTH, resolveTextBox } from './textBox';
import { paintFallbackBackground } from './fallbackBackground';

const WIDTH = REFERENCE_WIDTH;
const HEIGHT = REFERENCE_HEIGHT;

// 휴리스틱 값이다. 실제 168px 미리보기를 눈으로 보고 조정할 것 — 한글·일본어는 획이 많아
// 라틴 문자보다 큰 값이 필요하다. Phase 1-3 보고서에 실측 결과를 남긴다.
export const MIN_LEGIBLE_CJK_PX = 12;

export interface ThumbnailDiagnostics {
  effectivePxAt168: number; // 168px로 축소했을 때의 실제 글자 크기
  contrastRatio: number;    // 최종 대비비
  scrimAlphaUsed: number;
  warnings: string[];
}

export interface ThumbnailRenderResult {
  dataUrl: string;
  diagnostics: ThumbnailDiagnostics;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('배경 이미지를 읽지 못했습니다.'));
    image.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, variantIndex = 0) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const shift = [-0.12, 0, 0.12][variantIndex % 3] ?? 0;
  const x = (width - w) / 2 + shift * Math.max(0, w - width);
  const y = (height - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}

// 좌측 1/3 경로는 최초 검증된 알고리즘 그대로 유지한다. 상단중앙/중앙은 그 위에 추가된 새 분기다.
export async function renderThumbnail(input: ThumbnailRenderInput): Promise<ThumbnailRenderResult> {
  const width = input.width || WIDTH;
  const height = input.height || HEIGHT;
  const scale = width / WIDTH; // 16:9 유지 오버라이드(1920x1080 등)에서도 동일 비율이므로 균일 스케일 사용

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');

  // Phase 1-3: 배경 이미지가 없으면 accent 색 기반 그라디언트로 대체한다. 아래 샘플링·
  // 대비 계산 파이프라인은 이 그라디언트에도 실제 사진과 동일하게 그대로 적용된다.
  if (input.imageDataUrl) {
    const image = await loadImage(input.imageDataUrl);
    cover(ctx, image, width, height, input.variantIndex || 0);
  } else {
    paintFallbackBackground(ctx, width, height, input.accent);
  }

  // 파트: 모든 좌표 계산은 resolveTextBox() 하나로 통일한다. textBox가 있으면 드래그로
  // 잡은 정규화 좌표를, 없으면 기존 textZone 프리셋(숫자 변경 금지)을 그대로 반환한다.
  const box = resolveTextBox(input, width, height);
  const { boxX, maxWidth, align, scrimMode } = box;
  const titleY = box.boxY;
  const isSide = scrimMode === 'side';
  // Phase 1-4 이전에는 이 값이 곧 상한이었다(레이아웃 엔진이 축소만 했다). 지금은 이분 탐색의
  // 시작점/기본값일 뿐 — 실제 상한은 아래 maxFontSize다.
  const startFontSize = align === 'left' ? (input.layout === 'minimal' ? 82 : 72) * scale : 78 * scale;
  const minFontSize = 34 * scale;
  // 상한이 없으면 3글자 문구("겨울밤" 등)가 과하게 큰 크기로 나온다. 시작점일 뿐이며
  // 실제 렌더를 눈으로 보고 조정했다(Phase 1-4 보고서 3번 항목 참고).
  const maxFontSize = align === 'left' ? 140 * scale : 160 * scale;

  // fillText 전에 반드시 폰트 로드를 기다린다 — 못 기다리면 첫 렌더가 폴백 폰트로
  // 조용히 그려질 수 있다(로드 실패는 throw하지 않고 경고만 남긴다).
  await ensureFontsLoaded(input.fontStyle, startFontSize);

  const letterSpacing = input.letterSpacing ?? 0;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const measure = makeCanvasMeasurer(ctx, size => titleFont(input.fontStyle, size), letterSpacing);
  const footerHeight = 96 * scale;
  const safeBottom = height * 0.95;
  const layout = layoutText(input.headline, {
    measure,
    maxWidth,
    maxHeight: Math.max(startFontSize, safeBottom - titleY - footerHeight),
    startFontSize,
    minFontSize,
    maxFontSize,
    maxLines: 3,
    lineHeightRatio: input.lineHeightRatio
  });
  const blockHeight = layout.lines.length * layout.lineHeight;
  const startY = clampVerticalSafeArea(titleY, blockHeight, height, 0.05);

  // 파트C(Phase 1-3 개정): 레이아웃을 먼저 계산해야 실제 텍스트 블록 사각형을 알 수 있다.
  // 순서를 "레이아웃 → 샘플링 → 색 결정 → 스크림 → 텍스트"로 재배치해, 캔버스 전체 높이가
  // 아니라 글자가 실제로 놓이는 사각형만 휘도를 측정한다.
  const sampleX0 = align === 'left' ? boxX : boxX - maxWidth / 2;
  const sampleWidth = Math.max(1, Math.min(maxWidth, width - Math.max(0, sampleX0)));
  const profile = sampleLuminanceProfile(ctx, sampleX0, startY, sampleWidth, Math.max(1, blockHeight));

  let textColor = input.textColor;
  let scrimRGB: [number, number, number] = [248, 242, 230];
  let alpha = Math.max(0.25, Math.min(0.9, input.overlayStrength));
  let finalContrast: number;
  let contrastWarning: boolean;

  if (input.autoTextColor) {
    const auto = decideReadabilityFromProfile(profile, alpha);
    textColor = auto.textColor;
    scrimRGB = auto.scrimRGB;
    alpha = auto.scrimAlpha; // 목표 대비를 못 채우면 여기서 자동으로 올라간다
    finalContrast = auto.contrastRatio;
    contrastWarning = auto.contrastWarning;
  } else {
    // 수동 모드에서는 알파를 자동으로 올리지 않는다 — 사용자가 고른 색/강도를 그대로 존중한다.
    // maxAlpha를 현재 알파로 고정해 requiredScrimAlpha가 값을 올리지 못하게 하고,
    // 대비 진단(경고 여부)만 얻어 쓴다.
    const [tr, tg, tb] = hexToRgb(textColor);
    const textLuminance = relativeLuminance(tr, tg, tb);
    const scrimLuminance = relativeLuminance(...scrimRGB);
    const pinned = requiredScrimAlpha(profile, textLuminance, scrimLuminance, TARGET_CONTRAST, alpha, alpha);
    finalContrast = pinned.achievedContrast;
    contrastWarning = pinned.warning;
  }
  const [sr, sg, sb] = scrimRGB;

  if (isSide) {
    // 검증된 좌측 사이드 그라디언트 스크림.
    const gradient = ctx.createLinearGradient(0, 0, width * 0.72, 0);
    gradient.addColorStop(0, `rgba(${sr},${sg},${sb},${alpha})`);
    gradient.addColorStop(0.68, `rgba(${sr},${sg},${sb},${alpha * 0.75})`);
    gradient.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else {
    // 상단중앙/중앙: 텍스트 블록을 감싸는 수평 밴드 스크림(커버 렌더러와 동일한 방식).
    const padY = 60 * scale;
    const bandTop = Math.max(0, startY - padY);
    const bandHeight = Math.min(height, blockHeight + footerHeight + padY * 2);
    const gradient = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
    gradient.addColorStop(0, `rgba(${sr},${sg},${sb},0)`);
    gradient.addColorStop(0.2, `rgba(${sr},${sg},${sb},${alpha})`);
    gradient.addColorStop(0.8, `rgba(${sr},${sg},${sb},${alpha})`);
    gradient.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, bandTop, width, bandHeight);
  }

  if (isSide && input.layout === 'story') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.roundRect(boxX - 26 * scale, titleY - 28 * scale, 590 * scale, 360 * scale, 28 * scale);
    ctx.fill();
  }

  ctx.fillStyle = textColor;
  layout.lines.forEach((line, index) => {
    ctx.font = titleFont(input.fontStyle, layout.fontSize);
    ctx.letterSpacing = letterSpacingPx(letterSpacing, layout.fontSize);
    ctx.fillText(line, boxX, startY + index * layout.lineHeight);
  });
  ctx.letterSpacing = '0px';

  let lineY = startY + blockHeight + 10 * scale;
  const dividerStartX = align === 'left' ? boxX : boxX - 205 * scale;
  if (input.showDivider) {
    ctx.fillStyle = input.accent;
    ctx.fillRect(dividerStartX, lineY, 410 * scale, 1.5 * scale);
    ctx.beginPath();
    ctx.arc(dividerStartX + 205 * scale, lineY + 1, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    lineY += 8 * scale;
  }

  if (input.showSubline && input.subline) {
    // Phase 1-4: 부제는 제목과 독립된 고정 크기가 아니라, 원래 비율(26/startFontSize)을
    // 유지한 채 제목 크기를 따라간다 — 제목만 커지고 부제가 그대로면 조판이 무너진다.
    // 다만 비율을 지키다 보면 제목이 3줄까지 커진 경우 부제 폭이 프레임 밖으로 넘칠 수 있어
    // (실제 렌더로 확인한 회귀 — 보고서 3번 항목), headline과 같은 maxWidth로 말줄임한다.
    const sublineFontSize = layout.fontSize * (26 / startFontSize);
    const sublineFont = `500 ${sublineFontSize}px "Malgun Gothic", "Yu Gothic", sans-serif`;
    const sublineMeasure: MeasureFn = subText => { ctx.font = sublineFont; return ctx.measureText(subText).width; };
    const sublineText = ellipsize(input.subline, sublineFontSize, maxWidth, sublineMeasure);
    ctx.fillStyle = textColor;
    ctx.font = sublineFont;
    ctx.fillText(sublineText, boxX, lineY + sublineFontSize * 0.85);
  }

  if (input.showBadge && input.brandLine) {
    ctx.fillStyle = textColor;
    ctx.font = `600 ${18 * scale}px Georgia, serif`;
    ctx.fillText(input.brandLine, boxX, lineY + 66 * scale);
  }

  // 168px 축소 판독 진단(휴리스틱). 경고는 생성을 막지 않는다 — 판단은 사용자가 한다.
  const effectivePxAt168 = layout.fontSize * (168 / width);
  const warnings: string[] = [];
  if (effectivePxAt168 < MIN_LEGIBLE_CJK_PX) {
    warnings.push(`168px 축소 시 글자 크기가 약 ${effectivePxAt168.toFixed(1)}px로, 최소 권장값(${MIN_LEGIBLE_CJK_PX}px) 미만입니다.`);
  }
  if (contrastWarning) {
    warnings.push(`대비비가 ${finalContrast.toFixed(2)}:1로 권장 기준(${TARGET_CONTRAST}:1) 미만입니다 — 스크림을 최대로 올려도 부족합니다.`);
  } else if (finalContrast < TARGET_CONTRAST) {
    warnings.push(`대비비가 ${finalContrast.toFixed(2)}:1로 권장 기준(${TARGET_CONTRAST}:1) 미만입니다.`);
  }
  if (layout.truncated) {
    warnings.push('문구가 길어 말줄임(…) 처리되었습니다.');
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.94),
    diagnostics: { effectivePxAt168, contrastRatio: finalContrast, scrimAlphaUsed: alpha, warnings }
  };
}
