// 전체 실행: context → match → validate ↔ fallback 반복 → 최종 status 판정.
import { buildContext } from './context';
import { MAX_ITERATIONS, POLICY } from './fallback/policy';
import type { Matcher } from './matchers/types';
import type { Adjustments, Content, MatchResult, PipelineResult, Status, Template, Violation } from './schema';
import { validate } from './validation/validate';

// spec 3.4 초안. TODO(Step 4): 사용자가 accepted/degraded/rejected 경계를 확정하면 반영한다.
function decideStatus(violations: Violation[]): Status {
  if (violations.some((v) => v.severity === 'error')) return 'rejected';
  if (violations.some((v) => v.severity === 'warn')) return 'degraded';
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

  for (let i = 1; i <= MAX_ITERATIONS && violations.length > 0; i++) {
    const current = violations;
    const step = POLICY.find((s) => s.applies(current));
    if (step === undefined) {
      trace.push('fallback: 적용할 단계 없음');
      break;
    }
    const next = step.apply(ctx, r, adj);
    r = next.r;
    adj = next.adj;
    trace.push(`fallback#${i} ${step.id}: ${next.note}`);
    violations = validate(ctx, r, adj);
    trace.push(`validate: ${summarize(violations)}`);
  }

  return {
    status: decideStatus(violations),
    matcher: matcher.name,
    assignment: r.assignment,
    dropped: r.dropped,
    adjustments: adj,
    violations,
    trace,
  };
}
