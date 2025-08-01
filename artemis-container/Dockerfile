FROM vromero/activemq-artemis:2.16.0
# Dockerfile для Artemis под ARM. Без дополнительных скриптов.
# Используйте buildx для сборки: docker buildx build --platform linux/arm64 -t my-artemis-arm -f Dockerfile-artemis . 

# Копируем все кастомные конфиги из etc-template/etc
COPY etc-template/etc/ /var/lib/artemis/etc/
USER root
# Исправление репозиториев для старого Debian Stretch
RUN sed -i '/stretch-updates/d' /etc/apt/sources.list && \
    sed -i 's|deb.debian.org|archive.debian.org|g' /etc/apt/sources.list && \
    sed -i 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list && \
    apt-get update
# Установка Node.js 16 LTS (совместимо с Debian Stretch)
RUN apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    node -v && npm -v
USER artemis 
# Копируем Node.js API-сервис внутрь контейнера
COPY artemis-api/ /opt/artemis-api/
WORKDIR /opt/artemis-api/
USER root
RUN npm install
USER artemis
WORKDIR /

# Запуск Artemis и Node.js API-сервиса параллельно
USER root
RUN apt-get install -y supervisor
COPY supervisor.conf /etc/supervisor/conf.d/supervisor.conf
COPY configure-artemis.sh /var/lib/artemis/bin/configure-artemis.sh
RUN chmod +x /var/lib/artemis/bin/configure-artemis.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisor.conf"] 