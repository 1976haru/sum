import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FileArchive, FolderOpen, Music2, Play, Square, Trash2 } from 'lucide-react';
import type { AudioTrack, JobProgress, MotionMode } from '../types';

interface VideoStudioProps {
  projectName: string;
  outputDir: string;
  onOutputDirChange: (value: string) => void;
  thumbnailPath: string;
  onThumbnailPathChange: (value: string) => void;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '--:--';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoStudio({ projectName, outputDir, onOutputDirChange, thumbnailPath, onThumbnailPathChange }: VideoStudioProps) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [motion, setMotion] = useState<MotionMode>('still');
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const totalDuration = useMemo(() => tracks.reduce((sum, track) => sum + track.duration, 0), [tracks]);

  useEffect(() => {
    const offProgress = window.sumAPI.onProgress(setProgress);
    const offLog = window.sumAPI.onLog(line => setLogs(current => [...current.slice(-79), line]));
    return () => { offProgress(); offLog(); };
  }, []);

  async function addAudio() {
    const picked = await window.sumAPI.pickAudio();
    const loaded: AudioTrack[] = [];
    for (const file of picked) {
      const duration = await window.sumAPI.probeAudio(file.path).catch(() => 0);
      loaded.push({ ...file, id: `${file.path}-${Date.now()}-${loaded.length}`, title: file.name.replace(/\.[^.]+$/, ''), duration });
    }
    setTracks(current => [...current, ...loaded]);
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
      await window.sumAPI.exportCapcutKit({
        projectName,
        tracks: tracks.map(({ path, title, duration }) => ({ path, title, duration })),
        thumbnailPath: thumbnailPath || undefined,
        outputDir
      });
    } finally { setBusy(false); }
  }

  return (
    <section className="workspace-grid video-grid">
      <div className="panel controls-panel">
        <div className="panel-heading"><div><span className="eyebrow">AUDIO</span><h2>플레이리스트 순서</h2></div><button className="secondary" onClick={addAudio}><Music2 size={17} /> 음원 추가</button></div>
        <div className="track-summary"><b>{tracks.length}곡</b><span>총 {formatDuration(totalDuration)}</span></div>
        <div className="track-list">
          {tracks.map((track, index) => (
            <article className="track-row" key={track.id}>
              <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="track-main"><input value={track.title} onChange={event => setTracks(current => current.map(item => item.id === track.id ? { ...item, title: event.target.value } : item))} /><small>{track.name} · {formatDuration(track.duration)}</small></div>
              <div className="track-actions"><button title="위로" onClick={() => move(index, -1)}><ArrowUp size={15} /></button><button title="아래로" onClick={() => move(index, 1)}><ArrowDown size={15} /></button><button title="삭제" onClick={() => setTracks(current => current.filter(item => item.id !== track.id))}><Trash2 size={15} /></button></div>
            </article>
          ))}
          {!tracks.length && <p className="empty-note">Suno에서 받은 MP3/WAV를 한꺼번에 선택하면 파일 순서대로 들어옵니다.</p>}
        </div>
      </div>

      <div className="panel preview-panel">
        <div className="panel-heading"><div><span className="eyebrow">VIDEO + CAPCUT</span><h2>자동 렌더링</h2></div></div>
        <div className="file-card"><div><b>완성 썸네일</b><span>{thumbnailPath || '선택되지 않음'}</span></div><button className="secondary" onClick={chooseThumbnail}><FolderOpen size={16} /> 선택</button></div>
        <div className="file-card"><div><b>저장 폴더</b><span>{outputDir || '선택되지 않음'}</span></div><button className="secondary" onClick={chooseOutputDir}><FolderOpen size={16} /> 선택</button></div>
        <div className="field-grid"><label>화면 움직임<select value={motion} onChange={event => setMotion(event.target.value as MotionMode)}><option value="still">정지 이미지 · 빠른 렌더</option><option value="gentle">아주 느린 줌 · 고급형</option></select></label><label>영상 이름<input value={projectName} readOnly /></label></div>

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
