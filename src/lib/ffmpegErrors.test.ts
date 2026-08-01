import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ffmpegErrors = require('../../electron/ffmpegErrors.cjs') as {
  classifyFfmpegError: (stderr: string, options?: { wasCancelled?: boolean; exitCode?: number }) => {
    userMessage: string | null;
    isCancelled: boolean;
    code: string;
  };
};

describe('ffmpegErrors.cjs — classifyFfmpegError', () => {
  it('6) ENOSPC/디스크 공간 부족 → 한국어 메시지', () => {
    const result = ffmpegErrors.classifyFfmpegError('av_interleaved_write_frame(): No space left on device\nENOSPC');
    expect(result.userMessage).toBe('디스크 공간이 부족합니다.');
    expect(result.isCancelled).toBe(false);
  });

  it('6) 손상된 데이터(Invalid data found) → 한국어 메시지', () => {
    const result = ffmpegErrors.classifyFfmpegError('[mp3 @ 0x1] Invalid data found when processing input');
    expect(result.userMessage).toBe('음원 파일 중 하나가 손상되었을 수 있습니다.');
  });

  it('6) 실제 손상 파일로 재현했을 때 나온 문구("Error opening input")도 같은 한국어 메시지로 분류한다', () => {
    // Phase 2-2 검증 스크립트로 진짜 손상된 파일을 렌더링해서 얻은 실제 ffmpeg stderr — "Invalid data
    // found" 문구 없이 이 경로로 실패할 수 있다는 것을 실측으로 확인했다.
    const real = "[mp3 @ 0x1] Failed to read frame size: Could not seek to 4323.\n[in#2 @ 0x2] Error opening input: Invalid argument\nError opening input file audio_001.mp3.\nError opening input files: Invalid argument\n";
    const result = ffmpegErrors.classifyFfmpegError(real);
    expect(result.userMessage).toBe('음원 파일 중 하나가 손상되었을 수 있습니다.');
  });

  it('6) 권한 오류(EACCES/Permission denied) → 한국어 메시지', () => {
    expect(ffmpegErrors.classifyFfmpegError('Permission denied').userMessage).toBe('저장 폴더에 쓸 권한이 없습니다. 다른 폴더를 선택하세요.');
    expect(ffmpegErrors.classifyFfmpegError('EACCES: permission denied, open ...').userMessage).toBe('저장 폴더에 쓸 권한이 없습니다. 다른 폴더를 선택하세요.');
  });

  it('7) 취소로 인한 종료는 오류로 분류되지 않는다(wasCancelled)', () => {
    const result = ffmpegErrors.classifyFfmpegError('', { wasCancelled: true });
    expect(result.isCancelled).toBe(true);
    expect(result.userMessage).toBe('사용자가 취소했습니다.');
  });

  it('7) stderr에 Killed가 있으면 wasCancelled 없이도 취소로 분류한다', () => {
    const result = ffmpegErrors.classifyFfmpegError('Killed');
    expect(result.isCancelled).toBe(true);
  });

  it('종료 코드 255 + wasCancelled 조합도 취소로 분류한다', () => {
    const result = ffmpegErrors.classifyFfmpegError('', { wasCancelled: true, exitCode: 255 });
    expect(result.isCancelled).toBe(true);
  });

  it('분류 목록에 없으면 userMessage가 null이다(호출부가 원문을 보여준다)', () => {
    const result = ffmpegErrors.classifyFfmpegError('무슨 알 수 없는 에러 abcdefg');
    expect(result.userMessage).toBeNull();
    expect(result.isCancelled).toBe(false);
  });
});
