const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const archiver = require('archiver');
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
function send(channel, payload) {
  try { mainWindow && mainWindow.webContents.send(channel, payload); } catch {}
}
function log(line) { send('job:log', String(line)); }
function progress(jobId, stage, percent, label) {
  send('job:progress', { jobId, stage, percent: Math.max(0, Math.min(100, Math.round(percent))), label });
}
function formatChapter(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function formatSrt(seconds) {
  const ms = Math.max(0, Math.floor(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(rest).padStart(3, '0')}`;
}
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('dialog:pick-audio', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '플레이리스트 음원 선택', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] }]
  });
  return result.canceled ? [] : result.filePaths.map(filePath => ({ path: filePath, name: path.basename(filePath) }));
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
  fs.mkdirSync(outputDir, { recursive: true });
  const ext = input.format === 'png' ? '.png' : '.jpg';
  const dest = path.join(outputDir, `${safeName(input.fileName, 'thumbnail')}${ext}`);
  fs.writeFileSync(dest, buffer);
  return dest;
});
ipcMain.handle('shell:open-path', (_event, targetPath) => shell.openPath(targetPath));
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
  let cursor = 0;
  const chapters = [];
  const timeline = ['index,start,end,duration,title,file'];
  const srt = [];
  const manifestTracks = [];
  for (let i = 0; i < input.tracks.length; i++) {
    const track = input.tracks[i];
    const duration = Number(track.duration) || await probe(track.path);
    const start = cursor;
    const end = cursor + duration;
    const mediaName = `${String(i + 1).padStart(2, '0')}_${safeName(track.title || path.basename(track.path, path.extname(track.path)), `track_${i + 1}`, 70)}${path.extname(track.path)}`;
    archive.file(track.path, { name: `media/${mediaName}` });
    chapters.push(`${formatChapter(start)} ${track.title || `Track ${i + 1}`}`);
    timeline.push([i + 1, start.toFixed(3), end.toFixed(3), duration.toFixed(3), JSON.stringify(track.title || ''), JSON.stringify(mediaName)].join(','));
    srt.push(String(i + 1), `${formatSrt(start)} --> ${formatSrt(Math.min(end, start + 8))}`, track.title || `Track ${i + 1}`, '');
    manifestTracks.push({ index: i + 1, title: track.title, file: mediaName, start, end, duration });
    cursor = end;
  }
  if (input.thumbnailPath && fs.existsSync(input.thumbnailPath)) archive.file(input.thumbnailPath, { name: `thumbnail/${path.basename(input.thumbnailPath)}` });
  archive.append(chapters.join('\n') + '\n', { name: 'youtube_chapters.txt' });
  archive.append(timeline.join('\n') + '\n', { name: 'timeline.csv' });
  archive.append(srt.join('\n'), { name: 'track_titles.srt' });
  archive.append(JSON.stringify({ projectName: input.projectName, createdAt: new Date().toISOString(), totalDuration: cursor, tracks: manifestTracks }, null, 2), { name: 'project_manifest.json' });
  archive.append('1. CapCut에서 새 프로젝트를 만듭니다.\n2. media 폴더의 음원을 순서대로 불러옵니다.\n3. thumbnail 폴더의 이미지를 배경으로 배치합니다.\n4. track_titles.srt를 자막으로 가져옵니다.\n5. youtube_chapters.txt를 유튜브 설명란에 붙여넣습니다.\n\n이 ZIP은 CapCut 비공개 내부 프로젝트 파일을 수정하지 않는 안전한 가져오기용 패키지입니다.\n', { name: 'CAPCUT_IMPORT_GUIDE_KO.txt' });
  archive.finalize();
  await done;
  shell.showItemInFolder(dest);
  return dest;
});
