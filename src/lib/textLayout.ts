// 문자 단위 줄바꿈 + 자동 폰트 축소 + 말줄임 + 세로 안전영역 강제.
// 캔버스에 의존하지 않는 순수 함수(measure 콜백 주입)로 만들어 유닛 테스트가 가능하다.

export type MeasureFn = (text: string, fontSizePx: number) => number;

export interface LayoutOptions {
  measure: MeasureFn;
  maxWidth: number;
  maxHeight: number;
  startFontSize: number;
  minFontSize: number;
  maxLines?: number;
  lineHeightRatio?: number;
  fontStep?: number;
}

export interface TextBlockLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  truncated: boolean;
}

// 어떤 렌더 루프도 이 상한을 넘기지 않는다: 조건을 못 맞춰도 경고 후 반드시 반환한다.
const MAX_ITERATIONS = 5000;

function warnGuard(context: string) {
  if (typeof console !== 'undefined') console.warn(`[textLayout] ${context}: 최대 반복 횟수(${MAX_ITERATIONS})에 도달해 강제 종료했습니다.`);
}

function wrapGreedy(text: string, fontSize: number, maxWidth: number, measure: MeasureFn): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = '';
  let guard = 0;

  const pushCurrent = () => { if (current) { lines.push(current); current = ''; } };

  for (const word of words) {
    guard++;
    if (guard > MAX_ITERATIONS) { warnGuard('wrapGreedy/word'); pushCurrent(); return lines; }

    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth) { current = candidate; continue; }

    pushCurrent();
    if (measure(word, fontSize) <= maxWidth) { current = word; continue; }

    // 공백 없는 한글 구절 등: 어절 자체가 영역을 넘치면 문자 단위로 강제 절단한다.
    const chars = Array.from(word);
    let chunk = '';
    for (const ch of chars) {
      guard++;
      if (guard > MAX_ITERATIONS) { warnGuard('wrapGreedy/char'); current = chunk; return lines.concat(chunk ? [chunk] : []); }
      const candidate2 = chunk + ch;
      if (chunk === '' || measure(candidate2, fontSize) <= maxWidth) chunk = candidate2;
      else { lines.push(chunk); chunk = ch; }
    }
    current = chunk;
  }
  pushCurrent();
  return lines;
}

function ellipsize(line: string, fontSize: number, maxWidth: number, measure: MeasureFn): string {
  if (measure(line, fontSize) <= maxWidth) return line;
  const chars = Array.from(line);
  let guard = 0;
  while (chars.length > 0 && guard < MAX_ITERATIONS) {
    guard++;
    const candidate = `${chars.join('')}…`;
    if (measure(candidate, fontSize) <= maxWidth) return candidate;
    chars.pop();
  }
  if (guard >= MAX_ITERATIONS) warnGuard('ellipsize');
  return '…';
}

function effectiveMaxLines(fontSize: number, maxHeight: number, lineHeightRatio: number, cap: number): number {
  const byHeight = Math.max(1, Math.floor(maxHeight / (fontSize * lineHeightRatio)));
  return Math.max(1, Math.min(cap, byHeight));
}

// 어절 우선 줄바꿈 → 3줄 제한 초과 시 폰트 자동 축소(하한까지) → 그래도 넘치면 말줄임.
// maxHeight는 세로 안전영역(상하 여백 제외) 높이이며, 축소 루프는 줄 수와 세로 높이를 함께 만족할 때까지 반복한다.
export function layoutText(text: string, opts: LayoutOptions): TextBlockLayout {
  const maxLinesCap = opts.maxLines ?? 3;
  const lineHeightRatio = opts.lineHeightRatio ?? 1.28;
  const fontStep = opts.fontStep ?? 4;
  const trimmed = text.trim();

  if (!trimmed) return { lines: [], fontSize: opts.startFontSize, lineHeight: opts.startFontSize * lineHeightRatio, truncated: false };

  let fontSize = opts.startFontSize;
  let cap = effectiveMaxLines(fontSize, opts.maxHeight, lineHeightRatio, maxLinesCap);
  let lines = wrapGreedy(trimmed, fontSize, opts.maxWidth, opts.measure);

  let guard = 0;
  while (lines.length > cap && fontSize > opts.minFontSize && guard < MAX_ITERATIONS) {
    guard++;
    fontSize = Math.max(opts.minFontSize, fontSize - fontStep);
    cap = effectiveMaxLines(fontSize, opts.maxHeight, lineHeightRatio, maxLinesCap);
    lines = wrapGreedy(trimmed, fontSize, opts.maxWidth, opts.measure);
  }
  if (guard >= MAX_ITERATIONS) warnGuard('layoutText/shrink');

  let truncated = false;
  if (lines.length > cap) {
    truncated = true;
    lines = lines.slice(0, cap);
    lines[cap - 1] = ellipsize(lines[cap - 1], fontSize, opts.maxWidth, opts.measure);
  }

  return { lines, fontSize, lineHeight: fontSize * lineHeightRatio, truncated };
}

// 세로 방향 안전영역(상하 marginRatio) 안으로 텍스트 블록 시작 y좌표를 강제한다.
export function clampVerticalSafeArea(startY: number, blockHeight: number, canvasHeight: number, marginRatio = 0.05): number {
  const top = canvasHeight * marginRatio;
  const bottom = canvasHeight * (1 - marginRatio);
  let y = startY;
  if (y < top) y = top;
  if (y + blockHeight > bottom) y = Math.max(top, bottom - blockHeight);
  return y;
}

export function makeCanvasMeasurer(ctx: CanvasRenderingContext2D, fontBuilder: (fontSizePx: number) => string): MeasureFn {
  return (text, fontSizePx) => {
    ctx.font = fontBuilder(fontSizePx);
    return ctx.measureText(text).width;
  };
}
