/**
 * Comprehensive E2E test runner for the Project + Auth API.
 * Hits a live backend at BASE_URL (default http://localhost:5000).
 * Exits with non-zero code if any assertion fails.
 *
 * Usage:  node backend/scripts/e2e_full.js
 */
const BASE = process.env.BASE_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;
const failures = [];

function log(...a) { console.log(...a); }
function ok(name) { passed++; log(`  \u2713 ${name}`); }
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  log(`  \u2717 ${name}\n      ${detail}`);
}

function assertEq(actual, expected, name) {
  if (actual === expected) ok(name);
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(cond, name, detail = '') {
  if (cond) ok(name);
  else fail(name, detail || 'condition was false');
}

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, body: data };
}

const ts = Date.now();
const A_EMAIL = `alice_${ts}@gmail.com`;
const B_EMAIL = `bob_${ts}@gmail.com`;
const C_EMAIL = `carol_${ts}@gmail.com`;
const PASS = 'Abcdef1!';

let aTok, bTok, cTok;
let aId, bId, cId;
let projId;

async function section(name, fn) {
  log(`\n--- ${name} ---`);
  try { await fn(); }
  catch (e) { fail(`${name} threw`, e.stack || e.message); }
}

(async () => {
  log(`Running against ${BASE}`);

  await section('Health check', async () => {
    const res = await fetch(BASE + '/');
    assertEq(res.status, 200, 'GET / returns 200');
  });

  await section('Auth: validation', async () => {
    let r = await call('POST', '/register', { body: { email: 'not-an-email', password: PASS } });
    assertEq(r.status, 400, 'register rejects bad email');

    r = await call('POST', '/register', { body: { email: A_EMAIL, password: 'short' } });
    assertEq(r.status, 400, 'register rejects weak password');

    r = await call('POST', '/register', { body: { email: 'someone@hotmail.com', password: PASS } });
    assertEq(r.status, 400, 'register rejects non-gmail / non-edu email');
  });

  await section('Auth: register A, B, C', async () => {
    let r = await call('POST', '/register', { body: { email: A_EMAIL, password: PASS } });
    assertEq(r.status, 201, 'A register 201');
    aTok = r.body.accessToken;
    aId = r.body.user.id;

    r = await call('POST', '/register', { body: { email: B_EMAIL, password: PASS } });
    assertEq(r.status, 201, 'B register 201');
    bTok = r.body.accessToken;
    bId = r.body.user.id;

    r = await call('POST', '/register', { body: { email: C_EMAIL, password: PASS } });
    assertEq(r.status, 201, 'C register 201');
    cTok = r.body.accessToken;
    cId = r.body.user.id;

    // Duplicate
    r = await call('POST', '/register', { body: { email: A_EMAIL, password: PASS } });
    assertEq(r.status, 400, 'duplicate register 400');
  });

  await section('Auth: login & logout', async () => {
    let r = await call('POST', '/login', { body: { email: A_EMAIL, password: PASS } });
    assertEq(r.status, 200, 'login OK');
    assertTrue(typeof r.body.accessToken === 'string', 'login returns accessToken');

    r = await call('POST', '/login', { body: { email: A_EMAIL, password: 'WrongPass1!' } });
    assertEq(r.status, 401, 'wrong password 401');

    r = await call('POST', '/login', { body: { email: 'nobody_' + ts + '@gmail.com', password: PASS } });
    assertEq(r.status, 401, 'unknown email 401');
  });

  await section('Auth: token enforcement', async () => {
    let r = await call('GET', '/project');
    assertEq(r.status, 401, 'no token 401');

    r = await fetch(BASE + '/project', { headers: { Authorization: 'NotBearer xyz' } });
    assertEq(r.status, 401, 'malformed Authorization header 401');

    r = await call('GET', '/project', { token: 'garbage.token.value' });
    assertEq(r.status, 401, 'invalid JWT 401');
  });

  await section('Project: create + validation', async () => {
    let r = await call('POST', '/project', { token: aTok, body: { name: 'a b' } });
    assertEq(r.status, 400, 'reject name with space');

    r = await call('POST', '/project', { token: aTok, body: { name: 'a' } });
    assertEq(r.status, 400, 'reject name too short');

    r = await call('POST', '/project', { token: aTok, body: { name: 'x'.repeat(51) } });
    assertEq(r.status, 400, 'reject name too long');

    r = await call('POST', '/project', { token: aTok, body: { name: `proj_${ts}`, description: 'y'.repeat(501) } });
    assertEq(r.status, 400, 'reject description > 500 chars');

    r = await call('POST', '/project', { token: aTok, body: { name: `proj_${ts}`, description: 'shared demo' } });
    assertEq(r.status, 201, 'create project 201');
    assertEq(r.body.project.role, 'owner', 'creator role is owner');
    assertEq(r.body.project.name, `proj_${ts}`, 'returned name matches');
    projId = r.body.project.id;

    // Duplicate name for same owner
    r = await call('POST', '/project', { token: aTok, body: { name: `proj_${ts}` } });
    assertEq(r.status, 409, 'duplicate name 409');
  });

  await section('Project list isolation', async () => {
    let r = await call('GET', '/project', { token: aTok });
    assertEq(r.status, 200, 'A list 200');
    assertTrue(r.body.some((p) => p.id === projId && p.role === 'owner'), 'A sees own project as owner');

    r = await call('GET', '/project', { token: bTok });
    assertEq(r.status, 200, 'B list 200');
    assertTrue(!r.body.some((p) => p.id === projId), 'B does NOT see A\'s private project');
  });

  await section('Permission: deny-by-default', async () => {
    let r = await call('GET', `/project/${projId}`, { token: bTok });
    assertEq(r.status, 404, 'B GET others project => 404 (no leak)');

    r = await call('PUT', `/project/${projId}`, { token: bTok, body: { description: 'pwn' } });
    assertEq(r.status, 404, 'B PUT others project => 404');

    r = await call('DELETE', `/project/${projId}`, { token: bTok });
    assertEq(r.status, 404, 'B DELETE others project => 404');

    r = await call('GET', `/project/${projId}/members`, { token: bTok });
    assertEq(r.status, 404, 'B GET members of others project => 404');

    r = await call('POST', `/project/${projId}/members`, { token: bTok, body: { email: C_EMAIL, role: 'viewer' } });
    assertEq(r.status, 404, 'B cannot add members to others project => 404');
  });

  await section('Permission: invalid id shape', async () => {
    let r = await call('GET', '/project/not-a-uuid', { token: aTok });
    assertEq(r.status, 400, 'GET non-uuid id => 400');

    r = await call('PUT', '/project/not-a-uuid', { token: aTok, body: { description: 'x' } });
    assertEq(r.status, 400, 'PUT non-uuid id => 400');
  });

  await section('Members: invite B as viewer', async () => {
    let r = await call('POST', `/project/${projId}/members`, { token: aTok, body: { email: B_EMAIL, role: 'viewer' } });
    assertEq(r.status, 201, 'add viewer 201');
    assertEq(r.body.member.role, 'viewer', 'returned role viewer');

    r = await call('GET', `/project/${projId}`, { token: bTok });
    assertEq(r.status, 200, 'B can now read project');
    assertEq(r.body.role, 'viewer', 'B role is viewer');

    r = await call('PUT', `/project/${projId}`, { token: bTok, body: { description: 'viewer-edit' } });
    assertEq(r.status, 403, 'viewer cannot PUT (403)');
    assertEq(r.body.required, 'editor', '403 reports required role');
    assertEq(r.body.actual, 'viewer', '403 reports actual role');

    r = await call('DELETE', `/project/${projId}`, { token: bTok });
    assertEq(r.status, 403, 'viewer cannot DELETE (403)');

    r = await call('GET', `/project/${projId}/members`, { token: bTok });
    assertEq(r.status, 200, 'viewer can list members');
    assertTrue(Array.isArray(r.body) && r.body.length === 2, 'two members returned');

    r = await call('POST', `/project/${projId}/members`, { token: bTok, body: { email: C_EMAIL, role: 'viewer' } });
    assertEq(r.status, 403, 'viewer cannot add members (403)');
  });

  await section('Members: invalid role and missing user', async () => {
    let r = await call('POST', `/project/${projId}/members`, { token: aTok, body: { email: B_EMAIL, role: 'admin' } });
    assertEq(r.status, 400, 'invalid role rejected');

    r = await call('POST', `/project/${projId}/members`, { token: aTok, body: { email: B_EMAIL, role: 'owner' } });
    assertEq(r.status, 400, 'role=owner rejected via this endpoint');

    r = await call('POST', `/project/${projId}/members`, { token: aTok, body: { email: 'ghost_' + ts + '@gmail.com', role: 'viewer' } });
    assertEq(r.status, 404, 'unregistered email => 404');

    r = await call('POST', `/project/${projId}/members`, { token: aTok, body: { email: A_EMAIL, role: 'editor' } });
    assertEq(r.status, 409, 'cannot change owner role here');
  });

  await section('Members: promote B viewer -> editor', async () => {
    let r = await call('POST', `/project/${projId}/members`, { token: aTok, body: { email: B_EMAIL, role: 'editor' } });
    assertEq(r.status, 201, 'upsert promote OK');

    r = await call('PUT', `/project/${projId}`, { token: bTok, body: { description: 'edited by B' } });
    assertEq(r.status, 200, 'editor can PUT');
    assertEq(r.body.project.description, 'edited by B', 'description updated');

    r = await call('DELETE', `/project/${projId}`, { token: bTok });
    assertEq(r.status, 403, 'editor still cannot DELETE');
  });

  await section('Project list now shows shared project for B', async () => {
    let r = await call('GET', '/project', { token: bTok });
    assertEq(r.status, 200, 'B list 200');
    const row = r.body.find((p) => p.id === projId);
    assertTrue(!!row, 'B sees shared project in list');
    if (row) assertEq(row.role, 'editor', 'B sees role=editor in list');
  });

  await section('PUT: rename uniqueness scoped to owner', async () => {
    // A creates a second project, then tries to rename project1 to its name => 409
    let r = await call('POST', '/project', { token: aTok, body: { name: `proj2_${ts}` } });
    assertEq(r.status, 201, 'A create proj2');
    const pid2 = r.body.project.id;

    r = await call('PUT', `/project/${projId}`, { token: aTok, body: { name: `proj2_${ts}` } });
    assertEq(r.status, 409, 'rename collision rejected');

    // B (editor on projId) cannot collide because uniqueness is scoped to owner_id
    // and B doesn't own proj2; renaming projId to a fresh name via B should work.
    const fresh = `bedit_${ts}`;
    r = await call('PUT', `/project/${projId}`, { token: bTok, body: { name: fresh } });
    assertEq(r.status, 200, 'editor B can rename to fresh name');
    assertEq(r.body.project.name, fresh, 'name updated');

    // Cleanup proj2
    r = await call('DELETE', `/project/${pid2}`, { token: aTok });
    assertEq(r.status, 200, 'A delete proj2 OK');
  });

  await section('PUT: empty body (no fields) returns 200 with project unchanged', async () => {
    const r = await call('PUT', `/project/${projId}`, { token: aTok, body: {} });
    assertEq(r.status, 200, 'empty PUT 200');
  });

  await section('Members: remove B; B loses access', async () => {
    let r = await call('DELETE', `/project/${projId}/members/${bId}`, { token: aTok });
    assertEq(r.status, 200, 'remove B OK');

    r = await call('GET', `/project/${projId}`, { token: bTok });
    assertEq(r.status, 404, 'B back to 404');

    r = await call('DELETE', `/project/${projId}/members/${bId}`, { token: aTok });
    assertEq(r.status, 404, 'remove already-removed member => 404');

    r = await call('DELETE', `/project/${projId}/members/not-a-uuid`, { token: aTok });
    assertEq(r.status, 400, 'non-uuid userId => 400');
  });

  await section('Members: cannot remove last owner', async () => {
    const r = await call('DELETE', `/project/${projId}/members/${aId}`, { token: aTok });
    assertEq(r.status, 409, 'last-owner removal blocked');
  });

  await section('SQL injection / weird inputs are safe (parameterized)', async () => {
    // The name regex blocks quotes, but ensure server stays alive on funky input
    let r = await call('POST', '/project', { token: aTok, body: { name: "x'; DROP TABLE users;--" } });
    assertEq(r.status, 400, 'name with SQL fails validation, DB intact');

    // Sanity: backend still responds
    r = await call('GET', '/project', { token: aTok });
    assertEq(r.status, 200, 'backend still healthy after injection attempt');
  });

  await section('Soft delete + name reuse', async () => {
    const reuseName = `reuse_${ts}`;
    let r = await call('POST', '/project', { token: aTok, body: { name: reuseName } });
    assertEq(r.status, 201, 'create reuse-test project');
    const pid = r.body.project.id;

    r = await call('DELETE', `/project/${pid}`, { token: aTok });
    assertEq(r.status, 200, 'soft delete OK');

    r = await call('GET', `/project/${pid}`, { token: aTok });
    assertEq(r.status, 404, 'deleted project no longer fetchable');

    r = await call('POST', '/project', { token: aTok, body: { name: reuseName } });
    assertEq(r.status, 201, 'name reusable after soft delete');
  });

  await section('Final cleanup', async () => {
    const r = await call('DELETE', `/project/${projId}`, { token: aTok });
    assertEq(r.status, 200, 'delete original project');
  });

  log(`\n========== ${passed} passed, ${failed} failed ==========`);
  if (failed > 0) {
    log('\nFailures:');
    failures.forEach((f) => log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
})().catch((e) => { console.error('Test runner crashed:', e); process.exit(2); });
