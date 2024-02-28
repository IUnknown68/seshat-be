import 'dotenv/config';
import { createServer } from 'node:http';
import express from 'express';
import bodyParser from 'body-parser';

import chalk from 'chalk';

import {
  SEMSE_HOSTNAME,
  SEMSE_PORT,
  SEMSE_DOCUMENT_PREFIX,
  MAX_POST_BODY_LENGTH,
  SEMSE_DOCUMENT_INDEX,
} from './src/constants.js';

import {
  initRedis,
  getIndex,
  retrieve,
} from './src/redis.js';

import {
  initOpenAi,
  createEmbedding,
} from './src/gpt.js';

main();

//------------------------------------------------------------------------------
async function main() {
  try {
    process.on('uncaughtException', (err) => {
      console.error(chalk.red('uncaughtException'));
      if (process.env.NODE_ENV !== 'development') {
        console.log(err.message);
      } else {
        console.log(err);
      }
    });

    const context = {};
    const cleanupBound = (signal) => cleanup(context, signal);

    process.on('SIGINT', cleanupBound);
    process.on('SIGTERM', cleanupBound);

    await initOpenAi();

    context.redis = await initRedis();
    await getIndex(SEMSE_DOCUMENT_INDEX, SEMSE_DOCUMENT_PREFIX, true);

    await initExpress(context);
    await initRouting(context);

    process.stdout.write(`Starting ${chalk.cyan('profile-ai')} to listen on ${chalk.whiteBright(SEMSE_HOSTNAME)}:${SEMSE_PORT}... `);
    await listen(context.server, SEMSE_HOSTNAME, SEMSE_PORT);
    console.log(chalk.green(`✓ Ok.`));

    console.log(chalk.greenBright(`Server up and running.`));
  } catch (err) {
    console.log(chalk.red(`✗ Failed.`));
    if (process.env.NODE_ENV !== 'development') {
      console.log(err.message);
    } else {
      console.log(err);
    }
    process.exit(1);
  }
}

//------------------------------------------------------------------------------
async function cleanup(context, signal = 'exit') {
  setTimeout(() => {
    console.log(chalk.yellowBright('Timeout, force exiting'));
    process.exit(0);
  }, 3000);
  console.log('');
  if (signal) {
    console.log(chalk.yellowBright(signal));
  }
  try {
    context.redis && await context.redis.quit();
    if (context.server) {
      context.server.close(() => {
        console.log(chalk.green('Done.'));
        process.exit(0);
      });
    } else {
      console.log(chalk.green('Done.'));
      process.exit(0);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(0);
  }
}

//------------------------------------------------------------------------------
async function initExpress(context) {
  process.stdout.write(`Creating ${chalk.cyan('express-app')}... `);
  context.app = express();
  context.server = createServer(context.app);

  context.app.enable('trust proxy');
  console.log(chalk.green(`✓ Ok.`));
}

//------------------------------------------------------------------------------
function initRouting(context) {
  const router = express.Router({ mergeParams: true });

  const jsonParser = bodyParser.json({
    limit: MAX_POST_BODY_LENGTH,
  });

  context.app.use(`/api`, router);

  router.post('/query', jsonParser, async (req, res) => {
    let status = 500;
    try {
      const {
        query,
        start = 0,
        count = 5,
      } = req.body;
      if (!query) {
        status = 400;
        throw new Error('Empty query');
      }
      const result = await queryDb(query, count, start);
      res.send(result.map((v) => ({
        ...v,
        id: v.id.slice(SEMSE_DOCUMENT_PREFIX.length + 1),
      })));
    } catch (err) {
      res.status(status).send({
        message: err.message,
        name: err.name,
      });
    }
  });

  context.app.use(errorHandler);
}

//------------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
async function errorHandler(err, req, res, next) {
  res.status(err.status || 400);
  const error = {
    status: err.status || 400,
    code: err.code || '',
    message: err.message,
  };
  res.send({ error });
  res.end();
}

//------------------------------------------------------------------------------
async function listen(server, hostname, port) {
  return new Promise((resolve, reject) => {
    server.listen(port, hostname, resolve).on('error', reject);
  });
}

//------------------------------------------------------------------------------
async function queryDb(text, size = 2, from = 0) {
  const embedding = await createEmbedding(text);
  const docs = await retrieve(SEMSE_DOCUMENT_INDEX, embedding, size, from);
  return docs.map((doc) => ({
    id: doc.id,
    ...doc.value,
    date: new Date(parseInt(doc.value.date, 10)),
  }));
}
