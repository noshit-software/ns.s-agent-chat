#!/bin/bash
AGENT=$(basename "$(pwd)")
QUEUE_DIR="d:/workspace-ns.s/ns.s-agent-chat/queue/$AGENT"
STOPPED="$QUEUE_DIR/.stopped"
if [ -f "$STOPPED" ]; then
  rm -f "$STOPPED" "$QUEUE_DIR/.loop-running"
  echo "STOPPED"
fi
