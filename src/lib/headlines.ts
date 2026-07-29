import type { ChannelPresetId, HeadlineStyleTag, Language } from '../types';

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

// 스텝②: 스타일 태그별(호기심형·질문형·감성형·공감형·기대감형) 헤드라인 후보.
export const HEADLINE_STYLE_TAGS: HeadlineStyleTag[] = ['curiosity', 'question', 'emotional', 'empathy', 'anticipation'];

export const HEADLINE_STYLE_LABELS: Record<Language, Record<HeadlineStyleTag, string>> = {
  ko: { curiosity: '호기심형', question: '질문형', emotional: '감성형', empathy: '공감형', anticipation: '기대감형' },
  ja: { curiosity: '好奇心型', question: '質問型', emotional: '感性型', empathy: '共感型', anticipation: '期待型' },
  en: { curiosity: 'Curiosity', question: 'Question', emotional: 'Emotional', empathy: 'Empathy', anticipation: 'Anticipation' }
};

const TAGGED_BANKS: Record<Language, Record<HeadlineStyleTag, string[]>> = {
  ko: {
    curiosity: ['왜 자꾸 생각날까', '이 노래 어디서 들었지', '무슨 사연이었을까', '이 멜로디 낯익지 않나요'],
    question: ['오늘 뭐 듣고 있어?', '그날 기억나세요?', '이 노래 알아요?', '왜 마음이 이런 걸까?'],
    emotional: ['조용히 스며드는 밤', '마음이 젖는 오후', '바람이 두고 간 노래', '온기가 남은 자리'],
    empathy: ['누구나 그런 밤 있잖아요', '다 그런 날이 있죠', '지쳤던 하루 끝에', '혼자인 듯한 그 순간'],
    anticipation: ['오늘은 어떤 곡일까', '다음 곡이 더 좋아요', '설렘 가득한 선곡', '두근두근 다음 트랙']
  },
  ja: {
    curiosity: ['なぜか気になる曲', 'この曲、どこかで', 'どんな物語だろう', '聞き覚えのある旋律'],
    question: ['今何を聴いてる?', 'あの日を覚えてる?', 'この曲、知ってる?', 'なぜか切ないのはなぜ?'],
    emotional: ['静かに沁みる夜', '心が濡れる午後', '風が置いていった歌', '温もりが残る場所'],
    empathy: ['そんな夜もあるよね', '誰にでもある日', '疲れた一日の終わりに', 'ひとりのようなその瞬間'],
    anticipation: ['今日はどんな曲だろう', '次の曲がもっと好き', 'ときめく選曲', 'わくわく次のトラック']
  },
  en: {
    curiosity: ['Why This Feels Familiar', 'Where Have I Heard This', 'What Was the Story', 'A Melody You Half-Remember'],
    question: ['What Are You Playing Today', 'Do You Remember That Day', 'Do You Know This Song', 'Why Does It Feel Like This'],
    emotional: ['A Night That Quietly Sinks In', 'An Afternoon That Softens You', 'A Song the Wind Left Behind', 'Warmth That Still Lingers'],
    empathy: ['Everyone Has Nights Like This', 'We All Have Days Like That', 'At the End of a Tired Day', 'That Moment You Felt Alone'],
    anticipation: ['Wonder What Comes Next', 'The Next Song Is Even Better', 'A Playlist Full of Anticipation', 'Excited for the Next Track']
  }
};

export interface TaggedHeadline {
  tag: HeadlineStyleTag;
  text: string;
}

// 태그마다 1개씩, 총 5개 후보를 반환한다. seed(다시 추천 클릭 횟수)로 뱅크 내에서 회전한다.
export function styledHeadlineSuggestions(language: Language, seed = 0): TaggedHeadline[] {
  return HEADLINE_STYLE_TAGS.map(tag => {
    const bank = TAGGED_BANKS[language][tag];
    const rotated = rotate(bank, seed);
    return { tag, text: rotated[0] ?? bank[0] };
  });
}
