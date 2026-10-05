// 모든 template × content × matcher를 실행해 matcher별 지표 표를 만든다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goldenKey, loadAllContents, loadAllGoldens, loadAllTemplates } from '../src/io/loader';
import { scoreGolden } from './golden';
import { REGISTRY } from '../src/matchers';
import type { RegistryEntry } from '../src/matchers';
import { run } from '../src/pipeline';
import type { Content, Golden, PipelineResult, Template } from '../src/schema';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));
const NONE = '-';
const COLUMNS = ['matcher', 'goldenMatch', 'errors', 'warns', 'p1Dropped', 'groupSplit', 'status (acc/deg/rej)', 'ms'];

type Pair = { template: Template; content: Content; golden: Golden | undefined };
// 쌍 하나의 한 줄 요약(쌍별 표용). 키 = goldenKey.
type PairCell = Map<string, string>;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 로컬 시각 기준 YYYYMMDD-HHmm.
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

function errorCount(r: PipelineResult): number {
  return r.violations.filter((v) => v.severity === 'error').length;
}

function groupSplitCount(r: PipelineResult): number {
  return r.violations.filter((v) => v.ruleId === 'groupSplit').length;
}

// fallback 적용 횟수 = trace의 'fallback#' 줄 수(pipeline이 단계를 적용할 때마다 한 줄 남긴다).
function fallbackCount(r: PipelineResult): number {
  return r.trace.filter((line) => line.startsWith('fallback#')).length;
}

// 쌍별 표의 칸: status 앞 세 글자 + error/warn/dropped/groupSplit 수 + fallback 횟수. 예: "rej e1 w0 d2 s0 f1"
function cell(r: PipelineResult): string {
  const e = errorCount(r);
  return `${r.status.slice(0, 3)} e${e} w${r.violations.length - e} d${r.dropped.length} s${groupSplitCount(r)} f${fallbackCount(r)}`;
}

function evaluate(entry: RegistryEntry, pairs: Pair[], cells: PairCell): string[] {
  const name = entry.matcher.name;
  // 미구현 matcher와 oracle 전용 matcher(D-17)는 실행하지 않고 전부 "-".
  if (!entry.implemented || entry.oracleOnly === true) return [name, ...COLUMNS.slice(1).map(() => NONE)];

  let goldenSlots = 0;
  let goldenHits = 0;
  let errors = 0;
  let warns = 0;
  let p1Dropped = 0;
  let groupSplits = 0;
  let totalMs = 0;
  const status = { accepted: 0, degraded: 0, rejected: 0 };

  for (const { template, content, golden } of pairs) {
    const started = performance.now();
    const result = run(template, content, entry.matcher);
    totalMs += performance.now() - started;

    status[result.status] += 1;
    cells.set(goldenKey(template.id, content.id), cell(result));
    errors += errorCount(result);
    warns += result.violations.filter((v) => v.severity === 'warn').length;
    groupSplits += groupSplitCount(result);
    p1Dropped += result.dropped.filter((id) => content.items.find((i) => i.id === id)?.priority === 1).length;

    if (golden !== undefined) {
      // D-7: 모양이 같은 카드끼리 통째로 바꾼 배치도 정답으로 센다(bench/golden.ts).
      const score = scoreGolden(template, golden.assignment, result.assignment);
      goldenSlots += score.total;
      goldenHits += score.hits;
      cells.set(`${goldenKey(template.id, content.id)}#golden`, `${score.hits}/${score.total}`);
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
    pairs.length === 0 ? NONE : (totalMs / pairs.length).toFixed(3),
  ];
}

function toTable(header: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

// 쌍 × matcher 표. golden이 있는 쌍은 맞은 슬롯 수를 함께 적는다.
function pairTable(pairs: Pair[], entries: RegistryEntry[], cells: Map<string, PairCell>): string {
  const header = ['template × content', ...entries.map((e) => e.matcher.name)];
  const rows = pairs.map((p) => {
    const key = goldenKey(p.template.id, p.content.id);
    const label = p.golden === undefined ? key : `${key} ★`;
    return [
      label,
      ...entries.map((e) => {
        const c = cells.get(e.matcher.name);
        const summary = c?.get(key);
        if (summary === undefined) return NONE;
        const g = c?.get(`${key}#golden`);
        return g === undefined ? summary : `${summary} g${g}`;
      }),
    ];
  });
  return toTable(header, rows);
}

function main(): void {
  const templates = loadAllTemplates();
  const contents = loadAllContents();
  const goldens = new Map(loadAllGoldens().map((g) => [goldenKey(g.templateId, g.contentId), g]));
  const pairs: Pair[] = templates.flatMap((template) =>
    contents.map((content) => ({ template, content, golden: goldens.get(goldenKey(template.id, content.id)) })),
  );
  const goldenPairs = pairs.filter((p) => p.golden !== undefined).length;

  const cells = new Map<string, PairCell>(REGISTRY.map((e) => [e.matcher.name, new Map()]));
  const summary = REGISTRY.map((entry) => evaluate(entry, pairs, cells.get(entry.matcher.name) ?? new Map()));

  const now = new Date();
  const name = stamp(now);
  const report = [
    `# bench ${name}`,
    '',
    `- 템플릿 ${templates.length} × 콘텐츠 ${contents.length} = ${pairs.length}쌍, golden ${goldenPairs}쌍`,
    '- goldenMatch: golden이 있는 쌍에서 정답과 일치하는 슬롯 비율. 모양이 같은 카드끼리 통째로 바꾼 배치도 정답(D-7)',
    '- errors / warns / p1Dropped / groupSplit: 전체 쌍의 합. 미구현 지표는 "-"',
    '- status는 fallback(shrinkFont → dropLowPriority) 이후 기준(D-22). dropped에는 fallback이 버린 항목도 들어간다',
    '- ms: 쌍 하나를 한 번 실행한 시간의 평균',
    '- bruteForce는 oracle 전용(tests/oracle.test.ts에서만 실행)이라 "-"로 둔다(D-17)',
    '',
    toTable(COLUMNS, summary),
    '',
    '## 쌍별 결과',
    '',
    '- 칸: status(acc/deg/rej) e=error 수 w=warn 수 d=dropped 수 s=groupSplit 수 f=fallback 적용 횟수, g=golden 맞은 슬롯/전체. ★ = golden 있는 쌍',
    '',
    pairTable(pairs, REGISTRY.filter((e) => e.implemented && e.oracleOnly !== true), cells),
    '',
  ].join('\n');

  mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `${name}.md`);
  writeFileSync(path, report, 'utf8');
  console.log(report);
  console.log(`저장: ${path}`);
}

main();
