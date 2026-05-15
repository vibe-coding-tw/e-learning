const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function runJson(token, body) {
  const payload = JSON.stringify(body).replace(/'/g, "'\\''");
  const cmd = `curl -s -H \"Authorization: Bearer ${token}\" -H \"Content-Type: application/json\" \"https://firestore.googleapis.com/v1/projects/e-learning-942f7/databases/(default)/documents:runQuery\" -d '${payload}'`;
  return JSON.parse(run(cmd));
}

function patchRole(token, docPath, role) {
  const body = JSON.stringify({ fields: { role: { stringValue: role } } }).replace(/'/g, "'\\''");
  const url = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=role`;
  const cmd = `curl -s -X PATCH -H \"Authorization: Bearer ${token}\" -H \"Content-Type: application/json\" \"${url}\" -d '${body}'`;
  return JSON.parse(run(cmd));
}

(function main() {
  const token = run('gcloud auth print-access-token').trim();

  const query = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'role' },
          op: 'EQUAL',
          value: { stringValue: 'student' }
        }
      }
    }
  };

  const rows = runJson(token, query).filter(r => r.document);
  const docs = rows.map(r => ({
    name: r.document.name,
    uid: r.document.name.split('/').pop(),
    email: r.document.fields?.email?.stringValue || ''
  }));

  const updated = [];
  for (const d of docs) {
    patchRole(token, d.name.replace(/^projects\//, 'projects/'), 'user');
    updated.push({ uid: d.uid, email: d.email });
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    matchedStudentRoleCount: docs.length,
    updatedToUserCount: updated.length,
    updated
  }, null, 2));
})();
