import type { CoverConfig, CoverRenderInput, ProjectConfig } from '../types';
import { titleFont } from './fonts';
import { decideReadability, sampleAverageLuminance } from './readability';
import { clampVerticalSafeArea, layoutText, makeCanvasMeasurer } from './textLayout';

// DistroKid 등 음원 유통 규격: 3000x3000 정사각, 최소 1400x1400 권장, RGB JPG/PNG.
export const COVER_SIZE = 3000;
export const DISTROKID_NOTE = 'DistroKid 커버 규격: 3000×3000 정사각(RGB, 최소 1400×1400). 커버 문구는 등록할 트랙/앨범 메타데이터와 일치해야 합니다.';

// 커버는 썸네일과 완전 독립이지만, 최초 값은 채널 설정에서 가져와 톤을 맞춘다.
export function defaultCoverConfig(config: ProjectConfig): CoverConfig {
  return {
    headline: config.headline,
    layout: 'centered',
    accent: config.accent,
    textColor: config.textColor,
    overlayStrength: config.overlayStrength,
    fontStyle: config.fontStyle,
    autoTextColor: config.autoTextColor,
    brandLine: config.brandLine,
    showBadge: false,
    showDivider: config.showDivider,
    format: 'jpg'
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('배경 이미지를 읽지 못했습니다.'));
    image.src = src;
  });
}

function coverFit(ctx: CanvasRenderingContext2D, image: HTMLImageElement, size: number, variantIndex = 0) {
  const scale = Math.max(size / image.width, size / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const shift = [-0.1, 0, 0.1][variantIndex % 3] ?? 0;
  const x = (size - w) / 2 + shift * Math.max(0, w - size);
  const y = (size - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}

// 썸네일(16:9)과 완전 독립된 1:1 커버 렌더 경로. 배경·문구·레이아웃을 별도로 선택한다.
export async function renderCover(input: CoverRenderInput, size = COVER_SIZE): Promise<string> {
  const scale = size / COVER_SIZE;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');
  const image = await loadImage(input.imageDataUrl);
  coverFit(ctx, image, size, input.variantIndex || 0);

  const maxWidth = size * 0.76;
  const boxX = size / 2;
  const centerY = size * 0.5;
  const startFontSize = 250 * scale;
  const minFontSize = 96 * scale;
  const safeTop = size * 0.05;
  const safeBottom = size * 0.95;

  const luminance = input.autoTextColor
    ? sampleAverageLuminance(ctx, size * 0.12, size * 0.3, size * 0.76, size * 0.4)
    : null;
  const auto = luminance !== null ? decideReadability(luminance) : null;
  const textColor = auto ? auto.textColor : input.textColor;
  const scrimRGB = auto ? auto.scrimRGB : ([18, 14, 10] as [number, number, number]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const measure = makeCanvasMeasurer(ctx, fontSize => titleFont(input.fontStyle, fontSize));
  const layout = layoutText(input.headline, {
    measure,
    maxWidth,
    maxHeight: safeBottom - safeTop,
    startFontSize,
    minFontSize,
    maxLines: 3, // "1줄 지향" — 짧은 문구는 넓은 maxWidth 덕에 대부분 1줄로 조판된다
    lineHeightRatio: 1.22
  });

  const blockHeight = layout.lines.length * layout.lineHeight;
  const rawTop = centerY - blockHeight / 2;
  const startY = clampVerticalSafeArea(rawTop, blockHeight, size, 0.05);

  // 반투명 스크림: 텍스트 블록 주변만 부드럽게 감싸 축소 미리보기에서도 읽히게 한다.
  const alpha = Math.max(0.25, Math.min(0.9, input.overlayStrength));
  const [sr, sg, sb] = scrimRGB;
  const padY = 70 * scale;
  const gradient = ctx.createLinearGradient(0, startY - padY, 0, startY + blockHeight + padY);
  gradient.addColorStop(0, `rgba(${sr},${sg},${sb},0)`);
  gradient.addColorStop(0.25, `rgba(${sr},${sg},${sb},${alpha})`);
  gradient.addColorStop(0.75, `rgba(${sr},${sg},${sb},${alpha})`);
  gradient.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, Math.max(0, startY - padY), size, Math.min(size, blockHeight + padY * 2));

  if (input.layout === 'centered-panel') {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    const panelPad = 60 * scale;
    ctx.beginPath();
    ctx.roundRect(boxX - maxWidth / 2 - panelPad, startY - panelPad, maxWidth + panelPad * 2, blockHeight + panelPad * 2, 36 * scale);
    ctx.fill();
  }

  ctx.fillStyle = textColor;
  layout.lines.forEach((line, index) => {
    ctx.font = titleFont(input.fontStyle, layout.fontSize);
    ctx.fillText(line, boxX, startY + layout.lineHeight / 2 + index * layout.lineHeight);
  });

  const dividerY = Math.min(safeBottom - 4 * scale, startY + blockHeight + 46 * scale);
  if (input.showDivider) {
    ctx.fillStyle = input.accent;
    ctx.fillRect(boxX - 90 * scale, dividerY, 180 * scale, 3 * scale);
  }

  // 브랜드 배지는 기본 생략(파트A 규칙). showBadge를 켠 경우에만 하단에 작게 표기한다.
  if (input.showBadge && input.brandLine) {
    ctx.font = `600 ${34 * scale}px Georgia, serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(input.brandLine, boxX, Math.min(safeBottom - 40 * scale, dividerY + 20 * scale));
  }

  const mime = input.format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = input.format === 'png' ? undefined : 0.95;
  return quality === undefined ? canvas.toDataURL(mime) : canvas.toDataURL(mime, quality);
}
