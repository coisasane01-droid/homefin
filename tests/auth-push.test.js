import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import webpush from 'web-push';
import {
  createFamilySessionToken,
  validateFamilySession,
  verifyFamilySession,
} from '../api/_family-session.js';
import familyDataHandler from '../api/family-data.js';
import familyAttachmentsHandler from '../server/api-handlers/family-attachments.js';
import familyDeleteHandler from '../server/api-handlers/family-delete.js';
import familyStorageCleanupHandler from '../server/api-handlers/family-storage-cleanup.js';
import familyAuthHandler from '../api/family-auth.js';
import supportHandler from '../api/support.js';
import pushSubscribeHandler from '../server/api-handlers/push-subscribe.js';
import pushHandler from '../server/api-handlers/push-send.js';
import adminAuthHandler from '../api/admin-auth.js';

process.env.HOMEFIN_SESSION_SECRET = 'test-secret-with-more-than-thirty-two-characters';
process.env.VITE_SUPABASE_URL = 'https://supabase.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.VAPID_PUBLIC_KEY = 'test-public';
process.env.VAPID_PRIVATE_KEY = 'test-private';
process.env.HOMEFIN_ADMIN_SECRET = 'test-admin-secret-with-more-than-twenty';
const { default: pushBroadcastHandler } = await import('../server/api-handlers/push-broadcast.js');
const { default: pushApiHandler } = await import('../api/push.js');
const { default: familyFilesApiHandler } = await import('../api/family-files.js');

const originalFetch = global.fetch;
const originalSetVapidDetails = webpush.setVapidDetails;
const originalSendNotification = webpush.sendNotification;
const scrypt = promisify(crypto.scrypt);

afterEach(() => {
  global.fetch = originalFetch;
  webpush.setVapidDetails = originalSetVapidDetails;
  webpush.sendNotification = originalSendNotification;
});

function responseCapture() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

function authRequest(token) {
  return { authorization: token ? `Bearer ${token}` : '' };
}

function apiResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('family session accepts valid token and rejects expiry and cross-family use', () => {
  const token = createFamilySessionToken('family-one', 3);
  assert.equal(verifyFamilySession({ headers: authRequest(token) }, 'family-one').valid, true);
  assert.equal(verifyFamilySession({ headers: authRequest(token) }, 'family-two').valid, false);
  assert.equal(verifyFamilySession({ headers: {} }, 'family-one').valid, false);

  const payload = Buffer.from(JSON.stringify({
    familyId: 'family-one',
    sessionVersion: 1,
    iat: 1,
    exp: 2,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.HOMEFIN_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  assert.equal(verifyFamilySession({ headers: authRequest(`${payload}.${signature}`) }, 'family-one').valid, false);
});

test('family session validation checks current server version and fails on database outage', async () => {
  const token = createFamilySessionToken('family-one', 3);
  global.fetch = async () => apiResponse(200, [{ session_version: 3 }]);
  assert.equal((await validateFamilySession({ headers: authRequest(token) }, 'family-one')).valid, true);

  global.fetch = async () => apiResponse(200, [{ session_version: 4 }]);
  assert.equal((await validateFamilySession({ headers: authRequest(token) }, 'family-one')).valid, false);

  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(
    validateFamilySession({ headers: authRequest(token) }, 'family-one'),
    /validar a sessão familiar/
  );
});

test('financial data API rejects missing token and a token from another family', async () => {
  const missing = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: {},
    body: { action: 'get', familyId: 'family-one' },
  }, missing);
  assert.equal(missing.statusCode, 401);

  const token = createFamilySessionToken('family-one');
  const crossFamily = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'get', familyId: 'family-two' },
  }, crossFamily);
  assert.equal(crossFamily.statusCode, 401);
});

test('financial data API scopes reads to the authenticated family', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const requested = [];
  global.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    return apiResponse(200, [{
      family_id: 'family-one',
      data: { bills: [{ id: 'existing-record' }] },
      updated_at: '2026-01-01T00:00:00Z',
    }]);
  };

  const res = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'get', familyId: 'family-one' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.bills[0].id, 'existing-record');
  assert.ok(requested[1].includes('family_id=eq.family-one'));
});

test('financial data API saves only when the expected remote version still matches', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const expectedUpdatedAt = '2026-10-01T00:00:00.000Z';
  const latestUpdatedAt = '2026-10-02T00:00:00.000Z';
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?') && options.method === 'PATCH') {
      assert.match(target, /updated_at=eq\.2026-10-01T00%3A00%3A00\.000Z/);
      return apiResponse(200, [{
        family_id: 'family-one',
        updated_at: latestUpdatedAt,
      }]);
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      action: 'save',
      familyId: 'family-one',
      expectedUpdatedAt,
      data: { bills: [{ id: 'preserved-record' }] },
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updatedAt, latestUpdatedAt);
  assert.equal(requests[1].options.method, 'PATCH');
});

test('financial data API refuses stale writes and inserts only when no remote version exists', async () => {
  const token = createFamilySessionToken('family-one', 1);
  let writeRequest;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    writeRequest = { target, options };
    if (options.method === 'PATCH') return apiResponse(200, []);
    if (options.method === 'POST') return apiResponse(200, []);
    throw new Error(`Unexpected API request: ${target}`);
  };

  const stale = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      action: 'save',
      familyId: 'family-one',
      expectedUpdatedAt: '2026-10-01T00:00:00.000Z',
      data: { bills: [{ id: 'local-only-record' }] },
    },
  }, stale);
  assert.equal(stale.statusCode, 409);
  assert.equal(writeRequest.options.method, 'PATCH');
  assert.match(stale.body.error, /preservadas localmente/);

  const noKnownRemoteVersion = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      action: 'save',
      familyId: 'family-one',
      expectedUpdatedAt: null,
      data: { bills: [] },
    },
  }, noKnownRemoteVersion);
  assert.equal(noKnownRemoteVersion.statusCode, 409);
  assert.equal(writeRequest.options.method, 'POST');
  assert.match(writeRequest.options.headers.Prefer, /resolution=ignore-duplicates/);

  const missingVersion = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      action: 'save',
      familyId: 'family-one',
      data: { bills: [] },
    },
  }, missingVersion);
  assert.equal(missingVersion.statusCode, 400);
});

test('financial data API does not claim cloud access when Supabase is unavailable', async () => {
  const token = createFamilySessionToken('family-one', 1);
  global.fetch = async () => { throw new Error('offline'); };
  const res = responseCapture();
  await familyDataHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      action: 'save',
      familyId: 'family-one',
      expectedUpdatedAt: null,
      data: { bills: [] },
    },
  }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, undefined);
});

test('attachment upload requires a family session and stores the object under that family path', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('/storage/v1/object/attachments/')) {
      return apiResponse(200, { Key: 'attachments/family-one/uploaded.pdf' });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };
  const res = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      action: 'upload',
      familyId: 'family-one',
      name: 'receipt.pdf',
      contentType: 'application/pdf',
      base64: Buffer.from('%PDF-test').toString('base64'),
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.path, /^family-one\/\d+_[0-9a-f-]+_receipt\.pdf$/);
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(Buffer.from(requests[1].options.body).toString(), '%PDF-test');
});

test('attachment API rejects operations without a valid family session', async () => {
  const res = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: {},
    body: { action: 'sign', familyId: 'family-one', path: 'family-one/receipt.pdf' },
  }, res);
  assert.equal(res.statusCode, 401);
});

test('signed download and deletion are confined to the authenticated family', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) return apiResponse(200, [{ data: {} }]);
    if (target.includes('/storage/v1/object/sign/')) {
      return apiResponse(200, { signedURL: '/object/sign/attachments/family-one/receipt.pdf?token=signed' });
    }
    if (target.endsWith('/storage/v1/object/attachments')) return new Response(null, { status: 200 });
    throw new Error(`Unexpected API request: ${target}`);
  };

  const signed = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'sign', familyId: 'family-one', path: 'family-one/receipt.pdf' },
  }, signed);
  assert.equal(signed.statusCode, 200);
  assert.match(signed.body.url, /^https:\/\/supabase\.example\.test\/storage\/v1\/object\/sign\//);

  const removed = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'delete', familyId: 'family-one', path: 'family-one/receipt.pdf' },
  }, removed);
  assert.equal(removed.statusCode, 200);
  const deletion = requests.find(({ options }) => options.method === 'DELETE');
  assert.deepEqual(JSON.parse(deletion.options.body), { prefixes: ['family-one/receipt.pdf'] });

  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) return apiResponse(200, [{ data: { bills: [] } }]);
    throw new Error(`Unexpected API request: ${target}`);
  };
  const crossFamily = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(createFamilySessionToken('family-two', 1)),
    body: { action: 'sign', familyId: 'family-two', path: 'family-one/receipt.pdf' },
  }, crossFamily);
  assert.equal(crossFamily.statusCode, 404);
});

test('referenced attachments cannot be removed before the family data is synchronized', async () => {
  const token = createFamilySessionToken('family-one', 1);
  let storageDeleteRequested = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) {
      return apiResponse(200, [{
        data: { bills: [{ attachments: [{ storagePath: 'family-one/receipt.pdf' }] }] },
      }]);
    }
    if (target.endsWith('/storage/v1/object/attachments') && options.method === 'DELETE') {
      storageDeleteRequested = true;
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'delete', familyId: 'family-one', path: 'family-one/receipt.pdf' },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(storageDeleteRequested, false);
});

test('legacy root storage objects can be signed only while referenced by that family', async () => {
  const token = createFamilySessionToken('family-one', 1);
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) {
      return apiResponse(200, [{
        data: { bills: [{ attachments: [{
          url: 'https://supabase.example.test/storage/v1/object/public/attachments/legacy.pdf',
        }] }] },
      }]);
    }
    if (target.includes('/storage/v1/object/sign/')) {
      return apiResponse(200, { signedURL: '/object/sign/attachments/legacy.pdf?token=legacy' });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };
  const res = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'sign', familyId: 'family-one', path: 'legacy.pdf' },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.url, /legacy\.pdf\?token=legacy$/);
});

test('attachment Storage outage returns an explicit failure', async () => {
  const token = createFamilySessionToken('family-one', 1);
  global.fetch = async (url) => {
    if (String(url).includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    return apiResponse(503, { message: 'storage unavailable' });
  };
  const res = responseCapture();
  await familyAttachmentsHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'sign', familyId: 'family-one', path: 'family-one/receipt.pdf' },
  }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, undefined);
});

test('family deletion removes owned Storage objects and payment cleanup is in its RPC migration', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) {
      return apiResponse(200, [{
        data: { bills: [{ description: 'receipt.pdf', attachments: [
          { storagePath: 'family-one/receipt.pdf' },
          { storagePath: 'family-two/other-family.pdf' },
        ] }] },
      }]);
    }
    if (target.endsWith('/storage/v1/object/list/attachments')) {
      return apiResponse(200, [{ name: 'receipt.pdf', id: 'object-id' }]);
    }
    if (target.includes('homefin_storage_cleanup_queue') && options.method === 'POST') {
      return apiResponse(201, [{ id: 'cleanup-job-id' }]);
    }
    if (target.endsWith('/storage/v1/object/attachments') && options.method === 'DELETE') {
      return new Response(null, { status: 200 });
    }
    if (target.endsWith('/rest/v1/rpc/homefin_delete_family')) {
      return apiResponse(200, true);
    }
    if (target.includes('homefin_storage_cleanup_queue') && options.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyDeleteHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { familyId: 'family-one' },
  }, res);

  assert.equal(res.statusCode, 200);
  const storageRemovalIndex = requests.findIndex(({ options }) => options.method === 'DELETE');
  const databaseRemovalIndex = requests.findIndex(({ target }) => target.includes('homefin_delete_family'));
  const queueCreationIndex = requests.findIndex(({ target, options }) =>
    target.includes('homefin_storage_cleanup_queue') && options.method === 'POST'
  );
  assert.ok(storageRemovalIndex >= 0);
  assert.ok(queueCreationIndex >= 0 && queueCreationIndex < databaseRemovalIndex);
  assert.ok(databaseRemovalIndex < storageRemovalIndex);
  const storageRemoval = requests[storageRemovalIndex];
  assert.deepEqual(JSON.parse(storageRemoval.options.body), { prefixes: ['family-one/receipt.pdf'] });

  const migration = await (await import('node:fs/promises')).readFile(
    new URL('../scripts/migracao-hardening-autenticacao-push.sql', import.meta.url),
    'utf8'
  );
  assert.match(migration, /DELETE FROM public\.homefin_payments WHERE family_id = \$1/);
  assert.match(migration, /homefin_storage_cleanup_queue/);
  assert.match(migration, /AS RESTRICTIVE[\s\S]*bucket_id <> 'attachments'/);
  assert.doesNotMatch(migration, /REVOKE ALL ON storage\.objects/);
});

test('family deletion preserves attachments if the database RPC fails', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) {
      return apiResponse(200, [{ data: { bills: [] } }]);
    }
    if (target.endsWith('/storage/v1/object/list/attachments')) {
      return apiResponse(200, [{ name: 'receipt.pdf', id: 'object-id' }]);
    }
    if (target.includes('homefin_storage_cleanup_queue') && options.method === 'POST') {
      return apiResponse(201, [{ id: 'cleanup-job-id' }]);
    }
    if (target.endsWith('/rest/v1/rpc/homefin_delete_family')) {
      return apiResponse(500, { message: 'database unavailable' });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyDeleteHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { familyId: 'family-one' },
  }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(requests.some(({ options }) => options.method === 'DELETE'), false);
});

test('family deletion reports pending Storage cleanup after database deletion succeeds', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_data?')) {
      return apiResponse(200, [{ data: { bills: [] } }]);
    }
    if (target.endsWith('/storage/v1/object/list/attachments')) {
      return apiResponse(200, [{ name: 'receipt.pdf', id: 'object-id' }]);
    }
    if (target.includes('homefin_storage_cleanup_queue') && options.method === 'POST') {
      return apiResponse(201, [{ id: 'cleanup-job-id' }]);
    }
    if (target.endsWith('/rest/v1/rpc/homefin_delete_family')) {
      return apiResponse(200, true);
    }
    if (target.endsWith('/storage/v1/object/attachments') && options.method === 'DELETE') {
      return apiResponse(503, { message: 'storage unavailable' });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyDeleteHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { familyId: 'family-one' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.storageCleanupPending, true);
  assert.equal(
    requests.some(({ target, options }) =>
      target.includes('homefin_storage_cleanup_queue') && options.method === 'DELETE'
    ),
    false
  );
});

test('admin cleanup processes queued files only after family data is deleted', async () => {
  const login = responseCapture();
  await adminAuthHandler({
    method: 'POST',
    headers: {},
    body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
  }, login);
  assert.equal(login.statusCode, 200);

  const requests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.includes('homefin_storage_cleanup_queue?') && options.method !== 'DELETE') {
      return apiResponse(200, [{
        id: 'cleanup-job-id',
        family_id: 'family-one',
        object_paths: ['family-one/receipt.pdf'],
      }]);
    }
    if (target.includes('homefin_saas?')) {
      return apiResponse(200, [{ data: { families: [] } }]);
    }
    if (target.includes('homefin_family_credentials?')) return apiResponse(200, []);
    if (target.includes('homefin_data?')) return apiResponse(200, []);
    if (target.endsWith('/storage/v1/object/attachments') && options.method === 'DELETE') {
      return new Response(null, { status: 200 });
    }
    if (target.includes('homefin_storage_cleanup_queue?') && options.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyStorageCleanupHandler({
    method: 'POST',
    headers: authRequest(login.body.token),
    body: {},
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.processed, 1);
  const storageRemovalIndex = requests.findIndex(({ options }) => options.method === 'DELETE');
  const familyCheckIndex = requests.findIndex(({ target }) => target.includes('homefin_saas?'));
  assert.ok(storageRemovalIndex > familyCheckIndex);
});

test('admin cleanup leaves attachments untouched while the family still exists', async () => {
  const login = responseCapture();
  await adminAuthHandler({
    method: 'POST',
    headers: {},
    body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
  }, login);

  let storageDeleteRequested = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('homefin_storage_cleanup_queue?')) {
      return apiResponse(200, [{
        id: 'cleanup-job-id',
        family_id: 'family-one',
        object_paths: ['family-one/receipt.pdf'],
      }]);
    }
    if (target.includes('homefin_saas?')) {
      return apiResponse(200, [{ data: { families: [{ id: 'family-one' }] } }]);
    }
    if (target.endsWith('/storage/v1/object/attachments') && options.method === 'DELETE') {
      storageDeleteRequested = true;
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyStorageCleanupHandler({
    method: 'POST',
    headers: authRequest(login.body.token),
    body: {},
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.skipped, 1);
  assert.equal(storageDeleteRequested, false);
});

test('support API rejects unauthenticated family access', async () => {
  const res = responseCapture();
  await supportHandler({
    method: 'POST',
    headers: {},
    body: { action: 'get-messages', familyId: 'family-one' },
  }, res);
  assert.equal(res.statusCode, 401);
});

test('family support messages notify only admin Push subscriptions and remove expired admin endpoints', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const expiredEndpoint = 'https://fcm.googleapis.com/fcm/send/expired-admin-support';
  const requests = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (subscription) => {
    assert.equal(subscription.endpoint, expiredEndpoint);
    throw Object.assign(new Error('gone'), { statusCode: 410 });
  };
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ url: target, method: options.method || 'GET' });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_support_settings')) return apiResponse(200, []);
    if (target.includes('homefin_support_messages')) {
      return apiResponse(201, [{
        id: 'message-one',
        family_id: 'family-one',
        sender_type: 'family',
        message: 'Mensagem privada',
      }]);
    }
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (target.includes('homefin_push_subscriptions')) {
      assert.ok(target.includes('family_id=eq.admin'));
      assert.ok(target.includes('user_type=eq.admin'));
      return apiResponse(200, [{
        endpoint: expiredEndpoint,
        subscription: { endpoint: expiredEndpoint },
      }]);
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await supportHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { action: 'send-message', familyId: 'family-one', message: 'Mensagem privada' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message.id, 'message-one');
  const cleanup = requests.find(({ method }) => method === 'DELETE');
  assert.ok(cleanup.url.includes('family_id=eq.admin'));
  assert.ok(cleanup.url.includes('user_type=eq.admin'));
  assert.ok(cleanup.url.includes(encodeURIComponent(expiredEndpoint)));
});

test('family login rejects an incorrect PIN and issues a token only after server validation', async () => {
  const salt = 'a'.repeat(32);
  const correctHash = (await scrypt('1234', salt, 64)).toString('hex');
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('homefin_auth_attempts')) return apiResponse(200, []);
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ pin_salt: salt, pin_hash: correctHash, session_version: 1 }]);
    }
    if (target.includes('homefin_register_auth_failure')) return apiResponse(200, true);
    throw new Error(`Unexpected API request: ${target}`);
  };

  const wrong = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.10' },
    socket: {},
    body: { action: 'login', familyId: 'family-one', pin: '1111' },
  }, wrong);
  assert.equal(wrong.statusCode, 401);

  const valid = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: {},
    socket: {},
    body: { action: 'login', familyId: 'family-one', pin: '1234' },
  }, valid);
  assert.equal(valid.statusCode, 200);
  assert.equal(verifyFamilySession({ headers: authRequest(valid.body.token) }, 'family-one').valid, true);
});

test('family signup rejects oversized or invalid images before calling Supabase', async () => {
  const image = `data:image/webp;base64,${'A'.repeat(850_001)}`;
  global.fetch = async () => {
    throw new Error('Supabase must not be called for an invalid image');
  };
  const oversized = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: {},
    body: {
      action: 'create',
      familyId: 'family-one',
      pin: '1234',
      keyword: 'recovery phrase',
      family: { id: 'family-one', name: 'Família', settings: { logoImage: image } },
    },
  }, oversized);
  assert.equal(oversized.statusCode, 413);
  assert.match(oversized.body.error, /logo/);

  const invalidFormat = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: {},
    body: {
      action: 'create',
      familyId: 'family-one',
      pin: '1234',
      keyword: 'recovery phrase',
      family: { id: 'family-one', name: 'Família', settings: { logoImage: 'https://example.test/image.webp' } },
    },
  }, invalidFormat);
  assert.equal(invalidFormat.statusCode, 400);
  assert.match(invalidFormat.body.error, /formato inválido/);

  const imageUnderIndividualLimit = `data:image/webp;base64,${'A'.repeat(760_000)}`;
  const oversizedCombinedPayload = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: {},
    body: {
      action: 'create',
      familyId: 'family-one',
      pin: '1234',
      keyword: 'recovery phrase',
      family: {
        id: 'family-one',
        name: 'Família',
        settings: {
          logoImage: imageUnderIndividualLimit,
          backgroundImage: imageUnderIndividualLimit,
        },
      },
    },
  }, oversizedCombinedPayload);
  assert.equal(oversizedCombinedPayload.statusCode, 413);
  assert.match(oversizedCombinedPayload.body.error, /juntas/);
});

test('family signup accepts compressed images within individual and aggregate payload limits', async () => {
  const image = `data:image/webp;base64,${'A'.repeat(700_000)}`;
  let rpcRequest;
  global.fetch = async (url, options = {}) => {
    assert.match(String(url), /rpc\/homefin_create_family_with_credentials$/);
    rpcRequest = JSON.parse(options.body);
    return apiResponse(200, true);
  };

  const res = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: {},
    body: {
      action: 'create',
      familyId: 'family-one',
      pin: '1234',
      keyword: 'recovery phrase',
      family: {
        id: 'family-one',
        name: 'Família',
        settings: { backgroundImage: image, logoImage: image },
      },
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.family.settings.backgroundImage, image);
  assert.equal(rpcRequest.p_family.settings.logoImage, image);
  assert.equal(JSON.stringify(rpcRequest).includes('"1234"'), false);
  assert.equal(JSON.stringify(rpcRequest).includes('recovery phrase'), false);
});

test('family enrollment authorization requires an admin session and explicit independent verification', async () => {
  let rpcRequest;
  global.fetch = async (url, options = {}) => {
    assert.match(String(url), /rpc\/homefin_issue_family_enrollment_authorization$/);
    rpcRequest = JSON.parse(options.body);
    return apiResponse(200, { success: true, expiresAt: rpcRequest.p_expires_at });
  };

  const unauthenticated = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: {},
    body: {
      action: 'issue-enrollment',
      familyId: 'legacy-family',
      ownershipVerified: true,
      verificationMethod: 'known_phone',
      purpose: 'provision',
      verifiedBy: 'client-supplied-operator',
    },
  }, unauthenticated);
  assert.equal(unauthenticated.statusCode, 401);

  const incomplete = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { authorization: 'Bearer invalid' },
    body: { action: 'issue-enrollment', familyId: 'legacy-family', ownershipVerified: true },
  }, incomplete);
  assert.equal(incomplete.statusCode, 401);

  const login = responseCapture();
  await adminAuthHandler({
    method: 'POST',
    headers: {},
    body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
  }, login);
  assert.equal(login.statusCode, 200);

  const invalidVerification = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${login.body.token}` },
    body: {
      action: 'issue-enrollment',
      familyId: 'legacy-family',
      ownershipVerified: true,
      verificationMethod: 'browser_only',
      purpose: 'provision',
    },
  }, invalidVerification);
  assert.equal(invalidVerification.statusCode, 400);
  assert.equal(rpcRequest, undefined);

  const issued = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${login.body.token}`, 'x-real-ip': '192.0.2.20' },
    socket: {},
    body: {
      action: 'issue-enrollment',
      familyId: 'legacy-family',
      ownershipVerified: true,
      verificationMethod: 'known_phone',
      purpose: 'provision',
    },
  }, issued);
  assert.equal(issued.statusCode, 201);
  assert.equal(issued.body.oneTime, true);
  assert.match(issued.body.authorizationCode, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(rpcRequest.p_family_id, 'legacy-family');
  assert.match(rpcRequest.p_authorization_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(rpcRequest.p_authorization_hash, issued.body.authorizationCode);
  assert.match(rpcRequest.p_verified_by, /^admin-session:[a-f0-9]{64}$/);
  assert.notEqual(rpcRequest.p_verified_by, 'client-supplied-operator');
  assert.equal(rpcRequest.p_ownership_verified, true);
  assert.equal(rpcRequest.p_purpose, 'provision');
  assert.equal(Object.hasOwn(rpcRequest, 'p_operator_name'), false);
});

test('family enrollment consumes a family-scoped one-time code and permits login without returning the PIN', async () => {
  const authorizationCode = crypto.randomBytes(32).toString('base64url');
  let credential;
  const requested = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requested.push({ target, options });
    if (target.includes('homefin_saas?id=eq.global')) {
      return apiResponse(200, [{ data: { families: [
        { id: 'legacy-family', name: 'Família antiga' },
        { id: 'another-family', name: 'Outra família' },
      ] } }]);
    }
    if (target.includes('rpc/homefin_register_family_enrollment_attempt')) {
      return apiResponse(200, { allowed: true });
    }
    if (target.includes('rpc/homefin_consume_family_enrollment_authorization')) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.p_family_id, 'legacy-family');
      assert.equal(payload.p_authorization_hash, crypto.createHash('sha256').update(authorizationCode).digest('hex'));
      assert.match(payload.p_pin_salt, /^[a-f0-9]{32}$/);
      assert.match(payload.p_pin_hash, /^[a-f0-9]{128}$/);
      assert.equal(JSON.stringify(payload).includes('2468'), false);
      credential = {
        family_id: payload.p_family_id,
        pin_salt: payload.p_pin_salt,
        pin_hash: payload.p_pin_hash,
        session_version: 1,
        recovery_hash: null,
      };
      return apiResponse(200, { success: true, sessionVersion: 1 });
    }
    if (target.includes('homefin_auth_attempts')) return apiResponse(200, []);
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, credential ? [credential] : []);
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const enrolled = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.21' },
    socket: {},
    body: {
      action: 'enroll',
      familyId: 'legacy-family',
      authorizationCode,
      newPin: '2468',
    },
  }, enrolled);
  assert.equal(enrolled.statusCode, 201);
  assert.equal(enrolled.body.hasRecovery, false);
  assert.equal(credential.family_id, 'legacy-family');
  assert.equal(credential.recovery_hash, null);
  assert.equal(credential.pin_hash, (await scrypt('2468', credential.pin_salt, 64)).toString('hex'));
  assert.equal(JSON.stringify(enrolled.body).includes(authorizationCode), false);

  const login = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.22' },
    socket: {},
    body: { action: 'login', familyId: 'legacy-family', pin: '2468' },
  }, login);
  assert.equal(login.statusCode, 200);
  assert.equal(verifyFamilySession({ headers: authRequest(login.body.token) }, 'legacy-family').valid, true);
  assert.ok(requested.some(({ target }) => target.includes('family_id=eq.legacy-family')));
});

test('family enrollment rejects a code for another family, reused codes and concurrent replay', async () => {
  const authorizationCode = crypto.randomBytes(32).toString('base64url');
  let consumed = false;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('homefin_saas?id=eq.global')) {
      return apiResponse(200, [{ data: { families: [
        { id: 'legacy-family' },
        { id: 'another-family' },
      ] } }]);
    }
    if (target.includes('rpc/homefin_register_family_enrollment_attempt')) {
      return apiResponse(200, { allowed: true });
    }
    if (target.includes('rpc/homefin_consume_family_enrollment_authorization')) {
      const payload = JSON.parse(options.body);
      if (payload.p_family_id !== 'legacy-family') {
        return apiResponse(200, { success: false, reason: 'invalid_authorization' });
      }
      if (consumed) return apiResponse(200, { success: false, reason: 'authorization_reused' });
      consumed = true;
      return apiResponse(200, { success: true, sessionVersion: 1 });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const otherFamily = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.23' },
    socket: {},
    body: { action: 'enroll', familyId: 'another-family', authorizationCode, newPin: '2468' },
  }, otherFamily);
  assert.equal(otherFamily.statusCode, 401);

  const concurrent = await Promise.all([1, 2].map(async () => {
    const response = responseCapture();
    await familyAuthHandler({
      method: 'POST',
      headers: { 'x-real-ip': '192.0.2.24' },
      socket: {},
      body: { action: 'enroll', familyId: 'legacy-family', authorizationCode, newPin: '2468' },
    }, response);
    return response;
  }));
  assert.deepEqual(concurrent.map((response) => response.statusCode).sort(), [201, 409]);
  assert.equal(consumed, true);
});

test('family enrollment applies server-side rate limits and never replaces an existing credential', async () => {
  let denyAttempts = true;
  let consumeRequests = 0;
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('homefin_saas?id=eq.global')) {
      return apiResponse(200, [{ data: { families: [{ id: 'legacy-family' }] } }]);
    }
    if (target.includes('rpc/homefin_register_family_enrollment_attempt')) {
      return apiResponse(200, { allowed: !denyAttempts });
    }
    if (target.includes('rpc/homefin_consume_family_enrollment_authorization')) {
      consumeRequests += 1;
      return apiResponse(200, { success: false, reason: 'credential_exists' });
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const rateLimited = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.25' },
    socket: {},
    body: {
      action: 'enroll',
      familyId: 'legacy-family',
      authorizationCode: crypto.randomBytes(32).toString('base64url'),
      newPin: '2468',
    },
  }, rateLimited);
  assert.equal(rateLimited.statusCode, 429);
  assert.equal(consumeRequests, 0);

  denyAttempts = false;
  const alreadyEnrolled = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.26' },
    socket: {},
    body: {
      action: 'enroll',
      familyId: 'legacy-family',
      authorizationCode: crypto.randomBytes(32).toString('base64url'),
      newPin: '2468',
    },
  }, alreadyEnrolled);
  assert.equal(alreadyEnrolled.statusCode, 409);
  assert.match(alreadyEnrolled.body.error, /nenhuma foi substituída/);
  assert.equal(consumeRequests, 1);
});

test('admin PIN recovery uses a one-time authorization, preserves recovery, and revokes older sessions', async () => {
  const authorizationCode = crypto.randomBytes(32).toString('base64url');
  const recoverySalt = crypto.randomBytes(16).toString('hex');
  const recoveryHash = (await scrypt('family recovery phrase', recoverySalt, 64)).toString('hex');
  const credential = {
    family_id: 'legacy-family',
    pin_salt: crypto.randomBytes(16).toString('hex'),
    pin_hash: crypto.randomBytes(64).toString('hex'),
    recovery_salt: recoverySalt,
    recovery_hash: recoveryHash,
    session_version: 4,
  };
  const priorSession = createFamilySessionToken('legacy-family', 4);
  let issuePayload;
  let consumePayload;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('rpc/homefin_issue_family_enrollment_authorization')) {
      issuePayload = JSON.parse(options.body);
      return apiResponse(200, {
        success: true,
        expiresAt: issuePayload.p_expires_at,
        purpose: issuePayload.p_purpose,
      });
    }
    if (target.includes('homefin_saas?id=eq.global')) {
      return apiResponse(200, [{ data: { families: [{ id: 'legacy-family' }] } }]);
    }
    if (target.includes('rpc/homefin_register_family_enrollment_attempt')) {
      return apiResponse(200, { allowed: true });
    }
    if (target.includes('rpc/homefin_consume_family_enrollment_authorization')) {
      consumePayload = JSON.parse(options.body);
      assert.equal(consumePayload.p_family_id, 'legacy-family');
      assert.equal(
        consumePayload.p_authorization_hash,
        crypto.createHash('sha256').update(authorizationCode).digest('hex')
      );
      credential.pin_salt = consumePayload.p_pin_salt;
      credential.pin_hash = consumePayload.p_pin_hash;
      credential.session_version += 1;
      return apiResponse(200, {
        success: true,
        sessionVersion: credential.session_version,
        hasRecovery: true,
        purpose: 'pin_recovery',
      });
    }
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [credential]);
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const adminLogin = responseCapture();
  await adminAuthHandler({
    method: 'POST',
    headers: {},
    body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
  }, adminLogin);
  assert.equal(adminLogin.statusCode, 200);

  const authorization = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${adminLogin.body.token}`, 'x-real-ip': '192.0.2.27' },
    socket: {},
    body: {
      action: 'issue-enrollment',
      familyId: 'legacy-family',
      ownershipVerified: true,
      verificationMethod: 'previously_verified_email',
      purpose: 'pin_recovery',
    },
  }, authorization);
  assert.equal(authorization.statusCode, 201);
  assert.equal(issuePayload.p_purpose, 'pin_recovery');
  assert.equal(issuePayload.p_ownership_verified, true);

  const reset = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: { 'x-real-ip': '192.0.2.28' },
    socket: {},
    body: {
      action: 'enroll',
      familyId: 'legacy-family',
      authorizationCode,
      newPin: '8642',
    },
  }, reset);
  assert.equal(reset.statusCode, 201);
  assert.equal(reset.body.hasRecovery, true);
  assert.equal(reset.body.purpose, 'pin_recovery');
  assert.equal(credential.recovery_salt, recoverySalt);
  assert.equal(credential.recovery_hash, recoveryHash);
  assert.equal(credential.session_version, 5);
  assert.equal(credential.pin_hash, (await scrypt('8642', credential.pin_salt, 64)).toString('hex'));
  assert.match(consumePayload.p_pin_hash, /^[a-f0-9]{128}$/);
  assert.equal(verifyFamilySession({ headers: authRequest(priorSession) }, 'legacy-family').valid, true);
  assert.equal((await validateFamilySession({ headers: authRequest(priorSession) }, 'legacy-family')).valid, false);
});

test('admin login distinguishes a missing server secret from an invalid password', async () => {
  const previousSecret = process.env.HOMEFIN_ADMIN_SECRET;
  try {
    delete process.env.HOMEFIN_ADMIN_SECRET;
    const unconfigured = responseCapture();
    await adminAuthHandler({
      method: 'POST',
      headers: {},
      body: { action: 'login', password: 'anything' },
    }, unconfigured);
    assert.equal(unconfigured.statusCode, 503);
    assert.match(unconfigured.body.error, /não configurada/);

    process.env.HOMEFIN_ADMIN_SECRET = 'test-admin-secret-with-more-than-twenty';
    const incorrect = responseCapture();
    await adminAuthHandler({
      method: 'POST',
      headers: {},
      body: { action: 'login', password: 'incorrect' },
    }, incorrect);
    assert.equal(incorrect.statusCode, 401);

    const correct = responseCapture();
    await adminAuthHandler({
      method: 'POST',
      headers: {},
      body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
    }, correct);
    assert.equal(correct.statusCode, 200);
    assert.ok(correct.body.token);
  } finally {
    if (previousSecret === undefined) delete process.env.HOMEFIN_ADMIN_SECRET;
    else process.env.HOMEFIN_ADMIN_SECRET = previousSecret;
  }
});

test('family PIN recovery verifies the server-side keyword, updates the PIN and issues a new session', async () => {
  const sessionVersion = 6;
  const recoverySalt = 'b'.repeat(32);
  const recoveryHash = (await scrypt('my recovery key', recoverySalt, 64)).toString('hex');
  const updatedRequests = [];
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('homefin_family_credentials') && target.includes('select=session_version')) {
      return apiResponse(200, [{ session_version: sessionVersion }]);
    }
    if (target.includes('homefin_auth_attempts')) return apiResponse(200, []);
    if (target.includes('select=recovery_salt')) {
      return apiResponse(200, [{
        recovery_salt: recoverySalt,
        recovery_hash: recoveryHash,
        session_version: sessionVersion,
      }]);
    }
    if (options.method === 'PATCH') {
      updatedRequests.push({ url: target, body: JSON.parse(options.body) });
      return apiResponse(200, [{ session_version: sessionVersion + 1 }]);
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: authRequest(createFamilySessionToken('family-one')),
    socket: {},
    body: {
      action: 'recover',
      familyId: 'family-one',
      keyword: ' My Recovery Key ',
      newPin: '5678',
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updatedRequests.length, 1);
  assert.match(updatedRequests[0].url, /session_version=eq\.6/);
  assert.equal(updatedRequests[0].body.session_version, 7);
  assert.equal(
    verifyFamilySession({ headers: authRequest(res.body.token) }, 'family-one').sessionVersion,
    7
  );
});

test('legacy family without a server-side recovery hash cannot recover its PIN', async () => {
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes('homefin_family_credentials') && target.includes('select=session_version')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (target.includes('homefin_auth_attempts')) return apiResponse(200, []);
    if (target.includes('select=recovery_salt')) {
      return apiResponse(200, [{
        recovery_salt: null,
        recovery_hash: null,
        session_version: 1,
      }]);
    }
    throw new Error(`Unexpected API request: ${target}`);
  };

  const res = responseCapture();
  await familyAuthHandler({
    method: 'POST',
    headers: authRequest(createFamilySessionToken('family-one')),
    socket: {},
    body: {
      action: 'recover',
      familyId: 'family-one',
      keyword: 'legacy keyword',
      newPin: '5678',
    },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /não possui recuperação cadastrada no servidor/);
});

test('push enrollment rejects unauthenticated and cross-family requests', async () => {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: { p256dh: 'A'.repeat(65), auth: 'B'.repeat(24) },
  };
  const unauthenticated = responseCapture();
  await pushSubscribeHandler({
    method: 'POST',
    headers: {},
    body: { familyId: 'family-one', userType: 'family', subscription },
  }, unauthenticated);
  assert.equal(unauthenticated.statusCode, 401);

  const token = createFamilySessionToken('family-one');
  const crossFamily = responseCapture();
  await pushSubscribeHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { familyId: 'family-two', userType: 'family', subscription },
  }, crossFamily);
  assert.equal(crossFamily.statusCode, 401);
});

test('push subscription is stored only after authenticated confirmation', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/new-device',
    keys: { p256dh: 'A'.repeat(65), auth: 'B'.repeat(24) },
  };
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    return apiResponse(200, [{
      endpoint: subscription.endpoint,
      family_id: 'family-one',
      user_type: 'family',
    }]);
  };

  const res = responseCapture();
  await pushSubscribeHandler({
    method: 'POST',
    headers: authRequest(token),
    body: { familyId: 'family-one', userType: 'family', subscription },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.registered, true);
  const saved = JSON.parse(requests[1].options.body);
  assert.equal(saved.family_id, 'family-one');
  assert.equal(saved.user_type, 'family');
});

test('admin Push subscription is stored only under the admin profile', async () => {
  const login = responseCapture();
  await adminAuthHandler({
    method: 'POST',
    headers: {},
    body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
  }, login);
  assert.equal(login.statusCode, 200);

  const endpoint = 'https://fcm.googleapis.com/fcm/send/admin-device';
  let savedSubscription;
  global.fetch = async (_url, options = {}) => {
    savedSubscription = JSON.parse(options.body);
    return apiResponse(200, [{
      endpoint,
      family_id: 'admin',
      user_type: 'admin',
    }]);
  };

  const res = responseCapture();
  await pushSubscribeHandler({
    method: 'POST',
    headers: authRequest(login.body.token),
    body: {
      familyId: 'admin',
      userType: 'admin',
      subscription: {
        endpoint,
        keys: { p256dh: 'A'.repeat(65), auth: 'B'.repeat(24) },
      },
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.registered, true);
  assert.equal(savedSubscription.family_id, 'admin');
  assert.equal(savedSubscription.user_type, 'admin');
});

test('push delivery is scoped to one family and removes only its expired endpoint', async () => {
  const token = createFamilySessionToken('family-one', 1);
  const expiredEndpoint = 'https://fcm.googleapis.com/fcm/send/expired';
  const validEndpoint = 'https://fcm.googleapis.com/fcm/send/valid';
  const requested = [];
  let deliveredPayload;
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (subscription, payload) => {
    deliveredPayload = JSON.parse(payload);
    if (subscription.endpoint === expiredEndpoint) {
      throw Object.assign(new Error('gone'), { statusCode: 410 });
    }
  };
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    requested.push({ url: target, method: options.method || 'GET' });
    if (target.includes('homefin_family_credentials')) {
      return apiResponse(200, [{ session_version: 1 }]);
    }
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return apiResponse(200, [
      { endpoint: expiredEndpoint, family_id: 'family-one', subscription: { endpoint: expiredEndpoint } },
      { endpoint: validEndpoint, family_id: 'family-two', subscription: { endpoint: validEndpoint } },
    ]);
  };

  const res = responseCapture();
  await pushHandler({
    method: 'POST',
    headers: authRequest(token),
    body: {
      familyId: 'family-one',
      userType: 'family',
      title: 'Teste',
      body: 'Mensagem de teste',
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sent, 1);
  assert.equal(res.body.failed, 1);
  assert.equal(res.body.expiredRemoved, 1);
  assert.equal(deliveredPayload.url, '/#/login?family=family-one');
  const subscriptionQuery = requested.find(({ url }) => url.includes('homefin_push_subscriptions?'));
  assert.ok(subscriptionQuery.url.includes('family_id=eq.family-one'));
  assert.ok(subscriptionQuery.url.includes('user_type=eq.family'));
  const cleanup = requested.find(({ method }) => method === 'DELETE');
  assert.ok(cleanup.url.includes('family_id=eq.family-one'));
  assert.ok(cleanup.url.includes(encodeURIComponent(expiredEndpoint)));
});

test('admin broadcast requires an admin session and removes only expired registrations', async () => {
  const login = responseCapture();
  await adminAuthHandler({
    method: 'POST',
    headers: {},
    body: { action: 'login', password: process.env.HOMEFIN_ADMIN_SECRET },
  }, login);
  assert.equal(login.statusCode, 200);

  const expiredEndpoint = 'https://fcm.googleapis.com/fcm/send/expired-admin-broadcast';
  const validEndpoint = 'https://fcm.googleapis.com/fcm/send/valid-admin-broadcast';
  const requests = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (subscription) => {
    if (subscription.endpoint === expiredEndpoint) {
      throw Object.assign(new Error('not found'), { statusCode: 404 });
    }
  };
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return apiResponse(200, [
      { endpoint: expiredEndpoint, family_id: 'family-one', subscription: { endpoint: expiredEndpoint } },
      { endpoint: validEndpoint, family_id: 'family-two', subscription: { endpoint: validEndpoint } },
    ]);
  };

  const denied = responseCapture();
  await pushBroadcastHandler({
    method: 'POST',
    headers: {},
    body: { title: 'Aviso', body: 'Teste' },
  }, denied);
  assert.equal(denied.statusCode, 401);

  const sent = responseCapture();
  await pushBroadcastHandler({
    method: 'POST',
    headers: authRequest(login.body.token),
    body: { title: 'Aviso', body: 'Teste' },
  }, sent);
  assert.equal(sent.statusCode, 200);
  assert.equal(sent.body.sent, 1);
  assert.equal(sent.body.failed, 1);
  assert.equal(sent.body.expiredRemoved, 1);
  const listQuery = requests.find(({ url }) => url.includes('homefin_push_subscriptions?'));
  assert.ok(listQuery.url.includes('user_type=eq.family'));
  const cleanup = requests.find(({ method }) => method === 'DELETE');
  assert.ok(cleanup.url.includes(encodeURIComponent(expiredEndpoint)));
  assert.ok(cleanup.url.includes('family_id=eq.family-one'));
  assert.ok(cleanup.url.includes('user_type=eq.family'));
});


test('roteador agrupado encaminha operações Push e arquivos com autenticação', async () => {
  const pushSubscribe = responseCapture();
  await pushApiHandler({
    method: 'POST',
    query: { mode: 'subscribe' },
    headers: {},
    body: { familyId: 'family-one', userType: 'family' },
  }, pushSubscribe);
  assert.equal(pushSubscribe.statusCode, 401);

  const pushBroadcast = responseCapture();
  await pushApiHandler({
    method: 'POST',
    query: { mode: 'broadcast' },
    headers: {},
    body: { title: 'Aviso', body: 'Teste' },
  }, pushBroadcast);
  assert.equal(pushBroadcast.statusCode, 401);

  const attachments = responseCapture();
  await familyFilesApiHandler({
    method: 'POST',
    query: { mode: 'attachments' },
    headers: {},
    body: { action: 'sign', familyId: 'family-one' },
  }, attachments);
  assert.equal(attachments.statusCode, 401);

  const deletion = responseCapture();
  await familyFilesApiHandler({
    method: 'POST',
    query: { mode: 'delete' },
    headers: {},
    body: { familyId: 'family-one' },
  }, deletion);
  assert.equal(deletion.statusCode, 401);

  const cleanup = responseCapture();
  await familyFilesApiHandler({
    method: 'POST',
    query: { mode: 'cleanup' },
    headers: {},
    body: {},
  }, cleanup);
  assert.equal(cleanup.statusCode, 401);
});
