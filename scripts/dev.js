import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['--env-file-if-exists=backend/.env', 'backend/src/server.js'], {
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], {
    stdio: 'inherit',
  }),
];

let stopping = false;
let exitCode = 0;
let closedChildren = 0;

function stop(signal, code) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill(signal);
  }
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start a development server:', error);
    stop('SIGTERM', 1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop('SIGTERM', code || 1);
    if (code && code !== 0) exitCode = code;
  });
  child.on('close', () => {
    closedChildren += 1;
    if (closedChildren === children.length) process.exitCode = exitCode;
  });
}

process.on('SIGINT', () => stop('SIGINT', 130));
process.on('SIGTERM', () => stop('SIGTERM', 143));
