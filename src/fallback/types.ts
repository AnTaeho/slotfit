// 규칙 위반에 대응하는 단계 하나의 계약.
import type { MatchContext } from '../context';
import type { Adjustments, MatchResult, Violation } from '../schema';

// 가정: applies는 현재 남은 위반 전체를 받아 이 단계가 할 일이 있는지 답한다.
// apply는 입력을 바꾸지 않고 새 결과와 새 조정값, 그리고 trace에 남길 note를 돌려준다.
export type FallbackStep = {
  id: string;
  applies(v: Violation[]): boolean;
  apply(ctx: MatchContext, r: MatchResult, adj: Adjustments): { r: MatchResult; adj: Adjustments; note: string };
};
