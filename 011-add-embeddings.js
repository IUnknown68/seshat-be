import 'dotenv/config';
import {
  readFile,
  writeFile,
  readdir,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import chalk from 'chalk';

import {
  initOpenAi,
  createEmbedding,
} from './src/gpt.js';

import parseArgs from './src/parseArgs.js';

//---------------------------------------------------------------------------
async function main() {
  const {
    folder,
    force,
  } = await parseArgs(['folder', 'force'], {
    description: 'Add embeddings to datasets.',
  });

  await initOpenAi();
  const rootFolder = resolve(process.cwd(), folder);

  const rootFolderInOut = join(rootFolder, '010-json');

  const context = {
    force,
    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  await processFolder(rootFolderInOut, '.', context);

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
async function processFolder(rootFolderInOut, relativePath, context) {
  const folderInOut = join(rootFolderInOut, relativePath);

  const files = await readdir(folderInOut, { withFileTypes: true });
  for (const file of files) {
    const fileRelPath = join(relativePath, file.name);
    if (file.isDirectory()) {
      await processFolder(rootFolderInOut, fileRelPath, context);
    } else {
      await processFile(rootFolderInOut, fileRelPath, context);
      /////////////////////////////////////
      // return;
      /////////////////////////////////////
    }
  }
}

//------------------------------------------------------------------------------
async function processFile(rootFolderInOut, relativePath, context) {
  process.stdout.write(`${chalk.cyan(relativePath)}... `);
  try {
    const filePath = join(rootFolderInOut, relativePath);

    const dataset = JSON.parse(await readFile(filePath, 'utf8'));
    if (dataset.embedding && !context.force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++context.skipped;
      return;
    }
    dataset.embedding = await createEmbedding(`<h1>${dataset.title}</h1>\n${dataset.body}`, true);
    await writeFile(filePath, JSON.stringify(dataset, null, 2));

    process.stdout.write(`${chalk.whiteBright(relativePath)} ${chalk.green('Ok')}.\n`);
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
