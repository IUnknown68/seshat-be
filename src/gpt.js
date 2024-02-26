import OpenAI from 'openai';

import {
  EMBEDDING_MODEL,
  DIMENSIONS,
} from './constants.js';

import {
  ar2Float32Array,
} from './redis.js';

let openai = null;

//------------------------------------------------------------------------------
export async function createEmbedding(text, asArray = false) {
  const embedding = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: 'float',
    dimensions: DIMENSIONS,
  });
  return (asArray)
    ? embedding.data[0].embedding
    : ar2Float32Array(embedding.data[0].embedding);
}

//------------------------------------------------------------------------------
export function initOpenAi() {
  openai = new OpenAI();
  return openai;
}

//------------------------------------------------------------------------------
function getOpenAi() {
  return openai;
}

export default getOpenAi;

