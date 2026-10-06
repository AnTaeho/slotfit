// 모든 template × content × matcher를 실행해 matcher별 지표 표와 쌍별 표를 만든다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goldenKey, loadAllContents, loadAllGoldens, loadAllTemplates } from '../src/io/loader';
import { REGISTRY, runsOnEveryPair } from '../src/matchers';
import type { RegistryEntry } from '../src/matchers';
import { countFallbacks, countViolations, run } from '../src/pipeline';
import type { Content, Golden, PipelineResult, Template } from '../src/schema';
import { scoreGolden } from './golden';
import type { GoldenScore } from './golden';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));
const NONE = '-';
const SUMMARY_COLUMNS = ['matcher', 'goldenMatch', 'errors', 'warns', 'p1Dropped', 'groupSplit', 'status (acc/deg/rej)', 'ms'];

type Pair = { key: string; template: Template; content: Content; golden: Golden | undefined };
// 쌍 하나를 matcher 하나로 실행한 결과. golden이 없는 쌍이면 goldenScore는 undefined.
type PairRun = { pair: Pair; result: PipelineResult; ms: number; goldenScore: GoldenScore | undefined };
// matcher 하나가 모든 쌍을 돈 결과. 실행하지 않는 matcher(D-4, D-17)는 runs가 null.
type MatcherRuns = { entry: RegistryEntry; runs: PairRun[] | null };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 로컬 시각 기준 YYYYMMDD-HHmm.
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

function buildPairs(templates: Template[], contents: Content[]): Pair[] {
  const goldens = new Map(loadAllGoldens().map((golden) => [goldenKey(golden.templateId, golden.contentId), golden]));
  return templates.flatMap((template) =>
    contents.map((content) => {
      const key = goldenKey(template.id, content.id);
      return { key, template, content, golden: goldens.get(key) };
    }),
  );
}

function runPair(entry: RegistryEntry, pair: Pair): PairRun {
  const started = performance.now();
  const result = run(pair.template, pair.content, entry.matcher);
  const ms = performance.now() - started;
  // D-7: 모양이 같은 카드끼리 통째로 바꾼 배치도 정답으로 센다(bench/golden.ts).
  const goldenScore =
    pair.golden === undefined ? undefined : scoreGolden(pair.template, pair.golden.assignment, result.assignment);
  return { pair, result, ms, goldenScore };
}

function groupSplitCount(result: PipelineResult): number {
  return result.violations.filter((v) => v.ruleId === 'groupSplit').length;
}

function p1DroppedCount(result: PipelineResult, content: Content): number {
  return result.dropped.filter((id) => content.items.find((item) => item.id === id)?.priority === 1).length;
}

// matcher별 표의 한 행: 전체 쌍에 걸친 합계와 평균. 실행하지 않은 matcher는 전부 "-".
function summaryRow({ entry, runs }: MatcherRuns): string[] {
  const name = entry.matcher.name;
  if (runs === null) return [name, ...SUMMARY_COLUMNS.slice(1).map(() => NONE)];

  let goldenSlots = 0;
  let goldenHits = 0;
  let errors = 0;
  let warns = 0;
  let p1Dropped = 0;
  let groupSplits = 0;
  let totalMs = 0;
  const status = { accepted: 0, degraded: 0, rejected: 0 };

  for (const { pair, result, ms, goldenScore } of runs) {
    const counts = countViolations(result.violations);
    status[result.status] += 1;
    errors += counts.errors;
    warns += counts.warns;
    p1Dropped += p1DroppedCount(result, pair.content);
    groupSplits += groupSplitCount(result);
    totalMs += ms;
    if (goldenScore !== undefined) {
      goldenSlots += goldenScore.total;
      goldenHits += goldenScore.hits;
    }
  }

  return [
    name,
    goldenSlots === 0 ? NONE : (goldenHits / goldenSlots).toFixed(2),
    String(errors),
    String(warns),
    String(p1Dropped),
    String(groupSplits),
    `${status.accepted}/${status.degraded}/${status.rejected}`,
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

function toTable(header: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
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
    '- ms: 쌍 하나를 한 번 실행한 시간의 평균',
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

  mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `${name}.md`);
  writeFileSync(path, report, 'utf8');
  console.log(report);
  console.log(`저장: ${path}`);
}

main();
