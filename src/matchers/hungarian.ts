// hungarian matcher: cost 합이 최소인 배치를 다항 시간에 찾는다. 미구현.
import type { MatchContext } from '../context';
import type { MatchResult } from '../schema';
import type { Matcher } from './types';

// TODO(Step 2): cost 행렬을 dummy로 정사각으로 만들고 Hungarian 알고리즘을 직접 구현한다.
// 행/열 잠재값(potential)을 갱신하며 증가 경로를 찾아 한 행씩 짝을 늘린다. O(n^3).
// dummy와 짝지어진 콘텐츠는 dropped, dummy와 짝지어진 슬롯은 contentId: null.
function match(_ctx: MatchContext): MatchResult {
  throw new Error('TODO: Step 2');
}

export const hungarian: Matcher = { name: 'hungarian', match };
