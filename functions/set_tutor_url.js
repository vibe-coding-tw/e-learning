const https = require('https');
const { execSync } = require('child_process');

// 1. Get Token from gcloud (fallback to empty)
let token = "";
try {
    token = execSync('gcloud auth print-access-token').toString().trim();
} catch (e) {
    console.error("❌ Failed to get token via gcloud. Trying firebase...");
    token = execSync('firebase auth:token').toString().trim(); // older firebase alternative
}
const uid = 'lmg7jPw34ffuxRrSWLohzL9uey23';
const unitId = 'start-01-unit-html5-basics.html';
const url = 'https://classroom.github.com/a/TFjFeGBg';

// Firestore update mask requires field names with dots to be enclosed in backticks
const escapedPath = 'tutorConfigs.`start-01-unit-html5-basics.html`';

const data = JSON.stringify({
  fields: {
    tutorConfigs: {
      mapValue: {
        fields: {
          [unitId]: {
            mapValue: {
              fields: {
                githubClassroomUrl: { stringValue: url },
                authorized: { booleanValue: true }
              }
            }
          }
        }
      }
    }
  }
});

const options = {
  hostname: 'firestore.googleapis.com',
  port: 443,
  path: `/v1/projects/e-learning-942f7/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=${encodeURIComponent(escapedPath)}`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`[Firestore PATCH] Updating UID: ${uid} for ${unitId}...`);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`✅ Success: ${unitId} GitHub Classroom URL is now: ${url}`);
    } else {
      console.error(`❌ Error (${res.statusCode}): ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request Error: ${e.message}`);
  process.exit(1);
});

req.write(data);
req.end();
