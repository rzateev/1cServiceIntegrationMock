#!/bin/bash

# Скрипт для настройки Git конфигурации для кроссплатформенной разработки
echo "🔧 Настройка Git для кроссплатформенной разработки..."

# Настройка автоматической нормализации переносов строк
echo "📝 Настройка переносов строк..."
git config core.autocrlf false
git config core.eol lf

# Настройка пользователя (если не настроен)
if [ -z "$(git config --global user.name)" ]; then
    echo "👤 Настройка имени пользователя..."
    git config --global user.name "rzateev"
fi

if [ -z "$(git config --global user.email)" ]; then
    echo "📧 Настройка email пользователя..."
    git config --global user.email "rzateev@gmail.com"
fi

# Настройка редактора по умолчанию
echo "✏️  Настройка редактора..."
git config --global core.editor "code --wait"

# Настройка ветки по умолчанию
echo "🌿 Настройка ветки по умолчанию..."
git config --global init.defaultBranch main

# Настройка слияния
echo "🔀 Настройка стратегии слияния..."
git config --global merge.ff false
git config --global pull.rebase false

# Настройка логирования
echo "📊 Настройка логирования..."
git config --global log.decorate auto
git config --global log.abbrevCommit true

# Настройка алиасов
echo "🏷️  Настройка алиасов..."
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'

echo "✅ Настройка Git завершена!"
echo ""
echo "📋 Текущие настройки:"
echo "   Имя: $(git config --global user.name)"
echo "   Email: $(git config --global user.email)"
echo "   autocrlf: $(git config core.autocrlf)"
echo "   eol: $(git config core.eol)"
echo "   defaultBranch: $(git config --global init.defaultBranch)" 