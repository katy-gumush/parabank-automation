#!/usr/bin/env bash
# Creates a new CHECKING account for demo customer john (12212), funded from seeded CHECKING 13122.
# Requires: curl. OpenAPI: POST /createAccount — newAccountType 0 = CHECKING.
set -euo pipefail
ORIGIN="${PARABANK_ORIGIN:-https://parabank.parasoft.com}"
curl -sS -X POST "${ORIGIN}/parabank/services/bank/createAccount?customerId=12212&newAccountType=0&fromAccountId=13122"
echo
