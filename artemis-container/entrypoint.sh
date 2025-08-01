#!/bin/bash
set -e

# Назначаем владельца artemis:artemis для каталога конфигов
chown -R artemis:artemis /var/lib/artemis/etc

# Инициализация окружения (как делает оригинальный /init)
if [ -f /init ]; then
  /init || true
fi

# Запускаем configure-artemis.sh для проверки конфигурации (опционально)
if [ -f /var/lib/artemis/bin/configure-artemis.sh ]; then
  echo "Проверка конфигурации Artemis..."
  /var/lib/artemis/bin/configure-artemis.sh || true
fi

# Передаем управление CMD
exec "$@" 