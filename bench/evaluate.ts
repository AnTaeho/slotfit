// 모든 template × content × matcher를 실행해 matcher별 지표 표와 쌍별 표를 만든다.
import { loadAllContents, loadAllTemplates } from '../src/io/loader';
import { REGISTRY, runsOnEveryPair } from '../src/matchers';
import type { RegistryEntry } from '../src/matchers';
import { countFallbacks, countViolations, run } from '../src/pipeline';
import type { Content, Template } from '../src/schema';
import {
  buildPairs, goldenMatchText, groupSplitCount, NONE, runScored, saveReport, stamp, statusText, tally, toTable,
} from './pairs';
import type { Pair, ScoredRun } from './pairs';

// 실행 시간 측정: 쌍마다 워밍업 뒤 여러 번 재고 중앙값을 쓴다. 한 번 잰 값은 JIT·GC에 따라 실행마다 흔들린다.
// 엔진 가중치가 아니라 bench의 측정 설정이라 weights.ts가 아닌 여기에 둔다.
const TIMING_WARMUP_RUNS = 1; // 재기 전에 버리는 실행 횟수
const TIMING_RUNS = 21; // 재는 횟수. 홀수라 중앙값이 가운데 값 하나로 정해진다
const SUMMARY_COLUMNS = ['matcher', 'goldenMatch', 'errors', 'warns', 'p1Dropped', 'groupSplit', 'status (acc/deg/rej)', 'ms'];

// 쌍 하나를 matcher 하나로 실행한 결과 + 여러 번 잰 실행 시간의 중앙값(ms).
type PairRun = ScoredRun & { ms: number };
// matcher 하나가 모든 쌍을 돈 결과. 실행하지 않는 matcher(D-4, D-17)는 runs가 null.
type MatcherRuns = { entry: RegistryEntry; runs: PairRun[] | null };

// 정렬한 값의 가운데 값. 개수가 짝수면 가운데 두 값의 평균.
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) throw new Error('median: 값이 없다');
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[mid - 1] ?? upper) + upper) / 2;
}

// 쌍 하나의 실행 시간(ms): 워밍업 TIMING_WARMUP_RUNS회 뒤 TIMING_RUNS회 잰 값의 중앙값.
// run은 순수 함수라 몇 번을 돌려도 결과가 같다. 시간만 달라진다.
function medianRunMs(entry: RegistryEntry, pair: Pair): number {
  for (let i = 0; i < TIMING_WARMUP_RUNS; i++) run(pair.template, pair.content, entry.matcher);
  const samples: number[] = [];
  for (let i = 0; i < TIMING_RUNS; i++) {
    const started = performance.now();
    run(pair.template, pair.content, entry.matcher);
    samples.push(performance.now() - started);
  }
  return median(samples);
}

function runPair(entry: RegistryEntry, pair: Pair): PairRun {
  return { ...runScored(entry.matcher, pair), ms: medianRunMs(entry, pair) };
}

// matcher별 표의 한 행: 전체 쌍에 걸친 합계와 평균. 실행하지 않은 matcher는 전부 "-".
function summaryRow({ entry, runs }: MatcherRuns): string[] {
  const name = entry.matcher.name;
  if (runs === null) return [name, ...SUMMARY_COLUMNS.slice(1).map(() => NONE)];

  const total = tally(runs);
  const totalMs = runs.reduce((sum, pairRun) => sum + pairRun.ms, 0);
  return [
    name,
    goldenMatchText(total),
    String(total.errors),
    String(total.warns),
    String(total.p1Dropped),
    String(total.groupSplits),
    statusText(total),
    runs.length === 0 ? NONE : (totalMs / runs.length).toFixed(3),
  ];
}

// 쌍별 표의 칸: status 앞 세 글자 + error/warn/dropped/groupSplit 수 + fallback 횟수 (+ golden 맞은 슬롯/전체).
// 예: "rej e1 w0 d2 s0 f1", golden이 있으면 "acc e0 w0 d0 s0 f0 g5/5"
function pairCell({ result, goldenScore }: PairRun): string {
  const { errors, warns } = countViolations(result.violations);
  const summary = `${result.status.slice(0, 3)} e${errors} w${warns} d${result.dropped.length} s${groupSplitCount(result)} f${countFallbacks(result)}`;
  return goldenScore === undefined ? summary : `${summary} g${goldenScore.hits}/${goldenScore.total}`;
}

// 쌍 × matcher 표. 실행한 matcher만 열로 둔다. ★ = golden이 있는 쌍.
function pairTable(pairs: Pair[], ran: { entry: RegistryEntry; runs: PairRun[] }[]): string {
  const header = ['template × content', ...ran.map(({ entry }) => entry.matcher.name)];
  const rows = pairs.map((pair, index) => [
    pair.golden === undefined ? pair.key : `${pair.key} ★`,
    ...ran.map(({ runs }) => {
      const pairRun = runs[index];
      return pairRun === undefined ? NONE : pairCell(pairRun);
    }),
  ]);
  return toTable(header, rows);
}

function buildReport(name: string, templates: Template[], contents: Content[], pairs: Pair[], all: MatcherRuns[]): string {
  const goldenPairs = pairs.filter((pair) => pair.golden !== undefined).length;
  const ran = all.flatMap(({ entry, runs }) => (runs === null ? [] : [{ entry, runs }]));
  return [
    `# bench ${name}`,
    '',
    `- 템플릿 ${templates.length} × 콘텐츠 ${contents.length} = ${pairs.length}쌍, golden ${goldenPairs}쌍`,
    '- goldenMatch: golden이 있는 쌍에서 정답과 일치하는 슬롯 비율. 모양이 같은 카드끼리 통째로 바꾼 배치도 정답(D-7)',
    '- errors / warns / p1Dropped / groupSplit: 전체 쌍의 합. 미구현 지표는 "-"',
    '- status는 fallback(shrinkFont → dropLowPriority) 이후 기준(D-22). dropped에는 fallback이 버린 항목도 들어간다',
    `- ms: 쌍마다 워밍업 ${TIMING_WARMUP_RUNS}회 뒤 ${TIMING_RUNS}회 실행한 시간의 중앙값을 구하고, 그 중앙값들의 평균`,
    '- bruteForce는 oracle 전용(tests/oracle.test.ts에서만 실행)이라 "-"로 둔다(D-17)',
    '',
    toTable(SUMMARY_COLUMNS, all.map(summaryRow)),
    '',
    '## 쌍별 결과',
    '',
    '- 칸: status(acc/deg/rej) e=error 수 w=warn 수 d=dropped 수 s=groupSplit 수 f=fallback 적용 횟수, g=golden 맞은 슬롯/전체. ★ = golden 있는 쌍',
    '',
    pairTable(pairs, ran),
    '',
  ].join('\n');
}

function main(): void {
  const templates = loadAllTemplates();
  const contents = loadAllContents();
  const pairs = buildPairs(templates, contents);
  const all: MatcherRuns[] = REGISTRY.map((entry) => ({
    entry,
    runs: runsOnEveryPair(entry) ? pairs.map((pair) => runPair(entry, pair)) : null,
  }));

  const name = stamp(new Date());
  const report = buildReport(name, templates, contents, pairs, all);

  saveReport(name, report);
}

main();
