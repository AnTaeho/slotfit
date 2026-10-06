// 전체 실행: context → match → validate ↔ fallback 반복 → 최종 status 판정.
import { buildContext } from './context';
import { MAX_ITERATIONS, POLICY } from './fallback/policy';
import type { Matcher } from './matchers/types';
import type { Adjustments, Content, MatchResult, PipelineResult, Status, Template, Violation } from './schema';
import { DEFAULT_WEIGHTS } from './scoring/weights';
import type { Weights } from './scoring/weights';
import { validate } from './validation/validate';

// fallback 단계를 적용할 때마다 trace에 이 머리말로 한 줄을 남긴다. render·bench는 이 줄 수로 적용 횟수를 센다.
const FALLBACK_TRACE_PREFIX = 'fallback#';

export function countViolations(violations: Violation[]): { errors: number; warns: number } {
  const errors = violations.filter((v) => v.severity === 'error').length;
  return { errors, warns: violations.length - errors };
}

// fallback 적용 횟수 = trace의 'fallback#' 줄 수.
export function countFallbacks(result: PipelineResult): number {
  return result.trace.filter((line) => line.startsWith(FALLBACK_TRACE_PREFIX)).length;
}

// D-22: error가 하나라도 남으면 rejected. error 0이고 warn이 있거나 fallback이 1번 이상 적용됐으면 degraded.
// 그 밖(위반 0, fallback 0)은 accepted. D-9(warn ≥ 1 → degraded)를 「fallback 적용도 degraded」로 넓힌 것.
export function decideStatus(violations: Violation[], fallbackCount: number): Status {
  const { errors, warns } = countViolations(violations);
  if (errors > 0) return 'rejected';
  if (warns > 0 || fallbackCount > 0) return 'degraded';
  return 'accepted';
}

function summarize(violations: Violation[]): string {
  const { errors, warns } = countViolations(violations);
  return `error ${errors}, warn ${warns}`;
}

// weights를 넘기면 그 가중치로 cost를 매긴다(D-25). validation·fallback·status 판정은 가중치를 보지 않는다.
export function run(t: Template, c: Content, matcher: Matcher, weights: Weights = DEFAULT_WEIGHTS): PipelineResult {
  const ctx = buildContext(t, c, weights);
  const trace: string[] = [];

  let result: MatchResult = matcher.match(ctx);
  let adj: Adjustments = { fontSize: {} };
  trace.push(`match(${matcher.name}): totalCost ${result.totalCost}, dropped ${result.dropped.length}`);

  let violations = validate(ctx, result, adj);
  trace.push(`validate: ${summarize(violations)}`);

  // 위반이 남아 있는 동안 POLICY 순서대로 처음 할 일이 있는 단계 하나를 적용하고 다시 검사한다(D-21, D-23).
  let fallbackCount = 0;
  for (let iteration = 1; iteration <= MAX_ITERATIONS && violations.length > 0; iteration++) {
    const remaining = violations;
    const step = POLICY.find((candidate) => candidate.applies(remaining, ctx, result, adj));
    if (step === undefined) {
      trace.push('fallback: 적용할 단계 없음');
      break;
    }
    const outcome = step.apply(ctx, result, adj);
    result = outcome.r;
    adj = outcome.adj;
    fallbackCount += 1;
    trace.push(`${FALLBACK_TRACE_PREFIX}${iteration} ${step.id}: ${outcome.note}`);
    violations = validate(ctx, result, adj);
    trace.push(`validate: ${summarize(violations)}`);
  }

  return {
    status: decideStatus(violations, fallbackCount), // 모든 반복이 끝난 뒤 남은 위반으로 판정
    matcher: matcher.name,
    assignment: result.assignment,
    dropped: result.dropped,
    adjustments: adj,
    violations,
    trace,
  };
}
