const { execFileSync } = require('child_process');

const PROJECT_ID = 'e-learning-942f7';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const UID = 'k36RVpPwZoftnLwMtG4S4d4yLmj2';
const EMAIL = 'rover.k.chen@gmail.com';
const NAME = 'Rover Chen';
const NOW = new Date().toISOString();

const ADVANCED_UNITS = [
  'adv-01-unit-s3-interfaces.html',
  'adv-01-unit-mjpeg-stream.html',
  'adv-01-unit-jpeg-quality.html',
  'adv-02-unit-video-streaming.html',
  'adv-02-unit-canvas-image.html',
  'adv-02-unit-bandwidth-fps.html',
  'adv-03-unit-ble-notify.html',
  'adv-03-unit-json-serialization.html',
  'adv-03-unit-ble-mtu.html',
  'adv-04-unit-i2c-spi.html',
  'adv-04-unit-json-rest.html',
  'adv-04-unit-filter-algorithms.html',
  'adv-05-unit-feature-extraction.html',
  'adv-05-unit-centroid-error.html',
  'adv-05-unit-closed-loop.html',
  'adv-06-unit-threshold-filter.html',
  'adv-06-unit-centroid-algorithm.html',
  'adv-06-unit-hsv-math.html',
  'adv-06-unit-look-ahead.html',
  'adv-07-unit-ui-framework.html',
  'adv-07-unit-chart-canvas.html',
  'adv-07-unit-json-parsing.html',
  'adv-07-unit-event-polling.html',
  'adv-08-unit-color-spaces.html',
  'adv-08-unit-error-calculation.html',
  'adv-08-unit-p-control.html',
  'adv-08-unit-mobilenet-ssd.html',
  'adv-09-unit-cnn-audio.html',
  'adv-09-unit-teachable-machine.html',
  'adv-09-unit-webspeech-api.html',
  'adv-09-unit-flow-control.html',
  'adv-10-unit-icc-geometry.html',
  'adv-10-unit-api-design.html',
  'adv-10-unit-pwm-limits.html',
  'adv-11-unit-sensor-principles.html',
  'adv-11-unit-hardware-interrupts.html',
  'adv-11-unit-speed-algorithms.html',
  'adv-12-unit-pid-control.html',
  'adv-12-unit-pid-math.html',
  'adv-12-unit-code-logic.html',
  'adv-13-unit-robustness.html',
  'adv-13-unit-system-perf.html',
  'adv-13-unit-technical-narrative.html',
  'adv-14-unit-debugging-art.html',
  'adv-14-unit-kpi-definition.html',
  'adv-14-unit-refactoring.html',
  'adv-15-unit-data-flow.html',
  'adv-15-unit-ble-async.html',
  'adv-15-unit-pid-simulation.html',
  'adv-15-unit-image-dma.html'
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

  for (const unit of ADVANCED_UNITS) {
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
      source: { stringValue: 'manual_advanced_batch' },
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

  for (const unit of ADVANCED_UNITS) {
    const code = ensurePromoCode(unit, promoMap);
    summary.push({ unit, promoCode: code });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
