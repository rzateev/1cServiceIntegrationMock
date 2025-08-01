#!/bin/bash
set -e

BASE_DIR="/var/lib/artemis"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

check_file() {
    local file=$1
    local path=$2
    local expected1=$3
    local expected2=$4
    local ok=true
    if [ -f "$path/$file" ]; then
        content=$(cat "$path/$file")
        perms=$(stat -c '%U:%G %a' "$path/$file")
        if [[ "$content" == *"$expected1"* && "$content" == *"$expected2"* ]]; then
            echo -e "${GREEN}✓ $path/$file содержит нужные строки${NC}"
        else
            echo -e "${RED}✗ $path/$file НЕ содержит нужные строки!${NC}"
            ok=false
        fi
        if [[ "$perms" == *"artemis:artemis"* ]]; then
            echo -e "${GREEN}✓ Права на $path/$file корректны: $perms${NC}"
        else
            echo -e "${YELLOW}⚠ Проверьте владельца/права $path/$file: $perms${NC}"
        fi
    else
        echo -e "${RED}✗ Файл $path/$file не найден!${NC}"
        ok=false
    fi
    return $([ "$ok" = true ] && echo 0 || echo 1)
}

for path in "$BASE_DIR/etc"; do
    echo "--- Проверка $path ---"
    check_file artemis-users.properties "$path" "artemis=" "admin="
    check_file artemis-roles.properties "$path" "admin = artemis,admin" "amq = artemis,admin"
    check_file broker.xml "$path" "<configuration" "<core"
    check_file jolokia-access.xml "$path" "<restrict>" "<allow-origin>"
done

echo -e "${GREEN}[CONFIG] Проверка завершена!${NC}"
