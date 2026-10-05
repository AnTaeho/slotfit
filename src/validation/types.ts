// 검증 규칙 하나의 계약. check는 입력을 바꾸지 않고 찾은 위반만 돌려준다.
import type { MatchContext } from '../context';
import type { Adjustments, MatchResult, Severity, Violation } from '../schema';

export type Rule = {
  id: string;
  severity: Severity;
  check(ctx: MatchContext, result: MatchResult, adj: Adjustments): Violation[];
};
