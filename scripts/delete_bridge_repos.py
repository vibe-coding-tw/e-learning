#!/usr/bin/env python3
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ORG = "vibe-coding-classroom"

def run_cmd(cmd):
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        return res.returncode, res.stdout, res.stderr
    except Exception as e:
        return -1, "", str(e)

def delete_repo(repo_name, dry_run=True):
    repo_full_name = f"{ORG}/{repo_name}"
    if dry_run:
        return True, f"[Dry-Run] Would delete repository {repo_full_name}"
    
    cmd = ["gh", "repo", "delete", repo_full_name, "--yes"]
    rc, stdout, stderr = run_cmd(cmd)
    if rc != 0:
        return False, f"Failed to delete: {stderr.strip()}"
    return True, "Successfully deleted"

def main():
    dry_run = True
    if len(sys.argv) > 1:
        if sys.argv[1] == "--apply":
            dry_run = False
        elif sys.argv[1] == "--dry-run":
            dry_run = True
        else:
            print("Usage: python3 scripts/delete_bridge_repos.py [--dry-run | --apply]")
            sys.exit(1)
            
    print(f"Executing in {'DRY-RUN' if dry_run else 'APPLY'} mode...")
    
    # Query all repos in the organization
    print(f"Querying non-template repositories starting with vibe-coding-classroom- under {ORG}...")
    cmd = ["gh", "repo", "list", ORG, "--limit", "300", "--json", "name,isTemplate"]
    rc, stdout, stderr = run_cmd(cmd)
    if rc != 0:
        print(f"Failed to query repos: {stderr}")
        sys.exit(1)
        
    try:
        repos_data = json.loads(stdout)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        sys.exit(1)
        
    bridge_repos = [
        r["name"] for r in repos_data 
        if not r.get("isTemplate") and r["name"].startswith("vibe-coding-classroom-")
    ]
    print(f"Found {len(bridge_repos)} bridge repositories to delete.")
    
    results = []
    def worker(repo):
        success, msg = delete_repo(repo, dry_run=dry_run)
        status = "Success" if success else "Failed"
        print(f"[{status}] {repo}: {msg}")
        return repo, success, msg
        
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker, r) for r in sorted(bridge_repos)]
        for f in futures:
            results.append(f.result())
            
    success_count = sum(1 for _, s, _ in results if s)
    fail_count = len(results) - success_count
    
    print("\n" + "="*50)
    print("Delete Report:")
    print(f"  Total targeted repos: {len(results)}")
    print(f"  Success:              {success_count}")
    print(f"  Failed:               {fail_count}")
    print("="*50)

if __name__ == "__main__":
    main()
