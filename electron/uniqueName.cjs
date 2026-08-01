// 파일명/폴더명 충돌 해소 — 문자열 조작만 하는 순수 로직 + fs.existsSync 호출.
// Electron API는 쓰지 않는다(checklist.cjs/chapters.cjs와 같은 패턴).
const fs = require('fs');
const path = require('path');

// "(2)"부터 "(100)"까지 시도한다(바로 이름 그대로 쓰는 경우까지 합쳐 최대 100회 검사).
// 전부 겹치면(현실적으로 거의 불가능) 무한루프 대신 타임스탬프를 붙여 확정한다.
const MAX_NAME_ATTEMPTS = 100;

// existsFn을 주입할 수 있게 해 vitest에서 실제 파일시스템 없이도 충돌 시나리오를 재현한다.
function resolveUniqueName(dir, baseName, ext, existsFn) {
  const exists = existsFn || (name => fs.existsSync(path.join(dir, name)));
  const first = `${baseName}${ext}`;
  if (!exists(first)) return first;
  for (let n = 2; n <= MAX_NAME_ATTEMPTS; n++) {
    const candidate = `${baseName} (${n})${ext}`;
    if (!exists(candidate)) return candidate;
  }
  return `${baseName}_${Date.now()}${ext}`;
}

module.exports = { resolveUniqueName, MAX_NAME_ATTEMPTS };
