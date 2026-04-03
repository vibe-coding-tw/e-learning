const { execFileSync } = require('child_process');

const PROJECT_ID = 'e-learning-942f7';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const UID = 'k36RVpPwZoftnLwMtG4S4d4yLmj2';
const EMAIL = 'rover.k.chen@gmail.com';
const NAME = 'Rover Chen';
const NOW = new Date().toISOString();

const BASIC_UNITS = [
  'basic-01-unit-esp32-architecture.html',
  'basic-01-unit-platformio-setup.html',
  'basic-01-unit-drivers-ports.html',
  'basic-02-unit-partition-table.html',
  'basic-02-unit-ota-principles.html',
  'basic-02-unit-ota-security.html',
  'basic-03-unit-pinout.html',
  'basic-03-unit-pullup-debounce.html',
  'basic-03-unit-adc-resolution.html',
  'basic-04-unit-pwm-basics.html',
  'basic-04-unit-h-bridge.html',
  'basic-04-unit-ledc-syntax.html',
  'basic-05-unit-gatt-structure.html',
  'basic-05-unit-advertising-connection.html',
  'basic-05-unit-ble-properties.html',
  'basic-06-unit-fetch-api.html',
  'basic-06-unit-http-request.html',
  'basic-06-unit-cors-security.html',
  'basic-07-unit-wifi-ap-sta.html',
  'basic-07-unit-http-lifecycle.html',
  'basic-07-unit-async-webserver.html',
  'basic-08-unit-joystick-mapping.html',
  'basic-08-unit-unicycle-model.html',
  'basic-08-unit-response-curves.html',
  'basic-09-unit-millis.html',
  'basic-09-unit-hardware-timer.html',
  'basic-09-unit-sampling-rate.html',
  'basic-10-unit-fsm.html',
  'basic-10-unit-ui-design.html',
  'basic-10-unit-state-consistency.html'
];

function token() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

function curlJson(args, body = null) {
  const auth = `Authorization: Bearer ${token()}`;
  const curlArgs = ['-s', '-H', auth, '-H', 'Accept: application/json'];
  if (body !== null) curlArgs.push('-H', 'Content-Type: application/json');
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

  for (const unit of BASIC_UNITS) {
    tutorFields[unit] = {
      mapValue: {
        fields: {
          authorized: { booleanValue: true },
          email: { stringValue: EMAIL },
          name: { stringValue: NAME },
          qualifiedAt: { stringValue: NOW }
        }
      }
    };
  }

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
        fieldFilter: {
          field: { fieldPath: 'tutorEmail' },
          op: 'EQUAL',
          value: { stringValue: EMAIL }
        }
      }
    }
  };

  const result = curlJson([`${BASE}:runQuery`], query);
  const map = new Map();
  for (const row of result) {
    const doc = row.document;
    if (!doc) continue;
    const courseId = doc.fields?.courseId?.stringValue;
    const code = doc.name.split('/').pop();
    if (courseId && code) map.set(courseId, code);
  }
  return map;
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

function ensurePromoCode(courseId, existingMap) {
  if (existingMap.has(courseId)) return existingMap.get(courseId);

  let code = '';
  do {
    code = randomCode();
  } while (promoCodeExists(code));

  const body = {
    fields: {
      tutorEmail: { stringValue: EMAIL },
      tutorName: { stringValue: NAME },
      courseId: { stringValue: courseId },
      isActive: { booleanValue: true },
      source: { stringValue: 'manual_basic_batch' },
      createdAt: { timestampValue: NOW }
    }
  };

  curlJson(['-X', 'PATCH', `${BASE}/promo_codes/${code}`], body);
  existingMap.set(courseId, code);
  return code;
}

function main() {
  const userDoc = getUserDoc();
  patchUserTutorConfigs(userDoc);

  const promoMap = getExistingPromoMap();
  const summary = [];

  for (const unit of BASIC_UNITS) {
    const code = ensurePromoCode(unit, promoMap);
    summary.push({ unit, promoCode: code });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
