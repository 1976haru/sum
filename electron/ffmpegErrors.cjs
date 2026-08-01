// ffmpeg stderr를 사용자가 읽을 수 있는 한국어 메시지로 분류한다. 분류에 없으면 원문을
// 그대로 보여주면 된다(호출부 책임) — 원문 stderr는 여기서 버리지 않고 항상 결과에 포함한다.
function classifyFfmpegError(stderr, options = {}) {
  const text = String(stderr || '');
  const wasCancelled = Boolean(options.wasCancelled);
  const exitCode = options.exitCode;

  // 취소: 사용자가 playlist:cancel을 불러 SIGKILL한 경우. 오류로 표시하지 않는다.
  if (wasCancelled || /\bKilled\b/i.test(text) || (exitCode === 255 && wasCancelled)) {
    return { userMessage: '사용자가 취소했습니다.', isCancelled: true, code: 'CANCELLED' };
  }
  if (/no space left/i.test(text) || /ENOSPC/.test(text)) {
    return { userMessage: '디스크 공간이 부족합니다.', isCancelled: false, code: 'ENOSPC' };
  }
  // "Invalid data found"가 교과서적인 손상 메시지지만, 실제로는 파일이 아예 다른 포맷으로
  // 오인식되면 데뮤서가 "Error opening input"/"Could not find codec parameters"처럼 다른 문구를
  // 낼 때도 많다(실제 손상 파일로 재현해 확인함, Phase 2-2). 전부 같은 결론 — 파일을 못 읽는다.
  if (/invalid data found/i.test(text) || /error opening input/i.test(text) || /could not find codec parameters/i.test(text) || /moov atom not found/i.test(text)) {
    return { userMessage: '음원 파일 중 하나가 손상되었을 수 있습니다.', isCancelled: false, code: 'INVALID_DATA' };
  }
  if (/permission denied/i.test(text) || /EACCES/.test(text)) {
    return { userMessage: '저장 폴더에 쓸 권한이 없습니다. 다른 폴더를 선택하세요.', isCancelled: false, code: 'EACCES' };
  }
  // 분류 없음 — 호출부가 원문(rawStderr)을 그대로 보여준다.
  return { userMessage: null, isCancelled: false, code: 'UNKNOWN' };
}

module.exports = { classifyFfmpegError };
