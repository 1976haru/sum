import type { AIImageSettings, AspectKind, BackgroundInspection, CapcutKitRequest, ChannelBrandTemplate, ChannelPresetId, ChecklistSheets, JobProgress, PickedFile, RenderRequest } from './types';

declare global {
  interface Window {
    sumAPI: {
      pickAudio(): Promise<PickedFile[]>;
      pickImages(): Promise<PickedFile[]>;
      pickOutputDir(): Promise<string | null>;
      readImage(filePath: string): Promise<string>;
      probeAudio(filePath: string): Promise<number>;
      saveThumbnail(input: { dataUrl: string; outputDir: string; fileName: string; format: 'jpg' | 'png' }): Promise<string>;
      saveTextFile(input: { outputDir: string; fileName: string; content: string }): Promise<string>;
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
      inspectBackground(input: { dataUrl: string; textZone: string }): Promise<BackgroundInspection | { skipped: true; reason: string } | { failed: true; reason: string }>;
      pickChecklistXlsx(): Promise<string | null>;
      loadChecklistXlsx(filePath: string): Promise<ChecklistSheets>;
      copyText(text: string): Promise<boolean>;
      onProgress(callback: (progress: JobProgress) => void): () => void;
      onLog(callback: (line: string) => void): () => void;
    };
  }
}

export {};
