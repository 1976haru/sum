// 오디오 폴더 스캔용 순수 로직(확장자 필터 + 자연 정렬). Electron API를 import하지 않는다
// (checklist.cjs/chapters.cjs와 같은 패턴) — 실제 폴더 읽기(fs.readdirSync)는 main.cjs에 남긴다.
const path = require('path');

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
// 파트G: 폴더 스캔도 반복 상한이 있어야 한다 — 상한 넘으면 앞에서부터만 쓰고 호출부가 경고한다.
const MAX_TRACKS_PER_SET = 200;

// 문자열 비교로 정렬하면 "10.mp3"가 "2.mp3"보다 앞에 온다. numeric:true를 쓴 Intl.Collator가
// 표준적으로 이 문제를 해결한다 — 직접 파서를 짜지 않는다. 한국어 로케일이라 한글/일본어
// 파일명도 함께 정렬된다.
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

function isAudioFileName(name) {
  return AUDIO_EXTENSIONS.includes(path.extname(String(name || '')).toLowerCase());
}

function sortAudioFilesNatural(files) {
  const list = Array.isArray(files) ? files.slice() : [];
  return list.sort((a, b) => collator.compare(String(a.name || ''), String(b.name || '')));
}

module.exports = {
  AUDIO_EXTENSIONS,
  MAX_TRACKS_PER_SET,
  isAudioFileName,
  sortAudioFilesNatural
};
