#!/usr/bin/env python3
import os
import glob
import json
import subprocess
import sys

# Define directories
HOME = os.path.expanduser("~")
DOWNLOADS_DIR = os.path.join(HOME, "Downloads")
PROJECT_DIR = "/Users/lloydc/.gemini/antigravity/scratch/arthur-memorial-golf"
DATA_JS_PATH = os.path.join(PROJECT_DIR, "data.js")

print("⛳ Starting Arthur Memorial Golf Challenge Publisher...")

# 1. Look for recent backup JSON files in Downloads folder
# Looks for files like 'arthur-memorial-golf-challenge-backup-*.json' or 'golf_challenge_backup.json'
backup_patterns = [
    os.path.join(DOWNLOADS_DIR, "arthur-memorial-golf-challenge-backup-*.json"),
    os.path.join(DOWNLOADS_DIR, "*golf*backup*.json"),
    os.path.join(DOWNLOADS_DIR, "golf_challenge_backup*.json")
]

found_backups = []
for pattern in backup_patterns:
    found_backups.extend(glob.glob(pattern))

# Sort by modification time so we get the newest first
found_backups.sort(key=lambda x: os.path.getmtime(x), reverse=True)

new_data_loaded = False
if found_backups:
    newest_backup = found_backups[0]
    print(f"📦 Found recent database backup: {os.path.basename(newest_backup)}")
    
    try:
        # Load and validate the JSON
        with open(newest_backup, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
            
        if "players" in backup_data and "rollOfHonour" in backup_data:
            print("✅ Backup data validated successfully.")
            
            # Format JSON beautifully
            formatted_json = json.dumps(backup_data, indent=2)
            
            # Read current data.js to verify structure
            with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
                current_data_js = f.read()
                
            # Replace FACTORY_DATA block
            # We look for const FACTORY_DATA = ...; and replace it
            start_marker = "const FACTORY_DATA = "
            start_idx = current_data_js.find(start_marker)
            
            if start_idx != -1:
                # Find matching closing semicolon or restructure data.js
                # A very clean way is to write the file starting with 'const FACTORY_DATA = ' + JSON + ';'
                new_data_js_content = f"const FACTORY_DATA = {formatted_json};\n"
                
                with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
                    f.write(new_data_js_content)
                
                print("📝 data.js preset has been successfully overwritten with your latest changes.")
                new_data_loaded = True
                
                # Delete the backup file in Downloads to keep it clean and avoid matching it next time
                try:
                    os.remove(newest_backup)
                    print("🧹 Cleaned up downloaded backup file from Downloads.")
                except Exception as e:
                    print(f"⚠️ Could not delete temporary backup file: {e}")
            else:
                print("❌ Error: Could not find 'const FACTORY_DATA =' marker in data.js")
        else:
            print("❌ Error: Backup JSON is missing required fields ('players' or 'rollOfHonour')")
            
    except Exception as e:
        print(f"❌ Error processing backup file: {e}")
else:
    print("ℹ️ No recent backup file found in Downloads.")
    print("   (If you edited scores or bios, make sure to click 'Export Backup' in the local Admin Suite first.)")
    print("   Proceeding to check for photo updates...")

# 2. Check for Git changes (new photos, modified code)
print("\n🔍 Checking for updates to push...")
try:
    status_proc = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
    git_changes = status_proc.stdout.strip()
    
    if not git_changes:
        if new_data_loaded:
            print("✅ Presets updated, but no Git modifications detected. System is already fully in sync.")
            sys.exit(0)
        else:
            print("✅ No local changes or new photos detected. Nothing to push.")
            sys.exit(0)
            
    # List changes
    print("📁 Changes detected to stage and push:")
    for line in git_changes.split('\n'):
        print(f"   • {line}")
        
except Exception as e:
    print(f"❌ Git error: {e}")
    sys.exit(1)

# 3. Commit and push to GitHub Pages
print("\n🚀 Pushing updates live...")
try:
    # Stage all files
    subprocess.run(["git", "add", "."], check=True)
    
    # Commit changes
    commit_msg = "Automated website update: tournament data and photos"
    subprocess.run(["git", "commit", "-m", commit_msg], check=True)
    
    # Push to main
    subprocess.run(["git", "push", "origin", "main"], check=True)
    
    print("\n🎉 SUCCESS! Your updates have been successfully pushed to GitHub.")
    print("🌍 Your live site will refresh with the new content in about 30-60 seconds!")
    print("🔗 Live URL: https://chrislloyd1234-hue.github.io/arthur-memorial-golf/\n")
    
except subprocess.CalledProcessError as e:
    print(f"\n❌ Error during Git sync: {e}")
    sys.exit(1)
