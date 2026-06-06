#!/usr/bin/env node
/**
 * Automatically translate Traditional Chinese metadata fields to English using Vertex AI Gemini.
 *
 * Usage:
 *   node functions/scripts/translate_lessons_metadata.js --dry-run
 *   node functions/scripts/translate_lessons_metadata.js --apply
 */

const admin = require("firebase-admin");
const { execSync } = require("child_process");
const https = require("https");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

// Retrieve access token
let accessToken = "";
try {
  accessToken = execSync("gcloud auth application-default print-access-token").toString().trim();
} catch (err) {
  console.error("❌ Failed to retrieve gcloud access token. Run 'gcloud auth application-default login' first.");
  process.exit(1);
}

function callGemini(instruction, textToTranslate) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: {
        role: "USER",
        parts: { text: textToTranslate }
      },
      systemInstruction: {
        parts: { text: instruction }
      },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    });

    const project = "e-learning-942f7";
    const location = "us-central1";
    const model = "gemini-2.5-flash";
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const req = https.request(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "X-Goog-User-Project": project,
        "Content-Type": "application/json"
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`API Error: ${res.statusCode} - ${data}`));
        }
        try {
          const resJson = JSON.parse(data);
          const candidates = resJson.candidates || [];
          if (candidates.length === 0) return resolve("");
          let text = candidates[0].content?.parts?.[0]?.text || "";
          
          // Clean markdown wrappers if any
          text = text.trim();
          if (text.startsWith("```")) {
            const lines = text.split("\n");
            if (lines[0].startsWith("```")) lines.shift();
            if (lines[lines.length - 1].startsWith("```")) lines.pop();
            text = lines.join("\n").trim();
          }
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const isApply = process.argv.includes("--apply");
  const mode = isApply ? "APPLY" : "DRY_RUN";

  console.log(`[translate_lessons_metadata] Starting translation in mode=${mode}...`);

  const snap = await db.collection("metadata_lessons").get();
  console.log(`[translate_lessons_metadata] Loaded ${snap.size} documents.`);

  const instruction = (
    "You are a professional technical translator specializing in software engineering, embedded systems, and robotics. " +
    "Translate the given Traditional Chinese (zh-TW) text to natural, clear English (en). " +
    "Keep technical terms (like ESP32, WiFi, BLE, OTA, PID, etc.) as-is. Output ONLY the translated English text, " +
    "with no surrounding markdown, tags, or explanations."
  );

  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const summaryEn = String(data.summaryEn || "").trim();
    
    // Check if summaryEn is empty or missing
    if (summaryEn !== "") {
      skippedCount += 1;
      continue;
    }

    const sourceChinese = String(data.tagText || data.summary || data.description || "").trim();
    if (!sourceChinese) {
      skippedCount += 1;
      continue;
    }

    console.log(`[${doc.id}] Translating: "${sourceChinese.substring(0, 30)}..."`);
    
    try {
      const translation = await callGemini(instruction, sourceChinese);
      console.log(`    -> Translated: "${translation}"`);

      if (isApply) {
        await doc.ref.update({
          summaryEn: translation,
          i18nUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          i18nUpdatedBy: "gemini-metadata-translator"
        });
      }
      updatedCount += 1;
    } catch (apiErr) {
      console.error(`  ❌ Failed to translate [${doc.id}]:`, apiErr.message);
    }
    
    // Sleep briefly to avoid aggressive rate limiters
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[translate_lessons_metadata] Completed. Updated: ${updatedCount}, Skipped: ${skippedCount}, Mode: ${mode}`);
}

main().catch(err => {
  console.error("❌ Script execution failed:", err);
  process.exit(1);
});
