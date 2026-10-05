// CLI: pnpm render:all [matcher...] → 모든 template × content 쌍을 out/<t>__<c>__<m>.svg로 그린다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from '../src/context';
import { loadAllContents, loadAllTemplates } from '../src/io/loader';
import { REGISTRY } from '../src/matchers';
import { run } from '../src/pipeline';
import { renderSvg } from '../src/render/svg';

const OUT_DIR = fileURLToPath(new URL('../out/', import.meta.url));

function main(): void {
  // 인자가 없으면 구현된 matcher 전부.
  const wanted = process.argv.slice(2);
  const entries = REGISTRY.filter(
    (e) => e.implemented && (wanted.length === 0 || wanted.includes(e.matcher.name)),
  );
  mkdirSync(OUT_DIR, { recursive: true });

  for (const template of loadAllTemplates()) {
    for (const content of loadAllContents()) {
      for (const { matcher } of entries) {
        const result = run(template, content, matcher);
        const path = join(OUT_DIR, `${template.id}__${content.id}__${matcher.name}.svg`);
        writeFileSync(path, renderSvg(buildContext(template, content), result), 'utf8');
        console.log(`${result.status.padEnd(8)} ${path}`);
      }
    }
  }
}

main();
