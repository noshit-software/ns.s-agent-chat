#!/bin/bash
AGENT=$(basename "$(pwd)")
QUEUE_DIR="d:/workspace-ns.s/ns.s-agent-chat/queue/$AGENT"
rm -f "$QUEUE_DIR/.stopped" "$QUEUE_DIR/.loop-running"
