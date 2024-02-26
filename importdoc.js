import {
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  join,
  basename,
} from 'node:path';

import chalk from 'chalk';

import {
  SEMSE_DOCUMENT_PREFIX,
} from './src/constants.js';

import {
  initRedis,
  retrieve,
  // getIndex,
} from './src/redis.js';
import {
  initOpenAi,
  createEmbedding,
} from './src/gpt.js';


let redis = null;

//------------------------------------------------------------------------------
async function main() {
  await initOpenAi();

  redis = await initRedis({
    url: 'redis://127.0.0.1:6379',
    password: 'konichiwa',
  });

  const docs = await query('KI und Bewusstsein', 5);
  console.log(docs);


  // await getIndex(true);
  // await importAllFiles('/home/hans/data-server/js.intern.seiberspace.de/heise-forum');
}

//------------------------------------------------------------------------------
async function query(text, count = 2) {
  const embedding = await createEmbedding(text);
  const docs = await retrieve(embedding, count);
  return docs.map((doc) => ({
    id: doc.id,
    ...doc.value,
    date: new Date(parseInt(doc.value.date, 10)),
  }));
}

//------------------------------------------------------------------------------
async function importAllFiles(path) {
  const files = await readdir(path);
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    await importFile(join(path, file));
  }
}

//------------------------------------------------------------------------------
async function importFile(path) {
  const id = basename(path, '.json');
  const dataset = JSON.parse(await readFile(path, 'utf8'));

  delete dataset.id;
  dataset.date = (new Date(dataset.date)).getTime();
  dataset.embedding = await createEmbedding(`<h1>${dataset.title}</h1>\n${dataset.body}`);

  const key = `${SEMSE_DOCUMENT_PREFIX}:heise:${id}`;
  await redis.hSet(key, dataset);
  console.log(`${chalk.cyan(id)} ${chalk.green('imported')}.`);
}

//------------------------------------------------------------------------------
async function shutdown(signal) {
  setTimeout(() => {
    console.log(chalk.yellowBright('Timeout, force exiting'));
    process.exit(0);
  }, 3000);
  console.log('');
  if (signal) {
    console.log(chalk.yellowBright(signal));
  }
  redis && await redis.disconnect();
  console.log(chalk.green('Done.'));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
main().then(() => shutdown()).catch(err => {
  console.error(err);
  shutdown();
});
