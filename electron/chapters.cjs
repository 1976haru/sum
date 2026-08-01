// 유튜브 챕터/타임라인/SRT 빌드 — 순수 로직만 담당한다. Electron API를 일절 import하지 않는다
// (checklist.cjs와 같은 패턴). CapCut Kit ZIP(main.cjs)과 렌더러의 미리보기(chapters:build IPC)가
// 반드시 같은 결과를 내야 하므로, 이 모듈이 유일한 소스다 — 두 벌로 만들지 않는다.

// 유튜브 공식 도움말 기준 챕터 표시 조건. 어기면 에러 없이 조용히 실패(설명란에 그냥 텍스트로만
// 남고 챕터 UI가 안 뜬다)하므로, 여기서 미리 검증해 issues로 알린다.
const MIN_CHAPTER_COUNT = 3;
const MIN_CHAPTER_SECONDS = 10;
const MAX_CHAPTER_TITLE_CHARS = 40; // 모바일에서 안 잘리는 권장 길이(유튜브가 강제하는 값은 아니다).

function formatChapter(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatSrtTime(seconds) {
  const ms = Math.max(0, Math.floor(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(rest).padStart(3, '0')}`;
}

// 반올림 표시용(초 단위 issue 메시지). 정수면 정수로, 아니면 소수 1자리까지만 보여준다.
function roundSeconds(value) {
  return Math.round(value * 10) / 10;
}

// 챕터/타임라인/SRT가 전부 이 결과 하나에서 파생된다 — start/end 계산이 두 곳에서 어긋날 수 없다.
function computeCues(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  let cursor = 0;
  const cues = [];
  for (let i = 0; i < list.length; i++) {
    const track = list[i] || {};
    const duration = Number(track.duration) || 0;
    const title = String(track.title || `Track ${i + 1}`).trim() || `Track ${i + 1}`;
    const start = cursor;
    const end = cursor + duration;
    cues.push({ index: i + 1, title, duration, start, end, file: track.file || '' });
    cursor = end;
  }
  return cues;
}

// (tracks) => { lines, text, issues, cues }
// - lines: "0:00 제목" 형식의 챕터 줄 배열
// - text: youtube_chapters.txt에 그대로 쓰이는 전문(줄바꿈 + 마지막 개행 하나)
// - issues: 유튜브 챕터 표시 조건 위반/권장사항. error가 있어도 text/lines는 그대로 반환한다
//   (내보내기를 막지 않는다 — 판단은 사용자가 한다).
// - cues: 트랙별 시작/종료 시각. UI 타임라인 표시가 이 배열을 그대로 재사용해야 한다(같은 소스).
function buildChapters(tracks) {
  const cues = computeCues(tracks);
  const lines = cues.map(cue => `${formatChapter(cue.start)} ${cue.title}`);
  const issues = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.duration < MIN_CHAPTER_SECONDS) {
      issues.push({
        level: 'error',
        code: 'TOO_SHORT',
        message: `${cue.index}번 트랙이 ${roundSeconds(cue.duration)}초로 ${MIN_CHAPTER_SECONDS}초 미만입니다. 챕터 목록 전체가 무효화됩니다.`
      });
    }
    if (cue.title.length > MAX_CHAPTER_TITLE_CHARS) {
      issues.push({
        level: 'warning',
        code: 'TITLE_TOO_LONG',
        message: `${cue.index}번 제목이 ${cue.title.length}자입니다. 모바일에서 잘릴 수 있습니다(${MAX_CHAPTER_TITLE_CHARS}자 권장).`
      });
    }
    if (i > 0 && formatChapter(cue.start) === formatChapter(cues[i - 1].start)) {
      issues.push({
        level: 'error',
        code: 'DUPLICATE_TIME',
        message: `${cues[i - 1].index}번과 ${cue.index}번 트랙의 타임스탬프가 같습니다(${formatChapter(cue.start)}).`
      });
    }
  }

  if (lines.length < MIN_CHAPTER_COUNT) {
    issues.push({
      level: 'error',
      code: 'TOO_FEW',
      message: `챕터가 ${lines.length}개입니다. 유튜브는 ${MIN_CHAPTER_COUNT}개 이상이어야 표시됩니다.`
    });
  }

  return { lines, text: lines.length ? lines.join('\n') + '\n' : '', issues, cues };
}

function buildTimelineCsv(tracks) {
  const cues = computeCues(tracks);
  const header = 'index,start,end,duration,title,file';
  const rows = cues.map(cue => [
    cue.index,
    cue.start.toFixed(3),
    cue.end.toFixed(3),
    cue.duration.toFixed(3),
    JSON.stringify(cue.title || ''),
    JSON.stringify(cue.file || '')
  ].join(','));
  return [header, ...rows].join('\n') + '\n';
}

function buildSrt(tracks) {
  const cues = computeCues(tracks);
  const lines = [];
  for (const cue of cues) {
    lines.push(String(cue.index));
    lines.push(`${formatSrtTime(cue.start)} --> ${formatSrtTime(Math.min(cue.end, cue.start + 8))}`);
    lines.push(cue.title || `Track ${cue.index}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  MIN_CHAPTER_COUNT,
  MIN_CHAPTER_SECONDS,
  MAX_CHAPTER_TITLE_CHARS,
  formatChapter,
  computeCues,
  buildChapters,
  buildTimelineCsv,
  buildSrt
};
