#!/usr/bin/env node
import 'dotenv/config';
import {
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import {
  existsSync,
} from 'node:fs';
import {
  join,
  resolve,
  dirname,
  relative,
} from 'node:path';
import { randomUUID } from 'node:crypto';

import chalk from 'chalk';

import validate from '../src/validate-dataset.js';
import parseArgs from '../src/parseArgs.js';
import createWalker from '../src/createWalker.js';

//---------------------------------------------------------------------------
async function main() {
  const {
    folder,
    dest,
    force,
    simulate,
    prefix,
    flatten,
  } = await parseArgs(['folder', 'dest', 'force', 'simulate', 'prefix', 'flatten'], {
    description: 'Turn json files into redis datasets. Creates a json with {key, value}. Creates a new key. Expects json to be a valid dataset (title, body, date).',
  });

  const rootFolderIn = resolve(process.cwd(), folder);
  const rootFolderOut = resolve(process.cwd(), dest);

  const context = {
    force,
    flatten,
    simulate,
    prefix: prefix.endsWith(':') ? prefix.slice(0, -1) : prefix,

    rootFolderIn,
    rootFolderOut,

    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  const walker = createWalker(rootFolderIn, processFile, context);
  await walker();

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
async function processFile(rootFolder, relativePath, context) {
  process.stdout.write(`${chalk.cyan(relativePath)}... `);
  try {
    const fileIn = join(context.rootFolderIn, relativePath);
    const value = validate(JSON.parse(await readFile(fileIn, 'utf8')));
    const key = `${context.prefix}:${randomUUID()}`;

    const fileOut = (context.flatten)
      ? join(context.rootFolderOut, `${key.replace(/:/gi, '_')}.json`)
      : join(context.rootFolderOut, relativePath);

    await mkdir(dirname(fileOut), { recursive: true });

    if (existsSync(fileOut) && !context.force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++context.skipped;
      return;
    }

    if (context.simulate) {
      process.stdout.write(`${chalk.cyanBright(key)} ${chalk.whiteBright(fileOut)} ${chalk.yellowBright('Ok (simulated)')}.\n`);
    } else {
      await writeFile(fileOut, JSON.stringify({
        key,
        value,
      }, null, 2));
      process.stdout.write(`${chalk.whiteBright(relative(context.rootFolderOut, fileOut))} ${chalk.green('Ok')}.\n`);
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
