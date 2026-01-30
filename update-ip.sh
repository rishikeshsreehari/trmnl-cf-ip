#!/usr/bin/env bash
set -euo pipefail

WORKER_URL="https://trmnl-cf-ip.rishikeshsreehari.workers.dev/update"
IP_NAME="home"
PASSWORD="YOUR_PASSWORD_HERE"

curl -fsS "${WORKER_URL}?IP_name=${IP_NAME}&password=${PASSWORD}"
