export type Language = 'ko' | 'ja' | 'en';
export type ChannelPresetId = 'light-pop-lounge' | 'morning-showa-cafe' | 'custom';
// 좌측 1/3 · 상단 중앙 · 중앙 — 스텝③ 텍스트 위치 3종.
export type TextZone = 'left-third' | 'top-center' | 'center';
export type LayoutId = 'editorial' | 'story' | 'minimal';
export type MotionMode = 'still' | 'gentle';
export type AspectKind = '16x9' | '1x1';
export type CoverLayoutId = 'centered' | 'centered-panel';
export type FontStyleId = 'serif-thin' | 'serif-bold' | 'gothic';
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

export interface ProjectConfig {
  projectName: string;
  channelPreset: ChannelPresetId;
  language: Language;
  season: string;
  mood: string;
  headline: string;
  subline: string;
  textZone: TextZone;
  layout: LayoutId;
  background: string;
  accent: string;
  textColor: string;
  overlayStrength: number;
  fontStyle: FontStyleId;
  autoTextColor: boolean;
  brandLine: string;
  showBadge: boolean;
  showDivider: boolean;
  showSubline: boolean;
}

export interface ThumbnailRenderInput extends ProjectConfig {
  imageDataUrl: string;
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
  autoTextColor: boolean;
  brandLine: string;
  showBadge: boolean;
  showDivider: boolean;
  format: 'jpg' | 'png';
}

export interface CoverRenderInput extends CoverConfig {
  imageDataUrl: string;
  variantIndex?: number;
}

export interface ChannelBrandTemplate {
  channelPreset: ChannelPresetId;
  fontStyle: FontStyleId;
  textColor: string;
  accent: string;
  overlayStrength: number;
  autoTextColor: boolean;
  textZone: TextZone;
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
