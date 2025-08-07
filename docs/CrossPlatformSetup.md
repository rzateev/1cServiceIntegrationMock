# Кроссплатформенная настройка проекта

Этот документ описывает настройки для обеспечения совместимости проекта на Windows, macOS и Linux.

## Файлы конфигурации

### .editorconfig
Обеспечивает единообразное форматирование кода во всех редакторах:
- UTF-8 кодировка
- LF переносы строк (Unix-style)
- 2 пробела для отступов
- Автоматическое удаление пробелов в конце строк

### .gitattributes
Настраивает Git для правильной обработки файлов:
- Автоматическое определение текстовых файлов
- LF для всех текстовых файлов
- CRLF для Windows скриптов (.bat, .cmd)
- LF для Unix скриптов (.sh, .ps1)

### .gitignore
Исключает файлы, которые не должны попадать в репозиторий:
- Временные файлы
- Файлы IDE
- Системные файлы
- Логи и кэш

## Настройка Git

### Автоматическая настройка
Запустите один из скриптов:

**Linux/macOS:**
```bash
chmod +x scripts/setup-git-config.sh
./scripts/setup-git-config.sh
```

**Windows:**
```powershell
.\scripts\setup-git-config.ps1
```

### Ручная настройка
```bash
# Настройка переносов строк
git config core.autocrlf false
git config core.eol lf

# Настройка пользователя
git config --global user.name "Your Name"
git config --global user.email "rzateev@gmail.com"

# Настройка ветки по умолчанию
git config --global init.defaultBranch main
```

## Нормализация существующих файлов

Если в репозитории есть файлы с неправильными переносами строк:

```bash
# Нормализовать все файлы
git add --renormalize .

# Проверить изменения
git status

# Создать коммит с нормализацией
git commit -m "fix: normalize line endings"
```

## Проверка настроек

### Проверка .editorconfig
Убедитесь, что ваш редактор поддерживает .editorconfig:
- VS Code: установите расширение "EditorConfig for VS Code"
- Cursor: встроенная поддержка
- IntelliJ IDEA: встроенная поддержка
- Sublime Text: установите пакет "EditorConfig"

### Проверка .gitattributes
```bash
# Проверить атрибуты файла
git check-attr -a filename

# Проверить все атрибуты
git check-attr -a .
```

### Проверка Git настроек
```bash
# Показать все настройки
git config --list

# Показать настройки репозитория
git config --local --list
```

## Рекомендации для разработчиков

### Windows
1. Используйте Git Bash или WSL для работы с Unix-скриптами
2. Настройте VS Code для использования LF переносов строк
3. Установите .editorconfig расширение

### macOS/Linux
1. Убедитесь, что Git настроен на использование LF
2. Проверьте права доступа к скриптам: `chmod +x scripts/*.sh`

### Общие рекомендации
1. Всегда используйте .editorconfig для новых файлов
2. Проверяйте переносы строк перед коммитом
3. Используйте `git add --renormalize .` при смене ОС
4. Тестируйте проект на разных платформах

## Устранение проблем

### Проблема: файлы показываются как измененные после клонирования
**Решение:**
```bash
git config core.autocrlf false
git add --renormalize .
git commit -m "fix: normalize line endings"
```

### Проблема: скрипты не выполняются на Unix
**Решение:**
```bash
chmod +x scripts/*.sh
```

### Проблема: разные отступы в разных редакторах
**Решение:**
1. Убедитесь, что установлен .editorconfig
2. Перезапустите редактор
3. Проверьте настройки отступов в редакторе

## Полезные команды

```bash
# Проверить переносы строк в файле
file filename

# Показать невидимые символы
cat -A filename

# Конвертировать CRLF в LF
dos2unix filename

# Конвертировать LF в CRLF
unix2dos filename
``` 