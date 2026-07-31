import { hexToRgb } from './readability';

function toHex(v: number): string {
  return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
}

function mixToward(hex: string, target: number, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => c + (target - c) * amount;
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// 배경 이미지를 아직 고르지 않았을 때 쓰는 대체 배경. 채널 accent 색을 기준으로 위는 밝게,
// 아래는 어둡게 섞은 세로 그라디언트 — 완전 단색보다 입체감이 있어 미리보기가 밋밋하지 않다.
export function fallbackGradientStops(accentHex: string): { top: string; bottom: string } {
  return { top: mixToward(accentHex, 255, 0.55), bottom: mixToward(accentHex, 0, 0.35) };
}

export function paintFallbackBackground(ctx: CanvasRenderingContext2D, width: number, height: number, accentHex: string): void {
  const { top, bottom } = fallbackGradientStops(accentHex);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
