// 유튜브 설명문(description.txt) 조립 — 순수 로직만. Electron API를 쓰지 않는다.
// 챕터 텍스트는 반드시 호출부가 chapters.cjs의 buildChapters().text를 그대로 넘겨야 한다 —
// 여기서 챕터를 다시 계산하지 않는다(두 벌 금지, chapters.cjs가 유일한 소스).

const MAX_DESCRIPTION_CHARS = 5000; // 유튜브 설명란 상한. 초과해도 자르지 않고 경고만 한다.

// M열 키워드("아침음악, 커피음악") → 해시태그(["#아침음악", "#커피음악"]).
function keywordsToHashtags(keywords) {
  return String(keywords || '')
    .split(/[,·/]+/)
    .map(k => k.trim())
    .filter(Boolean)
    .map(k => `#${k.replace(/\s+/g, '')}`);
}

// 조립 순서(지시서 4번): 인사말 → 빈 줄 → 챕터 → 빈 줄 → 해시태그 → 고정 푸터.
function buildDescriptionText({ greeting = '', chaptersText = '', keywords = '', footer = '' } = {}) {
  const hashtags = keywordsToHashtags(keywords);
  const chaptersBlock = String(chaptersText || '').replace(/\n+$/, '');
  const sections = [String(greeting).trim(), '', chaptersBlock, ''];
  if (hashtags.length) sections.push(hashtags.join(' '));
  const footerTrimmed = String(footer).trim();
  if (footerTrimmed) sections.push(footerTrimmed);
  const text = sections.join('\n');
  return {
    text,
    length: text.length,
    overLimit: text.length > MAX_DESCRIPTION_CHARS,
    hashtags
  };
}

module.exports = { MAX_DESCRIPTION_CHARS, keywordsToHashtags, buildDescriptionText };
