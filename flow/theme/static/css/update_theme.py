"""
Phase 2.1 — Part 2: Update remaining CSS files (session_hub, styles_6, layout, layout_grid, session_history)
Sidebar.css was already updated in the previous run.
"""
import re, os

CSS_DIR = r'c:\Users\ASUS\Desktop\FLOW\flow\theme\static\css'

def read(name):
    with open(os.path.join(CSS_DIR, name), 'r', encoding='utf-8') as f:
        return f.read()

def write(name, content):
    with open(os.path.join(CSS_DIR, name), 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  [OK] Updated {name}")


# ===== 1. SESSION_HUB.CSS =====
print("\n[1/5] Updating session_hub.css ...")
s = read('session_hub.css')

# Remove :root block
root_block = re.search(r':root\s*\{.*?\}\s*', s, re.DOTALL)
if root_block:
    s = s[:root_block.start()] + s[root_block.end():]

# Add import after font import line
if "@import url('theme.css')" not in s:
    font_line_end = s.find('\n', s.find("@import url('https://fonts.googleapis.com"))
    if font_line_end > 0:
        s = s[:font_line_end+1] + "@import url('theme.css');\n" + s[font_line_end+1:]

# Replace old local variables with theme variables
s = s.replace('var(--bg)', 'var(--color-bg-darker)')
s = s.replace('var(--panel-hover)', 'var(--color-panel-hover)')
s = s.replace('var(--panel)', 'var(--color-panel-medium)')
s = s.replace('var(--border-soft)', 'var(--color-border-subtle)')
s = s.replace('var(--border)', 'var(--color-border-medium)')
s = s.replace('var(--text)', 'var(--color-text-sidebar)')
s = s.replace('var(--muted)', 'var(--ls-muted)')
s = s.replace('var(--shadow)', 'var(--shadow-sidebar)')
s = s.replace('var(--accent-glow)', 'rgba(124, 109, 250, 0.30)')
s = s.replace('var(--accent-2)', 'var(--color-accent-blue)')
s = re.sub(r'var\(--accent\)(?![-\w])', 'var(--color-accent-secondary)', s)
s = s.replace('var(--danger-soft)', 'rgba(255, 77, 109, 0.12)')
s = s.replace('var(--danger-border)', 'rgba(255, 77, 109, 0.35)')
s = re.sub(r'var\(--danger\)(?![-\w])', 'var(--color-accent-red)', s)
s = s.replace('var(--gold)', 'var(--color-accent-yellow)')
s = re.sub(r'var\(--radius\)(?![-\w])', 'var(--radius-xl)', s)
s = s.replace('var(--radius-sm)', 'var(--radius-md)')
s = s.replace('var(--radius-xs)', 'var(--radius-sm)')

# Hardcoded values
s = s.replace('color: #fff;', 'color: var(--color-text-primary);')
s = s.replace('background: rgba(255,255,255,0.05);', 'background: var(--color-panel-faint);')
s = s.replace('background: rgba(255,255,255,0.07);', 'background: var(--color-border-light);')
s = s.replace('background: rgba(255,255,255,0.06);', 'background: var(--color-panel-medium);')
s = s.replace('background: rgba(255,255,255,0.10);', 'background: var(--color-border-medium);')
s = s.replace('background: rgba(255,255,255,0.12);', 'background: var(--color-border-strong);')
s = s.replace('border-color: rgba(124,109,250,0.55);', 'border-color: var(--color-border-accent-focus);')
s = s.replace('border-color: rgba(124,109,250,0.25);', 'border-color: var(--color-border-accent);')
s = s.replace('border-color: rgba(124,109,250,0.22);', 'border-color: var(--color-border-accent-soft);')
s = s.replace('border-color: rgba(255,255,255,0.20);', 'border-color: var(--color-border-medium);')
s = s.replace('stroke: rgba(232,236,255,0.12);', 'stroke: var(--color-border-strong);')
s = s.replace('box-shadow: 0 4px 20px rgba(124,109,250,0.40);', 'box-shadow: var(--shadow-button);')
s = s.replace('box-shadow: 0 6px 28px rgba(124,109,250,0.55);', 'box-shadow: var(--shadow-button-hover);')
s = s.replace('outline: 2px solid rgba(124,109,250,0.65);', 'outline: 2px solid var(--color-border-accent-focus);')
s = s.replace('background: rgba(255,77,109,0.20);', 'background: rgba(255, 77, 109, 0.20);')

write('session_hub.css', s)


# ===== 2. STYLES_6.CSS =====
print("\n[2/5] Updating styles_6.css ...")
s = read('styles_6.css')

if "@import url('theme.css')" not in s:
    s = "@import url('theme.css');\n\n" + s

s = s.replace('background: #2E3440;', 'background: var(--color-bg-tertiary);')
s = s.replace('border: 1px solid #81A1C1;', 'border: 1px solid var(--color-accent-light);')
s = s.replace('color: #E5E9F0;', 'color: var(--color-text-secondary);')
s = s.replace('border-radius: 12px;', 'border-radius: var(--radius-md);')
s = s.replace('border-color: #A3BE8C;', 'border-color: var(--color-success);')
s = s.replace('border-color: #BF616A;', 'border-color: var(--color-error);')
s = s.replace('border-color: #5E81AC;', 'border-color: var(--color-info);')
s = s.replace('z-index: 9999;', 'z-index: var(--z-toast);')

write('styles_6.css', s)


# ===== 3. LAYOUT.CSS =====
print("\n[3/5] Updating layout.css ...")
s = read('layout.css')

root_block = re.search(r':root\s*\{.*?\}\s*', s, re.DOTALL)
if root_block:
    s = s[:root_block.start()] + s[root_block.end():]

if "@import url('theme.css')" not in s:
    header_end = s.find('*/\n')
    if header_end > 0:
        s = s[:header_end+3] + "\n@import url('theme.css');\n" + s[header_end+3:]
    else:
        s = "@import url('theme.css');\n\n" + s

s = s.replace('var(--transition-duration)', 'var(--transition-normal)')
s = s.replace('var(--transition-ease)', 'var(--ease-smooth)')
s = s.replace('var(--layout-bg)', 'var(--color-bg-deep)')
s = s.replace('var(--layout-surface)', 'var(--color-panel-light)')
s = s.replace('var(--layout-border)', 'var(--color-border-soft)')
s = s.replace('z-index: 60;', 'z-index: var(--z-sidebar);')

write('layout.css', s)


# ===== 4. LAYOUT_GRID.CSS =====
print("\n[4/5] Updating layout_grid.css ...")
s = read('layout_grid.css')

root_block = re.search(r':root\s*\{.*?\}\s*', s, re.DOTALL)
if root_block:
    s = s[:root_block.start()] + s[root_block.end():]

if "@import url('theme.css')" not in s:
    header_end = s.find('*/\n')
    if header_end > 0:
        s = s[:header_end+3] + "\n@import url('theme.css');\n" + s[header_end+3:]
    else:
        s = "@import url('theme.css');\n\n" + s

s = s.replace('var(--text-primary)', 'var(--color-text-sidebar)')
s = s.replace('var(--transition-smooth)', 'var(--ease-smooth)')
s = s.replace('var(--transition-duration)', 'var(--transition-normal)')
s = s.replace('border: 1px solid rgba(255,255,255,0.10);', 'border: 1px solid var(--color-border-medium);')
s = s.replace('border: 1px solid rgba(255,255,255,0.08);', 'border: 1px solid var(--color-border-soft);')
s = s.replace('color: rgba(232,236,255,0.92);', 'color: var(--color-text-sidebar);')
s = s.replace('color: rgba(232,236,255,0.62);', 'color: var(--ls-muted);')
s = s.replace('background: rgba(255,255,255,0.04);', 'background: var(--color-panel-light);')
s = s.replace('border-radius: 999px;', 'border-radius: var(--radius-full);')
s = s.replace('border-radius: 14px;', 'border-radius: var(--radius-lg);')
s = s.replace('border-radius: 16px;', 'border-radius: var(--radius-lg);')
s = s.replace('z-index: 70;', 'z-index: var(--z-button-toggle);')
s = s.replace('z-index: 60;', 'z-index: var(--z-sidebar);')
s = s.replace('box-shadow: 0 14px 40px rgba(0,0,0,0.45);', 'box-shadow: var(--shadow-toggle);')
s = s.replace('border-color: rgba(124,109,250,0.35);', 'border-color: var(--color-border-accent-medium);')

write('layout_grid.css', s)


# ===== 5. SESSION_HISTORY.CSS =====
print("\n[5/5] Updating session_history.css ...")
s = read('session_history.css')

root_block = re.search(r':root\s*\{.*?\}\s*', s, re.DOTALL)
if root_block:
    s = s[:root_block.start()] + s[root_block.end():]

if "@import url('theme.css')" not in s:
    s = "@import url('theme.css');\n\n" + s

s = s.replace('var(--bg)', 'var(--color-bg-deep)')
s = s.replace('var(--panel)', 'var(--color-panel-medium)')
s = re.sub(r'var\(--border\)(?![-\w])', 'var(--color-border-strong)', s)
s = s.replace('var(--text)', 'var(--color-text-sidebar)')
s = s.replace('var(--muted)', 'var(--ls-muted)')
s = re.sub(r'var\(--accent\)(?![-\w])', 'var(--color-accent-secondary)', s)
s = re.sub(r'var\(--radius\)(?![-\w])', 'var(--radius-lg)', s)
s = s.replace('var(--radius-sm)', 'var(--radius-md)')
s = s.replace('color: #fff;', 'color: var(--color-text-primary);')
s = s.replace('background: rgba(255, 255, 255, 0.03);', 'background: var(--color-panel-subtle);')
s = s.replace('border-bottom: 1px solid rgba(255, 255, 255, 0.05);', 'border-bottom: 1px solid var(--color-border-faint);')
s = s.replace('border-radius: 20px;', 'border-radius: var(--radius-xl);')
s = s.replace('border-radius: 8px;', 'border-radius: var(--radius-sm);')
s = s.replace('border-radius: 6px;', 'border-radius: var(--radius-xs);')

write('session_history.css', s)

print("\n[DONE] All remaining CSS files updated!")
