// 규칙 위반에 대응하는 단계 하나의 계약.
import type { MatchContext } from '../context';
import type { Adjustments, MatchResult, Violation } from '../schema';

// 단계를 한 번 적용한 결과: 새 배치(r), 새 조정값(adj), trace에 남길 한 줄(note).
export type FallbackOutcome = { r: MatchResult; adj: Adjustments; note: string };

// D-23: applies는 현재 남은 위반 전체와 함께 ctx·현재 배치·현재 조정값을 받아, 이 단계가 실제로 할 일이
// 남았는지 답한다(예: 이미 minFontSize인 슬롯은 shrinkFont가 할 일이 없다).
// apply는 입력을 바꾸지 않고 FallbackOutcome을 새로 만들어 돌려준다.
export type FallbackStep = {
  id: string;
  applies(violations: Violation[], ctx: MatchContext, result: MatchResult, adj: Adjustments): boolean;
  apply(ctx: MatchContext, result: MatchResult, adj: Adjustments): FallbackOutcome;
};
