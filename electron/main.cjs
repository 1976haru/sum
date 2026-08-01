const { app, BrowserWindow, dialog, ipcMain, shell, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const archiver = require('archiver');
const { parseChecklistXlsx } = require('./checklist.cjs');
const chapters = require('./chapters.cjs');
const audioFiles = require('./audioFiles.cjs');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

const activeJobs = new Map();
let mainWindow = null;

function unpacked(binaryPath) {
  return binaryPath ? binaryPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`) : binaryPath;
}
const ffmpegPath = unpacked(ffmpegStatic);
const ffprobePath = unpacked(ffprobeStatic && ffprobeStatic.path);

function safeName(input, fallback = 'output', max = 100) {
  let value = String(input || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '');
  if (value.length > max) value = value.slice(0, max).replace(/[\s.]+$/g, '');
  return value || fallback;
}
function tmpDir() {
  const root = process.platform === 'win32' ? 'C:\\sum-studio-tmp' : path.join(os.tmpdir(), 'sum-studio');
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, crypto.randomBytes(6).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 앱이 강제 종료되면 playlist:render의 finally가 못 돌아 작업 폴더가 C:\sum-studio-tmp\ 아래
// 계속 쌓인다. 시작 시 1회만 비운다 — 진행 중인 렌더가 있을 수 있는 시점(작업 실행 중)에는
// 절대 호출하지 않고, 주기적 타이머로도 돌리지 않는다. 정리 실패는 앱 실행을 막을 이유가
// 아니므로 절대 throw하지 않고 삼키되, 조용히 넘어가지 않도록 로그는 남긴다.
const SWEEP_MAX_ENTRIES = 1000;
function sweepTmpRoot() {
  try {
    // tmpDir()과 반드시 같은 경로 계산식을 써야 한다 — 어긋나면 아무것도 안 지우면서 지운 척하게 된다.
    const root = process.platform === 'win32' ? 'C:\\sum-studio-tmp' : path.join(os.tmpdir(), 'sum-studio');
    if (!fs.existsSync(root)) return;
    const entries = fs.readdirSync(root).slice(0, SWEEP_MAX_ENTRIES);
    for (const entry of entries) {
      try {
        fs.rmSync(path.join(root, entry), { recursive: true, force: true });
      } catch (error) {
        log(`[정리] 임시 폴더 항목을 지우지 못했습니다: ${entry} — ${error.message}`);
      }
    }
  } catch (error) {
    log(`[정리] 임시 폴더 정리 중 오류가 발생했지만 앱 실행은 계속합니다: ${error.message}`);
  }
}
function send(channel, payload) {
  try { mainWindow && mainWindow.webContents.send(channel, payload); } catch {}
}
function log(line) { send('job:log', String(line)); }
function progress(jobId, stage, percent, label) {
  send('job:progress', { jobId, stage, percent: Math.max(0, Math.min(100, Math.round(percent))), label });
}
// 시간 포맷은 electron/chapters.cjs 하나만 쓴다(두 벌 금지) — CapCut Kit의 챕터/타임라인과
// 아래 렌더 진행률 로그가 같은 포맷을 쓰도록 보장한다.
const { formatChapter } = chapters;
function probe(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      const duration = Number(out.trim());
      if (code === 0 && Number.isFinite(duration)) resolve(duration);
      else reject(new Error(err || '오디오 길이를 확인하지 못했습니다.'));
    });
  });
}
function dataUrlBuffer(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('잘못된 이미지 데이터입니다.');
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

// --- 파트D: 채널 브랜드 템플릿 영속화 (로컬 JSON, 앱 재실행 후에도 유지) ---
function brandTemplatesPath() {
  return path.join(app.getPath('userData'), 'brand-templates.json');
}
function readBrandTemplates() {
  try {
    const raw = fs.readFileSync(brandTemplatesPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeBrandTemplates(list) {
  fs.mkdirSync(path.dirname(brandTemplatesPath()), { recursive: true });
  fs.writeFileSync(brandTemplatesPath(), JSON.stringify(list, null, 2));
}

// --- 파트F: AI 이미지 설정(Qwen + Gemini). API 키는 가능하면 OS 자격 증명 저장소로 암호화해 로컬에만 보관한다. ---
function aiSettingsPath() {
  return path.join(app.getPath('userData'), 'ai-settings.json');
}
function decryptOrEmpty(enc) {
  if (!enc) return '';
  try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(enc, 'base64')) : ''; } catch { return ''; }
}
function encryptOrEmpty(plain) {
  if (!plain || !safeStorage.isEncryptionAvailable()) return '';
  return safeStorage.encryptString(plain).toString('base64');
}
const AI_SETTINGS_DEFAULTS = {
  provider: 'qwen',
  qwenApiKey: '', qwenWorkspaceId: '', qwenRegion: 'singapore', qwenModel: 'qwen-image-2.0-pro',
  geminiApiKey: '', geminiModel: 'gemini-3.1-flash-image'
};
function readAISettings() {
  try {
    const raw = fs.readFileSync(aiSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider === 'gemini' ? 'gemini' : 'qwen',
      qwenApiKey: decryptOrEmpty(parsed.qwenApiKeyEnc),
      qwenWorkspaceId: parsed.qwenWorkspaceId || '',
      qwenRegion: parsed.qwenRegion === 'beijing' ? 'beijing' : 'singapore',
      qwenModel: parsed.qwenModel || AI_SETTINGS_DEFAULTS.qwenModel,
      geminiApiKey: decryptOrEmpty(parsed.geminiApiKeyEnc),
      geminiModel: parsed.geminiModel || AI_SETTINGS_DEFAULTS.geminiModel
    };
  } catch {
    return { ...AI_SETTINGS_DEFAULTS };
  }
}
function writeAISettings(settings) {
  fs.mkdirSync(path.dirname(aiSettingsPath()), { recursive: true });
  const payload = {
    provider: settings.provider === 'gemini' ? 'gemini' : 'qwen',
    qwenWorkspaceId: settings.qwenWorkspaceId || '',
    qwenRegion: settings.qwenRegion === 'beijing' ? 'beijing' : 'singapore',
    qwenModel: settings.qwenModel || AI_SETTINGS_DEFAULTS.qwenModel,
    qwenApiKeyEnc: encryptOrEmpty(settings.qwenApiKey),
    geminiModel: settings.geminiModel || AI_SETTINGS_DEFAULTS.geminiModel,
    geminiApiKeyEnc: encryptOrEmpty(settings.geminiApiKey)
  };
  fs.writeFileSync(aiSettingsPath(), JSON.stringify(payload, null, 2));
}

const REGION_HOST = { singapore: 'ap-southeast-1', beijing: 'cn-beijing' };
const MASK = '••••••••';

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 파트G: 실패 시 조용히 넘어가지 않고, 최대 2회까지만 재시도한 뒤 마지막 실패 사유를 그대로 던진다(무한 재시도 금지).
async function withRetry(fn, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) log(`[AI 배경] 시도 ${attempt + 1} 실패, 재시도합니다: ${error.message}`);
    }
  }
  throw lastError;
}

// 파트C: 호출부의 provider 분기 로직이 바뀌어도 문구 금지 지시 없이 생성되는 일이 없도록,
// 각 provider 함수가 자기 자신의 입력을 스스로 방어한다(호출부 신뢰 금지).
function assertNegativePromptPresent(negativePrompt) {
  if (!negativePrompt || !String(negativePrompt).includes('no text')) {
    throw new Error('[안전장치] Qwen negative_prompt가 비어 있습니다. 생성을 중단합니다.');
  }
}
function assertPromptForbidsText(prompt) {
  if (!String(prompt || '').includes('no text')) {
    throw new Error('[안전장치] Gemini 프롬프트에 문구 금지 지시가 없습니다. 생성을 중단합니다.');
  }
}

async function generateQwenBackground(settings, prompt, negativePrompt, size) {
  assertNegativePromptPresent(negativePrompt);
  if (!settings.qwenApiKey) throw new Error('Qwen API 키가 설정되어 있지 않습니다. 설정 화면에서 키를 입력하거나, 프롬프트 복사 폴백을 사용하세요.');
  if (!settings.qwenWorkspaceId) throw new Error('Qwen 워크스페이스 ID가 설정되어 있지 않습니다.');

  const host = REGION_HOST[settings.qwenRegion] || REGION_HOST.singapore;
  const url = `https://${settings.qwenWorkspaceId}.${host}.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`;
  const body = {
    model: settings.qwenModel,
    input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
    parameters: { negative_prompt: negativePrompt || '', size: size || '1328*1328', n: 1, prompt_extend: true, watermark: false }
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.qwenApiKey}` },
    body: JSON.stringify(body)
  }, 60000);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Qwen 이미지 생성 실패 (HTTP ${response.status}): ${text.slice(0, 300) || '응답 없음'}`);
  }
  const json = await response.json();
  const imageUrl = json && json.output && json.output.choices && json.output.choices[0] && json.output.choices[0].message && json.output.choices[0].message.content && json.output.choices[0].message.content[0] && json.output.choices[0].message.content[0].image;
  if (!imageUrl) throw new Error('Qwen 응답에서 이미지 URL을 찾지 못했습니다.');

  const imageResponse = await fetchWithTimeout(imageUrl, {}, 60000);
  if (!imageResponse.ok) throw new Error('생성된 이미지를 내려받지 못했습니다.');
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get('content-type') || 'image/png';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

// Gemini(generateContent + responseModalities:IMAGE, imageConfig.aspectRatio) — 2026-07 공식 문서 기준.
async function generateGeminiBackground(settings, prompt, aspect) {
  assertPromptForbidsText(prompt);
  if (!settings.geminiApiKey) throw new Error('Gemini API 키가 설정되어 있지 않습니다. 설정 화면에서 키를 입력하거나, 프롬프트 복사 폴백을 사용하세요.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: aspect === '1x1' ? '1:1' : '16:9' }
    }
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiApiKey },
    body: JSON.stringify(body)
  }, 60000);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const modelHint = response.status === 404 || response.status === 400
      ? ` 모델 ID(${settings.geminiModel})가 유효하지 않을 수 있습니다. 설정 화면에서 확인하세요.`
      : '';
    throw new Error(`Gemini 이미지 생성 실패 (HTTP ${response.status}): ${text.slice(0, 300) || '응답 없음'}${modelHint}`);
  }
  const json = await response.json();
  const parts = json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
  const imagePart = Array.isArray(parts) ? parts.find(part => part.inlineData && part.inlineData.data) : null;
  if (!imagePart) throw new Error('Gemini 응답에서 이미지 데이터를 찾지 못했습니다.');
  const mime = imagePart.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${imagePart.inlineData.data}`;
}

// 파트F: Gemini는 배경 생성기가 아니라 검수기로만 쓴다(생성=Qwen 기본, 검수=Gemini).
// JSON 파싱 실패는 재시도하지 않고 즉시 "검수 불가"로 반환한다. 네트워크 실패만 withRetry(2)를 탄다.
function extractJsonBlock(text) {
  const match = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!match) throw new Error('응답에서 JSON을 찾지 못했습니다.');
  return match[0];
}

async function inspectGeminiBackground({ dataUrl, textZone }) {
  const settings = readAISettings();
  if (!settings.geminiApiKey) return { skipped: true, reason: '검수 건너뜀(키 없음)' };

  const { mime, buffer } = dataUrlBuffer(dataUrl);
  const prompt = [
    '이미지를 검사해 JSON만 출력한다. 다른 텍스트는 출력하지 않는다.',
    `지정된 텍스트존: ${textZone || 'center'}`,
    '{"hasText": boolean, "hasVisibleFace": boolean, "textZoneClear": boolean, "objectCount": number, "notes": string}'
  ].join('\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: buffer.toString('base64') } }] }],
    generationConfig: { responseModalities: ['TEXT'] }
  };

  let json;
  try {
    json = await withRetry(async () => {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiApiKey },
        body: JSON.stringify(body)
      }, 60000);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Gemini 검수 실패 (HTTP ${response.status}): ${text.slice(0, 300) || '응답 없음'}`);
      }
      return response.json();
    }, 2);
  } catch (error) {
    return { failed: true, reason: error.message };
  }

  const parts = json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
  const textPart = Array.isArray(parts) ? parts.find(part => typeof part.text === 'string') : null;
  if (!textPart) return { failed: true, reason: 'Gemini 응답에서 텍스트를 찾지 못했습니다.' };

  try {
    const parsed = JSON.parse(extractJsonBlock(textPart.text));
    return {
      hasText: Boolean(parsed.hasText),
      hasVisibleFace: Boolean(parsed.hasVisibleFace),
      textZoneClear: Boolean(parsed.textZoneClear),
      objectCount: Number(parsed.objectCount) || 0,
      notes: String(parsed.notes || '')
    };
  } catch {
    // 파트G: JSON 파싱 실패는 재시도하지 않는다. 단발성으로 "검수 불가"만 반환한다.
    return { failed: true, reason: '검수 응답 JSON 파싱에 실패했습니다.' };
  }
}

async function generateAIBackground({ prompt, negativePrompt, size, aspect }) {
  const settings = readAISettings();
  return withRetry(() => (
    settings.provider === 'gemini'
      ? generateGeminiBackground(settings, prompt, aspect || '16x9')
      : generateQwenBackground(settings, prompt, negativePrompt, size)
  ), 2);
}
// 파트D: 곡세트 체크리스트 xlsx 파싱은 electron/checklist.cjs(순수 모듈, vitest 대상)에 있다.
// 여기서는 경고 로그를 렌더러로 보내는 콜백만 연결한다.
function loadChecklistXlsx(filePath) {
  return parseChecklistXlsx(filePath, { onWarn: log });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#f4efe6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  sweepTmpRoot();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('dialog:pick-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '플레이리스트 음원 선택', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] }]
  });
  if (result.canceled) return [];
  const files = result.filePaths.map(filePath => ({ path: filePath, name: path.basename(filePath) }));
  return audioFiles.sortAudioFilesNatural(files);
});
ipcMain.handle('dialog:pick-audio-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: '음원 폴더 선택', properties: ['openDirectory'] });
  if (result.canceled) return { files: [], truncated: false };
  const dir = result.filePaths[0];
  // 재귀 금지 — 하위 폴더는 훑지 않는다. withFileTypes로 폴더 자체를 걸러낸다.
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && audioFiles.isAudioFileName(entry.name))
    .map(entry => ({ path: path.join(dir, entry.name), name: entry.name }));
  const sorted = audioFiles.sortAudioFilesNatural(entries);
  const truncated = sorted.length > audioFiles.MAX_TRACKS_PER_SET;
  return { files: sorted.slice(0, audioFiles.MAX_TRACKS_PER_SET), truncated };
});
ipcMain.handle('dialog:pick-images', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '썸네일 배경 이미지 선택', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  return result.canceled ? [] : result.filePaths.map(filePath => ({ path: filePath, name: path.basename(filePath) }));
});
ipcMain.handle('dialog:pick-output-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: '저장 폴더 선택', properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('file:read-image', async (_event, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
});
ipcMain.handle('audio:probe', (_event, filePath) => probe(filePath));
ipcMain.handle('thumbnail:save', async (_event, input) => {
  const { buffer } = dataUrlBuffer(input.dataUrl);
  const outputDir = input.outputDir || app.getPath('downloads');
  const ext = input.format === 'png' ? '.png' : '.jpg';
  // fileName에 "폴더/파일" 형태의 상대경로가 들어와도(파트E 세트 폴더 자동 생성) 각 구간을 안전화한다.
  const segments = String(input.fileName || 'thumbnail').split(/[\\/]+/).filter(Boolean).map(part => safeName(part, 'file'));
  const relative = segments.length ? segments : ['thumbnail'];
  const dest = path.join(outputDir, ...relative.slice(0, -1), `${relative[relative.length - 1]}${ext}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return dest;
});
ipcMain.handle('file:write-text', (_event, input) => {
  const outputDir = input.outputDir || app.getPath('downloads');
  const fileName = safeName(input.fileName, 'metadata');
  const dest = path.join(outputDir, `${fileName}.txt`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, String(input.content || ''), 'utf-8');
  return dest;
});
ipcMain.handle('shell:open-path', (_event, targetPath) => shell.openPath(targetPath));
ipcMain.handle('brand:load-templates', () => readBrandTemplates());
ipcMain.handle('brand:save-template', (_event, template) => {
  const list = readBrandTemplates().filter(item => item.channelPreset !== template.channelPreset);
  list.push({ ...template, updatedAt: new Date().toISOString() });
  writeBrandTemplates(list);
  return list;
});
ipcMain.handle('brand:delete-template', (_event, channelPreset) => {
  const list = readBrandTemplates().filter(item => item.channelPreset !== channelPreset);
  writeBrandTemplates(list);
  return list;
});
ipcMain.handle('settings:load-ai', () => {
  const settings = readAISettings();
  return {
    ...settings,
    qwenApiKey: settings.qwenApiKey ? MASK : '',
    geminiApiKey: settings.geminiApiKey ? MASK : '',
    hasQwenKey: Boolean(settings.qwenApiKey),
    hasGeminiKey: Boolean(settings.geminiApiKey)
  };
});
ipcMain.handle('settings:save-ai', (_event, settings) => {
  const current = readAISettings();
  const qwenApiKey = settings.qwenApiKey && settings.qwenApiKey !== MASK ? settings.qwenApiKey : current.qwenApiKey;
  const geminiApiKey = settings.geminiApiKey && settings.geminiApiKey !== MASK ? settings.geminiApiKey : current.geminiApiKey;
  writeAISettings({ ...settings, qwenApiKey, geminiApiKey });
  return { ok: true };
});
ipcMain.handle('ai:generate-background', (_event, input) => generateAIBackground(input));
ipcMain.handle('ai:inspect-background', (_event, input) => inspectGeminiBackground(input));
ipcMain.handle('dialog:pick-xlsx', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '곡세트 체크리스트(xlsx) 선택', properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('checklist:load-xlsx', (_event, filePath) => loadChecklistXlsx(filePath));
ipcMain.handle('clipboard:write-text', (_event, text) => { clipboard.writeText(String(text || '')); return true; });
ipcMain.handle('playlist:cancel', (_event, jobId) => {
  const child = activeJobs.get(jobId);
  if (child) child.kill('SIGKILL');
  return Boolean(child);
});

ipcMain.handle('playlist:render', async (_event, input) => {
  const jobId = input.jobId || crypto.randomUUID();
  const outputDir = input.outputDir || app.getPath('downloads');
  fs.mkdirSync(outputDir, { recursive: true });
  const work = tmpDir();
  const thumbExt = path.extname(input.thumbnailPath) || '.jpg';
  const stagedThumb = path.join(work, `thumb${thumbExt}`);
  fs.copyFileSync(input.thumbnailPath, stagedThumb);
  const tracks = [];
  for (let i = 0; i < input.tracks.length; i++) {
    const source = input.tracks[i].path;
    const ext = path.extname(source) || '.mp3';
    const staged = path.join(work, `audio_${String(i).padStart(3, '0')}${ext}`);
    fs.copyFileSync(source, staged);
    const duration = Number(input.tracks[i].duration) || await probe(staged);
    tracks.push({ ...input.tracks[i], path: staged, duration });
    progress(jobId, 'probe', ((i + 1) / input.tracks.length) * 8, `길이 확인 ${i + 1}/${input.tracks.length}`);
  }
  const totalDuration = tracks.reduce((sum, item) => sum + item.duration, 0);
  const outputPath = path.join(outputDir, `${safeName(input.outputName, 'playlist')}.mp4`);
  const args = ['-y', '-loop', '1', '-framerate', input.motion === 'gentle' ? '12' : '2', '-i', stagedThumb];
  tracks.forEach(track => args.push('-i', track.path));
  const audioLabels = tracks.map((_track, index) => `[a${index}]`).join('');
  const audioPrep = tracks.map((_track, index) => `[${index + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${index}]`).join(';');
  const visual = input.motion === 'gentle'
    ? `[0:v]scale=1408:792:force_original_aspect_ratio=increase,crop=1408:792,zoompan=z='min(zoom+0.00012,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=12,format=yuv420p[vout]`
    : `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=2,format=yuv420p[vout]`;
  const filter = `${audioPrep};${audioLabels}concat=n=${tracks.length}:v=0:a=1[aout];${visual}`;
  args.push('-filter_complex', filter, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(totalDuration), '-progress', 'pipe:1', '-nostats', outputPath);
  log(`[render] ${tracks.length}곡 / ${formatChapter(totalDuration)} / ${outputPath}`);
  progress(jobId, 'encode', 8, '영상 인코딩 시작');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args, { windowsHide: true });
      activeJobs.set(jobId, child);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
        const lines = stdout.split(/\r?\n/);
        stdout = lines.pop() || '';
        for (const line of lines) {
          const match = /^out_time_ms=(\d+)/.exec(line);
          if (match && totalDuration > 0) {
            const seconds = Number(match[1]) / 1000000;
            progress(jobId, 'encode', 8 + (seconds / totalDuration) * 92, `인코딩 ${formatChapter(seconds)} / ${formatChapter(totalDuration)}`);
          }
        }
      });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1600) || `FFmpeg 종료 코드 ${code}`)));
    });
    progress(jobId, 'done', 100, '완료');
    shell.showItemInFolder(outputPath);
    return { outputPath, duration: totalDuration };
  } finally {
    activeJobs.delete(jobId);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
});

// input.tracks의 duration/title로 미디어 파일명을 먼저 확정한 뒤(파일 저장 관심사라
// chapters.cjs 몫이 아니다), 실제 챕터/타임라인/SRT 텍스트는 전부 chapters.cjs 하나로 만든다
// — ZIP 안 내용물과 chapters:build IPC(미리보기)가 절대 두 벌로 어긋나지 않는다.
ipcMain.handle('capcut:export-kit', async (_event, input) => {
  const outputDir = input.outputDir || app.getPath('downloads');
  fs.mkdirSync(outputDir, { recursive: true });
  const dest = path.join(outputDir, `${safeName(input.projectName, 'SUM_CapCut_Kit')}_CapCut_Kit.zip`);
  const output = fs.createWriteStream(dest);
  const archive = archiver('zip', { zlib: { level: 6 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);

  const tracksWithFile = [];
  for (let i = 0; i < input.tracks.length; i++) {
    const track = input.tracks[i];
    const duration = Number(track.duration) || await probe(track.path);
    const mediaName = `${String(i + 1).padStart(2, '0')}_${safeName(track.title || path.basename(track.path, path.extname(track.path)), `track_${i + 1}`, 70)}${path.extname(track.path)}`;
    archive.file(track.path, { name: `media/${mediaName}` });
    tracksWithFile.push({ ...track, duration, file: mediaName });
  }

  const built = chapters.buildChapters(tracksWithFile);
  const timelineCsv = chapters.buildTimelineCsv(tracksWithFile);
  const srtText = chapters.buildSrt(tracksWithFile);
  const totalDuration = built.cues.length ? built.cues[built.cues.length - 1].end : 0;
  const manifestTracks = built.cues.map(cue => ({ index: cue.index, title: cue.title, file: cue.file, start: cue.start, end: cue.end, duration: cue.duration }));

  if (input.thumbnailPath && fs.existsSync(input.thumbnailPath)) archive.file(input.thumbnailPath, { name: `thumbnail/${path.basename(input.thumbnailPath)}` });
  archive.append(built.text, { name: 'youtube_chapters.txt' });
  archive.append(timelineCsv, { name: 'timeline.csv' });
  archive.append(srtText, { name: 'track_titles.srt' });
  archive.append(JSON.stringify({ projectName: input.projectName, createdAt: new Date().toISOString(), totalDuration, tracks: manifestTracks, chapterIssues: built.issues }, null, 2), { name: 'project_manifest.json' });
  archive.append('1. CapCut에서 새 프로젝트를 만듭니다.\n2. media 폴더의 음원을 순서대로 불러옵니다.\n3. thumbnail 폴더의 이미지를 배경으로 배치합니다.\n4. track_titles.srt를 자막으로 가져옵니다.\n5. youtube_chapters.txt를 유튜브 설명란에 붙여넣습니다.\n\n이 ZIP은 CapCut 비공개 내부 프로젝트 파일을 수정하지 않는 안전한 가져오기용 패키지입니다.\n', { name: 'CAPCUT_IMPORT_GUIDE_KO.txt' });
  archive.finalize();
  await done;
  shell.showItemInFolder(dest);
  // error 레벨 문제가 있어도 ZIP은 만든다 — 내보내기를 막지 않고, 문제 목록을 돌려줘 UI가 표시하게 한다.
  return { path: dest, issues: built.issues };
});

ipcMain.handle('chapters:build', (_event, tracks) => chapters.buildChapters(Array.isArray(tracks) ? tracks : []));
