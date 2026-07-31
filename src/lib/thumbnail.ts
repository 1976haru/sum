import type { ThumbnailRenderInput } from '../types';
import { ensureFontsLoaded, titleFont } from './fonts';
import { decideReadability, sampleAverageLuminance } from './readability';
import { clampVerticalSafeArea, layoutText, letterSpacingPx, makeCanvasMeasurer } from './textLayout';
import { REFERENCE_HEIGHT, REFERENCE_WIDTH, resolveTextBox } from './textBox';

const WIDTH = REFERENCE_WIDTH;
const HEIGHT = REFERENCE_HEIGHT;

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
export async function renderThumbnail(input: ThumbnailRenderInput): Promise<string> {
  const width = input.width || WIDTH;
  const height = input.height || HEIGHT;
  const scale = width / WIDTH; // 16:9 유지 오버라이드(1920x1080 등)에서도 동일 비율이므로 균일 스케일 사용

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');
  const image = await loadImage(input.imageDataUrl);
  cover(ctx, image, width, height, input.variantIndex || 0);

  // 파트: 모든 좌표 계산은 resolveTextBox() 하나로 통일한다. textBox가 있으면 드래그로
  // 잡은 정규화 좌표를, 없으면 기존 textZone 프리셋(숫자 변경 금지)을 그대로 반환한다.
  const box = resolveTextBox(input, width, height);
  const { boxX, maxWidth, align, scrimMode } = box;
  const titleY = box.boxY;
  const isSide = scrimMode === 'side';
  const startFontSize = align === 'left' ? (input.layout === 'minimal' ? 82 : 72) * scale : 78 * scale;
  const minFontSize = 34 * scale;

  // 파트C: 텍스트 영역 평균 휘도를 측정해 글자색/스크림을 자동 전환한다.
  // 샘플링 방식 자체는 이번 작업에서 손대지 않는다(Phase 1-3 과제) — side/band 분기만 유지.
  const sampleX = isSide ? boxX : boxX - maxWidth / 2;
  const sampleWidth = isSide ? Math.min(maxWidth + boxX, width) - boxX : maxWidth;
  const luminance = input.autoTextColor
    ? sampleAverageLuminance(ctx, sampleX, 0, Math.max(1, sampleWidth), height)
    : null;
  const auto = luminance !== null ? decideReadability(luminance) : null;
  const textColor = auto ? auto.textColor : input.textColor;
  const scrimRGB = auto ? auto.scrimRGB : ([248, 242, 230] as [number, number, number]);
  const alpha = Math.max(0.25, Math.min(0.9, input.overlayStrength));
  const [sr, sg, sb] = scrimRGB;

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
    maxLines: 3,
    lineHeightRatio: input.lineHeightRatio
  });
  const blockHeight = layout.lines.length * layout.lineHeight;
  const startY = clampVerticalSafeArea(titleY, blockHeight, height, 0.05);

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
    ctx.fillStyle = textColor;
    ctx.font = `500 ${26 * scale}px "Malgun Gothic", "Yu Gothic", sans-serif`;
    ctx.fillText(input.subline, boxX, lineY + 22 * scale);
  }

  if (input.showBadge && input.brandLine) {
    ctx.fillStyle = textColor;
    ctx.font = `600 ${18 * scale}px Georgia, serif`;
    ctx.fillText(input.brandLine, boxX, lineY + 66 * scale);
  }

  return canvas.toDataURL('image/jpeg', 0.94);
}
