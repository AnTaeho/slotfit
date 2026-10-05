// bruteForce matcher: 모든 배치를 탐색하는 oracle(느리지만 정답). 미구현.
import type { MatchContext } from '../context';
import type { MatchResult } from '../schema';
import type { Matcher } from './types';

// TODO(Step 2): 슬롯과 콘텐츠의 모든 짝짓기(순열)를 탐색해 totalCost가 최소인 배치를 고른다.
// 개수가 다르면 dummy 슬롯/콘텐츠를 채워 정사각으로 만든 뒤 순열을 돈다.
// 슬롯 6개 이하에서만 쓰는 테스트 기준값이다.
function match(_ctx: MatchContext): MatchResult {
  throw new Error('TODO: Step 2');
}

export const bruteForce: Matcher = { name: 'bruteForce', match };
