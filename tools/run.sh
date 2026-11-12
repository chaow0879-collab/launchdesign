#!/bin/bash
# 用法: run.sh 标签 节点id[,节点id] [比例]
cd /home/claude/v8
T=$(python3 tools/times.py $2 ${3:-.75})
rm -f shots/$1-*.png
timeout 900 node tools/shot.cjs /home/claude/v8/out/preview.html /home/claude/v8/shots/$1 $T > shots/$1.log 2>&1
F=$(for m in $T; do echo shots/$1-${m/:/-}.png; done)
python3 tools/grid.py shots/$1-grid.png $F
echo done >> shots/$1.log
