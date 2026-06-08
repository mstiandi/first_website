#!/usr/bin/env python3
"""PostToolUse: 每次编辑 JS/CSS 后检查 index.html 版本号是否更新"""
import json, sys, re, os

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX = os.path.join(PROJECT, 'index.html')

def main():
    try:
        data = json.load(sys.stdin)
    except:
        sys.exit(0)

    tool = data.get('tool_name', '')
    tool_input = data.get('tool_input', {})
    filepath = tool_input.get('file_path', '')

    # 只关心对 JS/CSS 的编辑
    if tool not in ('Edit', 'Write'):
        sys.exit(0)
    if not (filepath.endswith('.js') or filepath.endswith('.css')):
        sys.exit(0)

    basename = os.path.basename(filepath)
    filename = os.path.splitext(basename)[0]

    try:
        with open(INDEX, 'r', encoding='utf-8') as f:
            html = f.read()
    except:
        sys.exit(0)

    # 查找该文件在 index.html 中的版本号
    pattern = re.compile(rf'{filename}\.js\?v=(\d+)|{filename}\.css\?v=(\d+)')
    match = pattern.search(html)
    if match:
        version = match.group(1) or match.group(2)
        msg = f'[HOOK] ✅ {basename} 当前版本 v={version} — 如果改动较大请升版本号'
    else:
        msg = f'[HOOK] ⚠️ {basename} 在 index.html 中找不到版本号！'

    print(json.dumps({'systemMessage': msg}), file=sys.stdout)
    sys.exit(0)

if __name__ == '__main__':
    main()
