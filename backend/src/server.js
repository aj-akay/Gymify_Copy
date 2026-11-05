import { createApp } from './app.js';

const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.');
}

const server = createApp().listen(port, () => {
  console.log(`GYMIFY API listening on http://localhost:${port}/api/v1`);
});

function stopServer() {
  server.close();
}

process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
