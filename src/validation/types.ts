// 검증 규칙 하나의 계약.
import type { MatchContext } from '../context';
import type { Adjustments, MatchResult, Severity, Violation } from '../schema';

export type Rule = {
  id: string;
  severity: Severity;
  check(ctx: MatchContext, r: MatchResult, adj: Adjustments): Violation[];
};
