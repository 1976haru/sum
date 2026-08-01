import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const audioFiles = require('../../electron/audioFiles.cjs') as {
  AUDIO_EXTENSIONS: string[];
  MAX_TRACKS_PER_SET: number;
  isAudioFileName: (name: string) => boolean;
  sortAudioFilesNatural: (files: Array<{ name: string }>) => Array<{ name: string }>;
};

function names(files: Array<{ name: string }>) {
  return files.map(f => f.name);
}

describe('audioFiles.cjs — sortAudioFilesNatural', () => {
  it('7) 자연 정렬: 숫자 접두 파일명이 문자열 비교가 아니라 수치로 정렬된다', () => {
    const input = ['10.mp3', '2.mp3', '1.mp3'].map(name => ({ name }));
    const sorted = audioFiles.sortAudioFilesNatural(input);
    expect(names(sorted)).toEqual(['1.mp3', '2.mp3', '10.mp3']);
  });

  it('8) 자연 정렬: 한글 파일명이 섞여도 예외 없이 정렬된다', () => {
    const input = ['10_가을아침.mp3', '2_겨울밤.mp3', '1_봄노래.mp3', '창가의오후.mp3'].map(name => ({ name }));
    expect(() => audioFiles.sortAudioFilesNatural(input)).not.toThrow();
    const sorted = names(audioFiles.sortAudioFilesNatural(input));
    expect(sorted).toEqual(['1_봄노래.mp3', '2_겨울밤.mp3', '10_가을아침.mp3', '창가의오후.mp3']);
  });

  it('원본 배열을 변형하지 않는다(순수 함수)', () => {
    const input = [{ name: '10.mp3' }, { name: '1.mp3' }];
    const original = [...input];
    audioFiles.sortAudioFilesNatural(input);
    expect(input).toEqual(original);
  });

  it('빈 배열/undefined 항목이 섞여도 예외 없이 처리한다', () => {
    expect(() => audioFiles.sortAudioFilesNatural([])).not.toThrow();
  });
});

describe('audioFiles.cjs — isAudioFileName', () => {
  it('지원 확장자만 true를 반환한다', () => {
    for (const ext of audioFiles.AUDIO_EXTENSIONS) expect(audioFiles.isAudioFileName(`song${ext}`)).toBe(true);
    expect(audioFiles.isAudioFileName('image.png')).toBe(false);
    expect(audioFiles.isAudioFileName('readme.txt')).toBe(false);
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(audioFiles.isAudioFileName('SONG.MP3')).toBe(true);
  });
});
