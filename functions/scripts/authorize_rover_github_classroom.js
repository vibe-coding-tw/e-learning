const { execFileSync } = require('child_process');

const PROJECT_ID = 'e-learning-942f7';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const UID = 'k36RVpPwZoftnLwMtG4S4d4yLmj2';
const EMAIL = 'rover.k.chen@gmail.com';
const NAME = 'Rover Chen';
const NOW = new Date().toISOString();
const UNIT_ID = '03-unit-github-classroom.html';

function token() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

function curlJson(args, body = null) {
  const auth = `Authorization: Bearer ${token()}`;
  const curlArgs = ['-s', '-H', auth, '-H', 'Accept: application/json'];
  if (body !== null) {
    curlArgs.push('-H', 'Content-Type: application/json');
  }
  curlArgs.push(...args);
  if (body !== null) curlArgs.push('-d', JSON.stringify(body));
  const raw = execFileSync('curl', curlArgs, { encoding: 'utf8' });
  const json = raw ? JSON.parse(raw) : {};
  if (json.error) {
    throw new Error(`${json.error.status || 'ERROR'}: ${json.error.message}`);
  }
  return json;
}

function getUserDoc() {
  return curlJson([`${BASE}/users/${UID}`]);
}

function patchUserTutorConfigs(doc) {
  const tutorFields = (((doc || {}).fields || {}).tutorConfigs || {}).mapValue?.fields || {};

  tutorFields[UNIT_ID] = {
    mapValue: {
      fields: {
        authorized: { booleanValue: true },
        email: { stringValue: EMAIL },
        name: { stringValue: NAME },
        qualifiedAt: { stringValue: NOW }
      }
    }
  };

  const body = {
    fields: {
      tutorConfigs: {
        mapValue: { fields: tutorFields }
      },
      updatedAt: {
        timestampValue: NOW
      }
    }
  };

  return curlJson(
    [
      '-X',
      'PATCH',
      `${BASE}/users/${UID}?updateMask.fieldPaths=tutorConfigs&updateMask.fieldPaths=updatedAt`
    ],
    body
  );
}

function getExistingPromoMap() {
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'promo_codes' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'tutorEmail' },
                op: 'EQUAL',
                value: { stringValue: EMAIL }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'courseId' },
                op: 'EQUAL',
                value: { stringValue: UNIT_ID }
              }
            }
          ]
        }
      }
    }
  };

  const result = curlJson([`${BASE}:runQuery`], query);
  for (const row of result) {
    const doc = row.document;
    if (!doc) continue;
    const code = doc.name.split('/').pop();
    if (code) return code;
  }
  return null;
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function promoCodeExists(code) {
  try {
    curlJson([`${BASE}/promo_codes/${code}`]);
    return true;
  } catch (error) {
    if (String(error.message).includes('Requested entity was not found')) return false;
    if (String(error.message).includes('NOT_FOUND')) return false;
    throw error;
  }
}

function ensurePromoCode() {
  const existingCode = getExistingPromoMap();
  if (existingCode) return existingCode;

  let code = '';
  do {
    code = randomCode();
  } while (promoCodeExists(code));

  const body = {
    fields: {
      tutorEmail: { stringValue: EMAIL },
      tutorName: { stringValue: NAME },
      courseId: { stringValue: UNIT_ID },
      isActive: { booleanValue: true },
      source: { stringValue: 'manual_single_unit_batch' },
      createdAt: { timestampValue: NOW }
    }
  };

  curlJson(['-X', 'PATCH', `${BASE}/promo_codes/${code}`], body);
  return code;
}

function main() {
  const userDoc = getUserDoc();
  patchUserTutorConfigs(userDoc);
  const promoCode = ensurePromoCode();
  console.log(JSON.stringify({ unit: UNIT_ID, email: EMAIL, promoCode }, null, 2));
}

main();
