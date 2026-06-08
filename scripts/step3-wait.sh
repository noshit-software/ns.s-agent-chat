#!/bin/bash
AGENT=$(basename "$(pwd)")
QUEUE_DIR="d:/workspace-ns.s/ns.s-agent-chat/queue/$AGENT"
while true; do
  if [ -f "$QUEUE_DIR/.stopped" ]; then
    echo "STOP"
    break
  fi
  f=$(ls "$QUEUE_DIR"/*.json 2>/dev/null | head -1)
  if [ -n "$f" ]; then
    cat "$f" && rm "$f"
    break
  fi
  sleep 5
done
