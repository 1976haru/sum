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

  // 개발용 간이 챕터 계산 — 실제 검증(TOO_SHORT/DUPLICATE_TIME 등)은 electron/chapters.cjs가
  // 유일한 소스다. 이 목은 Electron 없이 vite dev로 UI만 확인할 때 쓰는 표시용 근사치일 뿐이다.
  function mockFormatChapter(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  (window as unknown as { sumAPI: Record<string, unknown> }).sumAPI = {
    pickAudio: async () => [],
    pickAudioFolder: async () => ({ files: [], truncated: false }),
    buildChapters: async (tracks: Array<{ title?: string; duration: number }>) => {
      let cursor = 0;
      const cues = tracks.map((t, i) => {
        const duration = Number(t.duration) || 0;
        const title = t.title || `Track ${i + 1}`;
        const start = cursor;
        const end = cursor + duration;
        cursor = end;
        return { index: i + 1, title, duration, start, end };
      });
      const lines = cues.map(cue => `${mockFormatChapter(cue.start)} ${cue.title}`);
      return { lines, text: lines.length ? `${lines.join('\n')}\n` : '', issues: [], cues };
    },
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
