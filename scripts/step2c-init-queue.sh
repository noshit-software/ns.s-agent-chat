#!/bin/bash
AGENT=$(basename "$(pwd)")
QUEUE_DIR="d:/workspace-ns.s/ns.s-agent-chat/queue/$AGENT"
mkdir -p "$QUEUE_DIR"
touch "$QUEUE_DIR/.loop-running"
rm -f "$QUEUE_DIR"/*.json
