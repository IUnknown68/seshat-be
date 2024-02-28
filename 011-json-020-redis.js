import 'dotenv/config';
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
} from 'node:fs/promises';
import {
  existsSync,
} from 'node:fs';
import {
  join,
  resolve,
} from 'node:path';
import { randomUUID } from 'node:crypto';

import chalk from 'chalk';

import validate from './src/validate-dataset.js';
import parseArgs from './src/parseArgs.js';

//---------------------------------------------------------------------------
async function main() {
  const {
    folder,
    prefix,
    force,
  } = await parseArgs(['folder', 'prefix', 'force'], {
    description: 'Parse text files into datasets.',
  });

  const rootFolder = resolve(process.cwd(), folder);

  const rootFolderIn = join(rootFolder, '010-json');
  const rootFolderOut = join(rootFolder, '020-redis');

  const context = {
    force,
    prefix: prefix.endsWith(':') ? prefix.slice(0, -1) : prefix,
    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  await processFolder(rootFolderIn, rootFolderOut, '.', context);

  process.stdout.write(`${chalk.whiteBright('Finished')}: ${chalk.greenBright(context.succeeded)} documents converted.`);
  if (context.failed > 0) {
    process.stdout.write(`, ${chalk.redBright(context.failed)} failed`);
  }
  if (context.skipped > 0) {
    process.stdout.write(`, ${chalk.yellowBright(context.skipped)} skipped`);
  }
  process.stdout.write(`.\n`);
}

//------------------------------------------------------------------------------
async function processFolder(rootFolderIn, rootFolderOut, relativePath, context) {
  const folderIn = join(rootFolderIn, relativePath);
  const folderOut = join(rootFolderOut, relativePath);

  await mkdir(folderOut, { recursive: true });

  const files = await readdir(folderIn, { withFileTypes: true });
  for (const file of files) {
    const fileRelPath = join(relativePath, file.name);
    if (file.isDirectory()) {
      await processFolder(rootFolderIn, rootFolderOut, fileRelPath, context);
    } else {
      await processFile(rootFolderIn, rootFolderOut, fileRelPath, context);
      /////////////////////////////////////
      // return;
      /////////////////////////////////////
    }
  }
}

//------------------------------------------------------------------------------
async function processFile(rootFolderIn, rootFolderOut, relativePath, context) {
  process.stdout.write(`${chalk.cyan(relativePath)}... `);
  try {
    const fileIn = join(rootFolderIn, relativePath);
    const fileOut = join(rootFolderOut, relativePath);

    if (existsSync(fileOut) && !context.force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++context.skipped;
      return;
    }

    const value = validate(JSON.parse(await readFile(fileIn, 'utf8')));
    const key = `${context.prefix}:${randomUUID()}`;
    await writeFile(fileOut, JSON.stringify({
      key,
      value,
    }, null, 2));

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
