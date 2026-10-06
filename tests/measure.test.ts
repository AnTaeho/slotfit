// measure: 글자 종류별 너비 근사(D-1)로 줄 수를 세는 measureLines와, 줄 수·높이 경계를 보는 fits.
import { describe, expect, it } from 'vitest';
import type { TextSlot } from '../src/schema';
import { fits, lineHeight, measureLines } from '../src/text/measure';

describe('measureLines (D-1)', () => {
  it('「3만원 이상 구매 시 전국 무료배송」 20px, 폭 218 → 2줄', () => {
    // 숫자 1 × 0.55 + 한글 13 × 1.0 + 공백 5 × 0.3 = 15.05em → 15.05 × 20 = 301px → ceil(301 / 218) = 2
    expect(measureLines('3만원 이상 구매 시 전국 무료배송', 20, 218)).toBe(2);
  });

  it('「무료배송」 32px, 폭 520 → 1줄', () => {
    // 한글 4 × 1.0 = 4em → 4 × 32 = 128px → ceil(128 / 520) = 1
    expect(measureLines('무료배송', 32, 520)).toBe(1);
  });

  it("'\\n'으로 나뉜 문단의 줄 수를 더한다", () => {
    // 10px, 폭 30: 「가나다라」 40px → 2줄, 「마」 10px → 1줄, 합 3줄
    expect(measureLines('가나다라\n마', 10, 30)).toBe(3);
  });

  it('빈 문단도 한 줄로 센다', () => {
    // 「가」 1줄 + 빈 문단 1줄 + 「나」 1줄
    expect(measureLines('가\n\n나', 10, 30)).toBe(3);
  });

  it('빈 문자열은 1줄', () => {
    expect(measureLines('', 20, 218)).toBe(1);
  });

  it('폭에 딱 맞으면 1줄, 한 글자 넘으면 2줄', () => {
    // 10px, 폭 30: 한글 3자 = 30px → 1줄, 4자 = 40px → 2줄
    expect(measureLines('가나다', 10, 30)).toBe(1);
    expect(measureLines('가나다라', 10, 30)).toBe(2);
  });
});

describe('fits', () => {
  const FONT_SIZE = 10;
  const slotOf = (maxLines: number, h: number): TextSlot => ({
    id: 's', type: 'text', role: 'body', box: { x: 0, y: 0, w: 100, h },
    fontSize: FONT_SIZE, minFontSize: FONT_SIZE, maxLines,
  });
  // 10px, 폭 100: 한글 10자가 한 줄.
  const twoLines = '가'.repeat(20);
  const threeLines = '가'.repeat(21);

  it('줄 수 경계: maxLines와 같으면 들어가고, 한 줄 넘으면 안 들어간다', () => {
    const roomy = slotOf(2, 1000); // 높이는 넉넉하게 두고 줄 수만 본다
    expect(fits(twoLines, roomy, FONT_SIZE)).toBe(true);
    expect(fits(threeLines, roomy, FONT_SIZE)).toBe(false);
  });

  it('높이 경계: 줄 수 × 줄 높이가 box.h와 같으면 들어가고, 1px 모자라면 안 들어간다', () => {
    const exact = 2 * lineHeight(FONT_SIZE); // 2줄 × (10 × 줄 높이 비율)
    // maxLines는 넉넉하게 두고 높이만 본다
    expect(fits(twoLines, slotOf(5, exact), FONT_SIZE)).toBe(true);
    expect(fits(twoLines, slotOf(5, exact - 1), FONT_SIZE)).toBe(false);
  });

  it('인자로 받은 fontSize로 잰다(슬롯의 기본 fontSize가 아니다)', () => {
    // 20자: 10px이면 2줄이라 maxLines 1을 넘고, 5px이면 100px = 1줄이라 들어간다
    const oneLine = slotOf(1, 1000);
    expect(fits(twoLines, oneLine, FONT_SIZE)).toBe(false);
    expect(fits(twoLines, oneLine, FONT_SIZE / 2)).toBe(true);
  });
});
