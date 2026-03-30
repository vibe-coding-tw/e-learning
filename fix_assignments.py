import re

html_file = 'functions/private_courses/03-unit-vibe-classroom-intro.html'
with open(html_file, 'r') as f:
    html = f.read()

# Extract all assignment-quest divs
matches = re.finditer(r'<div class="assignment-quest".*?</div>\s*</div>\s*(?=</?section|<!--|<div)', html, re.DOTALL)
# Actually the regex above is tricky because assignment-quest has nested divs.
# I will use a simple state machine to accurately extract them, or regex if balanced.
