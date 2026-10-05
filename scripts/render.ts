// CLI: pnpm render <templateId> <contentId> <matcher> → out/<t>__<c>__<m>.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from '../src/context';
import { loadContent, loadTemplate } from '../src/io/loader';
import { findMatcher, matcherNames } from '../src/matchers';
import { run } from '../src/pipeline';
import { renderSvg } from '../src/render/svg';

const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url));

function main(): void {
  const [templateId, contentId, matcherName] = process.argv.slice(2);
  if (templateId === undefined || contentId === undefined || matcherName === undefined) {
    console.error('사용법: pnpm render <templateId> <contentId> <matcher>');
    process.exit(1);
  }
  const entry = findMatcher(matcherName);
  if (entry === undefined) {
    console.error(`모르는 matcher: ${matcherName} (가능: ${matcherNames().join(', ')})`);
    process.exit(1);
  }
  if (!entry.implemented) {
    console.error(`아직 구현되지 않은 matcher: ${matcherName}`);
    process.exit(1);
  }

  const template = loadTemplate(templateId);
  const content = loadContent(contentId);
  const result = run(template, content, entry.matcher);
  const svg = renderSvg(buildContext(template, content), result);

  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, `${templateId}__${contentId}__${matcherName}.svg`);
  writeFileSync(path, svg, 'utf8');

  console.log(path);
  console.log(`status: ${result.status}`);
  for (const v of result.violations) {
    console.log(`  [${v.severity}] ${v.ruleId} ${v.slotId ?? '-'} ← ${v.contentId ?? '-'}: ${v.detail}`);
  }
}

main();
