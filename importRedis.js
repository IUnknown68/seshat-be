import 'dotenv/config';
import {
  readFile,
  readdir,
} from 'node:fs/promises';
import {
  join,
  resolve,
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

import validate from './src/validate-dataset.js';

let redis = null;

//------------------------------------------------------------------------------
async function main() {
  const {
    folder,
  } = await parseArgs();

  redis = await initRedis();
  await getIndex(true);

  const rootFolder = resolve(process.cwd(), folder);
  const context = {
    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  await processFolder(rootFolder, '.', context);

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
async function processFolder(rootFolder, relativePath, context) {
  const folderIn = join(rootFolder, relativePath);

  const files = await readdir(folderIn, { withFileTypes: true });
  for (const file of files) {
    const fileRelPath = join(relativePath, file.name);
    if (file.isDirectory()) {
      await processFolder(rootFolder, fileRelPath, context);
    } else {
      await processFile(rootFolder, fileRelPath, context);
/////////////////////////////////////
return;
/////////////////////////////////////
    }
  }
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
    console.log(parsed);
    await redis.hSet(key, parsed);
    ++context.succeeded;
    process.stdout.write(`${chalk.green('Ok')}.\n`);
  } catch (err) {
    ++context.failed;
    process.stdout.write(`${chalk.red('Failed:')} ${err.message}\n`);
  }
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
