/**
 * scripts/test_graders_sandbox.js
 * 
 * Local grader validation tool. Iterates over all grader scripts in public/graders/
 * and performs:
 *  1. Static analysis using shellcheck (if available locally)
 *  2. Sandbox execution check in a temporary empty workspace, verifying exit status and score formatting.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GRADERS_DIR = path.join(__dirname, '../public/graders');
const TEMP_BASE_DIR = '/tmp/grader_test_sandbox';

function checkShellcheck() {
  try {
    execSync('which shellcheck', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('🔍 Starting Grader Validation...');
  
  if (!fs.existsSync(GRADERS_DIR)) {
    console.error(`❌ Graders directory not found at ${GRADERS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(GRADERS_DIR).filter(f => f.endsWith('.sh') && f !== 'run.sh');
  console.log(`Found ${files.length} grader scripts to evaluate.`);

  const hasShellcheck = checkShellcheck();
  if (!hasShellcheck) {
    console.log('   "shellcheck" is not installed locally. Static analysis linting will be skipped (will run in GitHub Actions instead).');
  }

  let failedCount = 0;
  const results = [];

  // Create base temp directory if not exists
  if (!fs.existsSync(TEMP_BASE_DIR)) {
    fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });
  }

  for (const file of files) {
    const filePath = path.join(GRADERS_DIR, file);
    console.log(`Testing Grader: ${file}`);

    let shellcheckPassed = true;
    let shellcheckError = '';

    if (hasShellcheck) {
      try {
        execSync(`shellcheck ${filePath}`, { stdio: 'pipe' });
      } catch (err) {
        shellcheckPassed = false;
        shellcheckError = err.stdout ? err.stdout.toString() : err.message;
      }
    }

    // Run execution test
    const testTempDir = path.join(TEMP_BASE_DIR, `test_${file.replace('.sh', '')}_${Date.now()}`);
    fs.mkdirSync(testTempDir, { recursive: true });

    let runPassed = true;
    let score = null;
    let runError = '';

    try {
      // Run the grader in empty temp directory
      const stdout = execSync(`bash ${filePath} 100`, { cwd: testTempDir, stdio: 'pipe' }).toString().trim();
      score = parseInt(stdout, 10);

      if (isNaN(score)) {
        runPassed = false;
        runError = `Grader output is not an integer: "${stdout}"`;
      } else if (score < 0 || score > 100) {
        runPassed = false;
        runError = `Grader output score ${score} is out of bounds [0, 100]`;
      }
    } catch (err) {
      runPassed = false;
      runError = err.stderr ? err.stderr.toString().trim() : err.message;
    } finally {
      // Cleanup individual temp dir
      try {
        execSync(`rm -rf ${testTempDir}`);
      } catch (e) {
        // ignore
      }
    }

    const passed = shellcheckPassed && runPassed;
    if (!passed) {
      failedCount++;
    }

    results.push({
      file,
      shellcheckPassed,
      shellcheckError,
      runPassed,
      score,
      runError,
      passed
    });
  }

  // Final cleanup of base temp dir
  try {
    execSync(`rm -rf ${TEMP_BASE_DIR}`);
  } catch (e) {}

  console.log('\n================================================');
  console.log('🏁 Grader Validation Complete.');
  console.log(`Total Scripts: ${files.length}`);
  console.log(`Passed: ${files.length - failedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('================================================');

  if (failedCount > 0) {
    console.error('\n❌ Detailed Failures:');
    results.forEach(res => {
      if (!res.passed) {
        console.error(`- ${res.file}:`);
        if (!res.shellcheckPassed) {
          console.error(`  [Lint Error]\n${res.shellcheckError}`);
        }
        if (!res.runPassed) {
          console.error(`  [Run Error] ${res.runError}`);
        }
      }
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All grader checks passed successfully!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
