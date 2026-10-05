// 텍스트가 차지하는 줄 수를 글자 종류별 너비로 근사한다.
// 가정(D-1): 실제 폰트를 재지 않는다. 한글 1.0em / 영문·숫자 0.55em / 공백 0.3em / 그 외 0.55em,
// 줄 높이 = fontSize × 1.4. 줄 수는 단어 경계를 무시하고 문단 너비를 박스 폭으로 나눠 올림한다.
// 실제 렌더 결과와 오차가 있다.
import type { Adjustments, TextSlot } from '../schema';
import {
  CHAR_WIDTH_HANGUL_EM, CHAR_WIDTH_LATIN_EM, CHAR_WIDTH_OTHER_EM, CHAR_WIDTH_SPACE_EM,
  LINE_HEIGHT_RATIO, MIN_LINES_PER_PARAGRAPH,
} from '../scoring/weights';

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/; // 완성형 음절 + 자모
const LATIN_OR_DIGIT = /[A-Za-z0-9]/;

// 한 글자의 너비(em).
function charWidthEm(ch: string): number {
  if (ch === ' ') return CHAR_WIDTH_SPACE_EM;
  if (HANGUL.test(ch)) return CHAR_WIDTH_HANGUL_EM;
  if (LATIN_OR_DIGIT.test(ch)) return CHAR_WIDTH_LATIN_EM;
  return CHAR_WIDTH_OTHER_EM;
}

// 줄바꿈 없는 문자열의 너비(em).
export function textWidthEm(text: string): number {
  let sum = 0;
  for (const ch of text) sum += charWidthEm(ch);
  return sum;
}

export function lineHeight(fontSize: number): number {
  return fontSize * LINE_HEIGHT_RATIO;
}

// 지금 이 슬롯에 쓰는 글자 크기: fallback이 줄였으면 그 값, 아니면 템플릿의 기본 fontSize.
export function currentFontSize(slot: TextSlot, adj: Adjustments): number {
  return adj.fontSize[slot.id] ?? slot.fontSize;
}

// 근사 줄 수: '\n'으로 나눈 문단마다 ceil(문단 너비 / 박스 폭)(최소 1)을 더한다.
export function measureLines(text: string, fontSize: number, width: number): number {
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    const widthPx = textWidthEm(paragraph) * fontSize;
    lines += Math.max(MIN_LINES_PER_PARAGRAPH, Math.ceil(widthPx / width));
  }
  return lines;
}

// 줄 수 ≤ maxLines 이고 줄 수 × 줄 높이 ≤ box.h 이면 들어간다고 본다.
export function fits(text: string, slot: TextSlot, fontSize: number): boolean {
  const lines = measureLines(text, fontSize, slot.box.w);
  return lines <= slot.maxLines && lines * lineHeight(fontSize) <= slot.box.h;
}

// 그림용 근사 줄바꿈: 글자 단위로 폭을 채워 자른다.
// 가정: 글자를 쪼갤 수 없어 measureLines보다 한 줄 많게 나올 수 있다. 판정에는 쓰지 않는다.
export function wrapLines(text: string, fontSize: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    let lineWidth = 0;
    for (const ch of paragraph) {
      const charWidth = charWidthEm(ch) * fontSize;
      if (line !== '' && lineWidth + charWidth > width) {
        lines.push(line);
        line = '';
        lineWidth = 0;
      }
      line += ch;
      lineWidth += charWidth;
    }
    lines.push(line);
  }
  return lines;
}
