export type Language = 'ko' | 'ja' | 'en';
export type ChannelPresetId = 'light-pop-lounge' | 'morning-showa-cafe' | 'custom';
// 좌측 1/3 · 상단 중앙 · 중앙 — 스텝③ 텍스트 위치 3종.
export type TextZone = 'left-third' | 'top-center' | 'center';
export type LayoutId = 'editorial' | 'story' | 'minimal';
export type MotionMode = 'still' | 'gentle';
export type AspectKind = '16x9' | '1x1';
export type CoverLayoutId = 'centered' | 'centered-panel';
// 구 id('gothic')는 저장된 브랜드 템플릿에 남아있을 수 있어 fonts.ts의
// normalizeFontStyleId()가 로드 시점에 신 id로 변환한다. 렌더러는 이 5종만 다룬다.
export type FontStyleId = 'serif-thin' | 'serif-regular' | 'serif-bold' | 'gothic-regular' | 'gothic-bold';
export type HeadlineStyleTag = 'curiosity' | 'question' | 'emotional' | 'empathy' | 'anticipation';

export interface PickedFile {
  path: string;
  name: string;
}

export interface BackgroundImage extends PickedFile {
  dataUrl: string;
}

export interface AudioTrack extends PickedFile {
  id: string;
  title: string;
  duration: number;
  // 길이 측정(ffprobe) 실패 사유. 있으면 duration은 신뢰할 수 없다(0으로 조용히 넘기지 않는다).
  durationError?: string;
}

export type ChapterIssueLevel = 'error' | 'warning';

export interface ChapterIssue {
  level: ChapterIssueLevel;
  code: 'TOO_FEW' | 'TOO_SHORT' | 'DUPLICATE_TIME' | 'TITLE_TOO_LONG';
  message: string;
}

export interface ChapterCue {
  index: number;
  title: string;
  duration: number;
  start: number;
  end: number;
}

export interface ChapterBuildResult {
  lines: string[];
  text: string;
  issues: ChapterIssue[];
  cues: ChapterCue[];
}

// 스텝③ 미리보기에서 드래그로 직접 배치한 텍스트 박스. 모든 값은 0~1 정규화 좌표다
// (픽셀로 저장하면 640px 미리보기 / 168px 축소 / 1920px 실제 출력에서 서로 다른 위치가 찍힌다).
export interface TextBox {
  x: number;      // 0~1, 정렬 기준점의 가로 위치
  y: number;      // 0~1, 블록 상단
  width: number;  // 0~1, maxWidth
  align: 'left' | 'center';
}

export interface ProjectConfig {
  projectName: string;
  channelPreset: ChannelPresetId;
  language: Language;
  season: string;
  mood: string;
  headline: string;
  subline: string;
  textZone: TextZone;
  // textBox가 있으면 textZone 프리셋 대신 이 값을 쓴다. 없으면(undefined) 기존 프리셋 동작 그대로.
  textBox?: TextBox;
  layout: LayoutId;
  background: string;
  accent: string;
  textColor: string;
  overlayStrength: number;
  fontStyle: FontStyleId;
  // em 단위 자간. 기본 0(자간 없음), 범위 -0.05 ~ 0.3. 부제는 독립 설정이 없고 이 값을 함께 따른다.
  letterSpacing?: number;
  // 줄 간격 배수. 기본 1.28(textLayout.ts 기본값과 동일).
  lineHeightRatio?: number;
  autoTextColor: boolean;
  brandLine: string;
  showBadge: boolean;
  showDivider: boolean;
  showSubline: boolean;
  // Phase 2-2: description.txt 조립용 채널 고정 문구. ChannelBrandTemplate과 짝을 이룬다.
  channelGreeting: string;
  channelFooter: string;
}

export interface ThumbnailRenderInput extends ProjectConfig {
  // 없으면(undefined) accent 색 기반 그라디언트로 대체한다(Phase 1-3 폴백 배경).
  imageDataUrl?: string;
  width?: number;
  height?: number;
  variantIndex?: number;
}

export interface CoverConfig {
  headline: string;
  layout: CoverLayoutId;
  accent: string;
  textColor: string;
  overlayStrength: number;
  fontStyle: FontStyleId;
  letterSpacing?: number;
  lineHeightRatio?: number;
  autoTextColor: boolean;
  brandLine: string;
  showBadge: boolean;
  showDivider: boolean;
  format: 'jpg' | 'png';
}

export interface CoverRenderInput extends CoverConfig {
  // 없으면(undefined) accent 색 기반 그라디언트로 대체한다(Phase 1-3 폴백 배경).
  imageDataUrl?: string;
  variantIndex?: number;
}

export interface ChannelBrandTemplate {
  channelPreset: ChannelPresetId;
  fontStyle: FontStyleId;
  letterSpacing?: number;
  lineHeightRatio?: number;
  textColor: string;
  accent: string;
  overlayStrength: number;
  autoTextColor: boolean;
  textZone: TextZone;
  textBox?: TextBox;
  subline: string;
  brandLine: string;
  artistName: string;
  showBadge: boolean;
  showDivider: boolean;
  showSubline: boolean;
  channelGreeting: string;
  channelFooter: string;
  updatedAt: string;
}

export type AIRegion = 'singapore' | 'beijing';
export type AIProvider = 'qwen' | 'gemini';

export interface AIImageSettings {
  provider: AIProvider;
  qwenApiKey: string;
  qwenWorkspaceId: string;
  qwenRegion: AIRegion;
  qwenModel: string;
  geminiApiKey: string;
  geminiModel: string;
}

export type LocationPresetId = 'rome' | 'paris' | 'barcelona' | 'prague' | 'kyoto' | 'provence';
export type SeasonPresetId = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimePresetId = 'morning' | 'golden-hour' | 'night';
export type PromptVariant = 'generic' | 'midjourney' | 'qwen';

export interface BatchResultItem {
  fileName: string;
  path?: string;
  status: 'ok' | 'failed';
  reason?: string;
  // renderThumbnail()의 진단 경고(168px 판독성/대비/말줄임). 경고는 생성을 막지 않는다.
  warnings?: string[];
}

export interface BatchProgressState {
  current: number;
  total: number;
  label: string;
}

export interface JobProgress {
  jobId: string;
  stage: string;
  percent: number;
  label: string;
}

// description.txt 조립에 필요한 입력. chaptersText는 렌더 쪽(electron/chapters.cjs)이 실제
// 트랙으로 재계산한 값을 쓴다 — 미리보기(chapters:build)의 값을 그대로 신뢰하지 않는다.
// 그래야 chapters.txt와 description.txt의 챕터 구간이 항상 문자 단위로 같다.
export interface RenderDescriptionInput {
  greeting: string;
  footer: string;
  keywords: string;
}

export interface RenderRequest {
  jobId: string;
  tracks: Array<Pick<AudioTrack, 'path' | 'title' | 'duration'>>;
  thumbnailPath: string;
  outputDir: string;
  outputName: string;
  motion: MotionMode;
  // 있으면(사용자가 커버를 저장한 적이 있으면) 산출물 폴더에 함께 담는다.
  coverPath?: string;
  description?: RenderDescriptionInput;
  // src/lib/releaseMeta.ts가 만든 텍스트를 그대로 받아 파일로 적기만 한다(로직 재계산 없음).
  metadataText?: string;
}

export type RenderResult =
  | { cancelled: true }
  | { cancelled: false; outputPath: string; folderPath: string; duration: number; chapterIssues: ChapterIssue[] };

export interface DescriptionBuildResult {
  text: string;
  length: number;
  overLimit: boolean;
  hashtags: string[];
}

export type ChecklistSheetName = '한국채널' | '일본채널';

export interface ChecklistSetRow {
  setNumber: string;
  releaseTarget: string;
  season: string;
  projectName: string;
  moodHint: string;
  trackTarget: string;
  backgroundDirection: string;
  titleExample: string;
  keywords: string;
  thumbnailStatus: string;
}

export type ChecklistSheets = Record<ChecklistSheetName, ChecklistSetRow[]>;

export interface ReleaseMeta {
  releaseTitle: string;
  artistName: string;
  channelPreset: ChannelPresetId;
}

export interface BackgroundInspection {
  hasText: boolean;
  hasVisibleFace: boolean;
  textZoneClear: boolean;
  objectCount: number;
  notes: string;
}

export interface CapcutKitRequest {
  projectName: string;
  tracks: Array<Pick<AudioTrack, 'path' | 'title' | 'duration'>>;
  thumbnailPath?: string;
  outputDir: string;
}
