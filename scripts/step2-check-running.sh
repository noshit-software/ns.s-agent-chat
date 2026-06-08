#!/bin/bash
AGENT=$(basename "$(pwd)")
QUEUE_DIR="d:/workspace-ns.s/ns.s-agent-chat/queue/$AGENT"
if [ -f "$QUEUE_DIR/.loop-running" ]; then
  echo "ALREADY_RUNNING"
fi
