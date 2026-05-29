#!/usr/bin/env python3
import os
import sys
import re
import argparse
import subprocess
import requests
import json
from bs4 import BeautifulSoup, NavigableString

CONTENT_REPO_DIR = "/Users/roverchen/Documents/Apps/content-repo"
ZH_DIR = os.path.join(CONTENT_REPO_DIR, "courses", "zh-TW")
EN_DIR = os.path.join(CONTENT_REPO_DIR, "courses", "en")

def contains_chinese(text):
    if not text:
        return False
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def get_access_token():
    try:
        res = subprocess.run(
            ["gcloud", "auth", "application-default", "print-access-token"],
            capture_output=True,
            text=True,
            check=True
        )
        return res.stdout.strip()
    except Exception as e:
        print(f"Error getting access token from gcloud: {e}")
        return None

def call_gemini(system_instruction, user_content, token, project, location, model):
    import time
    url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Goog-User-Project": project,
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": {
            "role": "USER",
            "parts": {
                "text": user_content
            }
        },
        "systemInstruction": {
            "parts": {
                "text": system_instruction
            }
        },
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    
    # Try up to 5 times with exponential backoff for 429 errors
    for attempt in range(5):
        response = None
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            if response.status_code == 429:
                sleep_time = (2 ** attempt) + 2
                print(f"    -> Rate limited (429) on attempt {attempt+1}. Sleeping for {sleep_time}s and retrying...")
                time.sleep(sleep_time)
                continue
                
            response.raise_for_status()
            res_data = response.json()
            
            candidates = res_data.get("candidates", [])
            if not candidates:
                return None
                
            part_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            
            # Strip markdown wrapper
            cleaned_text = part_text.strip()
            if cleaned_text.startswith("```"):
                lines = cleaned_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                cleaned_text = "\n".join(lines).strip()
                
            return cleaned_text
        except Exception as e:
            if response is not None and response.status_code == 429:
                sleep_time = (2 ** attempt) + 2
                print(f"    -> Rate limited (429) exception on attempt {attempt+1}. Sleeping for {sleep_time}s and retrying...")
                time.sleep(sleep_time)
                continue
            print(f"    -> API Call Error: {e}")
            if response is not None:
                print(f"    -> Response Body: {response.text}")
            return None
            
    print("    -> API Call Error: Maximum retries exceeded for 429.")
    return None

def translate_batch(strings, token, project, location, model):
    if not strings:
        return []
        
    system_instruction = (
        "You are a professional technical translator specializing in software engineering and web development. "
        "Translate the following JSON array of Traditional Chinese (zh-TW) strings into clear, natural English (en). "
        "Maintain the exact JSON array structure, order, and size. Do not translate code symbols, filenames, or technical terms "
        "that should remain unchanged. Return ONLY the translated JSON array, with no markdown code blocks or explanations."
    )
    
    user_content = json.dumps(strings, ensure_ascii=False)
    
    # Try up to 3 times
    for attempt in range(3):
        res_text = call_gemini(system_instruction, user_content, token, project, location, model)
        if res_text:
            try:
                translated_list = json.loads(res_text)
                if isinstance(translated_list, list) and len(translated_list) == len(strings):
                    return translated_list
                else:
                    print(f"    -> Warning: Translated list length mismatch (Expected {len(strings)}, got {len(translated_list)}). Retrying...")
            except Exception as e:
                print(f"    -> Warning: Failed to parse JSON response from Gemini on attempt {attempt+1}: {e}. Retrying...")
                print(f"    -> Raw text: {res_text[:200]}")
                
    # Fallback: Translate individually if batch fails
    print("    -> Batch translation failed. Falling back to concurrent individual translation...")
    from concurrent.futures import ThreadPoolExecutor
    
    def translate_single(s):
        individual_instruction = (
            "Translate this Traditional Chinese text to English. Output only the translated English text."
        )
        res = call_gemini(individual_instruction, s, token, project, location, model)
        return res.strip() if res else s

    with ThreadPoolExecutor(max_workers=8) as executor:
        fallback_results = list(executor.map(translate_single, strings))
    return fallback_results

def translate_script_block(script_content, token, project, location, model):
    system_instruction = (
        "You are a technical translator. Translate all Chinese strings inside this JavaScript code to English. "
        "Do NOT change any variable names, logic, code structure, properties, or HTML tags inside JS string literals. "
        "Only translate the Chinese text values to English. Return ONLY the translated JavaScript code. "
        "Do NOT wrap the output in markdown code blocks (e.g. ```javascript)."
    )
    res = call_gemini(system_instruction, script_content, token, project, location, model)
    return res if res else script_content

def translate_file(filename, token, project, location, model, force):
    zh_path = os.path.join(ZH_DIR, filename)
    en_filename = filename.replace("tw-", "en-")
    en_path = os.path.join(EN_DIR, en_filename)
    
    if os.path.exists(en_path) and not force:
        print(f"Skipping {filename} (English version already exists)")
        return True
        
    print(f"Processing {filename}...")
    with open(zh_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    soup = BeautifulSoup(html_content, "html.parser")
    
    # 1. Update HTML lang attribute
    html_tag = soup.find("html")
    if html_tag:
        html_tag["lang"] = "en"
        
    # 2. Extract and translate text nodes
    text_nodes = []
    texts_to_translate = []
    
    for element in soup.find_all(text=True):
        if element.parent.name in ["script", "style"]:
            continue
        text_str = element.string.strip()
        if text_str and contains_chinese(text_str):
            text_nodes.append(element)
            texts_to_translate.append(element.string) # Keep original whitespace/newlines or raw string
            
    # Extract attribute values that might have Chinese (e.g., placeholders, titles)
    attribute_targets = [] # list of (element, attribute_name, original_value)
    for element in soup.find_all(True):
        for attr in ["placeholder", "title", "alt", "data-title"]:
            if element.has_attr(attr) and contains_chinese(element[attr]):
                attribute_targets.append((element, attr, element[attr]))
                texts_to_translate.append(element[attr])
                
    print(f"  -> Extracted {len(texts_to_translate)} Chinese text segments.")
    
    # Translate text segments in batches of 20
    batch_size = 20
    translated_texts = []
    for i in range(0, len(texts_to_translate), batch_size):
        batch = texts_to_translate[i : i + batch_size]
        print(f"  -> Translating batch {i//batch_size + 1} of {(len(texts_to_translate)-1)//batch_size + 1}...")
        translated_batch = translate_batch(batch, token, project, location, model)
        translated_texts.extend(translated_batch)
        
    # Replace translated texts back into DOM
    translated_index = 0
    
    # Replace NavigableStrings
    for node in text_nodes:
        if translated_index < len(translated_texts):
            node.replace_with(translated_texts[translated_index])
            translated_index += 1
            
    # Replace Attribute strings
    for element, attr, _ in attribute_targets:
        if translated_index < len(translated_texts):
            element[attr] = translated_texts[translated_index]
            translated_index += 1
            
    # 3. Translate Script blocks
    script_tags = soup.find_all("script")
    script_count = 0
    for script in script_tags:
        if script.string and contains_chinese(script.string):
            script_count += 1
            print(f"  -> Translating JS script block {script_count}...")
            translated_js = translate_script_block(script.string, token, project, location, model)
            script.string.replace_with(translated_js)
            
    # 3.5. Translate onclick attributes containing Chinese
    for el in soup.find_all(True):
        if el.has_attr("onclick") and isinstance(el["onclick"], str) and contains_chinese(el["onclick"]):
            print(f"  -> Translating onclick attribute: {el['onclick'][:60]}...")
            translated_onclick = translate_script_block(el["onclick"], token, project, location, model)
            el["onclick"] = translated_onclick

    # 4. Replace links / references from tw- to en- in attributes
    for el in soup.find_all(True):
        for attr in ["href", "src", "onclick", "data-classroom-url"]:
            if el.has_attr(attr) and isinstance(el[attr], str):
                val = el[attr]
                # Replace tw-common -> en-common, tw-car -> en-car
                if "tw-" in val:
                    el[attr] = val.replace("tw-", "en-")
                    
    # Save the output
    os.makedirs(EN_DIR, exist_ok=True)
    with open(en_path, "w", encoding="utf-8") as f:
        # Use formatter="html" to ensure standard HTML entities
        f.write(str(soup))
        
    print(f"  -> Successfully translated and saved to {en_filename}\n")
    return True

def main():
    parser = argparse.ArgumentParser(description="BeautifulSoup-based zh-TW course HTML translator.")
    parser.add_argument("--file", help="Name of a single HTML file in zh-TW folder to translate.")
    parser.add_argument("--force", action="store_true", help="Force translation and overwrite existing English files.")
    parser.add_argument("--project", default="e-learning-942f7", help="Google Cloud project ID.")
    parser.add_argument("--location", default="us-central1", help="Vertex AI region.")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Vertex AI Gemini model identifier.")
    parser.add_argument("--workers", type=int, default=5, help="Number of concurrent file translation workers.")
    
    args = parser.parse_args()
    
    token = get_access_token()
    if not token:
        print("Error: Could not retrieve access token.")
        sys.exit(1)
        
    if args.file:
        success = translate_file(args.file, token, args.project, args.location, args.model, args.force)
        sys.exit(0 if success else 1)
        
    if not os.path.exists(ZH_DIR):
        print(f"Error: Source directory {ZH_DIR} does not exist.")
        sys.exit(1)
        
    files = sorted([f for f in os.listdir(ZH_DIR) if f.endswith(".html") and f.startswith("tw-")])
    print(f"Found {len(files)} course HTML files in {ZH_DIR}")
    
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    print(f"Starting parallel translation with {args.workers} workers...")
    
    def process_one(f):
        # Refresh/retrieve access token for each file to be safe
        t = get_access_token()
        if not t:
            print(f"[{f}] Error: Could not retrieve access token.")
            return f, False
        success = translate_file(f, t, args.project, args.location, args.model, args.force)
        return f, success
        
    success_count = 0
    failure_count = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_one, f): f for f in files}
        for future in as_completed(futures):
            f = futures[future]
            try:
                name, success = future.result()
                if success:
                    success_count += 1
                else:
                    failure_count += 1
            except Exception as e:
                print(f"[{f}] Exception in worker thread: {e}")
                failure_count += 1
            
    print(f"\nTranslation run complete. Success: {success_count}, Failures: {failure_count}")

if __name__ == "__main__":
    main()
