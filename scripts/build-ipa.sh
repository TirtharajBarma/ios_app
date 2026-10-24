#!/usr/bin/env bash
# Default to local build
exec bash "$(dirname "$0")/build-ipa-local.sh" "$@"
