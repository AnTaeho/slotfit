// 모든 template × content × matcher를 실행해 matcher별 지표 표를 만든다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goldenKey, loadAllContents, loadAllGoldens, loadAllTemplates } from '../src/io/loader';
import { REGISTRY } from '../src/matchers';
import type { RegistryEntry } from '../src/matchers';
import { run } from '../src/pipeline';
import type { Content, Golden, Template } from '../src/schema';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));
const NONE = '-';
const COLUMNS = ['matcher', 'goldenMatch', 'errors', 'warns', 'p1Dropped', 'groupSplit', 'status (acc/deg/rej)', 'ms'];

type Pair = { template: Template; content: Content; golden: Golden | undefined };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 로컬 시각 기준 YYYYMMDD-HHmm.
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

function evaluate(entry: RegistryEntry, pairs: Pair[]): string[] {
  const name = entry.matcher.name;
  // 미구현 matcher는 실행하지 않고 전부 "-".
  if (!entry.implemented) return [name, ...COLUMNS.slice(1).map(() => NONE)];

  let goldenSlots = 0;
  let goldenHits = 0;
  let errors = 0;
  let warns = 0;
  let p1Dropped = 0;
  let totalMs = 0;
  const status = { accepted: 0, degraded: 0, rejected: 0 };

  for (const { template, content, golden } of pairs) {
    const started = performance.now();
    const result = run(template, content, entry.matcher);
    totalMs += performance.now() - started;

    status[result.status] += 1;
    errors += result.violations.filter((v) => v.severity === 'error').length;
    warns += result.violations.filter((v) => v.severity === 'warn').length;
    p1Dropped += result.dropped.filter((id) => content.items.find((i) => i.id === id)?.priority === 1).length;

    if (golden !== undefined) {
      // 가정: 정확 일치만 센다. TODO(Step 1): 그룹 순서 교환 허용 여부는 사용자 결정을 반영한다.
      const actual = new Map(result.assignment.map((a) => [a.slotId, a.contentId]));
      for (const expected of golden.assignment) {
        goldenSlots += 1;
        if (actual.get(expected.slotId) === expected.contentId) goldenHits += 1;
      }
    }
  }

  return [
    name,
    goldenSlots === 0 ? NONE : (goldenHits / goldenSlots).toFixed(2),
    String(errors),
    String(warns),
    String(p1Dropped),
    NONE, // TODO(Step 3): groupSplit 규칙이 생기면 그 위반 수를 센다.
    `${status.accepted}/${status.degraded}/${status.rejected}`,
    pairs.length === 0 ? NONE : (totalMs / pairs.length).toFixed(3),
  ];
}

function toTable(rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(COLUMNS), line(COLUMNS.map(() => '---')), ...rows.map(line)].join('\n');
}

function main(): void {
  const templates = loadAllTemplates();
  const contents = loadAllContents();
  const goldens = new Map(loadAllGoldens().map((g) => [goldenKey(g.templateId, g.contentId), g]));
  const pairs: Pair[] = templates.flatMap((template) =>
    contents.map((content) => ({ template, content, golden: goldens.get(goldenKey(template.id, content.id)) })),
  );
  const goldenPairs = pairs.filter((p) => p.golden !== undefined).length;

  const now = new Date();
  const name = stamp(now);
  const report = [
    `# bench ${name}`,
    '',
    `- 템플릿 ${templates.length} × 콘텐츠 ${contents.length} = ${pairs.length}쌍, golden ${goldenPairs}쌍`,
    '- goldenMatch: golden이 있는 쌍에서 정답과 정확히 일치하는 슬롯 비율',
    '- ms: 쌍 하나를 한 번 실행한 시간의 평균',
    '',
    toTable(REGISTRY.map((entry) => evaluate(entry, pairs))),
    '',
  ].join('\n');

  mkdirSync(RESULTS_DIR, { recursive: true });
  const path = join(RESULTS_DIR, `${name}.md`);
  writeFileSync(path, report, 'utf8');
  console.log(report);
  console.log(`저장: ${path}`);
}

main();
