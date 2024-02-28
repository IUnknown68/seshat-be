#!/usr/bin/env node
import 'dotenv/config';
import {
  readFile,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import chalk from 'chalk';

import {
  initRedis,
  getIndex,
  ar2Float32Array,
} from '../src/redis.js';

import validate from '../src/validate-dataset.js';
import parseArgs from '../src/parseArgs.js';
import createWalker from '../src/createWalker.js';

let redis = null;

//------------------------------------------------------------------------------
async function main() {
  const {
    folder,
    simulate,
    prefix,
    index,
  } = await parseArgs(['folder', 'simulate', 'index', 'prefix'], {
    description: 'Import redis datasets.',
  });

  redis = await initRedis();
  await getIndex(index, prefix, !simulate);

  const rootFolderIn = resolve(process.cwd(), folder);

  const context = {
    simulate,
    index,

    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  const walker = createWalker(rootFolderIn, processFile, context);
  await walker();

  process.stdout.write(`${chalk.whiteBright('Finished')}: ${chalk.greenBright(context.succeeded)} documents imported.`);
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
  const fileAbs = join(rootFolder, relativePath);
  process.stdout.write(`${chalk.cyan(relativePath)}... `);
  try {
    const { key, value } = JSON.parse(await readFile(fileAbs, 'utf8'));
    if (!key) {
      throw new Error('Empty key');
    }

    const parsed = validate(value);
    parsed.date = parsed.date.getTime();
    parsed.embedding = ar2Float32Array(parsed.embedding);

    if (context.simulate) {
      process.stdout.write(`${chalk.whiteBright(key)} ${chalk.yellowBright('Ok (simulated)')}.\n`);
    } else {
      await redis.hSet(key, parsed);
      process.stdout.write(`${chalk.whiteBright(key)} ${chalk.green('Ok')}.\n`);
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
  redis && await redis.quit();
});
