# GitHub API 原生整合計劃

## 概述

本計劃旨在在 GitHub Classroom 停止支援前，將其核心功能直接整合到 Vibe Coding 平台。通過自建邀請派發、自動評分、權限管理等功能，實現對 Classroom 功能的完全替代，並提供更高度的客製化與安全控制。

**目標效果**：
- 學生一鍵領取作業，無需進入組織 Pending 流程
- 自動為學生建立私有 Repo，直接授予 Collaborator 權限
- 自動評分結果回寫到 Dashboard
- 教材同步與 PR 管理完全由系統控制
- 推薦連結與分潤機制無縫整合

---

## 1. 整體架構設計

### 1.1 現狀分析

**GitHub Classroom 在 Vibe Coding 中的作用**：
- 建立學生作業 Repo（Template Repo → Student Repo）
- 發送邀請連結與權限管理
- 觸發自動評分 Workflow（GitHub Actions）
- 提供 Feedback Pull Request 機制

**問題點**：
- Classroom 依賴組織成員邀請，學生有時卡在 Pending
- Classroom API 功能有限，難以客製化
- GitHub 官方已宣佈停止支援
- 無法與 Vibe Coding 的導師分潤、推薦連結等機制深度整合

### 1.2 新架構目標

```mermaid
graph TB
    subgraph Frontend["前端（Dashboard）"]
        F1["學生：點擊『領取作業』按鈕"]
        F2["導師：在 Settings 中配置作業連結"]
    end

    subgraph Backend["後端 API（Cloud Functions）"]
        B1["createStudentAssignmentRepo()"]
        B2["addCollaboratorToRepo()"]
        B3["triggerAutogradeWorkflow()"]
        B4["ingestAutogradeResult()"]
    end

    subgraph GitHub["GitHub API / Actions"]
        G1["Template Repo"]
        G2["Student Repo"]
        G3["Actions Workflow"]
    end

    subgraph Firestore["Firestore"]
        D1["assignments"]
        D2["unitAssignments"]
    end

    F1 -->|"呼叫 API"| B1
    F2 -->|"配置連結"| D2
    B1 -->|"使用 GitHub API"| G1
    B1 -->|"建立 Student Repo"| G2
    B2 -->|"PUT /collaborators"| G2
    B3 -->|"觸發 Workflow"| G3
    G3 -->|"Push → Test"| G3
    G3 -->|"Webhook 回傳分數"| B4
    B4 -->|"回寫分數"| D1
```

---

## 2. 實作階段（Phase 計劃）

### Phase 1：基礎 API 層（第 1-2 周）

#### 1.1 GitHub Token 管理
- 建立 GitHub Personal Access Token（Fine-grained）
- 存入 Firebase Secrets（`GITHUB_API_TOKEN`）
- 限制 Token 權限：僅限 `vibe-coding-classroom` Org 內的操作
- 權限清單：`repos`, `workflows`, `admin:org_hook`

#### 1.2 安裝 PyGithub 或 GitHub REST 客戶端
```
# functions/package.json 新增
"@octokit/rest": "^19.0.0"  # 或保持 Node.js 原生 fetch
```

#### 1.3 建立基礎 HTTP 函數框架
```javascript
// functions/github-api-helper.js
class GitHubAPIHelper {
    constructor(token) {
        this.token = token;
        this.baseUrl = "https://api.github.com";
    }

    async createRepoFromTemplate(orgName, templateRepo, newRepoName, isPrivate = true) {
        // POST /repos/{owner}/{template_repo}/generate
    }

    async addCollaborator(orgName, repoName, username, permission = 'push') {
        // PUT /repos/{owner}/{repo}/collaborators/{username}
    }

    async removeCollaborator(orgName, repoName, username) {
        // DELETE /repos/{owner}/{repo}/collaborators/{username}
    }
}

module.exports = GitHubAPIHelper;
```

---

### Phase 2：學生邀請派發流程（第 3-4 周）

#### 2.1 前端交互改進
- 在 Dashboard 「領取作業」按鈕旁加入「正在建立倉庫...」的進度提示
- 成功後：直接顯示 Repo 連結 + 複製按鈕
- 失敗時：顯示友善錯誤信息 + 重試按鈕

#### 2.2 後端 Cloud Function 實作

**新增函數：`createStudentRepository`**

```javascript
// 觸發條件：學生點擊「領取作業」
exports.createStudentRepository = onCall(async (request) => {
    const { unitId } = request.data;
    const user = request.auth;

    // 1. 驗證：學生是否已付費或有資格
    const hasAccess = await checkPaymentAuthorization(user.uid, unitId);
    if (!hasAccess) throw new HttpsError('permission-denied', '未付費');

    // 2. 檢查是否已建立過此 Repo
    const assignment = await db.collection('assignments')
        .where('userId', '==', user.uid)
        .where('unitId', '==', unitId)
        .limit(1)
        .get();

    if (!assignment.empty && assignment.docs[0].data().repositoryUrl) {
        // 已建立，直接回傳現有連結
        return { repositoryUrl: assignment.docs[0].data().repositoryUrl };
    }

    // 3. 取得對應的 Template Repo
    const unitConfig = await db.collection('metadata_lessons')
        .where('unitId', '==', unitId)
        .limit(1)
        .get();

    const templateRepo = unitConfig.docs[0]?.data().templateRepo || `starter-${unitId}`;

    // 4. 呼叫 GitHub API 建立 Repo
    const ghHelper = new GitHubAPIHelper(process.env.GITHUB_API_TOKEN);
    const newRepoName = `${unitId}-${user.uid.substring(0, 8)}`; // 例：01-vscode-abc12345
    const studentRepo = await ghHelper.createRepoFromTemplate(
        'vibe-coding-classroom',
        templateRepo,
        newRepoName,
        true // private
    );

    // 5. 將學生加為 Collaborator
    await ghHelper.addCollaborator(
        'vibe-coding-classroom',
        newRepoName,
        user.email.split('@')[0], // 假設 GitHub username = email prefix
        'push'
    );

    // 6. 回寫到 Firestore
    const assignmentRef = db.collection('assignments').doc();
    await assignmentRef.set({
        userId: user.uid,
        unitId,
        repositoryUrl: studentRepo.html_url,
        repositoryName: newRepoName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active'
    });

    return { repositoryUrl: studentRepo.html_url };
});
```

#### 2.3 錯誤處理與重試機制
- 如果 GitHub API 暫時不可用，將失敗請求放入 Firestore 隊列
- 定時任務每 5 分鐘檢查並重試失敗的請求

---

### Phase 3：自動評分整合（第 5-6 周）

#### 3.1 GitHub Actions Workflow 範本優化
```yaml
# vibe-coding-classroom-starter/(.github/workflows/autograde.yml)
name: 作業自動評分
on: 
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  VC_AUTOGRADE_URL: ${{ secrets.VC_AUTOGRADE_URL }}
  VC_AUTOGRADE_TOKEN: ${{ secrets.VC_AUTOGRADE_TOKEN }}

jobs:
  autograde:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 設定測試環境（例如 Python）
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'

      # 執行測試
      - name: 執行單元測試
        id: test
        run: |
          python -m pytest tests/ --tb=short -v
        continue-on-error: true

      # 回傳分數給 Vibe System
      - name: 回傳自動評分結果
        if: always()
        run: |
          SCORE=$(python scripts/calculate_score.py)
          PAYLOAD='{"score": '$SCORE', "status": "${{ job.status }}", "commitSha": "${{ github.sha }}"}'
          SIGNATURE=$(printf %s "$PAYLOAD" | openssl dgst -sha256 -hmac "$VC_AUTOGRADE_TOKEN" | sed 's/^.* //')
          curl -X POST "$VC_AUTOGRADE_URL" \
            -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD"
```

#### 3.2 Webhook 接收與分數回寫
- 現有的 `ingestGithubAutograde` 函數已支援 Webhook
- 新增驗證：確認來源必須是 `vibe-coding-classroom` Org

---

### Phase 4：導師配置與推薦連結（第 7-8 周）

#### 4.1 導師在 Settings 中配置作業連結
- UI：Settings 分頁新增「作業連結配置」區塊
- 允許導師為每個單元配置自建 Repo 的連結
- 存儲到 `users.tutorConfigs[unitId].customAssignmentUrl`

#### 4.2 推薦連結機制
- 推薦連結格式：`https://vibe-coding.tw/accept-assignment?referralCode=TUTOR_ID&unitId=UNIT_ID`
- 學生點擊後，自動：
  1. 檢驗推薦碼有效性
  2. 記錄 `assignments.referredByTutor`
  3. 建立作業 Repo
  4. 回寫分潤明細

---

### Phase 5：教材同步與 PR 機制（第 9-10 周）

#### 5.1 Template Repo 更新流程
```
1. 更新 canonical template repo (vibe-coding-template/*)
2. 系統批次偵測更新
3. 對所有學生 Repo 建立同步 PR（從 canonical 提取差異）
4. 導師在 Dashboard 審核並 Merge
5. 學生在他們的 Repo 拉入更新
```

#### 5.2 PR 管理 API
```javascript
// 新增函數：syncTemplateToStudentRepo()
// 用途：建立同步 PR
async function createSyncPR(orgName, studentRepoName, templateRepoName) {
    // 1. 比較 canonical 與 student repo 差異
    // 2. 建立分支 (sync/YYYY-MM-DD)
    // 3. 建立 PR 到 student repo
    // 4. 返回 PR URL
}
```

---

## 3. 技術實作細節

### 3.1 GitHub API 端點清單

| 操作 | 端點 | 方法 | 說明 |
| --- | --- | --- | --- |
| 建立 Repo（from template） | `/repos/{owner}/{template_repo}/generate` | POST | PyGithub / Octokit 原生支援 |
| 新增協力者 | `/repos/{owner}/{repo}/collaborators/{username}` | PUT | 設定 `permission: 'push'` |
| 移除協力者 | `/repos/{owner}/{repo}/collaborators/{username}` | DELETE | 清除權限 |
| 建立 Branch | `/repos/{owner}/{repo}/git/refs` | POST | 用於教材同步 |
| 建立 Pull Request | `/repos/{owner}/{repo}/pulls` | POST | 同步 Template 更新 |
| 取得 Repo 訊息 | `/repos/{owner}/{repo}` | GET | 驗證 Repo 狀態 |
| 建立 Webhook | `/repos/{owner}/{repo}/hooks` | POST | 接收 Actions 完成通知 |

### 3.2 Token 安全管理
- **儲存位置**：Firebase Secrets → `GITHUB_API_TOKEN`
- **權限級別**：Fine-grained Personal Access Token（推薦）
  - Repository：`vibe-coding-classroom/*` 及 `vibe-coding-template/*`
  - Permissions：
    - `contents` (read/write)
    - `pull_requests` (read/write)
    - `workflows` (read/write)
    - `administration` (read)
- **輪換策略**：每 3 個月更新一次 Token
- **監控**：GitHub Audit Log 定期檢查異常操作

### 3.3 Rate Limiting 對策
- GitHub API 限制：每小時 5000 次請求（認證用戶）
- **預估使用**：
  - 每個學生建立 Repo：~5 次 API 呼叫
  - 每次教材同步：~10 次 API 呼叫
  - 月度推算：100 學生 × 5 作業 × 5 呼叫 ≈ 2500 次（安全範圍內）
- **應對方案**：
  - 批次操作使用 GraphQL（減少呼叫數）
  - 超過臨界值時排隊並延遲執行

---

## 4. 遷移策略

### 4.1 平行運行期（Phase 1-4 期間）
- 新系統與 Classroom 同時運行
- 學生可選擇使用「自建派發」或「Classroom 邀請」
- 後端同時支援兩種作業提交方式

### 4.2 逐步遷移（Week 9-12）
- 預設新系統，Classroom 作為備選
- 通知所有導師更新教材連結
- 檢查現有作業 Repo 的自動評分是否正常轉移

### 4.3 完全棄用（Week 12+）
- 關閉 Classroom 新邀請
- 現有 Classroom Repo 標記為唯讀
- 所有新學生強制使用自建系統

### 4.4 回檔計劃
- 保留所有 Classroom Repo 的 Git Mirror
- 允許學生導出已完成的作業歷史

---

## 5. 前端改進建議

### 5.1 「領取作業」流程優化
```
當前：「進入教室寫作業」→ Classroom 邀請連結
改進：「領取作業」（一鍵）→ 建立 Repo → 直接開啟 IDE
```

### 5.2 Dashboard 新增區塊
- **我的作業 Repo**：快速連結到所有已建立的 Repo
- **同步狀態**：顯示是否有 Template 更新待審核
- **自動評分結果**：即時顯示最新分數

### 5.3 導師端改進
- **作業連結管理**：統一配置所有單元的自建 Repo 連結
- **同步審核面板**：批量審核與 Merge 教材更新 PR
- **學生 Repo 列表**：篩選、搜尋、快速存取

---

## 6. 測試計劃

### 6.1 單元測試（Unit Tests）
```javascript
// tests/github-api-helper.test.js
describe('GitHubAPIHelper', () => {
    it('should create repo from template', async () => { /* ... */ });
    it('should add collaborator with correct permission', async () => { /* ... */ });
    it('should handle rate limiting gracefully', async () => { /* ... */ });
});
```

### 6.2 整合測試（Integration Tests）
1. **E2E 流程**：
   - 學生點擊「領取作業」
   - Repo 自動建立
   - 直接開啟 IDE
   - Push 程式碼
   - 自動評分觸發
   - 分數回寫 Dashboard

2. **故障場景**：
   - GitHub API 超時 → 重試機制
   - 學生已建立 Repo → 回傳現有連結
   - 推薦碼失效 → 友善提示

### 6.3 效能測試
- 100 學生同時建立 Repo（批次試驗）
- API 回應時間 < 5 秒
- Webhook 處理延遲 < 10 秒

---

## 7. 風險評估與應對

| 風險 | 影響 | 降低方案 |
| --- | --- | --- |
| GitHub Token 洩漏 | 他人可存取所有 Org Repo | Fine-grained Token + Secrets 管理 |
| Rate Limiting 觸發 | 邀請派發中斷 | GraphQL + 批次操作 + 排隊機制 |
| API 更新不相容 | 功能故障 | 定期更新 SDK + 測試 |
| 學生 Repo 權限混亂 | 學生無法 Push | 加入 Collaborator 驗證 + 定時審計 |
| Webhook 簽名驗證失敗 | 分數無法回寫 | 嚴格驗證 + Fallback 機制 |

---

## 8. 實作時程表

| 周期 | 任務 | 負責 | 交付物 |
| --- | --- | --- | --- |
| Week 1-2 | 基礎 API 層 + Token 管理 | Backend | `github-api-helper.js` |
| Week 3-4 | 學生邀請派發 + 前端改進 | Backend + Frontend | `createStudentRepository()` + UI |
| Week 5-6 | 自動評分整合 | DevOps | Workflow 範本 + 回寫驗證 |
| Week 7-8 | 導師配置 + 推薦連結 | Backend + Frontend | Settings UI + API |
| Week 9-10 | 教材同步與 PR 管理 | Backend | `syncTemplateToStudentRepo()` |
| Week 11-12 | 整合測試 + 平行運行 | QA | 測試報告 + 遷移檢查清單 |

---

## 9. 成功標準

- [ ] 新系統 100% 相容 Classroom 的邀請派發
- [ ] 自動評分結果成功回寫 ≥ 95%
- [ ] 導師推薦連結點擊率 ≥ 90%
- [ ] 教材同步 PR 審核流程順暢
- [ ] API 平均回應時間 < 2 秒
- [ ] 零 Token 安全事件

---

## 附錄 A：GitHub API 最小範例

### Python 範例（PyGithub）
```python
from github import Github

# 初始化
g = Github("你的_GITHUB_TOKEN")
org = g.get_organization("vibe-coding-classroom")
template = org.get_repo("starter-vscode")

# 建立 Repo
new_repo = org.create_repo(
    name="vscode-student-001",
    private=True,
    description="Student assignment repo"
)

# 新增協力者
new_repo.add_to_collaborators("student-github-username", permission="push")

print(f"Created: {new_repo.html_url}")
```

### Node.js 範例（Octokit）
```javascript
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({ auth: 'your-token' });

// 建立 Repo（from template）
const repo = await octokit.repos.createUsingTemplate({
    template_owner: 'vibe-coding-classroom',
    template_repo: 'starter-vscode',
    owner: 'vibe-coding-classroom',
    name: 'vscode-student-001',
    private: true
});

// 新增協力者
await octokit.repos.addCollaborator({
    owner: 'vibe-coding-classroom',
    repo: 'vscode-student-001',
    username: 'student-github-username',
    permission: 'push'
});

console.log(repo.data.html_url);
```

---

## 附錄 B：Firestore 資料結構更新

### assignments collection 新增欄位
```
{
    id: "uuid",
    userId: "user-id",
    unitId: "unit-id",
    
    // 新增欄位
    repositoryUrl: "https://github.com/vibe-coding-classroom/vscode-student-001",
    repositoryName: "vscode-student-001",
    createdVia: "native-api",  // "classroom" or "native-api"
    
    // 既有欄位
    autoGrade: { ... },
    grade: 100,
    status: "completed"
}
```

### users/{uid}/tutorConfigs[unitId] 新增欄位
```
{
    authorized: true,
    customAssignmentUrl: "https://github.com/vibe-coding-classroom/starter-vscode",
    
    // 既有欄位
    assignmentUrl: "https://classroom.github.com/..."
}
```

---

最後更新：2026-05-28
計劃版本：v1.0
