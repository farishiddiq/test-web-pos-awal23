// Postgres (PGlite) berjalan di web worker supaya layar tetap responsif
import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { DEMO_USER } from './constants';

worker({
  async init(options) {
    const db = await PGlite.create({ dataDir: options.dataDir });
    // Mode demo selalu masuk sebagai pemilik "Dapur Ahmad"
    await db.exec(`set request.jwt.claim.sub = '${DEMO_USER.id}'`);
    return db;
  },
});
