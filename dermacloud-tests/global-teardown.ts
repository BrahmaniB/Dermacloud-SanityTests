import { execSync } from 'child_process';
import path from 'path';

async function globalTeardown() {
  // Wipe the test database after all tests finish — double-ensures no leftover data
  execSync('npx tsx scripts/seed-test-db.ts', {
    cwd: path.join(__dirname, '..', 'DermaCloud'),
    env: { ...process.env, MONGODB_URI: 'mongodb://localhost:27017/dermacloud-test' },
    stdio: 'inherit',
  });
}

export default globalTeardown;
