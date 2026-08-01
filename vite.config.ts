import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// devMockAPI.ts(순수 브라우저 dev 모드)가 electron/chapters.cjs·description.cjs를 자체 재구현 없이
// 실제로 import해서 쓴다(Phase 2-2 — mock이 실제 검증 로직과 어긋나 UI 회귀를 놓치는 것을 막기 위함).
// 두 파일은 여전히 Node CommonJS(main.cjs의 require(), vitest의 createRequire()가 그대로 읽는다)라
// 원본은 건드리지 않고, 이 두 파일이 브라우저로 나갈 때만 `module.exports`가 읽히도록 최소한의
// 다리를 놓는다. 다른 electron/*.cjs(fs·electron API를 쓰는 파일들)는 대상이 아니다.
function cjsBrowserBridge(): Plugin {
  const targets = [/electron[\\/]chapters\.cjs$/, /electron[\\/]description\.cjs$/];
  return {
    name: 'sum-cjs-browser-bridge',
    transform(code, id) {
      if (!targets.some(re => re.test(id))) return null;
      return { code: `const module = { exports: {} };\n${code}\nexport default module.exports;\n`, map: null };
    }
  };
}

export default defineConfig({
  plugins: [react(), cjsBrowserBridge()],
  base: './',
  build: { outDir: 'dist' }
});
