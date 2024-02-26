import {
  createClient,
  SchemaFieldTypes,
  VectorAlgorithms,
} from 'redis';
import chalk from 'chalk';

import {
  SEMSE_REDIS_URL,
  SEMSE_DOCUMENT_INDEX,
  SEMSE_DOCUMENT_PREFIX,
  DIMENSIONS,
} from './constants.js';

let redis = null;

//------------------------------------------------------------------------------
export async function retrieve(queryVector, size = 2, from = 0) {
  const result = await redis.ft.search(
    SEMSE_DOCUMENT_INDEX,
    `*=>[KNN ${from + size} @embedding $queryVector AS vectorScore]`,
    {
      PARAMS: {
        queryVector,
      },
      SORTBY: 'vectorScore',
      DIALECT: 2,
      RETURN: ['title', 'body', 'date', 'vectorScore'],
      LIMIT: {
        from,
        size,
      },
    },
  );
  return result.documents;
}

//------------------------------------------------------------------------------
export async function getIndex(createIfNotExists = false) {
  try {
    return await redis.ft.info(SEMSE_DOCUMENT_INDEX);
  } catch (err) { /* fall through */ }

  if (!createIfNotExists) {
    return null;
  }

  await redis.ft.create(SEMSE_DOCUMENT_INDEX, {
    title: SchemaFieldTypes.TEXT,
    body: SchemaFieldTypes.TEXT,
    date: {
      type: SchemaFieldTypes.NUMERIC,
      SORTABLE: true,
    },
    embedding: {
      type: SchemaFieldTypes.VECTOR,
      ALGORITHM: VectorAlgorithms.FLAT,
      TYPE: 'FLOAT32',
      DIM: DIMENSIONS,
      DISTANCE_METRIC: 'COSINE',
    },
  }, {
    ON: 'HASH',
    INDEX_TYPE: 'HASH',
    PREFIX: `${SEMSE_DOCUMENT_PREFIX}:`,
  });

  return redis.ft.info(SEMSE_DOCUMENT_INDEX);
}

//------------------------------------------------------------------------------
export function createConfig() {
  const redisConfig = {
    url: SEMSE_REDIS_URL,
  };
  if (process.env.SEMSE_REDIS_USER) {
    redisConfig.user = process.env.SEMSE_REDIS_USER;
  }
  if (process.env.SEMSE_REDIS_PASSWORD) {
    redisConfig.password = process.env.SEMSE_REDIS_PASSWORD;
  }
  return redisConfig;
}

//------------------------------------------------------------------------------
export function initRedis(config = createConfig()) {
  return new Promise(async (resolve, reject) => {
    process.stdout.write(`Connecting ${chalk.cyan('redis')}... `);
    redis = await createClient(config);
    redis.on('error', (err) => {
      reject(err);
    });
    await redis.connect();
    console.log(chalk.green(`✓ Ok.`));
    resolve(redis);
  });
}

//------------------------------------------------------------------------------
export function ar2Float32Array(ar) {
  return Buffer.from(new Float32Array(ar).buffer);
}

//------------------------------------------------------------------------------
export function bufferToArrayOfFloats(buffer) {
  const array = [];
  for (let i = 0; i < buffer.length / 4; i++) {
    array.push(buffer.readFloatLE(i * 4));
  }
  return array;
}

//------------------------------------------------------------------------------
function getRedis() {
  return redis;
}

export default getRedis;
