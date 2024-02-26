import 'dotenv/config';

export const SEMSE_REDIS_URL = process.env.SEMSE_REDIS_URL
  || 'redis://127.0.0.1:6379';

export const SEMSE_DOCUMENT_PREFIX = process.env.SEMSE_DOCUMENT_PREFIX
  || 'documents';

export const SEMSE_DOCUMENT_INDEX = process.env.SEMSE_DOCUMENT_INDEX
  || 'idx:documents';

export const SEMSE_HOSTNAME = process.env.SEMSE_HOSTNAME
  || '127.0.0.1';

export const SEMSE_PORT = process.env.SEMSE_PORT
  || 80;

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const DIMENSIONS = 512;
export const MAX_POST_BODY_LENGTH = 3000; // bytes
