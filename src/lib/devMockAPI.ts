// 개발용 폴백: 순수 브라우저(Vite dev server)에서 Electron IPC 없이도 실제 UI를 검증할 수 있게 한다.
// 실제 Electron에서는 preload.cjs가 이 모듈보다 먼저 window.sumAPI를 채워두므로 여기서는 아무 동작도 하지 않는다.
// 네이티브 파일/저장 대화상자만 흉내 내고, 캔버스 렌더 엔진(thumbnail.ts/cover.ts)은 그대로 실제 코드가 동작한다.
//
// chapters.cjs/description.cjs는 Electron API(fs/electron)를 쓰지 않는 순수 JS라 Vite가 그대로
// 브라우저 번들에 넣을 수 있다 — 그래서 여기서 자체 재구현 대신 실제 모듈을 그대로 불러 쓴다.
// mock이 실제 검증 로직(TOO_SHORT 등)과 어긋나면 브라우저에서만 UI 회귀를 놓치게 된다(Phase 2-1에서 실제로 발생).
// 이 두 파일은 여전히 Node CommonJS(.cjs, module.exports)다 — 브라우저 네이티브 ESM은 `module`을
// 모른다. vite.config.ts의 cjsBrowserBridge 플러그인이 이 두 파일에 한해 브라우저로 나갈 때만
// `module.exports`를 감싸 default export로 열어준다(원본 파일은 건드리지 않는다 — main.cjs의
// require()·vitest의 createRequire()는 지금처럼 순수 CommonJS 그대로 읽는다).
import chaptersModule from '../../electron/chapters.cjs';
import descriptionModule from '../../electron/description.cjs';
import type { ChapterBuildResult, DescriptionBuildResult } from '../types';

const chaptersApi = chaptersModule as unknown as {
  buildChapters: (tracks: Array<{ title?: string; duration: number }>) => ChapterBuildResult;
};
const descriptionApi = descriptionModule as unknown as {
  buildDescriptionText: (input: { greeting?: string; chaptersText?: string; keywords?: string; footer?: string }) => DescriptionBuildResult;
};

if (typeof window !== 'undefined' && !(window as unknown as { sumAPI?: unknown }).sumAPI) {
  const imageStore = new Map<string, string>();
  let seq = 0;

  function gradientDataUrl(top: string, bottom: string, size = 640) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return canvas.toDataURL('image/png');
  }

  function readJSON<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  (window as unknown as { sumAPI: Record<string, unknown> }).sumAPI = {
    pickAudio: async () => [],
    pickAudioFolder: async () => ({ files: [], truncated: false }),
    buildChapters: async (tracks: Array<{ title?: string; duration: number }>) => chaptersApi.buildChapters(tracks),
    buildDescription: async (input: { greeting?: string; chaptersText?: string; keywords?: string; footer?: string }) => descriptionApi.buildDescriptionText(input),
    pickImages: async () => {
      seq += 1;
      const path = `mock://bright-${seq}.png`;
      imageStore.set(path, gradientDataUrl('#bfe6ff', '#dff0e0'));
      return [{ path, name: `bright-${seq}.png` }];
    },
    pickOutputDir: async () => 'C:/mock-output',
    readImage: async (path: string) => imageStore.get(path) || gradientDataUrl('#eee', '#ccc'),
    probeAudio: async () => 180,
    saveThumbnail: async (input: { fileName: string; format: string }) => {
      console.log('[devMockAPI] saveThumbnail', input.fileName, input.format);
      return `C:/mock-output/${input.fileName}.${input.format}`;
    },
    renderPlaylist: async () => ({ cancelled: false, outputPath: 'C:/mock-output/out/out.mp4', folderPath: 'C:/mock-output/out', duration: 0, chapterIssues: [] }),
    cancelRender: async () => true,
    exportCapcutKit: async () => ({ path: 'C:/mock-output/kit.zip', issues: [] }),
    openPath: async () => '',
    loadBrandTemplates: async () => readJSON('mock-brand-templates', []),
    saveBrandTemplate: async (template: { channelPreset: string }) => {
      const list = readJSON<Array<{ channelPreset: string }>>('mock-brand-templates', []).filter(item => item.channelPreset !== template.channelPreset);
      list.push({ ...template, updatedAt: new Date().toISOString() } as never);
      localStorage.setItem('mock-brand-templates', JSON.stringify(list));
      return list;
    },
    deleteBrandTemplate: async (channelPreset: string) => {
      const list = readJSON<Array<{ channelPreset: string }>>('mock-brand-templates', []).filter(item => item.channelPreset !== channelPreset);
      localStorage.setItem('mock-brand-templates', JSON.stringify(list));
      return list;
    },
    loadAISettings: async () => readJSON('mock-ai-settings', {
      provider: 'qwen', qwenApiKey: '', qwenWorkspaceId: '', qwenRegion: 'singapore', qwenModel: 'qwen-image-2.0-pro',
      geminiApiKey: '', geminiModel: 'gemini-3.1-flash-image', hasQwenKey: false, hasGeminiKey: false
    }),
    saveAISettings: async (settings: { qwenApiKey?: string; geminiApiKey?: string }) => {
      const hasQwenKey = Boolean(settings.qwenApiKey);
      const hasGeminiKey = Boolean(settings.geminiApiKey);
      localStorage.setItem('mock-ai-settings', JSON.stringify({ ...settings, hasQwenKey, hasGeminiKey }));
      return { ok: true };
    },
    generateAIBackground: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return gradientDataUrl('#ffd9a8', '#8a5a3a');
    },
    copyText: async (text: string) => { console.log('[devMockAPI] copyText', text.slice(0, 80)); return true; },
    onProgress: () => () => {},
    onLog: () => () => {}
  };
}
