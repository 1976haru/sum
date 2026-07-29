import type { AspectKind, LocationPresetId, PromptVariant, SeasonPresetId, TextZone, TimePresetId } from '../types';

// 필름 실사 스펙 블록 — 문구는 이미지에 절대 굽지 않으므로(한글 깨짐 실증) 여기엔 문구 관련 지시가 없다.
export const SPEC_BLOCK =
  'Cinematic editorial photograph, shot on 35mm film, Kodak Portra 400, 50mm lens, f/1.8-2.0, shallow depth of field, natural bokeh, subtle film grain, muted warm color grading';

export const NEGATIVE_PROMPT =
  'no text, no letters, no logo, no watermark, no visible face, no front-facing portrait, no identifiable person, no celebrity, no branded IP, no famous painting, no glowing sparkles, no HDR look, no plastic CGI, no illustration';

const NEGATIVE_ITEMS = NEGATIVE_PROMPT.split(', ').map(item => item.replace(/^no\s+/, ''));

interface LocationPreset {
  label: string;
  scene: string;
  objects: string[];
}
interface SeasonPreset {
  label: string;
  mood: string;
}
interface TimePreset {
  label: string;
  mood: string;
}

// 각 프리셋 오브제는 3~5개로 제한(축소 시 가독성 유지).
export const LOCATION_PRESETS: Record<LocationPresetId, LocationPreset> = {
  rome: {
    label: '로마',
    scene: 'a quiet cobblestone alley in Rome',
    objects: ['terracotta rooftops', 'an espresso cup on a marble café table', 'ivy climbing a stone wall', 'a vintage Vespa parked nearby']
  },
  paris: {
    label: '파리',
    scene: 'a Parisian café corner near a zinc-roofed building',
    objects: ['a wicker bistro chair', 'a croissant on a small plate', 'wrought-iron balcony railings', 'soft rain on cobblestones']
  },
  barcelona: {
    label: '바르셀로나',
    scene: 'a sunlit courtyard in Barcelona with Mediterranean warmth',
    objects: ['colorful mosaic tiles', 'potted citrus trees', 'a woven straw hat on a chair', 'linen curtains drifting in the breeze']
  },
  prague: {
    label: '프라하',
    scene: 'a cobbled lane in old-town Prague',
    objects: ['gothic spires in the distance', 'a warm café window glow', 'an old tram rail', 'fallen leaves on stone steps']
  },
  kyoto: {
    label: '교토',
    scene: 'a quiet wooden veranda in Kyoto overlooking a small garden',
    objects: ['a paper lantern', 'a ceramic teacup', 'a maple branch', 'a raked gravel garden path']
  },
  provence: {
    label: '프로방스',
    scene: 'a lavender-lined stone farmhouse terrace in Provence',
    objects: ['rows of lavender in soft focus', 'a weathered wooden shutter', 'a glass of rosé on a stone table', 'olive tree branches']
  }
};

export const SEASON_PRESETS: Record<SeasonPresetId, SeasonPreset> = {
  spring: { label: '봄', mood: 'soft cherry blossoms drifting in the air, pastel tones' },
  summer: { label: '여름', mood: 'bright warm sun, long soft shadows, humid air' },
  autumn: { label: '가을', mood: 'amber and rust-colored foliage, crisp low light' },
  winter: { label: '겨울', mood: 'quiet snowfall, cool blue-grey light with warm accents' }
};

export const TIME_PRESETS: Record<TimePresetId, TimePreset> = {
  morning: { label: '아침', mood: 'early morning light, soft and cool' },
  'golden-hour': { label: 'golden hour', mood: 'golden hour sunlight, long warm shadows' },
  night: { label: '밤', mood: 'quiet night ambience, warm window light against a dark blue sky' }
};

const TEXT_ZONE_NOTES: Record<TextZone, string> = {
  'left-third': 'Keep the left third of the frame low-detail and visually calm, reserved for a text overlay',
  'top-center': 'Keep the top area of the frame low-detail and visually calm, reserved for a text overlay',
  center: 'Keep the vertical center band of the frame low-detail and visually calm, reserved for a text overlay'
};

export interface PromptBuildOptions {
  locationId: LocationPresetId;
  seasonId: SeasonPresetId;
  timeId: TimePresetId;
  textZone: TextZone;
  aspect: AspectKind;
  extra?: string;
}

function sceneCore(opts: PromptBuildOptions): string {
  const location = LOCATION_PRESETS[opts.locationId];
  const season = SEASON_PRESETS[opts.seasonId];
  const time = TIME_PRESETS[opts.timeId];
  const objects = location.objects.slice(0, 5).join(', ');
  const extra = opts.extra?.trim();
  return [
    `${location.scene}, featuring ${objects}.`,
    `${season.mood}, ${time.mood}.`,
    extra ? `${extra}.` : ''
  ].filter(Boolean).join(' ');
}

// Generic(ChatGPT/DALL-E) / Midjourney(--ar --style raw) / Qwen(상세 서술형) 3종을 함께 만든다.
export function buildPromptVariants(opts: PromptBuildOptions): Record<PromptVariant, string> {
  const core = sceneCore(opts);
  const zoneNote = TEXT_ZONE_NOTES[opts.textZone];
  const ar = opts.aspect === '1x1' ? '1:1' : '16:9';

  const generic = [`${SPEC_BLOCK}.`, core, `${zoneNote}.`, `Avoid: ${NEGATIVE_PROMPT}.`].join(' ');
  const midjourney = `${SPEC_BLOCK}, ${core} ${zoneNote}. --ar ${ar} --style raw --no ${NEGATIVE_ITEMS.join(', ')}`;
  const qwen = [`${SPEC_BLOCK}.`, core, `${zoneNote}.`].join(' ');

  return { generic, midjourney, qwen };
}

export function buildNegativePrompt(): string {
  return NEGATIVE_PROMPT;
}
