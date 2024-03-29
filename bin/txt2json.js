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
  extname,
  basename,
  dirname,
  relative,
} from 'node:path';

import chalk from 'chalk';

import {
  initOpenAi,
} from '../src/gpt.js';

import parseArgs from '../src/parseArgs.js';
import createWalker from '../src/createWalker.js';

const PROMPT = `Below is an article. Parse the article into a json object containing:

1) REQUIRED! A title. Find a title in the article, or generate one based on the article.
2) A date, if you can find anything looking like a date in the article. Can be empty Output as ISO 8601.

Here is an example:

{
  "title": "Meaningful title",
  "date": "2024-02-28T08:57:26.009Z"
}

Return ONLY the json, nothing else, no explanations!

Here is the article:`;

//---------------------------------------------------------------------------
async function main() {
  const {
    folder,
    dest,
    force,
    simulate,
  } = await parseArgs(['folder', 'dest', 'force', 'simulate'], {
    description: 'Parse text files into datasets.',
  });

  const openai = await initOpenAi();

  const rootFolderIn = resolve(process.cwd(), folder);
  const rootFolderOut = resolve(process.cwd(), dest);

  const context = {
    force,
    simulate,

    rootFolderIn,
    rootFolderOut,

    openai,

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
    const newBasename = `${basename(relativePath, extname(relativePath))}.json`;
    const dstRelpath = join(dirname(relativePath), newBasename);
    const dstFile = join(context.rootFolderOut, dstRelpath);
    await mkdir(dirname(dstFile), { recursive: true });

    if (existsSync(dstFile) && !context.force) {
      process.stdout.write(`${chalk.yellowBright('Exists')}, skipping.\n`);
      ++context.skipped;
      return;
    }

    const text = await readFile(join(context.rootFolderIn, relativePath), 'utf8');
    if (context.simulate) {
      process.stdout.write(`${chalk.whiteBright(relative(context.rootFolderOut, dstFile))} ${chalk.yellowBright('Ok (simulated)')}.\n`);
    } else {
      const json = await txt2json(text, context);
      await writeFile(dstFile, JSON.stringify(json, null, 2));
      process.stdout.write(`${chalk.whiteBright(dstRelpath)} ${chalk.green('Ok')}.\n`);
    }

    ++context.succeeded;
  } catch (err) {
    ++context.failed;
    process.stdout.write(`${chalk.red('Failed:')} ${err.message}\n`);
  }
}

//------------------------------------------------------------------------------
async function txt2json(text, context) {
  const chatCompletion = await context.openai.chat.completions.create({
    model: 'gpt-3.5-turbo-0125',
    messages: [{
      role: 'user',
      content: `${PROMPT}\n\n${text}`,
    }],
  });

  const result = chatCompletion.choices[0].message.content;
  const parsed = JSON.parse(result);
  if (parsed.date) {
    parsed.date = new Date(parsed.date);
  } else {
    parsed.date = new Date();
  }

  return {
    ...parsed,
    body: text,
  };
}

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
main().catch(err => {
  console.error(err);
}).finally(async () => {
});
