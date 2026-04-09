#!/usr/bin/env node
// Daemon de synchronisation — polling git toutes les 5s
// Le redemarrage de l'agent au changement de fichier est gere par `node --watch`.
import { spawnSync } from 'node:child_process';

const POLL_INTERVAL_MS = 5000;

function git(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let syncing = false;

async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    const fetchRes = git(['fetch', 'origin', 'main', '--quiet']);
    if (fetchRes.status !== 0) return;

    const local = git(['rev-parse', 'HEAD']).stdout.trim();
    const remote = git(['rev-parse', 'origin/main']).stdout.trim();
    if (!remote || local === remote) return;

    const diff = git(['diff', '--name-only', 'HEAD', 'origin/main']).stdout.trim();
    if (!diff) return;

    const files = diff.split('\n').filter(Boolean);
    console.log(`[sync] ${files.length} changed file(s): ${files.join(', ')}`);
    for (const file of files) {
      git(['checkout', 'origin/main', '--', file]);
    }
  } catch (err) {
    console.warn('[sync] error:', err.message);
  } finally {
    syncing = false;
  }
}

async function loop() {
  await sync();
  setTimeout(loop, POLL_INTERVAL_MS);
}

console.log(`[sync] daemon started, polling every ${POLL_INTERVAL_MS}ms`);
loop();
