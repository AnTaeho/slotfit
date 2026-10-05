// golden 비교(D-7): 카드를 통째로 바꾼 배치는 정답, 카드 사이로 갈라진 배치는 오답으로 센다.
import { describe, expect, it } from 'vitest';
import { scoreGolden } from '../bench/golden';
import { loadGolden, loadTemplate } from '../src/io/loader';
import type { Assignment } from '../src/schema';

describe('golden 비교 (D-7)', () => {
  const t = loadTemplate('t01-sale-cards');
  const golden = loadGolden('t01-sale-cards', 'c01-summer-sale');
  if (golden === null) throw new Error('golden 없음');

  it('정답 그대로면 5/5', () => {
    expect(scoreGolden(t, golden.assignment, golden.assignment)).toEqual({ hits: 5, total: 5 });
  });

  it('카드 A/B를 통째로 바꿔도 5/5', () => {
    const swapped: Assignment = [
      { slotId: 'title', contentId: 'title' },
      { slotId: 'cardA-sub', contentId: 'c2-sub' },
      { slotId: 'cardA-body', contentId: 'c2-body' },
      { slotId: 'cardB-sub', contentId: 'c1-sub' },
      { slotId: 'cardB-body', contentId: 'c1-body' },
    ];
    expect(scoreGolden(t, golden.assignment, swapped)).toEqual({ hits: 5, total: 5 });
  });

  it('소제목만 바뀌어 카드가 섞이면 3/5', () => {
    const mixed: Assignment = [
      { slotId: 'title', contentId: 'title' },
      { slotId: 'cardA-sub', contentId: 'c2-sub' },
      { slotId: 'cardA-body', contentId: 'c1-body' },
      { slotId: 'cardB-sub', contentId: 'c1-sub' },
      { slotId: 'cardB-body', contentId: 'c2-body' },
    ];
    expect(scoreGolden(t, golden.assignment, mixed)).toEqual({ hits: 3, total: 5 });
  });
});
