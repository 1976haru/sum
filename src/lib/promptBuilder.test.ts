import { describe, expect, it } from 'vitest';
import type { LocationPresetId, SeasonPresetId, TimePresetId } from '../types';
import { LOCATION_PRESETS, NEGATIVE_PROMPT, SEASON_PRESETS, SPEC_BLOCK, TIME_PRESETS, buildNegativePrompt, buildPromptVariants } from './promptBuilder';

const LOCATIONS = Object.keys(LOCATION_PRESETS) as LocationPresetId[];
const SEASONS = Object.keys(SEASON_PRESETS) as SeasonPresetId[];
const TIMES = Object.keys(TIME_PRESETS) as TimePresetId[];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'in', 'on', 'with', 'of', 'to', 'at', 'a', 'featuring',
  'soft', 'warm', 'cool', 'quiet', 'light', 'near', 'against', 'over', 'small',
  // winter/morning 고정 조합에서 계절·시간대 절이 모든 장소에 동일하게 붙는 비-변별 단어들
  // (조명/소재 역할 분리 작업으로 문구가 바뀌어 추가됨). 장소 변별력 검사와는 무관하다.
  'snowfall', 'frost', 'window', 'glass', 'bare', 'branches', 'early', 'morning', 'long', 'pale', 'shadow', 'shadows'
]);

function nounSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(word => word.length > 2 && !STOPWORDS.has(word))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter(item => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

describe('LOCATION_PRESETS 오브제 개수', () => {
  it('모든 프리셋의 오브제는 3~5개 범위를 지킨다(168px 축소 가독성 유지)', () => {
    for (const preset of Object.values(LOCATION_PRESETS)) {
      expect(preset.objects.length).toBeGreaterThanOrEqual(3);
      expect(preset.objects.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('buildPromptVariants — 문구 금지 지시의 구조적 보존', () => {
  const combos = LOCATIONS.flatMap(locationId =>
    SEASONS.flatMap(seasonId => TIMES.map(timeId => ({ locationId, seasonId, timeId })))
  );

  it('72조합 전부 생성된다(6 x 4 x 3)', () => {
    expect(combos.length).toBe(72);
  });

  it('모든 조합에서 generic·midjourney 변형에 문구 금지 지시가 살아있다', () => {
    for (const combo of combos) {
      const variants = buildPromptVariants({ ...combo, textZone: 'center', aspect: '16x9' });
      expect(variants.generic).toContain('no text');
      expect(variants.midjourney).toContain('no text');
      expect(variants.midjourney).toContain('--no');
    }
  });

  it('qwen 변형은 본문에 금지 문구를 넣지 않는다(negative_prompt 파라미터가 담당)', () => {
    const variants = buildPromptVariants({ locationId: 'rome', seasonId: 'winter', timeId: 'morning', textZone: 'center', aspect: '16x9' });
    expect(variants.qwen).not.toContain('no text');
    expect(variants.qwen).not.toContain('Avoid:');
  });

  it('buildNegativePrompt()는 Qwen negative_prompt로 전달될 문구 금지 지시를 항상 포함한다', () => {
    const negative = buildNegativePrompt();
    expect(negative).toContain('no text');
    expect(negative).toBe(NEGATIVE_PROMPT);
  });
});

describe('72조합 다양성 린터 — 장소가 다르면 핵심 명사 집합이 충분히 달라야 한다', () => {
  it('서로 다른 장소 쌍의 자카드 유사도가 상한선(0.6) 아래다', () => {
    const bySameSeasonTime = LOCATIONS.map(locationId =>
      buildPromptVariants({ locationId, seasonId: 'winter', timeId: 'morning', textZone: 'center', aspect: '16x9' }).qwen
    );
    for (let i = 0; i < LOCATIONS.length; i++) {
      for (let j = i + 1; j < LOCATIONS.length; j++) {
        const similarity = jaccard(nounSet(bySameSeasonTime[i]), nounSet(bySameSeasonTime[j]));
        expect(similarity).toBeLessThan(0.6);
      }
    }
  });

  it('같은 장소에서 계절·시간대만 바뀌어도 프롬프트 전문은 서로 다르다(중복 없음)', () => {
    const combos = LOCATIONS.flatMap(locationId =>
      SEASONS.flatMap(seasonId => TIMES.map(timeId => buildPromptVariants({ locationId, seasonId, timeId, textZone: 'center', aspect: '16x9' }).qwen))
    );
    expect(new Set(combos).size).toBe(combos.length);
  });
});

// 계절(SEASON_PRESETS)은 소재만, 시간대(TIME_PRESETS)는 조명만 서술해야 한다.
// 두 축이 조명을 동시에 서술하면 "cool blue-grey light" vs "golden hour sunlight"처럼
// 방향이 충돌하는 지시가 같은 프롬프트에 섞여 들어간다. 색보정은 SPEC_BLOCK이 전담한다.
const LIGHT_WORDS = [
  'light', 'lighting', 'lit', 'sunlight', 'sunlit', 'backlit', 'shadow', 'shadows',
  'bright', 'dark', 'dim', 'glow', 'glowing', 'luminous', 'radiance',
  'tones', 'grading', 'saturated', 'pastel'
];
const MAX_LIGHT_WORDS_PER_COMBO = 4;

function lightWordMatches(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const word of LIGHT_WORDS) {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'));
    if (matches) found.push(...matches);
  }
  return found;
}

function lightWordSet(text: string): Set<string> {
  return new Set(lightWordMatches(text));
}

describe('조명 중복 린터 — 계절은 소재, 시간대는 빛 (역할 분리 강제)', () => {
  it('1) SEASON_PRESETS 4개의 mood에는 조명 어휘가 하나도 없다', () => {
    for (const [seasonId, preset] of Object.entries(SEASON_PRESETS)) {
      const matches = lightWordMatches(preset.mood);
      expect(matches, `${seasonId} mood="${preset.mood}"에서 조명 어휘 발견: ${matches.join(', ')}`).toEqual([]);
    }
  });

  it('2) 72조합 각각에서 계절 절과 시간대 절이 같은 조명 어휘를 동시에 쓰지 않는다', () => {
    for (const seasonId of SEASONS) {
      const seasonWords = lightWordSet(SEASON_PRESETS[seasonId].mood);
      for (const timeId of TIMES) {
        const timeWords = lightWordSet(TIME_PRESETS[timeId].mood);
        const overlap = [...seasonWords].filter(word => timeWords.has(word));
        expect(overlap, `${seasonId} x ${timeId}: 계절·시간대가 같은 조명 어휘를 공유함(${overlap.join(', ')})`).toEqual([]);
      }
    }
  });

  it('3) 72조합 전부, qwen 프롬프트 전문의 조명 어휘 총 등장 횟수가 조합당 상한(4회)을 넘지 않는다', () => {
    for (const locationId of LOCATIONS) {
      for (const seasonId of SEASONS) {
        for (const timeId of TIMES) {
          const qwen = buildPromptVariants({ locationId, seasonId, timeId, textZone: 'center', aspect: '16x9' }).qwen;
          const count = lightWordMatches(qwen).length;
          expect(count, `${locationId}/${seasonId}/${timeId}: 조명 어휘 ${count}회 — "${qwen}"`).toBeLessThanOrEqual(MAX_LIGHT_WORDS_PER_COMBO);
        }
      }
    }
  });

  it('4) SPEC_BLOCK을 제외한 나머지 절에는 color grading/tones 계열이 없다(색보정은 SPEC_BLOCK 단독 담당)', () => {
    for (const locationId of LOCATIONS) {
      for (const seasonId of SEASONS) {
        for (const timeId of TIMES) {
          const qwen = buildPromptVariants({ locationId, seasonId, timeId, textZone: 'center', aspect: '16x9' }).qwen;
          expect(qwen.startsWith(`${SPEC_BLOCK}.`)).toBe(true);
          const rest = qwen.slice(`${SPEC_BLOCK}.`.length);
          expect(/\bgrading\b/i.test(rest), `${locationId}/${seasonId}/${timeId}: SPEC_BLOCK 밖에 "grading" 등장 — "${rest}"`).toBe(false);
          expect(/\btones\b/i.test(rest), `${locationId}/${seasonId}/${timeId}: SPEC_BLOCK 밖에 "tones" 등장 — "${rest}"`).toBe(false);
        }
      }
    }
  });
});
