# Скрипт для настройки Git конфигурации для кроссплатформенной разработки (PowerShell)
Write-Host "🔧 Настройка Git для кроссплатформенной разработки..." -ForegroundColor Green

# Настройка автоматической нормализации переносов строк
Write-Host "📝 Настройка переносов строк..." -ForegroundColor Yellow
git config core.autocrlf false
git config core.eol lf

# Настройка пользователя (если не настроен)
if (-not (git config --global user.name)) {
    Write-Host "👤 Настройка имени пользователя..." -ForegroundColor Yellow
    git config --global user.name "rzateev"
}

if (-not (git config --global user.email)) {
    Write-Host "📧 Настройка email пользователя..." -ForegroundColor Yellow
    git config --global user.email "rzateev@gmail.com"
}

# Настройка редактора по умолчанию
Write-Host "✏️  Настройка редактора..." -ForegroundColor Yellow
git config --global core.editor "code --wait"

# Настройка ветки по умолчанию
Write-Host "🌿 Настройка ветки по умолчанию..." -ForegroundColor Yellow
git config --global init.defaultBranch main

# Настройка слияния
Write-Host "🔀 Настройка стратегии слияния..." -ForegroundColor Yellow
git config --global merge.ff false
git config --global pull.rebase false

# Настройка логирования
Write-Host "📊 Настройка логирования..." -ForegroundColor Yellow
git config --global log.decorate auto
git config --global log.abbrevCommit true

# Настройка алиасов
Write-Host "🏷️  Настройка алиасов..." -ForegroundColor Yellow
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'

Write-Host "✅ Настройка Git завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Текущие настройки:" -ForegroundColor Cyan
Write-Host "   Имя: $(git config --global user.name)" -ForegroundColor White
Write-Host "   Email: $(git config --global user.email)" -ForegroundColor White
Write-Host "   autocrlf: $(git config core.autocrlf)" -ForegroundColor White
Write-Host "   eol: $(git config core.eol)" -ForegroundColor White
Write-Host "   defaultBranch: $(git config --global init.defaultBranch)" -ForegroundColor White 