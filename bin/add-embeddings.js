#!/usr/bin/env node
import 'dotenv/config';
import {
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import {
  join,
  resolve,
  relative,
  dirname,
} from 'node:path';

import chalk from 'chalk';

import {
  initOpenAi,
  createEmbedding,
} from '../src/gpt.js';

import parseArgs from '../src/parseArgs.js';
import createWalker from '../src/createWalker.js';

//---------------------------------------------------------------------------
async function main() {
  const {
    folder,
    dest,
    force,
    simulate,
  } = await parseArgs(['folder', 'force', 'dest', 'simulate'], {
    description: 'Add embeddings to datasets. Sources are expected to be EITHER redis-datasets that can be imported (objects containing a "key" and a "value"), OR plain objects containing a "title" and a "body".',
  });

  await initOpenAi();

  // const rootFolder = resolve(process.cwd(), folder);
  const rootFolderIn = resolve(process.cwd(), folder);
  const rootFolderOut = resolve(process.cwd(), dest);

  const context = {
    force,
    simulate,

    rootFolderIn,
    rootFolderOut,

    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  const walker = createWalker(rootFolderIn, processFile, context);
  await walker();

  process.stdout.write(`${chalk.whiteBright('Finished')}: ${chalk.greenBright(context.succeeded)} documents embedded.`);
  if (context.failed > 0) {
    process.stdout.write(`, ${chalk.redBright(context.failed)} failed`);
  }
  if (context.skipped > 0) {
    process.stdout.write(`, ${chalk.yellowBright(context.skipped)} skipped`);
  }
  process.stdout.write(`.\n`);
}

//------------------------------------------------------------------------------
async function processFile(rootFolder, relativePath, context) {
  process.stdout.write(`${chalk.cyan(relativePath)}... `);
  try {
    const srcFile = join(context.rootFolderIn, relativePath);
    const dstFile = join(context.rootFolderOut, relativePath);
    await mkdir(dirname(dstFile), { recursive: true });

    const json = JSON.parse(await readFile(srcFile, 'utf8'));
    const dataset = (json.value)
      ? json.value
      : json;
    if (dataset.embedding && !context.force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++context.skipped;
      return;
    }

    if (context.simulate) {
      process.stdout.write(`${chalk.whiteBright(relative(context.rootFolderOut, dstFile))} ${chalk.yellowBright('Ok (simulated)')}.\n`);
    } else {
      dataset.embedding = await createEmbedding(`<h1>${dataset.title}</h1>\n${dataset.body}`, true);
      await writeFile(dstFile, JSON.stringify(json, null, 2));
      process.stdout.write(`${chalk.whiteBright(relativePath)} ${chalk.green('Ok')}.\n`);
    }

    ++context.succeeded;
  } catch (err) {
    ++context.failed;
    process.stdout.write(`${chalk.red('Failed:')} ${err.message}\n`);
  }
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
main().catch(err => {
  console.error(err);
}).finally(async () => {
});
