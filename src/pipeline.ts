// 전체 실행: context → match → validate ↔ fallback 반복 → 최종 status 판정.
import { buildContext } from './context';
import { MAX_ITERATIONS, POLICY } from './fallback/policy';
import type { Matcher } from './matchers/types';
import type { Adjustments, Content, MatchResult, PipelineResult, Status, Template, Violation } from './schema';
import { validate } from './validation/validate';

// D-22: error가 하나라도 남으면 rejected. error 0이고 warn이 있거나 fallback이 1번 이상 적용됐으면 degraded.
// 그 밖(위반 0, fallback 0)은 accepted. D-9(warn ≥ 1 → degraded)를 「fallback 적용도 degraded」로 넓힌 것.
export function decideStatus(violations: Violation[], fallbackCount: number): Status {
  if (violations.some((v) => v.severity === 'error')) return 'rejected';
  if (violations.some((v) => v.severity === 'warn') || fallbackCount > 0) return 'degraded';
  return 'accepted';
}

function summarize(violations: Violation[]): string {
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warns = violations.length - errors;
  return `error ${errors}, warn ${warns}`;
}

export function run(t: Template, c: Content, matcher: Matcher): PipelineResult {
  const ctx = buildContext(t, c);
  const trace: string[] = [];

  let r: MatchResult = matcher.match(ctx);
  let adj: Adjustments = { fontSize: {} };
  trace.push(`match(${matcher.name}): totalCost ${r.totalCost}, dropped ${r.dropped.length}`);

  let violations = validate(ctx, r, adj);
  trace.push(`validate: ${summarize(violations)}`);

  // 위반이 남아 있는 동안 POLICY 순서대로 처음 할 일이 있는 단계 하나를 적용하고 다시 검사한다(D-21, D-23).
  let fallbackCount = 0;
  for (let i = 1; i <= MAX_ITERATIONS && violations.length > 0; i++) {
    const current = violations;
    const step = POLICY.find((s) => s.applies(current, ctx, r, adj));
    if (step === undefined) {
      trace.push('fallback: 적용할 단계 없음');
      break;
    }
    const next = step.apply(ctx, r, adj);
    r = next.r;
    adj = next.adj;
    fallbackCount += 1;
    trace.push(`fallback#${i} ${step.id}: ${next.note}`);
    violations = validate(ctx, r, adj);
    trace.push(`validate: ${summarize(violations)}`);
  }

  return {
    status: decideStatus(violations, fallbackCount), // 모든 반복이 끝난 뒤 남은 위반으로 판정
    matcher: matcher.name,
    assignment: r.assignment,
    dropped: r.dropped,
    adjustments: adj,
    violations,
    trace,
  };
}
