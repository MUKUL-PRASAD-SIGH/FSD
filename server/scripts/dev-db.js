// Zero-install local MongoDB for development: `npm run db`.
// Starts a real mongod on 127.0.0.1:27017 with data persisted in ../.data/mongo (git-ignored).
// Use a managed MongoDB (Atlas) or docker-compose for anything beyond local development.
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const dbPath = path.join(__dirname, '..', '..', '.data', 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  const mongod = await MongoMemoryServer.create({
    instance: { port: Number(process.env.MONGO_PORT || 27017), ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
  console.log(`MongoDB ready: ${mongod.getUri()}hackelite_db  (data: ${dbPath})`);
  const stop = async () => { await mongod.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error('Could not start MongoDB:', e.message); process.exit(1); });
