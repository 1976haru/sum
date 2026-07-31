import { describe, expect, it } from 'vitest';
import type { LocationPresetId, SeasonPresetId, TimePresetId } from '../types';
import { LOCATION_PRESETS, NEGATIVE_PROMPT, SEASON_PRESETS, TIME_PRESETS, buildNegativePrompt, buildPromptVariants } from './promptBuilder';

const LOCATIONS = Object.keys(LOCATION_PRESETS) as LocationPresetId[];
const SEASONS = Object.keys(SEASON_PRESETS) as SeasonPresetId[];
const TIMES = Object.keys(TIME_PRESETS) as TimePresetId[];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'in', 'on', 'with', 'of', 'to', 'at', 'a', 'featuring',
  'soft', 'warm', 'cool', 'quiet', 'light', 'near', 'against', 'over', 'small'
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
