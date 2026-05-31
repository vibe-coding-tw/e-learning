#!/usr/bin/env python3
import os
import shutil

COURSES_DIR = "/Users/roverchen/Documents/Apps/content-repo/courses/zh-TW"
GRADERS_DIR = "/Users/roverchen/Documents/Apps/vibe-coding-tw/public/graders"
DEFAULT_GRADER = os.path.join(GRADERS_DIR, "default.sh")

def main():
    if not os.path.exists(COURSES_DIR):
        print(f"Courses directory not found: {COURSES_DIR}")
        return
        
    if not os.path.exists(GRADERS_DIR):
        print(f"Graders directory not found: {GRADERS_DIR}")
        return
        
    if not os.path.exists(DEFAULT_GRADER):
        print(f"Default grader not found: {DEFAULT_GRADER}")
        return
        
    # Get all html files from courses directory
    course_files = [f for f in os.listdir(COURSES_DIR) if f.endswith(".html")]
    print(f"Found {len(course_files)} course unit HTML files.")
    
    created_count = 0
    skipped_count = 0
    
    for f in sorted(course_files):
        unit_id = f[:-5] # remove ".html"
        target_name = f"{unit_id}.sh"
        target_path = os.path.join(GRADERS_DIR, target_name)
        
        if os.path.exists(target_path):
            skipped_count += 1
            print(f"[Skip] {target_name} (already exists)")
        else:
            shutil.copy2(DEFAULT_GRADER, target_path)
            # Make sure it keeps execution permissions
            os.chmod(target_path, 0o755)
            created_count += 1
            print(f"[Create] {target_name}")
            
    print("\n" + "="*50)
    print("Execution Summary:")
    print(f"  Total units processed: {len(course_files)}")
    print(f"  New grader files created: {created_count}")
    print(f"  Existing files skipped:   {skipped_count}")
    print("="*50)

if __name__ == "__main__":
    main()
