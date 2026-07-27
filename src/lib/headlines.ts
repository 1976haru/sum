import type { ChannelPresetId, Language } from '../types';

const BANKS: Record<Language, string[]> = {
  ko: [
    '문득, 그날이 떠올랐다',
    '잘 살아온 줄 알았는데',
    '어떤 순간은 오래 남는다',
    '비가 지나간 자리에',
    '오늘은 조금 천천히',
    '왜 이 노래가 그리울까',
    '조용한 날, 마음이 간다',
    '그날의 온기가 남았다',
    '다시 듣고 싶은 오후',
    '혼자 듣기 아까운 밤',
    '커피가 식기 전까지',
    '그 시절이 다시 온다'
  ],
  ja: [
    'ふと、あの日を思い出す',
    'なぜか恋しい午後',
    '静かな時間が残った',
    '雨上がりの窓辺で',
    '今日は少しゆっくり',
    'あの歌が恋しくなる',
    '心がほどける午後',
    'あの日の温度が残る',
    'もう一度聴きたい夜',
    'ひとりには惜しい音楽',
    '珈琲が冷めるまで',
    'あの頃が戻ってくる'
  ],
  en: [
    'Some Days Stay With Us',
    'Before the Coffee Gets Cold',
    'A Quiet Hour Returns',
    'Why This Song Feels Familiar',
    'After the Rain Passed',
    'Today, We Take It Slow',
    'The Warmth We Left Behind',
    'One More Song for Tonight'
  ]
};

const SHORT_BANKS: Record<Language, string[]> = {
  ko: ['문득 그날', '왜 그리울까', '조용한 오후', '오늘의 온기', '다시 듣는 밤', '그 시절 한 잔'],
  ja: ['ふと、あの日', 'なぜ恋しい', '静かな午後', '今日の温もり', 'もう一度の夜', 'あの頃の珈琲'],
  en: ['That Quiet Day', 'Why It Stays', 'Slow Afternoon', 'Warm Again', 'One More Night', 'Old Café Light']
};

function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length) return [];
  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

export function headlineSuggestions(language: Language, preset: ChannelPresetId, season: string, mood: string): string[] {
  const seed = [...`${preset}:${season}:${mood}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return rotate(BANKS[language], seed).slice(0, 8);
}

export function shortHeadlineSuggestions(language: Language): string[] {
  return SHORT_BANKS[language];
}

export function defaultSubline(language: Language, preset: ChannelPresetId): string {
  if (language === 'ja') return preset === 'morning-showa-cafe' ? '朝の昭和喫茶 プレイリスト' : '冬カフェ プレイリスト';
  if (language === 'en') return 'CAFE POP PLAYLIST';
  return preset === 'light-pop-lounge' ? '카페에서 듣기 좋은 감성 팝 플레이리스트' : '마음이 쉬어가는 카페 플레이리스트';
}
