import 'dotenv/config';
import {
  readFile,
  readdir,
} from 'node:fs/promises';
import {
  join,
} from 'node:path';

import {
  ArgumentParser,
} from 'argparse';
import chalk from 'chalk';

import {
  initRedis,
  getIndex,
  ar2Float32Array,
} from './src/redis.js';

let redis = null;

//------------------------------------------------------------------------------
async function main() {
  const {
    folder,
  } = await parseArgs();

  const files = await readdir(folder);
  redis = await initRedis();
  await getIndex(true);

  console.log(`Found ${chalk.cyan(files.length)} documents, starting import.`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    process.stdout.write(`${chalk.cyan(file)}... `);
    const filename = join(folder, file);
    try {
      const { key, value } = JSON.parse(await readFile(filename, 'utf8'));
      if (!key) {
        throw new Error('Empty key');
      }
      if (!value || (typeof value !== 'object')) {
        throw new Error('Invalid value');
      }
      value.embedding = ar2Float32Array(value.embedding);
      await redis.hSet(key, value);
      ++succeeded;
      process.stdout.write(`${chalk.green('Ok')}.\n`);
    } catch (err) {
      ++failed;
      process.stdout.write(`${chalk.red('Failed:')} ${err.message}\n`);
    }
  }

  process.stdout.write(`${chalk.whiteBright('Finished')}: ${chalk.greenBright(succeeded)} documents imported`);
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

  /*
  parser.add_argument('-f', '--force', {
    help: 'Overwrite existing documents.',
    action: 'store_true',
  });
  */

  parser.add_argument('folder', {
    help: 'The folder from where to import documents.',
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
