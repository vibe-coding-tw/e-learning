const admin = require("firebase-admin");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const logger = require("firebase-functions/logger");

const sandboxDir = "/tmp/cron_sandbox";

/**
 * 下載 URL 內容並寫入至本機檔案路徑。
 * @param {string} url - 來源 URL
 * @param {string} destPath - 目標檔案路徑
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

/**
 * 批次下載評分腳本並對近期的作業進行自動評分。
 */
async function runCronGrading() {
    logger.info("=== STARTING SCHEDULED CRON GRADING RUN ===");
    const db = admin.firestore();
    
    // 建立沙盒目錄
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir);

    try {
        const now = admin.firestore.Timestamp.now();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // 查詢最近 30 天內有更新過的作業
        const snap = await db.collection("assignments")
            .where("updatedAt", ">=", thirtyDaysAgo)
            .get();
            
        if (snap.empty) {
            logger.info("No assignments updated in the last 30 days.");
            return;
        }

        logger.info(`Analyzing ${snap.size} recent assignments...`);
        const token = process.env.GITHUB_API_TOKEN || "";
        const hostingUrl = "https://e-learning-942f7.web.app";

        for (const doc of snap.docs) {
            const data = doc.data();
            const docId = doc.id;
            const repoUrl = data.repositoryUrl;
            const repoName = data.repositoryName;
            const unitId = data.unitId;
            const studentUid = data.userId || data.uid || docId.split('_')[0];
            const currentScore = data.grade !== undefined && data.grade !== null ? data.grade : (data.autoGrade?.score || 0);

            // 已經滿分則跳過，避免重複執行
            if (currentScore >= 100) {
                continue;
            }

            if (!repoUrl || !repoName || !unitId) {
                continue;
            }

            const graderName = unitId.replace(/\.html$/, "");
            logger.info(`\n[Cron Grader] Evaluating: ${docId} (Unit: ${unitId}, Repo: ${repoName})`);

            // 下載對應的評分腳本
            const graderUrl = `${hostingUrl}/graders/${graderName}.sh`;
            const localGraderPath = path.join("/tmp", `${graderName}_cron.sh`);

            try {
                await downloadFile(graderUrl, localGraderPath);
                fs.chmodSync(localGraderPath, "755");

                // 複製 GitHub 倉庫，包含 Token 驗證
                let cloneUrl = repoUrl;
                if (token && repoUrl.startsWith("https://github.com/")) {
                    cloneUrl = repoUrl.replace("https://github.com/", `https://${token}@github.com/`);
                }

                const localRepoPath = path.join(sandboxDir, repoName);
                if (fs.existsSync(localRepoPath)) {
                    fs.rmSync(localRepoPath, { recursive: true, force: true });
                }

                execSync(`git clone ${cloneUrl} ${localRepoPath} --depth 1`, { stdio: "ignore" });

                // 執行評分
                const scoreOutput = execSync(`bash ${localGraderPath}`, {
                    cwd: localRepoPath,
                    encoding: "utf8"
                }).trim();

                const score = parseInt(scoreOutput, 10);
                if (Number.isNaN(score)) {
                    throw new Error(`Invalid score output: "${scoreOutput}"`);
                }

                logger.info(`  👉 Computed Score: ${score}/100`);

                // 若分數有變動才寫入，減少 Firestore 寫入成本
                if (score !== currentScore) {
                    const historyEntry = {
                        timestamp: now,
                        content: `Cron Auto-grade: ${score}/100`,
                        action: "AUTO_GRADE"
                    };

                    const isPass = score >= 70;
                    const finalStatus = isPass ? "graded" : (data.currentStatus || data.status || "submitted");
                    const learningState = isPass ? "resolved" : (data.learningState || "blocked");

                    const updatePayload = {
                        grade: score,
                        tutorFeedback: `自動排程評鑑分數為 ${score} 分。`,
                        teacherFeedback: `自動排程評鑑分數為 ${score} 分。`,
                        status: finalStatus,
                        currentStatus: finalStatus,
                        learningState: learningState,
                        updatedAt: now,
                        submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
                    };

                    await db.collection("assignments").doc(docId).update(updatePayload);
                    logger.info(`  ✅ Updated assignment ${docId} with new score ${score}`);
                } else {
                    logger.info("  Score unchanged. Skipping write.");
                }

            } catch (err) {
                logger.error(`  🚨 Error evaluating ${docId}:`, err.message);
            } finally {
                // 清理下載的腳本
                if (fs.existsSync(localGraderPath)) {
                    fs.unlinkSync(localGraderPath);
                }
            }
        }

    } catch (globalErr) {
        logger.error("🚨 Cron grading execution failed:", globalErr);
    } finally {
        // 清理沙盒
        if (fs.existsSync(sandboxDir)) {
            fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
    }
    logger.info("=== SCHEDULED CRON GRADING RUN COMPLETED ===");
}

module.exports = {
    runCronGrading
};
