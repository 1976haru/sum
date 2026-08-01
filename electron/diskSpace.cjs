// 디스크 여유 공간 확인 + 출력 용량 근사치. Electron API는 쓰지 않는다(fs/path는 Node 코어).
const fs = require('fs');
const path = require('path');

// 실제 인코딩은 -c:v libx264(고정 -b:v 없이 CRF)라 정확한 비트레이트가 없다. 정지 이미지에
// 가까운 슬라이드쇼라 실측상 낮게 나오는 편이지만, 이 값은 어디까지나 근사치다(주석 명시,
// 지시서 1-1). 과소평가로 인한 ENOSPC 도중 실패를 피하려 20% 여유를 곱한다.
const ESTIMATED_VIDEO_KBPS = 300;
const AUDIO_KBPS = 192;
const SAFETY_MARGIN = 1.2;

function estimateOutputBytes(totalDurationSeconds) {
  const bytesPerSecond = ((ESTIMATED_VIDEO_KBPS + AUDIO_KBPS) * 1000) / 8;
  return Math.ceil(Math.max(0, totalDurationSeconds) * bytesPerSecond * SAFETY_MARGIN);
}

// targetPath가 아직 없으면(출력 폴더를 만들기 전) 존재하는 가장 가까운 상위 폴더를 잰다.
function freeSpaceBytesFor(targetPath) {
  let dir = path.resolve(targetPath);
  const seen = new Set();
  while (!fs.existsSync(dir) && !seen.has(dir)) {
    seen.add(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const stat = fs.statfsSync(dir);
  return stat.bavail * stat.bsize;
}

function sumFileSizes(paths) {
  let total = 0;
  for (const p of paths) {
    try { total += fs.statSync(p).size; } catch { /* 없는 파일은 0으로 취급 — 조용히 무시하되 합계엔 영향 없음 */ }
  }
  return total;
}

module.exports = { estimateOutputBytes, freeSpaceBytesFor, sumFileSizes, ESTIMATED_VIDEO_KBPS, AUDIO_KBPS, SAFETY_MARGIN };
