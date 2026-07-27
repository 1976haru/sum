import type { ThumbnailRenderInput } from '../types';

const WIDTH = 1280;
const HEIGHT = 720;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('배경 이미지를 읽지 못했습니다.'));
    image.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, variantIndex = 0) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const shift = [-0.12, 0, 0.12][variantIndex % 3] ?? 0;
  const x = (WIDTH - w) / 2 + shift * Math.max(0, w - WIDTH);
  const y = (HEIGHT - h) / 2;
  ctx.drawImage(image, x, y, w, h);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export async function renderThumbnail(input: ThumbnailRenderInput): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = input.width || WIDTH;
  canvas.height = input.height || HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');
  const image = await loadImage(input.imageDataUrl);
  cover(ctx, image, input.variantIndex || 0);

  const left = input.textSide === 'left';
  const gradient = ctx.createLinearGradient(left ? 0 : WIDTH, 0, left ? WIDTH * 0.72 : WIDTH * 0.28, 0);
  const alpha = Math.max(0.25, Math.min(0.9, input.overlayStrength));
  gradient.addColorStop(0, `rgba(248,242,230,${alpha})`);
  gradient.addColorStop(0.68, `rgba(248,242,230,${alpha * 0.75})`);
  gradient.addColorStop(1, 'rgba(248,242,230,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const boxX = left ? 74 : 670;
  const maxWidth = 530;
  const titleY = input.layout === 'minimal' ? 230 : input.layout === 'story' ? 172 : 205;
  const titleSize = input.layout === 'minimal' ? 82 : 72;

  if (input.layout === 'story') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.roundRect(boxX - 26, titleY - 28, 590, 360, 28);
    ctx.fill();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = input.textColor;
  ctx.font = `700 ${titleSize}px "Batang", "Yu Mincho", "Noto Serif KR", Georgia, serif`;
  const lines = wrapLines(ctx, input.headline, maxWidth);
  lines.forEach((line, index) => ctx.fillText(line, boxX, titleY + index * (titleSize + 14)));

  const lineY = titleY + lines.length * (titleSize + 14) + 14;
  ctx.fillStyle = input.accent;
  ctx.fillRect(boxX, lineY, 410, 2);
  ctx.beginPath();
  ctx.arc(boxX + 205, lineY + 1, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '500 30px "Malgun Gothic", "Yu Gothic", sans-serif';
  ctx.fillText(input.subline, boxX, lineY + 26);

  ctx.font = '600 21px Georgia, serif';
  ctx.fillText('P L A Y L I S T', boxX, lineY + 78);

  return canvas.toDataURL('image/jpeg', 0.94);
}
