#!/usr/bin/env node
// Daemon de detection de changements distants — polling git toutes les 30s
// Notifie la plateforme Agenxia quand origin/main a diverge du HEAD local.
// Ne modifie AUCUN fichier local — le developpeur decide quand pull/rebase.
import { spawnSync } from 'node:child_process';

const POLL_INTERVAL_MS = 30_000;
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://agenxia.anteika.fr';
const SESSION_ID = process.env.SESSION_ID;
const AGENT_ID = process.env.AGENT_ID;

function git(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

let lastNotifiedRemote = '';

async function notify(title, message, type = 'info') {
  if (!SESSION_ID) return;
  try {
    await fetch(`${PLATFORM_URL}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': SESSION_ID,
      },
      body: JSON.stringify({
        type,
        title,
        message,
        agent_id: AGENT_ID,
      }),
    });
  } catch {
    // Plateforme injoignable — on tait l'erreur, on reessaie au prochain tick
  }
}

async function check() {
  try {
    const fetchRes = git(['fetch', 'origin', 'main', '--quiet']);
    if (fetchRes.status !== 0) return;

    const local = git(['rev-parse', 'HEAD']).stdout.trim();
    const remote = git(['rev-parse', 'origin/main']).stdout.trim();
    if (!remote || local === remote) return;

    // Deja notifie pour ce SHA distant — pas de spam
    if (remote === lastNotifiedRemote) return;
    lastNotifiedRemote = remote;

    const diff = git(['diff', '--name-only', 'HEAD', 'origin/main']).stdout.trim();
    if (!diff) return;

    const files = diff.split('\n').filter(Boolean);
    const short = remote.slice(0, 7);
    console.log(`[sync] ${files.length} remote change(s) detected (${short}): ${files.join(', ')}`);

    await notify(
      'Code mis à jour sur GitHub',
      `${files.length} fichier(s) modifié(s) sur origin/main (${short}):\n${files.join('\n')}\n\nFaites git pull pour récupérer les changements.`,
      'info',
    );
  } catch (err) {
    console.warn('[sync] error:', err.message);
  }
}

async function loop() {
  await check();
  setTimeout(loop, POLL_INTERVAL_MS);
}

console.log(`[sync] watcher started, polling every ${POLL_INTERVAL_MS / 1000}s`);
loop();
