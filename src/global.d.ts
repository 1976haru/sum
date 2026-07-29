import type { AIImageSettings, AspectKind, CapcutKitRequest, ChannelBrandTemplate, ChannelPresetId, JobProgress, PickedFile, RenderRequest } from './types';

declare global {
  interface Window {
    sumAPI: {
      pickAudio(): Promise<PickedFile[]>;
      pickImages(): Promise<PickedFile[]>;
      pickOutputDir(): Promise<string | null>;
      readImage(filePath: string): Promise<string>;
      probeAudio(filePath: string): Promise<number>;
      saveThumbnail(input: { dataUrl: string; outputDir: string; fileName: string; format: 'jpg' | 'png' }): Promise<string>;
      renderPlaylist(input: RenderRequest): Promise<{ outputPath: string; duration: number }>;
      cancelRender(jobId: string): Promise<boolean>;
      exportCapcutKit(input: CapcutKitRequest): Promise<string>;
      openPath(targetPath: string): Promise<string>;
      loadBrandTemplates(): Promise<ChannelBrandTemplate[]>;
      saveBrandTemplate(template: ChannelBrandTemplate): Promise<ChannelBrandTemplate[]>;
      deleteBrandTemplate(channelPreset: ChannelPresetId): Promise<ChannelBrandTemplate[]>;
      loadAISettings(): Promise<AIImageSettings & { hasQwenKey: boolean; hasGeminiKey: boolean }>;
      saveAISettings(settings: AIImageSettings): Promise<{ ok: boolean }>;
      generateAIBackground(input: { prompt: string; negativePrompt?: string; size?: string; aspect?: AspectKind }): Promise<string>;
      copyText(text: string): Promise<boolean>;
      onProgress(callback: (progress: JobProgress) => void): () => void;
      onLog(callback: (line: string) => void): () => void;
    };
  }
}

export {};
