#!/usr/bin/env python3
import json
import subprocess
import os
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor

ORG = "vibe-coding-classroom"
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_YML = os.path.join(ROOT_DIR, "scripts", "workflow-templates", "default.yml")
WORKDIR = "/tmp/merge-classroom-templates-workdir"

def run_cmd(cmd, cwd=None, input_str=None):
    try:
        res = subprocess.run(cmd, input=input_str, capture_output=True, text=True, cwd=cwd)
        return res.returncode, res.stdout, res.stderr
    except Exception as e:
        return -1, "", str(e)

def toggle_actions(repo_full_name, enable):
    action = "enable" if enable else "disable"
    payload = {"enabled": True, "allowed_actions": "all"} if enable else {"enabled": False}
    payload_json = json.dumps(payload)
    cmd = [
        "gh", "api",
        "-X", "PUT",
        f"repos/{repo_full_name}/actions/permissions",
        "--input", "-"
    ]
    rc, stdout, stderr = run_cmd(cmd, input_str=payload_json)
    if rc != 0:
        print(f"  -> ❌ Failed to {action} Actions for {repo_full_name}: {stderr.strip()}")
        return False
    return True

def process_repo(repo_name, dry_run=True):
    repo_full_name = f"{ORG}/{repo_name}"
    local_dir = os.path.join(WORKDIR, repo_name)
    
    if os.path.exists(local_dir):
        shutil.rmtree(local_dir)
        
    # 1. Clone
    clone_cmd = ["gh", "repo", "clone", repo_full_name, local_dir, "--", "-q"]
    rc, stdout, stderr = run_cmd(clone_cmd)
    if rc != 0:
        return False, f"Clone failed: {stderr.strip()}"
        
    # Detect default branch
    rc, stdout, stderr = run_cmd(["git", "symbolic-ref", "refs/remotes/origin/HEAD"], cwd=local_dir)
    default_branch = "main"
    if rc == 0 and stdout:
        default_branch = stdout.strip().split('/')[-1]
    else:
        # Fallback to local active branch
        rc_b, stdout_b, stderr_b = run_cmd(["git", "branch", "--show-current"], cwd=local_dir)
        if rc_b == 0 and stdout_b:
            default_branch = stdout_b.strip()
            
    # 2. Re-create workflow structure and copy template
    workflows_dir = os.path.join(local_dir, ".github", "workflows")
    os.makedirs(workflows_dir, exist_ok=True)
    
    dest_file = os.path.join(workflows_dir, "autograde-and-sync.yml")
    shutil.copy2(DEFAULT_YML, dest_file)
    
    # Remove all other files outside `.github/`
    for item in os.listdir(local_dir):
        if item == ".github" or item == ".git":
            continue
        item_path = os.path.join(local_dir, item)
        if os.path.isdir(item_path):
            shutil.rmtree(item_path)
        else:
            os.remove(item_path)

    # Clean up everything inside `.github/` except `workflows/autograde-and-sync.yml`
    github_dir = os.path.join(local_dir, ".github")
    if os.path.exists(github_dir):
        for item in os.listdir(github_dir):
            if item == "workflows":
                # Clean workflows dir except for autograde-and-sync.yml
                workflows_dir = os.path.join(github_dir, "workflows")
                for wf_file in os.listdir(workflows_dir):
                    if wf_file != "autograde-and-sync.yml":
                        wf_path = os.path.join(workflows_dir, wf_file)
                        if os.path.isdir(wf_path):
                            shutil.rmtree(wf_path)
                        else:
                            os.remove(wf_path)
            else:
                # Delete any other folders/files inside .github, e.g. .github/classroom/ or .github/scripts/
                item_path = os.path.join(github_dir, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
            
    # Add all changes to staging (including deletions)
    run_cmd(["git", "add", "-A"], cwd=local_dir)
    
    # Check if there are any changes
    rc, stdout, stderr = run_cmd(["git", "diff", "--cached", "--quiet"], cwd=local_dir)
    if rc == 0:
        # No changes
        shutil.rmtree(local_dir)
        return True, "No changes (already consolidated and cleaned)"
        
    if dry_run:
        shutil.rmtree(local_dir)
        return True, f"[Dry-Run] Would consolidate workflow and clean template repository on branch {default_branch}"
        
    # 3. Apply changes (Commit and Push)
    # 3.a Disable GitHub Actions before pushing
    if not toggle_actions(repo_full_name, enable=False):
        shutil.rmtree(local_dir)
        return False, "Failed to disable Actions before push"
        
    # 3.b Commit
    commit_msg = "ci: consolidate workflow and clean template repository [skip ci]"
    rc_c, stdout_c, stderr_c = run_cmd(["git", "commit", "-m", commit_msg], cwd=local_dir)
    if rc_c != 0:
        toggle_actions(repo_full_name, enable=True) # Ensure actions are re-enabled
        shutil.rmtree(local_dir)
        return False, f"Commit failed: {stderr_c.strip()}"
        
    # 3.c Push
    rc_p, stdout_p, stderr_p = run_cmd(["git", "push", "origin", default_branch], cwd=local_dir)
    
    # 3.d Re-enable Actions immediately after push attempt
    actions_restored = toggle_actions(repo_full_name, enable=True)
    
    shutil.rmtree(local_dir)
    
    if rc_p != 0:
        return False, f"Push failed: {stderr_p.strip()}"
    if not actions_restored:
        return False, "Push succeeded, but failed to re-enable Actions"
        
    return True, f"Successfully merged workflow on branch {default_branch}"

def main():
    dry_run = True
    if len(sys.argv) > 1:
        if sys.argv[1] == "--apply":
            dry_run = False
        elif sys.argv[1] == "--dry-run":
            dry_run = True
        else:
            print("Usage: python3 scripts/merge_classroom_templates.py [--dry-run | --apply]")
            sys.exit(1)
            
    print(f"Executing in {'DRY-RUN' if dry_run else 'APPLY'} mode...")
    
    os.makedirs(WORKDIR, exist_ok=True)
    
    # Query all template repos in the organization
    print("Querying template repositories under vibe-coding-classroom...")
    cmd = ["gh", "repo", "list", ORG, "--limit", "300", "--json", "name,isTemplate"]
    rc, stdout, stderr = run_cmd(cmd)
    if rc != 0:
        print(f"Failed to query repos: {stderr}")
        sys.exit(1)
        
    try:
        repos_data = json.loads(stdout)
    except Exception as e:
        print(f"Failed to parse JSON repo list: {e}")
        sys.exit(1)
        
    template_repos = [r["name"] for r in repos_data if r.get("isTemplate") is True]
    print(f"Found {len(template_repos)} template repositories.")
    
    # Process repositories in parallel
    print("Processing workflows...")
    results = []
    
    def worker(repo_name):
        success, msg = process_repo(repo_name, dry_run=dry_run)
        status = "Success" if success else "Failed"
        print(f"[{status}] {repo_name}: {msg}")
        return repo_name, success, msg
        
    # Limit to 5 concurrent workers to avoid rate limit / token abuse
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker, repo) for repo in sorted(template_repos)]
        for f in futures:
            results.append(f.result())
            
    # Print summary report
    success_count = sum(1 for _, s, _ in results if s)
    fail_count = len(results) - success_count
    
    print("\n" + "="*50)
    print("Execution Report:")
    print(f"  Total repos: {len(results)}")
    print(f"  Success:     {success_count}")
    print(f"  Failed:      {fail_count}")
    
    if fail_count > 0:
        print("\nFailures:")
        for r, s, m in results:
            if not s:
                print(f"  - {r}: {m}")
    print("="*50)
    
    if os.path.exists(WORKDIR):
        shutil.rmtree(WORKDIR)

if __name__ == "__main__":
    main()
