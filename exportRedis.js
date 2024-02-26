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
} from 'node:path';

import {
  ArgumentParser,
} from 'argparse';
import chalk from 'chalk';
import {
  commandOptions,
} from 'redis';

import {
  initRedis,
  bufferToArrayOfFloats,
} from './src/redis.js';

let redis = null;

//------------------------------------------------------------------------------
async function main() {
  const {
    out,
    force,
    keypattern,
  } = await parseArgs();

  await mkdir(out, { recursive: true });

  redis = await initRedis();
  const keys = await redis.keys(keypattern);
  if (!keys.length) {
    console.log(`No documents to export.`);
    return;
  }
  console.log(`Found ${chalk.whiteBright(keys.length)} documents, starting export.`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  for (const key of keys) {
    process.stdout.write(`${chalk.cyan(key)}... `);
    const filename = join(out, `${key.replace(/:/gi, '_')}.json`);
    if (existsSync(filename) && !force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++skipped;
      continue;
    }

    try {
      const value = await redis.hGetAll(key);
      const buffer = await redis.hGet(commandOptions({ returnBuffers: true }), key, 'embedding');
      value.embedding = bufferToArrayOfFloats(buffer);
      const content = {
        key,
        value,
      };
      await writeFile(filename, JSON.stringify(content));
      process.stdout.write(`${chalk.green('Ok')}\n`);
      ++succeeded;
    } catch (err) {
      process.stdout.write(`${chalk.red('Failed:')} ${err.message}\n`);
      ++failed;
    }
  }

  process.stdout.write(`${chalk.whiteBright('Finished')}: ${chalk.greenBright(succeeded)} documents exported`);
  if (failed > 0) {
    process.stdout.write(`, ${chalk.redBright(failed)} failed`);
  }
  if (skipped > 0) {
    process.stdout.write(`, ${chalk.yellowBright(skipped)} skipped`);
  }
  process.stdout.write(`.\n`);
}

//------------------------------------------------------------------------------
async function parseArgs() {
  const { version, description } = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
  const parser = new ArgumentParser({
    description,
  });

  parser.add_argument('-v', '--version', {
    action: 'version',
    version,
  });

  parser.add_argument('-o', '--out', {
    help: 'The folder where to export the documents to.',
    required: true,
  });

  parser.add_argument('-f', '--force', {
    help: 'Overwrite existing files.',
    action: 'store_true',
  });

  parser.add_argument('keypattern', {
    help: 'Pattern of keys to export. Usually something like documents:*',
  });

  const parsed = parser.parse_args();
  return parsed;
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
main().catch(err => {
  console.error(err);
}).finally(async () => {
  redis && await redis.quit();
});
