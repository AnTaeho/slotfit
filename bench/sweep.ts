// 가중치 민감도 sweep: cost 가중치를 하나씩 절반·두 배로 바꿔 모든 쌍을 다시 돌리고, 기준(기본값)과 얼마나 달라지는지 표로 낸다.
// 「어느 숫자를 건드리면 결과가 움직이는가」를 보는 도구다. 가중치 값은 정하지 않고 weights.ts도 고치지 않는다(D-25).
import { loadAllContents, loadAllTemplates } from '../src/io/loader';
import { findMatcher } from '../src/matchers';
import type { Matcher } from '../src/matchers';
import type { Role } from '../src/schema';
import { DEFAULT_WEIGHTS, FORBIDDEN_COST } from '../src/scoring/weights';
import type { Weights } from '../src/scoring/weights';
import { buildPairs, goldenMatchText, NONE, runScored, saveReport, stamp, statusText, tally, toTable } from './pairs';
import type { Pair, ScoredRun } from './pairs';

// sweep 설정. bench의 실험 설정이라 여기에 둔다(weights.ts는 엔진 가중치만 담는다).
const SWEEP_FACTORS = [0.5, 2]; // 가중치 하나에 곱해 보는 배율
const SWEEP_MATCHER_NAMES = ['hungarian', 'hierarchical']; // greedy는 cost를 보지 않고 고르므로 뺀다
const TOP_SENSITIVE_COUNT = 3; // 「가장 민감한 가중치」로 적는 개수

// 바꿔 볼 가중치 하나: 이름, 지금 값을 읽는 법, 그 값만 바꾼 새 Weights를 만드는 법(입력은 바꾸지 않는다).
type Knob = { name: string; get(weights: Weights): number; set(weights: Weights, value: number): Weights };

const SCALAR_KEYS = ['roleMismatch', 'roleUnknown', 'shrinkNeeded', 'overflowPerLine', 'underfill', 'order'] as const;
const PRIORITIES = [1, 2, 3] as const;
const ROLES: readonly Role[] = ['title', 'subtitle', 'body', 'caption', 'image'];

// 스칼라 가중치는 그대로 하나씩, 표 가중치(dropByPriority·emptyByRole)는 키마다 따로.
const KNOBS: Knob[] = [
  ...SCALAR_KEYS.map((key): Knob => ({
    name: key,
    get: (weights) => weights[key],
    set: (weights, value) => ({ ...weights, [key]: value }),
  })),
  ...PRIORITIES.map((priority): Knob => ({
    name: `dropByPriority[${priority}]`,
    get: (weights) => weights.dropByPriority[priority],
    set: (weights, value) => ({ ...weights, dropByPriority: { ...weights.dropByPriority, [priority]: value } }),
  })),
  ...ROLES.map((role): Knob => ({
    name: `emptyByRole.${role}`,
    get: (weights) => weights.emptyByRole[role],
    set: (weights, value) => ({ ...weights, emptyByRole: { ...weights.emptyByRole, [role]: value } }),
  })),
];

type Variant = { label: string; knob: Knob; factor: number; weights: Weights };
// 변형 하나를 matcher 하나로 모든 쌍에 돌린 결과. changedPairs = 기준과 배치가 달라진 쌍 수(기준 행은 null).
type MatcherOutcome = { runs: ScoredRun[]; changedPairs: number | null };
type Row = { label: string; outcomes: MatcherOutcome[] };

// D-15: 금지 짝 하나를 「버림 + 비움」으로 바꾸면 항상 더 싸야 최적해가 금지 칸을 고르지 않는다.
// 버림·비움 비용을 키운 변형에서도 이 부등식이 성립하는지 확인한다. 깨지면 그 변형의 결과는 믿을 수 없다.
function assertForbiddenStillDominates(label: string, weights: Weights): void {
  const maxDrop = Math.max(...Object.values(weights.dropByPriority));
  const maxEmpty = Math.max(...Object.values(weights.emptyByRole));
  if (!(FORBIDDEN_COST > maxDrop + maxEmpty)) {
    throw new Error(`sweep ${label}: FORBIDDEN_COST(${FORBIDDEN_COST}) ≤ 최대 버림(${maxDrop}) + 최대 비움(${maxEmpty})`);
  }
}

// 값이 0인 가중치는 몇 배를 해도 0이라 건너뛴다(지금은 roleUnknown).
function buildVariants(base: Weights): { variants: Variant[]; skipped: string[] } {
  const skipped = KNOBS.filter((knob) => knob.get(base) === 0).map((knob) => knob.name);
  const variants = KNOBS.filter((knob) => knob.get(base) !== 0).flatMap((knob) =>
    SWEEP_FACTORS.map((factor): Variant => {
      const value = knob.get(base) * factor;
      return { label: `${knob.name} ×${factor} (${knob.get(base)} → ${value})`, knob, factor, weights: knob.set(base, value) };
    }),
  );
  return { variants, skipped };
}

// 가정: 「배치가 달라졌다」 = fallback까지 끝난 최종 assignment(슬롯 → 항목)가 하나라도 다르다.
// 글자 크기 조정이나 status만 달라진 쌍은 세지 않는다.
function countChangedPairs(baseline: readonly ScoredRun[], runs: readonly ScoredRun[]): number {
  return runs.filter((scored, index) => {
    const before = baseline[index];
    if (before === undefined) throw new Error(`sweep: 기준에 없는 쌍 (${scored.pair.key})`);
    return JSON.stringify(before.result.assignment) !== JSON.stringify(scored.result.assignment);
  }).length;
}

const runAll = (matcher: Matcher, pairs: readonly Pair[], weights: Weights): ScoredRun[] =>
  pairs.map((pair) => runScored(matcher, pair, weights));

// 행 하나의 칸: 변형 이름, 그리고 matcher마다 goldenMatch · groupSplit · status · 달라진 쌍 수.
function rowCells({ label, outcomes }: Row): string[] {
  return [
    label,
    ...outcomes.flatMap(({ runs, changedPairs }) => {
      const total = tally(runs);
      return [goldenMatchText(total), String(total.groupSplits), statusText(total), changedPairs === null ? NONE : String(changedPairs)];
    }),
  ];
}

// 가중치별 달라진 쌍 수(모든 배율 × 모든 matcher의 합)와 그 내역. 많이 달라진 순, 같으면 KNOBS 순서.
type Sensitivity = { name: string; total: number; detail: string };
function rankSensitivity(variants: Variant[], rows: Row[], matchers: Matcher[]): Sensitivity[] {
  const byKnob = new Map<string, { total: number; parts: string[] }>();
  variants.forEach((variant, index) => {
    const entry = byKnob.get(variant.knob.name) ?? { total: 0, parts: [] };
    const outcomes = rows[index]?.outcomes ?? [];
    outcomes.forEach((outcome, m) => {
      const changed = outcome.changedPairs ?? 0;
      entry.total += changed;
      entry.parts.push(`×${variant.factor} ${matchers[m]?.name ?? NONE} ${changed}`);
    });
    byKnob.set(variant.knob.name, entry);
  });
  return [...byKnob.entries()]
    .map(([name, { total, parts }]) => ({ name, total, detail: parts.join(', ') }))
    .sort((a, b) => b.total - a.total); // sort는 안정 정렬이라 같은 값이면 KNOBS 순서가 남는다
}

function buildReport(time: string, pairCount: number, matchers: Matcher[], rows: Row[], ranked: Sensitivity[], skipped: string[]): string {
  const header = [
    '변형',
    ...matchers.flatMap(({ name: m }) => [`${m} goldenMatch`, `${m} groupSplit`, `${m} status`, `${m} 달라진 쌍`]),
  ];
  const unchanged = ranked.filter((entry) => entry.total === 0).map((entry) => entry.name);
  return [
    `# sweep ${time}`,
    '',
    `- 가중치 하나만 ×${SWEEP_FACTORS.join(', ×')}로 바꾸고 나머지는 기본값(weights.ts)으로 둔 채 ${pairCount}쌍을 ${matchers.map((m) => m.name).join(' · ')}로 돌렸다`,
    '- 첫 행은 기준(기본값). 괄호 안은 (기본값 → 바꾼 값)',
    '- goldenMatch · groupSplit · status(acc/deg/rej)는 bench와 같은 정의(fallback 이후)',
    `- 달라진 쌍: 기준과 최종 배치(assignment)가 하나라도 다른 쌍 수. 전체 ${pairCount}쌍`,
    skipped.length === 0 ? '- 건너뛴 가중치: 없음' : `- 건너뛴 가중치(값이 0이라 배율이 뜻이 없음): ${skipped.join(', ')}`,
    '',
    toTable(header, rows.map(rowCells)),
    '',
    `## 가장 민감한 가중치 ${TOP_SENSITIVE_COUNT}개`,
    '',
    '- 기준: 달라진 쌍 수의 합(모든 배율 × 모든 matcher). 같으면 위 표의 순서',
    '',
    ...ranked.slice(0, TOP_SENSITIVE_COUNT).map((entry, index) => `${index + 1}. \`${entry.name}\` — 합 ${entry.total} (${entry.detail})`),
    '',
    unchanged.length === 0 ? '- 달라진 쌍이 0인 가중치: 없음' : `- 달라진 쌍이 0인 가중치: ${unchanged.map((n) => `\`${n}\``).join(', ')}`,
    '',
  ].join('\n');
}

function main(): void {
  const matchers = SWEEP_MATCHER_NAMES.map((matcherName) => {
    const entry = findMatcher(matcherName);
    if (entry === undefined) throw new Error(`sweep: 모르는 matcher ${matcherName}`);
    return entry.matcher;
  });
  const pairs = buildPairs(loadAllTemplates(), loadAllContents());
  const { variants, skipped } = buildVariants(DEFAULT_WEIGHTS);

  assertForbiddenStillDominates('기준', DEFAULT_WEIGHTS);
  const baseline = matchers.map((matcher) => runAll(matcher, pairs, DEFAULT_WEIGHTS));
  const baselineRow: Row = { label: '기준(기본값)', outcomes: baseline.map((runs) => ({ runs, changedPairs: null })) };

  const variantRows = variants.map((variant): Row => {
    assertForbiddenStillDominates(variant.label, variant.weights);
    return {
      label: variant.label,
      outcomes: matchers.map((matcher, m) => {
        const runs = runAll(matcher, pairs, variant.weights);
        return { runs, changedPairs: countChangedPairs(baseline[m] ?? [], runs) };
      }),
    };
  });

  const time = stamp(new Date());
  const ranked = rankSensitivity(variants, variantRows, matchers);
  saveReport(`sweep-${time}`, buildReport(time, pairs.length, matchers, [baselineRow, ...variantRows], ranked, skipped));
}

main();
