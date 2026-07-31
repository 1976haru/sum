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

export interface RenderRequest {
  jobId: string;
  tracks: Array<Pick<AudioTrack, 'path' | 'title' | 'duration'>>;
  thumbnailPath: string;
  outputDir: string;
  outputName: string;
  motion: MotionMode;
}

export type ChecklistSheetName = '한국채널' | '일본채널';

export interface ChecklistSetRow {
  setNumber: string;
  releaseTarget: string;
  season: string;
  projectName: string;
  moodHint: string;
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
