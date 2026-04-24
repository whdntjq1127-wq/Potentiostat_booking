import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const buildIdPath = join(repoRoot, '.next', 'BUILD_ID');

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate a local port.'));
          return;
        }

        resolvePort(address.port);
      });
    });
  });
}

function toDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function createLegacySnapshot() {
  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 3);

  return {
    bookings: [
      {
        id: 'legacy-bk-001',
        applicant: 'Legacy User',
        channel: 'CH 3',
        startAt: toDateTimeLocal(start),
        endAt: toDateTimeLocal(end),
        purpose: 'Recovered from old local storage',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ],
    blockedDates: [],
    notices: [],
    settings: {
      bookingWindowDays: 5,
      maxDurationDays: 5,
    },
    changeLogs: [
      {
        id: 'legacy-log-001',
        actor: 'Legacy User',
        action: 'booking_created',
        summary: 'Legacy CH 3 booking',
        createdAt: new Date().toISOString(),
        bookingId: 'legacy-bk-001',
        expiresAt: new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function startNextServer({ port, storeFile }) {
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      RESERVATION_STORE_FILE: storeFile,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];

  child.stdout.on('data', (chunk) => {
    logs.push(chunk.toString());
  });
  child.stderr.on('data', (chunk) => {
    logs.push(chunk.toString());
  });

  return { child, logs };
}

async function stopNextServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill();

  await Promise.race([
    new Promise((resolveExit) => {
      child.once('exit', resolveExit);
    }),
    sleep(5000).then(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }),
  ]);
}

async function waitForServer(baseUrl, server) {
  const startedAt = Date.now();
  const timeoutMs = 30000;

  while (Date.now() - startedAt < timeoutMs) {
    if (server.child.exitCode !== null || server.child.signalCode !== null) {
      throw new Error(
        `Next server exited before it became ready.\n${server.logs.join('')}`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/reservations`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still booting.
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for Next server.\n${server.logs.join('')}`);
}

async function readSnapshot(baseUrl) {
  const response = await fetch(`${baseUrl}/api/reservations`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to read reservations: ${JSON.stringify(data)}`);
  }

  return data;
}

async function recoverLegacySnapshot(baseUrl, snapshot) {
  const response = await fetch(`${baseUrl}/api/reservations/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'recoverLegacySnapshot',
      payload: { snapshot },
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(`Failed to recover legacy snapshot: ${JSON.stringify(data)}`);
  }

  return data;
}

async function run() {
  await access(buildIdPath).catch(() => {
    throw new Error(
      'Production build not found. Run `corepack pnpm build` before this check.',
    );
  });

  const tempDir = await mkdtemp(join(tmpdir(), 'potentiostat-legacy-recovery-'));
  const storeFile = join(tempDir, 'reservations.json');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const legacySnapshot = createLegacySnapshot();
  let failed = false;
  let server;

  try {
    server = startNextServer({ port, storeFile });
    await waitForServer(baseUrl, server);
    await recoverLegacySnapshot(baseUrl, legacySnapshot);
    const snapshot = await readSnapshot(baseUrl);

    const recoveredBooking = snapshot.bookings.find(
      (booking) => booking.id === 'legacy-bk-001',
    );

    if (!recoveredBooking) {
      throw new Error('Legacy booking was not restored into the server snapshot.');
    }

    console.log(
      `Legacy recovery verification passed: ${recoveredBooking.applicant}, ${recoveredBooking.channel}, ${recoveredBooking.startAt} - ${recoveredBooking.endAt}`,
    );
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (server) {
      await stopNextServer(server.child);
    }

    if (!failed) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
