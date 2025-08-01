const express = require('express');
const { exec } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

// Добавляем CORS для лучшей интеграции
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Artemis-Admin-User, X-Artemis-Admin-Pass');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const ARTEMIS_CLI = '/var/lib/artemis/bin/artemis';
const ARTEMIS_INSTANCE = '/var/lib/artemis';
const ARTEMIS_ADMIN_USER = process.env.ARTEMIS_ADMIN_USER || 'admin';
const ARTEMIS_ADMIN_PASS = process.env.ARTEMIS_ADMIN_PASS || 'admin';
const ARTEMIS_URL = process.env.ARTEMIS_URL || 'tcp://localhost:61616';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Добавляем эндпоинт для проверки здоровья сервиса
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'artemis-api',
    version: '2.0.0'
  });
});

// Добавляем эндпоинт для получения информации о системе
app.get('/info', async (req, res) => {
  try {
    const { user, pass } = getAdminCreds(req);
    const cmd = `${ARTEMIS_CLI} version --user ${user} --password ${pass} --url ${ARTEMIS_URL} --silent`;
    const version = await runCli(cmd);
    
    res.json({
      artemisVersion: version.trim(),
      adminUser: user,
      artemisUrl: ARTEMIS_URL,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

function runCli(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: ARTEMIS_INSTANCE }, (error, stdout, stderr) => {
      if (error) {
        log(`CLI error: ${stderr}`);
        return reject(stderr || error.message);
      }
      resolve(stdout);
    });
  });
}

function getAdminCreds(req) {
  const user = req.headers['x-artemis-admin-user'] || ARTEMIS_ADMIN_USER;
  const pass = req.headers['x-artemis-admin-pass'] || ARTEMIS_ADMIN_PASS;
  return { user, pass };
}

// Получить список пользователей
app.get('/users', async (req, res) => {
  try {
    const { user, pass } = getAdminCreds(req);
    const cmd = `${ARTEMIS_CLI} user list --user ${user} --password ${pass} --url ${ARTEMIS_URL} --silent`;
    const out = await runCli(cmd);
    const users = out.split('\n')
      .map(line => line.trim())
      .filter(line => line &&
        !line.startsWith('Connection') &&
        !line.startsWith('---') &&
        !line.startsWith('Total') &&
        !line.startsWith('[') &&
        !line.startsWith('user') &&
        !line.startsWith('roles'))
      .map(line => {
        // Формат: "имя"(role1,role2)
        const match = line.match(/^"?([^"]+)"?\(([^)]*)\)$/);
        if (match) {
          const username = match[1];
          const roles = match[2].split(',').map(r => r.trim()).filter(Boolean);
          return { username, roles };
        }
        // Старый формат: username role1,role2
        const [username, roles] = line.split(' ');
        return { username, roles: roles ? roles.split(',') : [] };
      })
      .filter(u => u.username && u.username !== '');
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// Получить список пользователей с паролями
app.get('/users/with-passwords', async (req, res) => {
  try {
    const { user, pass } = getAdminCreds(req);
    const cmd = `${ARTEMIS_CLI} user list --user ${user} --password ${pass} --url ${ARTEMIS_URL} --silent`;
    const out = await runCli(cmd);
    const users = out.split('\n')
      .map(line => line.trim())
      .filter(line => line &&
        !line.startsWith('Connection') &&
        !line.startsWith('---') &&
        !line.startsWith('Total') &&
        !line.startsWith('[') &&
        !line.startsWith('user') &&
        !line.startsWith('roles'))
      .map(line => {
        // Формат: "имя"(role1,role2)
        const match = line.match(/^"?([^"]+)"?\(([^)]*)\)$/);
        if (match) {
          const username = match[1];
          const roles = match[2].split(',').map(r => r.trim()).filter(Boolean);
          return { username, roles };
        }
        // Старый формат: username role1,role2
        const [username, roles] = line.split(' ');
        return { username, roles: roles ? roles.split(',') : [] };
      })
      .filter(u => u.username && u.username !== '');

    // Получаем пароли для каждого пользователя
    const usersWithPasswords = [];
    for (const user of users) {
      try {
        // Используем команду для получения информации о пользователе
        const userInfoCmd = `${ARTEMIS_CLI} user show --user ${user} --password ${pass} --user-command-user ${user.username} --url ${ARTEMIS_URL} --silent`;
        const userInfo = await runCli(userInfoCmd);
        
        // Пытаемся извлечь пароль из вывода (может не работать в некоторых версиях)
        let password = '***';
        if (userInfo.includes('password') || userInfo.includes('Password')) {
          const passwordMatch = userInfo.match(/password[:\s]+([^\s\n]+)/i);
          if (passwordMatch) {
            password = passwordMatch[1];
          }
        }
        
        usersWithPasswords.push({
          ...user,
          password: password
        });
      } catch (userError) {
        // Если не удалось получить пароль, добавляем пользователя без пароля
        usersWithPasswords.push({
          ...user,
          password: '***'
        });
      }
    }
    
    res.json({ users: usersWithPasswords });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// Создать пользователя
app.post('/users', async (req, res) => {
  const { username, password, role = 'amq' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  try {
    const { user, pass } = getAdminCreds(req);
    const cmd = `${ARTEMIS_CLI} user add --user ${user} --password ${pass} --user-command-user ${username} --user-command-password ${password} --role ${role} --url ${ARTEMIS_URL} --silent`;
    await runCli(cmd);
    log(`User created: ${username}`);
    res.json({ result: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// Сбросить пароль/роли пользователя
app.put('/users/:username', async (req, res) => {
  const { username } = req.params;
  const { password, role = 'amq' } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'password required' });
  }
  try {
    const { user, pass } = getAdminCreds(req);
    const cmd = `${ARTEMIS_CLI} user reset --user ${user} --password ${pass} --user-command-user ${username} --user-command-password ${password} --role ${role} --url ${ARTEMIS_URL} --silent`;
    await runCli(cmd);
    log(`User reset: ${username}`);
    res.json({ result: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// Удалить пользователя
app.delete('/users/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const { user, pass } = getAdminCreds(req);
    const cmd = `${ARTEMIS_CLI} user rm --user ${user} --password ${pass} --user-command-user ${username} --url ${ARTEMIS_URL} --silent`;
    await runCli(cmd);
    log(`User deleted: ${username}`);
    res.json({ result: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

const PORT = process.env.PORT || 8162;
app.listen(PORT, () => {
  log(`artemis-api started on port ${PORT}`);
}); 