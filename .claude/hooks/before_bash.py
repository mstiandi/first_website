#!/usr/bin/env python3
"""PreToolUse: git push 前检查版本号是否最新"""
import json, sys, os, re

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX = os.path.join(PROJECT, 'index.html')

def main():
    try:
        data = json.load(sys.stdin)
    except:
        sys.exit(0)

    tool_input = data.get('tool_input', {})
    command = tool_input.get('command', '')

    # 只在 git push 时触发
    if 'git push' not in command:
        sys.exit(0)

    # 检查 index.html 中所有版本号
    try:
        with open(INDEX, 'r', encoding='utf-8') as f:
            html = f.read()
    except:
        sys.exit(0)

    versions = re.findall(r'(js|css)/([^?"]+)\?v=(\d+)', html)
    if versions:
        lines = '\n'.join([f'  {v[0]}/{v[1]}?v={v[2]}' for v in versions])
        print(json.dumps({
            'systemMessage': f'[HOOK] 准备 push，当前资源版本:\n{lines}\n请确认已更新所有需要的版本号。'
        }), file=sys.stdout)

    sys.exit(0)

if __name__ == '__main__':
    main()
