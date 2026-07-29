// 개발용 폴백: 순수 브라우저(Vite dev server)에서 Electron IPC 없이도 실제 UI를 검증할 수 있게 한다.
// 실제 Electron에서는 preload.cjs가 이 모듈보다 먼저 window.sumAPI를 채워두므로 여기서는 아무 동작도 하지 않는다.
// 네이티브 파일/저장 대화상자만 흉내 내고, 캔버스 렌더 엔진(thumbnail.ts/cover.ts)은 그대로 실제 코드가 동작한다.
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
    renderPlaylist: async () => ({ outputPath: 'C:/mock-output/out.mp4', duration: 0 }),
    cancelRender: async () => true,
    exportCapcutKit: async () => 'C:/mock-output/kit.zip',
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
