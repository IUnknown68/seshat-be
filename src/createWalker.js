import {
  readdir,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

//------------------------------------------------------------------------------
function createWalker(rootFolder, processFile, context = {}) {
  async function runFolder(relativePath) {
    const folderPath = join(rootFolder, relativePath);
    const files = await readdir(folderPath, { withFileTypes: true });
    for (const file of files) {
      const relPath = join(relativePath, file.name);
      if (file.isDirectory()) {
        await runFolder(relPath);
      } else {
        await processFile(rootFolder, relPath, context);
        /////////////////////////////////////
        // return;
        /////////////////////////////////////
      }
    }
  }

  return () => runFolder('.');
}

export default createWalker;
