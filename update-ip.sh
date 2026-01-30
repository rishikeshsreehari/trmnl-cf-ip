#!/usr/bin/env bash
set -euo pipefail

# CONFIGURATION
WORKER_URL="https://ip.t.r1l.in/update"
PASSWORD="your_secure_password" # Replace with your actual password

echo "Updating TRMNL Allowlist..."

# 1. Register IPv4 as a standard named IP
curl -4 -fsS "${WORKER_URL}?IP_name=home_v4&password=${PASSWORD}" && echo " IPv4 updated."

# 2. Register IPv6 as a 'range' to allow your Phone/Laptop automatically
# Note the 'range_' prefix in the name. Use range_ for IPv6 addresses.
curl -6 -fsS "${WORKER_URL}?IP_name=range_home&password=${PASSWORD}" && echo " IPv6 Range updated."

echo "All systems green."