// 문자 단위 줄바꿈 + 자동 폰트 축소 + 말줄임 + 세로 안전영역 강제.
// 캔버스에 의존하지 않는 순수 함수(measure 콜백 주입)로 만들어 유닛 테스트가 가능하다.

export type MeasureFn = (text: string, fontSizePx: number) => number;

export interface LayoutOptions {
  measure: MeasureFn;
  maxWidth: number;
  maxHeight: number;
  // Phase 1-4 이전에는 이 값이 사실상 상한이었다(축소 전용 루프). 지금은 이분 탐색의
  // 시작점/기본값일 뿐이다 — maxFontSize를 안 주면 예전처럼 이 값이 곧 상한이 된다
  // (하위 호환: 기존 호출부·테스트가 그대로 동작한다).
  startFontSize: number;
  minFontSize: number;
  // 확대 상한. 생략하면 startFontSize를 상한으로 쓴다(= 기존 축소 전용 동작).
  maxFontSize?: number;
  maxLines?: number;
  lineHeightRatio?: number;
  fontStep?: number;
  // 완성된 줄에 대해 行頭・行末禁則 후처리를 적용할지 (기본 true). measure는 wrapGreedy와
  // 동일한 함수를 그대로 재사용해 이동 후에도 폭이 maxWidth를 넘지 않는지 검증한다.
  applyKinsokuRule?: boolean;
  // 테스트/진단용 훅. 이분 탐색이 fontSize 하나를 시도(=wrapGreedy 1회 호출)할 때마다 불린다.
  // 렌더 로직에는 영향을 주지 않는다 — 호출 횟수를 세는 용도(완료 기준 "12회 이하" 실측)로만 쓴다.
  onFontSizeProbe?: (fontSize: number, lineCount: number) => void;
}

export interface TextBlockLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  truncated: boolean;
}

// 어떤 렌더 루프도 이 상한을 넘기지 않는다: 조건을 못 맞춰도 경고 후 반드시 반환한다.
const MAX_ITERATIONS = 5000;

function warnGuard(context: string, limit: number = MAX_ITERATIONS) {
  if (typeof console !== 'undefined') console.warn(`[textLayout] ${context}: 최대 반복 횟수(${limit})에 도달해 강제 종료했습니다.`);
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

export function ellipsize(line: string, fontSize: number, maxWidth: number, measure: MeasureFn): string {
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

// JIS X 4051 行頭禁則(줄 첫머리 금지) 문자 — 마침표/닫는 괄호/작은 가나 등.
// ASCII '.' ',' 는 원 목록엔 없지만 한국어 문장에서 반각으로 흔히 쓰이므로 추가했다.
const LINE_START_FORBIDDEN = new Set(Array.from(
  '。、．，」』）］｝〉》】〕・…‥ー々ゝゞ？！?!：；:;' +
  'っゃゅょぁぃぅぇぉゎッャュョァィゥェォヮ' +
  '.,'
));

// 行末禁則(줄 끝 금지) 문자 — 여는 괄호류.
const LINE_END_FORBIDDEN = new Set(Array.from('「『（［｛〈《【〔＄￥＃＠'));

const MAX_KINSOKU_ITERATIONS = 200;

// wrapGreedy가 만든 줄을 건드리지 않고, 완성된 줄 배열만 후처리로 다듬는다.
// - 다음 줄 첫머리가 금칙 문자로 시작하면 앞줄 끝으로 끌어올린다.
// - 끌어올리기가 앞줄 폭 초과로 실패하면 追い出し(밀어내기)를 시도한다: 앞줄의 마지막
//   글자를 현재 줄 앞으로 내려 금칙 문자를 줄 첫머리에서 밀어낸다.
// - 이번 줄 끝이 금칙 문자로 끝나면 다음 줄 앞으로 내린다.
// - 연속된 금칙 문자는 통째로 이동한다.
// - 이동/밀어내기로 인해 상대 줄이 maxWidth를 넘으면 시도하지 않는다(원상 복구).
// - 줄 전체가 금칙 문자뿐이면 끌어올리기(그 줄 전체를 앞줄에 병합)는 시도하지 않지만,
//   追い出し는 시도한다(앞줄 마지막 한 글자만 내리는 것이라 전체 병합과 무관하다).
export function applyKinsoku(lines: string[], fontSize: number, maxWidth: number, measure: MeasureFn): string[] {
  if (lines.length <= 1) return lines;
  const result = lines.slice();
  let iterations = 0;
  let changed = true;

  while (changed && iterations < MAX_KINSOKU_ITERATIONS) {
    changed = false;

    // 行頭禁則: i번째 줄 첫머리의 금칙 문자열을 (i-1)번째 줄 끝으로 옮긴다.
    for (let i = 1; i < result.length && iterations < MAX_KINSOKU_ITERATIONS; i++) {
      iterations++;
      const line = result[i];
      if (!line || !LINE_START_FORBIDDEN.has(line[0])) continue; // 위반 없음

      let cut = 0;
      while (cut < line.length && LINE_START_FORBIDDEN.has(line[cut])) cut++;

      let fixed = false;
      if (cut < line.length) {
        // 줄 전체가 금칙 문자는 아니다 — 끌어올리기(앞줄로 당기기)를 시도한다.
        const moved = line.slice(0, cut);
        const candidatePrev = result[i - 1] + moved;
        if (measure(candidatePrev, fontSize) <= maxWidth) {
          result[i - 1] = candidatePrev;
          result[i] = line.slice(cut);
          fixed = true;
        }
      }

      if (!fixed) {
        // 끌어올리기를 시도하지 않았거나(줄 전체가 금칙 문자) 폭 초과로 실패했다.
        // 追い出し(밀어내기): 앞줄의 마지막 글자를 현재 줄 앞으로 내려, 금칙 문자가
        // 더 이상 줄 첫머리가 아니게 만든다. wrapGreedy가 문자 단위 강제 절단으로 만든
        // 줄은 앞줄이 이미 maxWidth를 꽉 채운 경우가 많아 끌어올리기 자체가 폭 계산상
        // 항상 실패하는데, 이 경우의 보완책이다.
        const prevLine = result[i - 1];
        if (prevLine.length > 1) { // 앞줄이 1글자면 시도하지 않는다
          const pushedChar = prevLine[prevLine.length - 1];
          if (!LINE_START_FORBIDDEN.has(pushedChar)) { // 내린 글자 자체가 금칙이면 위반이 남으므로 포기
            const candidateNext = pushedChar + line;
            if (measure(candidateNext, fontSize) <= maxWidth) { // 내린 결과가 넘치면 포기
              result[i - 1] = prevLine.slice(0, -1);
              result[i] = candidateNext;
              fixed = true;
            }
          }
        }
      }

      if (fixed) changed = true;
    }

    // 行末禁則: i번째 줄 끝의 금칙 문자열을 (i+1)번째 줄 앞으로 옮긴다.
    for (let i = 0; i < result.length - 1 && iterations < MAX_KINSOKU_ITERATIONS; i++) {
      iterations++;
      const line = result[i];
      if (!line) continue;
      let cut = line.length;
      while (cut > 0 && LINE_END_FORBIDDEN.has(line[cut - 1])) cut--;
      if (cut === line.length || cut === 0) continue;
      const moved = line.slice(cut);
      const candidateNext = moved + result[i + 1];
      if (measure(candidateNext, fontSize) > maxWidth) continue;
      result[i] = line.slice(0, cut);
      result[i + 1] = candidateNext;
      changed = true;
    }
  }
  if (iterations >= MAX_KINSOKU_ITERATIONS) warnGuard('applyKinsoku');
  return result;
}

// letterSpacing(em)을 캔버스 letterSpacing 속성용 px 문자열로 변환한다.
// em은 폰트 크기에 비례해야 하는데 canvas는 DOM cascade 밖이라 "0.1em" 문자열을 그대로 주면
// 브라우저마다 기준 크기 해석이 갈릴 수 있어, 여기서 직접 px로 환산해 넘긴다.
export function letterSpacingPx(letterSpacingEm: number, fontSizePx: number): string {
  if (!letterSpacingEm) return '0px';
  return `${(letterSpacingEm * fontSizePx).toFixed(2)}px`;
}

function effectiveMaxLines(fontSize: number, maxHeight: number, lineHeightRatio: number, cap: number): number {
  const byHeight = Math.max(1, Math.floor(maxHeight / (fontSize * lineHeightRatio)));
  return Math.max(1, Math.min(cap, byHeight));
}

// 이분 탐색 상한 — 범위가 minFontSize~maxFontSize(보통 34~200 정도)면 12회로 충분하다
// (log2(200-34) ≈ 7.4). wrapGreedy는 문자 단위 폴백이 있어 가볍지 않고 미리보기·드래그마다
// 매번 불리므로, 선형 탐색(수십 회) 대신 반드시 이분 탐색을 쓴다.
const MAX_FONT_SEARCH_ITERATIONS = 12;

interface FontProbeResult {
  ok: boolean; // 이 fontSize에서 줄 수·폭 제약을 모두 만족하는지(=말줄임 없이 들어가는지)
  lines: string[];
}

interface FontFitResult {
  fontSize: number;
  lines: string[];
  fits: boolean; // false면 minFontSize로도 못 맞춘 것 — 호출부가 말줄임을 적용해야 한다
}

// minFontSize~maxFontSize 범위에서 "줄 수 ≤ cap 이고 어느 줄도 maxWidth를 넘지 않는"
// 조건을 만족하는 가장 큰 fontSize를 이분 탐색으로 찾는다. wrapGreedy 자체는 손대지 않는다.
function findFittingFontSize(
  text: string,
  measure: MeasureFn,
  maxWidth: number,
  maxHeight: number,
  minFontSize: number,
  maxFontSize: number,
  lineHeightRatio: number,
  maxLinesCap: number,
  onProbe?: (fontSize: number, lineCount: number) => void
): FontFitResult {
  let iterations = 0;

  function probe(fontSize: number): FontProbeResult {
    iterations++;
    const cap = effectiveMaxLines(fontSize, maxHeight, lineHeightRatio, maxLinesCap);
    const lines = wrapGreedy(text, fontSize, maxWidth, measure);
    onProbe?.(fontSize, lines.length);
    if (!lines.length || lines.length > cap) return { ok: false, lines };
    const withinWidth = lines.every(line => measure(line, fontSize) <= maxWidth + 1e-6);
    return { ok: withinWidth, lines };
  }

  const lo = Math.min(minFontSize, maxFontSize);
  const hi = Math.max(minFontSize, maxFontSize);

  const loProbe = probe(lo);
  if (!loProbe.ok) {
    // 최소 크기로도 안 맞는다 — 이분 탐색할 필요가 없다. 호출부가 말줄임으로 처리한다.
    return { fontSize: lo, lines: loProbe.lines, fits: false };
  }

  const hiProbe = probe(hi);
  if (hiProbe.ok) {
    // 상한 크기가 이미 맞는다 — 그보다 큰 시도는 무의미하므로 바로 채택한다.
    return { fontSize: hi, lines: hiProbe.lines, fits: true };
  }

  let bestFontSize = lo;
  let bestLines = loProbe.lines;
  let low = lo;
  let high = hi;

  while (iterations < MAX_FONT_SEARCH_ITERATIONS && high - low > 0.5) {
    const mid = (low + high) / 2;
    const midProbe = probe(mid);
    if (midProbe.ok) {
      low = mid;
      bestFontSize = mid;
      bestLines = midProbe.lines;
    } else {
      high = mid;
    }
  }
  if (iterations >= MAX_FONT_SEARCH_ITERATIONS) warnGuard('layoutText/fontSearch', MAX_FONT_SEARCH_ITERATIONS);

  return { fontSize: bestFontSize, lines: bestLines, fits: true };
}

// 어절 우선 줄바꿈 → minFontSize~maxFontSize 범위에서 이분 탐색으로 가장 큰 적합 크기를
// 찾는다(Phase 1-4, 양방향) → 그래도 minFontSize에서조차 안 맞으면 말줄임.
// maxHeight는 세로 안전영역(상하 여백 제외) 높이다.
export function layoutText(text: string, opts: LayoutOptions): TextBlockLayout {
  const maxLinesCap = opts.maxLines ?? 3;
  const lineHeightRatio = opts.lineHeightRatio ?? 1.28;
  const trimmed = text.trim();

  if (!trimmed) return { lines: [], fontSize: opts.startFontSize, lineHeight: opts.startFontSize * lineHeightRatio, truncated: false };

  // maxFontSize를 안 주면 startFontSize가 곧 상한이 된다(하위 호환 — 예전의 축소 전용 동작).
  const maxFontSize = Math.max(opts.minFontSize, opts.maxFontSize ?? opts.startFontSize);

  const fit = findFittingFontSize(
    trimmed,
    opts.measure,
    opts.maxWidth,
    opts.maxHeight,
    opts.minFontSize,
    maxFontSize,
    lineHeightRatio,
    maxLinesCap,
    opts.onFontSizeProbe
  );

  const fontSize = fit.fontSize;
  let lines = fit.lines;
  let truncated = false;

  if (!fit.fits) {
    // minFontSize로도 못 맞춘다 — 기존과 동일하게 자르고 마지막 줄을 말줄임 처리한다.
    const cap = Math.max(1, effectiveMaxLines(fontSize, opts.maxHeight, lineHeightRatio, maxLinesCap));
    truncated = true;
    lines = lines.slice(0, cap);
    if (!lines.length) lines = [''];
    lines[lines.length - 1] = ellipsize(lines[lines.length - 1], fontSize, opts.maxWidth, opts.measure);
  }

  if (opts.applyKinsokuRule ?? true) {
    lines = applyKinsoku(lines, fontSize, opts.maxWidth, opts.measure);
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

// letterSpacingEm(0이면 자간 없음)을 함께 받아 ctx.letterSpacing도 같이 맞춘다.
// ctx.letterSpacing은 font 문자열에 들어가지 않는 별도 캔버스 속성이라, 여기서 맞추지
// 않으면 measureText 폭과 실제로 그려지는 폭이 어긋나 줄바꿈이 틀어진다.
export function makeCanvasMeasurer(ctx: CanvasRenderingContext2D, fontBuilder: (fontSizePx: number) => string, letterSpacingEm = 0): MeasureFn {
  return (text, fontSizePx) => {
    ctx.font = fontBuilder(fontSizePx);
    if ('letterSpacing' in ctx) ctx.letterSpacing = letterSpacingPx(letterSpacingEm, fontSizePx);
    return ctx.measureText(text).width;
  };
}
