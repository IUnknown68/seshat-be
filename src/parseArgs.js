import 'dotenv/config';
import {
  readFile,
} from 'node:fs/promises';

import {
  ArgumentParser,
} from 'argparse';

const knownArgs = {
  folder: [
    'folder',
    {
      help: 'The folder from where to import documents.',
    },
  ],
  force: [
    '-f',
    '--force',
    {
      help: 'Overwrite existing documents.',
      action: 'store_true',
    },
  ],
  prefix: [
    '-p',
    '--prefix',
    {
      help: 'Key prefix, required.',
      required: true,
    },
  ],
  index: [
    '-i',
    '--index',
    {
      help: 'Index name, required.',
      required: true,
    },
  ],
  simulate: [
    '-s',
    '--simulate',
    {
      help: `Simulate, don't actually do anything.`,
      action: 'store_true',
    },
  ],
};

//------------------------------------------------------------------------------
async function parseArgs(args, options = {}) {
  const { version, description } = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  const parser = new ArgumentParser({
    description,
    ...options,
  });

  parser.add_argument('-v', '--version', {
    action: 'version',
    version,
  });

  for (const argName of args) {
    const arg = knownArgs[argName];
    if (!arg) {
      throw new Error(`Unknown arg: ${argName}.`);
    }
    parser.add_argument(...arg);
  }

  return parser.parse_args();
}

export default parseArgs;
