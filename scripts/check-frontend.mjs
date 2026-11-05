import { createRequire } from 'node:module';
import { writeFile, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');

// Bundle actual components for server rendering, with the integration flags off.
// This avoids adding a test framework or changing production configuration.
const entry = `
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './src/contexts/AuthContext.jsx';
import MemberGate from './src/components/MemberGate.jsx';
import AuthPage from './src/pages/AuthPage.jsx';
import InquiryForm from './src/components/InquiryForm.jsx';
import * as api from './src/services/memberApi.js';

assert.equal(api.safeReturnPath('//evil.example'), '/saved');
assert.equal(api.safeReturnPath('https://evil.example'), '/saved');
assert.equal(api.safeReturnPath('/compare'), '/compare');
assert.equal(api.safeReturnPath('/gyms/forge-fitness'), '/gyms/forge-fitness');
assert.equal(api.safeReturnPath('/login'), '/saved');
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.method, 'PUT');
    assert.equal(options.body, JSON.stringify({ example: true }));
    return new Response(JSON.stringify({ data: { accepted: true } }), { status: 200 });
  };
  assert.deepEqual(await api.memberRequest('/test', { method: 'PUT', body: { example: true } }), { accepted: true });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Not authorized' } }), { status: 401 });
  await assert.rejects(api.memberRequest('/test'), /Not authorized/);
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  await assert.rejects(api.memberRequest('/test'), /Unexpected response/);
} finally { globalThis.fetch = originalFetch; }
const wrap = child => renderToString(React.createElement(AuthProvider, null, React.createElement(MemoryRouter, null, child)));
const gate = wrap(React.createElement(MemberGate, null, React.createElement('div', null, 'PRIVATE_COMPARISON_CONTENT')));
assert(!gate.includes('PRIVATE_COMPARISON_CONTENT'));
assert(gate.includes('/login?next='));
for (const mode of ['login','signup','recovery']) {
  const auth = wrap(React.createElement(AuthPage, { mode }));
  assert(auth.includes('disabled'));
  assert(auth.includes('credentials will not be sent'));
}
const inquiry = renderToString(React.createElement(InquiryForm));
assert(inquiry.includes('Check form (preview)'));
assert(inquiry.includes('nothing will be sent'));
assert(inquiry.includes('type="email"'));
assert(inquiry.includes('name="consent"'));
console.log('Frontend checks passed: safe return links, credentialed transport, API errors, guest gate, and unconnected form states.');
`;
const filename = path.resolve('scripts/.frontend-check.generated.mjs');
try {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'frontend-check.jsx', loader: 'jsx' },
    bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/server'],
    banner: { js: "import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url);" },
    define: { 'import.meta.env': JSON.stringify({ VITE_MEMBER_API_ENABLED: 'false', VITE_INQUIRY_API_ENABLED: 'false' }) },
  });
  await writeFile(filename, result.outputFiles[0].text);
  await import(pathToFileURL(filename).href);
} finally { await unlink(filename).catch(() => {}); }
