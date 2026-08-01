import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ClipboardCopy, FileArchive, FolderOpen, FolderTree, Music2, Play, Square, Trash2 } from 'lucide-react';
import type { AudioTrack, ChapterBuildResult, JobProgress, MotionMode, PickedFile } from '../types';
import { runWithConcurrencyLimit } from '../lib/concurrency';

interface VideoStudioProps {
  projectName: string;
  outputDir: string;
  onOutputDirChange: (value: string) => void;
  thumbnailPath: string;
  onThumbnailPathChange: (value: string) => void;
  // 체크리스트 F열(곡수목표). 아직 세트를 적용하지 않았으면 빈 문자열 — 이때는 목표를 숨긴다.
  trackTarget?: string;
}

// ffprobe처럼 무거운 프로세스를 트랙 수만큼 한꺼번에 띄우지 않는다(파트G 반복 상한과 같은 취지).
const PROBE_CONCURRENCY = 4;

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

async function probeTracksConcurrently(files: PickedFile[]): Promise<AudioTrack[]> {
  return runWithConcurrencyLimit(files, PROBE_CONCURRENCY, async (file, index) => {
    const base = { ...file, id: `${file.path}-${Date.now()}-${index}`, title: file.name.replace(/\.[^.]+$/, '') };
    try {
      // 철칙3: 실패를 조용히 0으로 넘기지 않는다 — .catch(() => 0)를 쓰지 않고 사유를 남긴다.
      const duration = await window.sumAPI.probeAudio(file.path);
      return { ...base, duration };
    } catch (error) {
      return { ...base, duration: 0, durationError: error instanceof Error ? error.message : String(error) };
    }
  });
}

export default function VideoStudio({ projectName, outputDir, onOutputDirChange, thumbnailPath, onThumbnailPathChange, trackTarget }: VideoStudioProps) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [motion, setMotion] = useState<MotionMode>('still');
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [chapterResult, setChapterResult] = useState<ChapterBuildResult | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [folderMessage, setFolderMessage] = useState('');
  const totalDuration = useMemo(() => tracks.reduce((sum, track) => sum + track.duration, 0), [tracks]);
  const hasDurationError = tracks.some(track => track.durationError);
  const targetCount = Number(trackTarget);
  const hasTarget = Boolean(trackTarget) && Number.isFinite(targetCount) && targetCount > 0;

  useEffect(() => {
    const offProgress = window.sumAPI.onProgress(setProgress);
    const offLog = window.sumAPI.onLog(line => setLogs(current => [...current.slice(-79), line]));
    return () => { offProgress(); offLog(); };
  }, []);

  // 챕터/타임라인은 electron/chapters.cjs(메인 프로세스) 하나에서만 계산한다 — 렌더러에서
  // 같은 로직을 다시 짜면 두 벌이 되어 어긋난다(Phase 2-1 4-1). 트랙 제목/길이가 바뀔 때마다
  // 다시 물어봐서 미리보기·타임라인·검증(issues)을 항상 같은 소스로 표시한다.
  useEffect(() => {
    let cancelled = false;
    void window.sumAPI.buildChapters(tracks.map(({ title, duration }) => ({ title, duration }))).then(result => {
      if (!cancelled) setChapterResult(result);
    });
    return () => { cancelled = true; };
  }, [tracks]);

  async function addAudio() {
    setLoadingAudio(true);
    setFolderMessage('');
    try {
      const picked = await window.sumAPI.pickAudio();
      if (!picked.length) return;
      const loaded = await probeTracksConcurrently(picked);
      setTracks(current => [...current, ...loaded]);
    } finally {
      setLoadingAudio(false);
    }
  }

  async function addAudioFolder() {
    setLoadingAudio(true);
    setFolderMessage('');
    try {
      const { files, truncated } = await window.sumAPI.pickAudioFolder();
      if (!files.length) return;
      const loaded = await probeTracksConcurrently(files);
      setTracks(current => [...current, ...loaded]);
      // MAX_TRACKS_PER_SET(electron/audioFiles.cjs)와 같은 값 — 상한 초과 시 앞에서부터만 불러왔다는 사실을 알린다.
      if (truncated) setFolderMessage('폴더 안 음원이 200개보다 많아 자연 정렬 기준 앞에서 200개만 불러왔습니다.');
    } finally {
      setLoadingAudio(false);
    }
  }

  async function chooseOutputDir() {
    const picked = await window.sumAPI.pickOutputDir();
    if (picked) onOutputDirChange(picked);
  }

  async function chooseThumbnail() {
    const picked = await window.sumAPI.pickImages();
    if (picked[0]) onThumbnailPathChange(picked[0].path);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    setTracks(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function renderVideo() {
    if (!tracks.length) return alert('음원을 먼저 불러오세요.');
    if (!thumbnailPath) return alert('완성 썸네일 JPG를 선택하세요.');
    if (!outputDir) return alert('저장 폴더를 선택하세요.');
    const jobId = crypto.randomUUID();
    setBusy(true);
    setLogs([]);
    try {
      await window.sumAPI.renderPlaylist({
        jobId,
        tracks: tracks.map(({ path, title, duration }) => ({ path, title, duration })),
        thumbnailPath,
        outputDir,
        outputName: projectName,
        motion
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  async function exportKit() {
    if (!tracks.length || !outputDir) return alert('음원과 저장 폴더를 먼저 준비하세요.');
    setBusy(true);
    try {
      const result = await window.sumAPI.exportCapcutKit({
        projectName,
        tracks: tracks.map(({ path, title, duration }) => ({ path, title, duration })),
        thumbnailPath: thumbnailPath || undefined,
        outputDir
      });
      const errorCount = result.issues.filter(issue => issue.level === 'error').length;
      if (errorCount) {
        setLogs(current => [...current, `[챕터] ZIP은 만들어졌지만 유튜브 챕터 조건을 ${errorCount}건 위반합니다 — 아래 미리보기를 확인하세요.`]);
      }
    } finally { setBusy(false); }
  }

  async function copyChapters() {
    if (!chapterResult?.text) return;
    await window.sumAPI.copyText(chapterResult.text);
    setCopyStatus('복사했습니다.');
    setTimeout(() => setCopyStatus(''), 2000);
  }

  const cueByIndex = new Map((chapterResult?.cues ?? []).map(cue => [cue.index, cue]));
  const errorIssues = chapterResult?.issues.filter(issue => issue.level === 'error') ?? [];
  const warningIssues = chapterResult?.issues.filter(issue => issue.level === 'warning') ?? [];

  return (
    <section className="workspace-grid video-grid">
      <div className="panel controls-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">AUDIO</span><h2>플레이리스트 순서</h2></div>
          <div className="action-row">
            <button className="secondary" disabled={loadingAudio} onClick={() => void addAudio()}><Music2 size={17} /> {loadingAudio ? '불러오는 중...' : '음원 추가'}</button>
            <button className="secondary" disabled={loadingAudio} onClick={() => void addAudioFolder()}><FolderTree size={17} /> 폴더 지정</button>
          </div>
        </div>
        <div className="track-summary">
          <b>{tracks.length}곡</b><span>총 {formatDuration(totalDuration)}</span>
          {hasTarget && (
            <span className={tracks.length >= targetCount ? 'track-target ok' : 'track-target'}>
              {targetCount}곡 중 {tracks.length}곡{tracks.length >= targetCount ? ' · 완료' : ` · ${targetCount - tracks.length}곡 부족`}
            </span>
          )}
        </div>
        {folderMessage && <p className="supporting">{folderMessage}</p>}
        <div className="track-list">
          {tracks.map((track, index) => {
            const cue = cueByIndex.get(index + 1);
            const tooShort = track.duration > 0 && track.duration < 10;
            return (
              <article className={track.durationError ? 'track-row track-error' : 'track-row'} key={track.id}>
                <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="track-main">
                  <input value={track.title} onChange={event => setTracks(current => current.map(item => item.id === track.id ? { ...item, title: event.target.value } : item))} />
                  {track.durationError ? (
                    <small className="track-error-text"><AlertTriangle size={12} /> 길이 확인 실패 — {track.durationError}</small>
                  ) : (
                    <small>
                      {track.name} · {formatDuration(track.duration)}
                      {cue && <span className="track-timeline"> · {formatDuration(cue.start)} – {formatDuration(cue.end)}</span>}
                      {tooShort && <span className="track-warning-inline"> · 10초 미만</span>}
                    </small>
                  )}
                </div>
                <div className="track-actions"><button title="위로" onClick={() => move(index, -1)}><ArrowUp size={15} /></button><button title="아래로" onClick={() => move(index, 1)}><ArrowDown size={15} /></button><button title="삭제" onClick={() => setTracks(current => current.filter(item => item.id !== track.id))}><Trash2 size={15} /></button></div>
              </article>
            );
          })}
          {!tracks.length && <p className="empty-note">Suno에서 받은 MP3/WAV를 한꺼번에 선택하거나, 폴더를 지정하면 파일명 자연 정렬 순서로 들어옵니다.</p>}
        </div>

        <div className="panel-heading section-gap"><div><span className="eyebrow">YOUTUBE</span><h2>챕터 미리보기</h2></div>
          <button className="secondary" disabled={!chapterResult?.text} onClick={() => void copyChapters()}><ClipboardCopy size={16} /> 복사</button>
        </div>
        {copyStatus && <p className="supporting">{copyStatus}</p>}
        {errorIssues.map((issue, i) => (
          <p key={`err-${i}`} className="chapter-issue error"><AlertTriangle size={14} /> {issue.message}</p>
        ))}
        {warningIssues.map((issue, i) => (
          <p key={`warn-${i}`} className="chapter-issue warning"><AlertTriangle size={14} /> {issue.message}</p>
        ))}
        {chapterResult && !errorIssues.length && !warningIssues.length && tracks.length > 0 && (
          <p className="chapter-issue ok"><CheckCircle2 size={14} /> 유튜브 챕터 조건을 모두 만족합니다.</p>
        )}
        <pre className="log-panel chapter-preview">{chapterResult?.text || '음원을 추가하면 챕터 미리보기가 여기 표시됩니다.'}</pre>
      </div>

      <div className="panel preview-panel">
        <div className="panel-heading"><div><span className="eyebrow">VIDEO + CAPCUT</span><h2>자동 렌더링</h2></div></div>
        <div className="file-card"><div><b>완성 썸네일</b><span>{thumbnailPath || '선택되지 않음'}</span></div><button className="secondary" onClick={chooseThumbnail}><FolderOpen size={16} /> 선택</button></div>
        <div className="file-card"><div><b>저장 폴더</b><span>{outputDir || '선택되지 않음'}</span></div><button className="secondary" onClick={chooseOutputDir}><FolderOpen size={16} /> 선택</button></div>
        <div className="field-grid"><label>화면 움직임<select value={motion} onChange={event => setMotion(event.target.value as MotionMode)}><option value="still">정지 이미지 · 빠른 렌더</option><option value="gentle">아주 느린 줌 · 고급형</option></select></label><label>영상 이름<input value={projectName} readOnly /></label></div>

        {hasDurationError && (
          <p className="chapter-issue error"><AlertTriangle size={14} /> 길이 측정에 실패한 트랙이 있습니다 — 타임라인/챕터 시각이 어긋날 수 있습니다. 왼쪽 목록에서 확인하세요.</p>
        )}
        {progress && <div className="progress-card"><div><b>{progress.label}</b><span>{progress.percent}%</span></div><div className="progress-track"><span style={{ width: `${progress.percent}%` }} /></div></div>}
        <div className="action-row">
          <button className="primary" disabled={busy || !tracks.length} onClick={renderVideo}>{busy ? <Square size={17} /> : <Play size={17} />} 긴 MP4 자동 만들기</button>
          <button className="secondary" disabled={busy || !tracks.length} onClick={exportKit}><FileArchive size={17} /> CapCut Kit ZIP</button>
        </div>
        <p className="supporting">CapCut Kit에는 음원, 썸네일, 트랙 제목 SRT, 타임라인 CSV, YouTube 챕터가 들어갑니다.</p>
        <pre className="log-panel">{logs.length ? logs.join('\n') : '작업 로그가 여기에 표시됩니다.'}</pre>
      </div>
    </section>
  );
}
