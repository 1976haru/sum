// 사람이 눈으로 읽고 판단하기 위한 출력 도구. 판정은 하지 않는다 — 통과/실패는 vitest 린터가 결정한다.
// 지금까지 발견된 버그 3건(장르 무차별, 문구 굽기, 조명 충돌)은 전부 테스트가 아니라
// "출력물을 사람이 읽어서" 발견되었다. 이 스크립트는 그 확인 절차를 반복 가능하게 만든다.
// Electron API는 import하지 않는다 — src/lib 순수 모듈만 사용한다.
import {
  LOCATION_PRESETS,
  NEGATIVE_PROMPT,
  SEASON_PRESETS,
  TIME_PRESETS,
  buildPromptVariants
} from '../src/lib/promptBuilder';
import { buildReleaseMetadataText } from '../src/lib/releaseMeta';
import { resolveTextBox } from '../src/lib/textBox';
import { fontSpecFor, LEGACY_FONT_STYLE_MAP, normalizeFontStyleId } from '../src/lib/fonts';
import { applyKinsoku, layoutText, letterSpacingPx, type MeasureFn } from '../src/lib/textLayout';
import type { FontStyleId, LayoutId, SeasonPresetId, TextZone, TimePresetId } from '../src/types';

// 린터(promptBuilder.test.ts)와 동일한 어휘 목록. 이 스크립트는 판정하지 않으므로
// 여기서의 카운트는 참고용 요약일 뿐, 통과/실패 기준은 테스트 쪽에 있다.
const LIGHT_WORDS = [
  'light', 'lighting', 'lit', 'sunlight', 'sunlit', 'backlit', 'shadow', 'shadows',
  'bright', 'dark', 'dim', 'glow', 'glowing', 'luminous', 'radiance',
  'tones', 'grading', 'saturated', 'pastel'
];

function lightWordsIn(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const word of LIGHT_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) found.push(word);
  }
  return found;
}

function section(title: string) {
  console.log('');
  console.log('='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

section('1) 프롬프트 전문 3종 — 기본 조합 (rome / winter / golden-hour / left-third / 16:9)');
const baseVariants = buildPromptVariants({
  locationId: 'rome',
  seasonId: 'winter',
  timeId: 'golden-hour',
  textZone: 'left-third',
  aspect: '16x9'
});
console.log('\n--- Qwen ---');
console.log(baseVariants.qwen);
console.log('\n--- Generic (ChatGPT · DALL-E / Gemini) ---');
console.log(baseVariants.generic);
console.log('\n--- Midjourney ---');
console.log(baseVariants.midjourney);

section('2) 12개 계절×시간대 조합 — 조명 절만 나란히 (계절.mood + 시간대.mood)');
const SEASON_IDS = Object.keys(SEASON_PRESETS) as SeasonPresetId[];
const TIME_IDS = Object.keys(TIME_PRESETS) as TimePresetId[];
let duplicateComboCount = 0;
for (const seasonId of SEASON_IDS) {
  for (const timeId of TIME_IDS) {
    const seasonMood = SEASON_PRESETS[seasonId].mood;
    const timeMood = TIME_PRESETS[timeId].mood;
    const seasonWords = lightWordsIn(seasonMood);
    const timeWords = lightWordsIn(timeMood);
    const overlap = seasonWords.filter(word => timeWords.includes(word));
    if (overlap.length > 0) duplicateComboCount++;
    const tag = `[${seasonId} / ${timeId}]`.padEnd(24);
    const overlapNote = overlap.length ? `  ⚠ 조명 어휘 중복: ${overlap.join(', ')}` : '';
    console.log(`${tag} ${seasonMood}, ${timeMood}${overlapNote}`);
  }
}

section('3) 6개 장소의 오브제 개수');
for (const [locationId, preset] of Object.entries(LOCATION_PRESETS)) {
  console.log(`${locationId.padEnd(10)} ${preset.label.padEnd(8)} 오브제 ${preset.objects.length}개 — ${preset.objects.join(' / ')}`);
}

section('4) NEGATIVE_PROMPT 전문');
console.log(NEGATIVE_PROMPT);

section('5) 릴리스 메타데이터 텍스트 샘플');
console.log(buildReleaseMetadataText({
  releaseTitle: '그날, 로마에서',
  artistName: 'SUM Studio',
  coverHeadline: '그날, 로마에서',
  generatedAt: '2026-07-31T00:00:00.000Z'
}));

section('6) resolveTextBox — 프리셋 3종 x 해상도별(640/1280/1920) 좌표');
const ZONES: TextZone[] = ['left-third', 'top-center', 'center'];
const RESOLUTIONS: Array<{ width: number; height: number }> = [
  { width: 640, height: 360 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 }
];
for (const zone of ZONES) {
  console.log(`\n--- ${zone} ---`);
  for (const res of RESOLUTIONS) {
    const box = resolveTextBox({ textZone: zone, layout: 'editorial' }, res.width, res.height);
    const label = `${res.width}x${res.height}`.padEnd(10);
    console.log(`  ${label} boxX=${box.boxX.toFixed(2)} boxY=${box.boxY.toFixed(2)} maxWidth=${box.maxWidth.toFixed(2)} align=${box.align} scrimMode=${box.scrimMode}`);
  }
}
console.log('\nleft-third는 layout에 따라 boxY가 세 갈래다(1280x720 기준, scale=1):');
for (const layout of ['editorial', 'minimal', 'story'] as LayoutId[]) {
  const box = resolveTextBox({ textZone: 'left-third', layout }, 1280, 720);
  console.log(`  layout=${layout.padEnd(10)} boxY=${box.boxY}`);
}

section('7) FontStyleId 5종 — weight/family 표 및 구→신 id 매핑');
const FONT_IDS: FontStyleId[] = ['serif-thin', 'serif-regular', 'serif-bold', 'gothic-regular', 'gothic-bold'];
for (const id of FONT_IDS) {
  const spec = fontSpecFor(id);
  console.log(`  ${id.padEnd(16)} weight=${spec.weight}  family=${spec.family}`);
}
console.log('\n구 id → 신 id 매핑 (LEGACY_FONT_STYLE_MAP):');
for (const [oldId, newId] of Object.entries(LEGACY_FONT_STYLE_MAP)) {
  console.log(`  "${oldId}" → "${newId}"  (weight ${oldId === 'gothic' ? '700 → 700 (동일, id만 변경)' : ''})`);
}
console.log(`\n정규화 확인: normalizeFontStyleId('gothic') = "${normalizeFontStyleId('gothic')}"`);
console.log(`정규화 확인: normalizeFontStyleId(undefined) = "${normalizeFontStyleId(undefined)}"`);

section('8) 行頭・行末禁則 — 적용 전/후 줄바꿈 비교 (일본어 예문 2개 + 한국어 예문 1개)');
// 순수 함수만 쓰는 dump 스크립트 규칙(Electron/DOM 미사용)에 맞춰, 실제 캔버스 대신
// 문자 1개당 고정 폭을 갖는 합성 측정 함수로 재현한다(textLayout.test.ts와 동일한 방식).
function syntheticMeasure(charWidthAt16: number): MeasureFn {
  return (text, fontSizePx) => Array.from(text).length * charWidthAt16 * (fontSizePx / 16);
}
const kinsokuMeasure = syntheticMeasure(10);
const kinsokuFontSize = 16;

function printKinsokuComparison(label: string, lines: string[], maxWidth: number) {
  console.log(`\n--- ${label} (maxWidth=${maxWidth}) ---`);
  console.log('  적용 전:');
  lines.forEach((line, i) => console.log(`    [${i}] "${line}"`));
  const fixed = applyKinsoku(lines, kinsokuFontSize, maxWidth, kinsokuMeasure);
  console.log('  적용 후:');
  fixed.forEach((line, i) => console.log(`    [${i}] "${line}"`));
  const violations = fixed.filter((l, i) => i > 0 && l.startsWith('、')).length
    + fixed.filter((l, i) => i < fixed.length - 1 && l.endsWith('「')).length;
  console.log(`  잔여 위반: ${violations}건, 내용 보존: ${fixed.join('') === lines.join('') ? 'OK' : 'MISMATCH'}`);
}

printKinsokuComparison('일본어 예문 1 — 行頭禁則(、)', ['ふと', '、あの日を思い出す'], 1000);
printKinsokuComparison('일본어 예문 2 — 行末禁則(「)', ['窓辺の「', '静かな朝」'], 1000);
printKinsokuComparison('한국어 예문 — 行頭禁則(.)', ['안녕하세요', '.정말 그렇습니다'], 1000);

section('9) 자간(letterSpacing) 0 / 0.1em / 0.2em — 줄바꿈 결과 비교');
const letterSpacingSample = '이 멜로디 기억나 오늘도 어제처럼 설레는 하루';
for (const em of [0, 0.1, 0.2]) {
  // letterSpacingPx가 실제로 폭 계산에 반영되는지 보여주기 위해, 측정 함수 자체에
  // "글자수 * (기본폭 + 자간px)"를 반영한다 — makeCanvasMeasurer가 ctx.letterSpacing을
  // 설정하는 것과 동일한 효과를 합성 측정 함수로 재현한 것.
  const measureWithSpacing: MeasureFn = (text, fontSizePx) => {
    const base = Array.from(text).length * 10 * (fontSizePx / 16);
    const spacingPx = parseFloat(letterSpacingPx(em, fontSizePx));
    return base + Math.max(0, Array.from(text).length - 1) * spacingPx;
  };
  const layout = layoutText(letterSpacingSample, {
    measure: measureWithSpacing,
    maxWidth: 300,
    maxHeight: 400,
    startFontSize: 32,
    minFontSize: 20,
    maxLines: 4
  });
  console.log(`\n--- letterSpacing=${em}em (letterSpacingPx@32px = ${letterSpacingPx(em, 32)}) ---`);
  layout.lines.forEach((line, i) => console.log(`  [${i}] "${line}"  (width=${measureWithSpacing(line, layout.fontSize).toFixed(1)})`));
}

section('요약');
console.log(`조명 어휘 중복이 발견된 계절×시간대 조합 수: ${duplicateComboCount} / ${SEASON_IDS.length * TIME_IDS.length}`);
console.log('(이 숫자는 참고용 요약일 뿐입니다 — 실제 통과/실패 판정은 `npx vitest run`의 promptBuilder.test.ts 린터가 합니다.)');
