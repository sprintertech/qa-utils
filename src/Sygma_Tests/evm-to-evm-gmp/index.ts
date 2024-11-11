import fs from 'fs';

export const sepoliaBaseStorageContract = JSON.parse(
  fs.readFileSync('src/ABIS/storage.json', 'utf8')
);
