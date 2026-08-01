import { createRequire } from 'node:module';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const diskSpace = require('../../electron/diskSpace.cjs') as {
  estimateOutputBytes: (seconds: number) => number;
  freeSpaceBytesFor: (targetPath: string) => number;
  sumFileSizes: (paths: string[]) => number;
  ESTIMATED_VIDEO_KBPS: number;
  AUDIO_KBPS: number;
};

describe('diskSpace.cjs — estimateOutputBytes', () => {
  it('재생시간이 길수록 예상 용량도 커진다(단조 증가)', () => {
    expect(diskSpace.estimateOutputBytes(120)).toBeGreaterThan(diskSpace.estimateOutputBytes(60));
  });

  it('0초는 0바이트에 가깝다(음수 아님)', () => {
    expect(diskSpace.estimateOutputBytes(0)).toBe(0);
  });

  it('대략 (비디오+오디오 비트레이트) × 시간 규모다(안전마진 포함, 자릿수 확인)', () => {
    // 42분(2520초) 기준 대략 몇십 MB 수준이어야 한다 — 극단적으로 어긋나지 않는지만 확인.
    const bytes = diskSpace.estimateOutputBytes(2520);
    expect(bytes).toBeGreaterThan(10 * 1024 * 1024);
    expect(bytes).toBeLessThan(500 * 1024 * 1024);
  });
});

describe('diskSpace.cjs — freeSpaceBytesFor / sumFileSizes (실제 파일시스템)', () => {
  it('존재하는 폴더의 여유 공간을 0보다 크게 반환한다', () => {
    const bytes = diskSpace.freeSpaceBytesFor(os.tmpdir());
    expect(bytes).toBeGreaterThan(0);
  });

  it('아직 없는 하위 폴더 경로를 줘도 예외 없이 상위 폴더 기준으로 반환한다', () => {
    const notYetCreated = path.join(os.tmpdir(), `sum-disk-test-${Date.now()}`, 'nested', 'more');
    expect(() => diskSpace.freeSpaceBytesFor(notYetCreated)).not.toThrow();
    expect(diskSpace.freeSpaceBytesFor(notYetCreated)).toBeGreaterThan(0);
  });

  it('sumFileSizes는 실제 파일 크기 합을 반환하고, 없는 파일은 0으로 조용히 무시한다', () => {
    const tmpFile = path.join(os.tmpdir(), `sum-disk-test-file-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'x'.repeat(1000));
    try {
      const total = diskSpace.sumFileSizes([tmpFile, path.join(os.tmpdir(), 'does-not-exist-xyz.bin')]);
      expect(total).toBe(1000);
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });
});
