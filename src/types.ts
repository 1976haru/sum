export type Language = 'ko' | 'ja' | 'en';
export type ChannelPresetId = 'light-pop-lounge' | 'morning-showa-cafe' | 'custom';
export type TextSide = 'left' | 'right';
export type LayoutId = 'editorial' | 'story' | 'minimal';
export type MotionMode = 'still' | 'gentle';

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
  textSide: TextSide;
  layout: LayoutId;
  background: string;
  accent: string;
  textColor: string;
  overlayStrength: number;
}

export interface ThumbnailRenderInput extends ProjectConfig {
  imageDataUrl: string;
  width?: number;
  height?: number;
  variantIndex?: number;
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

export interface CapcutKitRequest {
  projectName: string;
  tracks: Array<Pick<AudioTrack, 'path' | 'title' | 'duration'>>;
  thumbnailPath?: string;
  outputDir: string;
}
