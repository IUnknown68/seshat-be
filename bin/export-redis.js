#!/usr/bin/env node
import 'dotenv/config';
import {
  writeFile,
  mkdir,
} from 'node:fs/promises';
import {
  existsSync,
} from 'node:fs';
import {
  join,
} from 'node:path';

import chalk from 'chalk';
import {
  commandOptions,
} from 'redis';

import {
  initRedis,
  bufferToArrayOfFloats,
} from '../src/redis.js';

import parseArgs from '../src/parseArgs.js';

let redis = null;

//------------------------------------------------------------------------------
async function main() {
  const {
    dest,
    force,
    prefix,
  } = await parseArgs(['dest', 'force', 'prefix']);

  await mkdir(dest, { recursive: true });

  redis = await initRedis();
  const keys = await redis.keys(prefix);
  if (!keys.length) {
    console.log(`No documents to export.`);
    return;
  }
  console.log(`Found ${chalk.whiteBright(keys.length)} documents, starting export.`);

  const context = {
    dest,

    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  for (const key of keys) {
    process.stdout.write(`${chalk.cyan(key)}... `);
    const filename = join(dest, `${key.replace(/:/gi, '_')}.json`);
    if (existsSync(filename) && !force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++context.skipped;
      continue;
    }

    try {
      const value = await redis.hGetAll(key);
      if (typeof value.embedding !== 'undefined') {
        const buffer = await redis.hGet(commandOptions({ returnBuffers: true }), key, 'embedding');
        value.embedding = bufferToArrayOfFloats(buffer);
      }
      const content = {
        key,
        value,
      };
      await writeFile(filename, JSON.stringify(content));
      process.stdout.write(`${chalk.green('Ok')}\n`);
      ++context.succeeded;
    } catch (err) {
      process.stdout.write(`${chalk.red('Failed:')} ${err.message}\n`);
      ++context.failed;
    }
  }

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
//------------------------------------------------------------------------------
main().catch(err => {
  console.error(err);
}).finally(async () => {
  redis && await redis.quit();
});
