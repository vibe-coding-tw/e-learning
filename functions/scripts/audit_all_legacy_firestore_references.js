#!/usr/bin/env node
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const LEGACY_TO_CANONICAL = {
  "01-master-getting-started.html": "common-developer-identity.html",
  "02-master-ai-agents.html": "common-agent-mode.html",
  "03-master-wifi-motor.html": "common-github-classroom.html",
  "01-unit-vscode-online.html": "common-vscode-online.html",
  "01-unit-vscode-setup.html": "common-vscode-setup.html",
  "02-unit-agent-mode.html": "common-agent-mode.html",
  "02-unit-classroom-workflow.html": "common-github-classroom.html",
  "02-unit-github-classroom.html": "common-github-classroom.html",
  "03-unit-motor-ramping.html": "common-motor-ramping.html",
  "03-unit-wifi-setup.html": "common-wifi-setup.html",

  "adv-01-master-s3-cam.html": "adv-01-unit-jpeg-quality.html",
  "adv-02-master-video.html": "adv-02-unit-bandwidth-fps.html",
  "adv-03-master-ble-advanced.html": "adv-03-unit-ble-mtu.html",
  "adv-04-master-sensors.html": "adv-04-unit-filter-algorithms.html",
  "adv-05-master-cv.html": "adv-05-unit-centroid-error.html",
  "adv-06-master-cv-advanced.html": "adv-06-unit-centroid-algorithm.html",
  "adv-07-master-ui-framework.html": "adv-07-unit-chart-canvas.html",
  "adv-08-master-image-processing.html": "adv-08-unit-color-spaces.html",
  "adv-09-master-ai-recognition.html": "adv-09-unit-cnn-audio.html",
  "adv-10-master-diff-drive.html": "adv-10-unit-api-design.html",
  "adv-11-master-photoelectric.html": "adv-11-unit-hardware-interrupts.html",
  "adv-12-master-pid.html": "adv-12-unit-code-logic.html",
  "adv-13-master-robustness.html": "adv-13-unit-robustness.html",
  "adv-14-master-debugging-art.html": "adv-14-unit-debugging-art.html",
  "adv-15-master-architecture.html": "adv-15-unit-ble-async.html",

  "basic-01-master-environment.html": "basic-01-unit-drivers-ports.html",
  "basic-02-master-ota-architecture.html": "basic-02-unit-ota-principles.html",
  "basic-03-master-io-mapping.html": "basic-03-unit-adc-resolution.html",
  "basic-04-master-pwm-control.html": "basic-04-unit-h-bridge.html",
  "basic-05-master-ble-gatt.html": "basic-05-unit-advertising-connection.html",
  "basic-06-master-http-web.html": "basic-06-unit-cors-security.html",
  "basic-07-master-wifi-modes.html": "basic-07-unit-async-webserver.html",
  "basic-08-master-joystick-math.html": "basic-08-unit-joystick-mapping.html",
  "basic-09-master-multitasking.html": "basic-09-unit-hardware-timer.html",
  "basic-10-master-fsm.html": "basic-10-unit-fsm.html",

  "start-01-master-web-app.html": "start-01-unit-flexbox-layout.html",
  "start-02-master-web-ble.html": "start-02-unit-ble-async.html",
  "start-03-master-remote-control.html": "start-03-unit-control-panel.html",
  "start-04-master-touch-events.html": "start-04-unit-long-press.html",
  "start-05-master-joystick-lab.html": "start-05-unit-canvas-joystick.html"
};

// Check if a string is or contains legacy unit references (including language prefix)
function checkLegacyValue(str) {
  if (typeof str !== "string") return null;
  const s = str.trim();
  const lower = s.toLowerCase();
  
  // 1. Direct match or matches with prefix stripped
  for (const legacy of Object.keys(LEGACY_TO_CANONICAL)) {
    if (lower === legacy.toLowerCase()) {
      return { type: "legacy_html", legacy, canonical: LEGACY_TO_CANONICAL[legacy] };
    }
    const noExt = legacy.replace(/\.html$/i, "");
    if (lower === noExt.toLowerCase()) {
      return { type: "legacy_no_ext", legacy, canonical: LEGACY_TO_CANONICAL[legacy].replace(/\.html$/i, "") };
    }
  }

  // 2. Language prefixes (tw- / en-) on canonical keys
  if (/^(?:tw|en)-/i.test(s)) {
    const stripped = s.replace(/^(?:tw|en)-/i, "");
    // Check if stripped is valid canonical or legacy
    if (stripped.startsWith("common-") || stripped.startsWith("start-") || stripped.startsWith("basic-") || stripped.startsWith("adv-")) {
      return { type: "prefixed_canonical", legacy: s, canonical: stripped };
    }
  }

  return null;
}

// Deep inspect object for any legacy strings
function inspectObject(obj, path = "") {
  const matches = [];
  if (!obj || typeof obj !== "object") return matches;

  for (const [key, val] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Check key itself
    const keyMatch = checkLegacyValue(key);
    if (keyMatch) {
      matches.push({ path: `KEY:${currentPath}`, val: key, ...keyMatch });
    }

    if (typeof val === "string") {
      const match = checkLegacyValue(val);
      if (match) {
        matches.push({ path: currentPath, val, ...match });
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (typeof item === "string") {
          const match = checkLegacyValue(item);
          if (match) {
            matches.push({ path: `${currentPath}[${idx}]`, val: item, ...match });
          }
        } else if (item && typeof item === "object") {
          matches.push(...inspectObject(item, `${currentPath}[${idx}]`));
        }
      });
    } else if (val && typeof val === "object") {
      matches.push(...inspectObject(val, currentPath));
    }
  }
  return matches;
}

async function auditCollection(name) {
  console.log(`\nAuditing collection: ${name}...`);
  const snap = await db.collection(name).get();
  let docCount = 0;
  let hitCount = 0;

  for (const doc of snap.docs) {
    docCount++;
    const data = doc.data();
    
    // Check document ID itself
    const docIdMatch = checkLegacyValue(doc.id);
    const idMatches = docIdMatch ? [{ path: "DOCUMENT_ID", val: doc.id, ...docIdMatch }] : [];
    
    const fieldsMatches = inspectObject(data);
    const allMatches = [...idMatches, ...fieldsMatches];

    if (allMatches.length > 0) {
      hitCount++;
      console.log(`  [HIT] Document ID: ${doc.id}`);
      allMatches.forEach((m) => {
        console.log(`    - Path: ${m.path}`);
        console.log(`      Value: "${m.val}"`);
        console.log(`      Resolution: ${m.type} -> "${m.canonical}"`);
      });
    }
  }
  console.log(`Collection ${name} finished: scanned ${docCount} documents, found ${hitCount} documents with legacy references.`);
}

async function main() {
  const collections = ["metadata_lessons", "assignments", "users", "orders", "referral_links"];
  for (const col of collections) {
    await auditCollection(col);
  }
}

main().catch(console.error);
