require('dotenv').config();
const axios = require('axios');
const AMQPClient = require('amqp10').Client;
const amqpPolicy = require('amqp10').Policy;
const { formatAmqpUri } = require('./amqp-uri-helper');

const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:9090';

const amqp_test = {
  applicationName: 'testAppE2e',
  processName: 'testProcessE2e',
  inChannelName: 'e2eInQueue',
  outChannelName: 'e2eOutQueue',
};

async function cleanup() {
  // Удалить старое приложение
  await axios.delete(`${MOCK_API_URL}/api/applications/by-name/${amqp_test.applicationName}`).catch(()=>{});
  // Удалить все процессы с таким именем
  await axios.delete(`${MOCK_API_URL}/api/processes/by-name/${amqp_test.processName}`).catch(()=>{});
  // Удалить все каналы с такими именами
  await axios.delete(`${MOCK_API_URL}/api/channels/by-name/${amqp_test.inChannelName}`).catch(()=>{});
  await axios.delete(`${MOCK_API_URL}/api/channels/by-name/${amqp_test.outChannelName}`).catch(()=>{});
}

async function fullCleanup() {
  console.log('\n=== Полная очистка всех testAppE2e, процессов и каналов ===');
  try {
    const appsResp = await axios.get(`${MOCK_API_URL}/api/applications`, { timeout: 5000 });
    const apps = appsResp.data.data || [];
    console.log(`Найдено приложений: ${apps.length}`);
    for (const app of apps) {
      if (app.name !== amqp_test.applicationName) continue;
      console.log(`\n[Удаление приложения] _id: ${app._id}, id_token: ${app.id_token}`);
      // Удалить все процессы этого приложения
      let procs = [];
      try {
        const procResp = await axios.get(`${MOCK_API_URL}/api/processes?applicationId=${app._id}`, { timeout: 5000 });
        procs = procResp.data.data || [];
      } catch (err) {
        console.error(`[Ошибка получения процессов] applicationId: ${app._id}`, err.message);
      }
      console.log(`  Найдено процессов: ${procs.length}`);
      for (const proc of procs) {
        console.log(`  [Удаление процесса] _id: ${proc._id}`);
        // Удалить все каналы этого процесса
        let chans = [];
        try {
          const chResp = await axios.get(`${MOCK_API_URL}/api/channels?processId=${proc._id}`, { timeout: 5000 });
          chans = chResp.data.data || [];
        } catch (err) {
          console.error(`[Ошибка получения каналов] processId: ${proc._id}`, err.message);
        }
        console.log(`    Найдено каналов: ${chans.length}`);
        for (const ch of chans) {
          try {
            await axios.delete(`${MOCK_API_URL}/api/channels/${ch._id}`, { timeout: 5000 });
            console.log(`    [Удалён канал] _id: ${ch._id}`);
          } catch (err) {
            if (err.response?.status === 409) {
              // Если канал содержит сообщения, используем принудительное удаление
              try {
                await axios.delete(`${MOCK_API_URL}/api/channels/${ch._id}/force`, { timeout: 5000 });
                console.log(`    [Принудительно удалён канал] _id: ${ch._id}`);
              } catch (forceErr) {
                console.error(`[Ошибка принудительного удаления канала] _id: ${ch._id}`, forceErr.message);
              }
            } else {
              console.error(`[Ошибка удаления канала] _id: ${ch._id}`, err.message);
            }
          }
        }
        try {
          await axios.delete(`${MOCK_API_URL}/api/processes/${proc._id}`, { timeout: 5000 });
          console.log(`  [Удалён процесс] _id: ${proc._id}`);
        } catch (err) {
          console.error(`[Ошибка удаления процесса] _id: ${proc._id}`, err.message);
        }
      }
      try {
        await axios.delete(`${MOCK_API_URL}/api/applications/${app._id}`, { timeout: 5000 });
        console.log(`[Удалено приложение] _id: ${app._id}`);
      } catch (err) {
        console.error(`[Ошибка удаления приложения] _id: ${app._id}`, err.message);
      }
    }
  } catch (err) {
    console.error('Ошибка при полной очистке:', err.message);
  }
  console.log('=== Конец полной очистки ===\n');
}

async function printAllApplications() {
  console.log('\n=== Список всех приложений, процессов и каналов ===');
  try {
    const appsResp = await axios.get(`${MOCK_API_URL}/api/applications`);
    const apps = appsResp.data.data || [];
    for (const app of apps) {
      console.log(`\n[Application] name: ${app.name}, _id: ${app._id}, id_token: ${app.id_token}, createdAt: ${app.createdAt}`);
      // Получить процессы для приложения
      const procResp = await axios.get(`${MOCK_API_URL}/api/processes?applicationId=${app._id}`).catch(()=>({data:{data:[]}}));
      const procs = procResp.data.data || [];
      for (const proc of procs) {
        console.log(`  [Process] name: ${proc.name}, _id: ${proc._id}, applicationId: ${proc.applicationId}`);
        // Получить каналы для процесса
        const chResp = await axios.get(`${MOCK_API_URL}/api/channels?processId=${proc._id}`).catch(()=>({data:{data:[]}}));
        const chans = chResp.data.data || [];
        for (const ch of chans) {
          console.log(`    [Channel] name: ${ch.name}, _id: ${ch._id}, processId: ${ch.processId}, direction: ${ch.direction}`);
        }
      }
    }
  } catch (err) {
    console.error('Ошибка при получении списка приложений:', err.message);
  }
  console.log('=== Конец списка ===\n');
}

async function runTest() {
  try {
    await fullCleanup();
    await printAllApplications();
    // 1. Создать приложение
    console.log('Шаг 1: Создание нового приложения...');
    const appResponse = await axios.post(`${MOCK_API_URL}/api/applications`, {
      name: amqp_test.applicationName,
      description: 'Тестовое приложение для E2E-теста',
      clientSecret: 'e2e-secret-123', // обязательно для схемы
    });
    const application = appResponse.data.data;
    console.log(`Приложение "${application.name}" создано с ID: ${application._id}`);
    console.log('DEBUG application:', application);
    // Проверка наличия приложения в базе через API
    const appCheck = await axios.get(`${MOCK_API_URL}/api/applications/${application._id}`).catch(e => e.response?.data);
    console.log('Проверка приложения в базе:', appCheck?.data || appCheck);
    
    // --- DEBUG: id_token из базы ---
    const dbIdToken = appCheck?.data?.id_token || application.id_token;
    console.log('[DEBUG] id_token из базы:', dbIdToken);

    // 2. Получить id_token через /auth/oidc/token
    console.log('\nШаг 2: Получение id_token через /auth/oidc/token...');
    const base64data = Buffer.from(`${application.name}:${application.clientSecret}`, 'utf8').toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    console.log('params:', params.toString());
    const tokenResponse = await axios.post(
      `${MOCK_API_URL}/auth/oidc/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + base64data,
        },
      }
    );
    const id_token = tokenResponse.data.id_token;
    if (!id_token) throw new Error('id_token не получен');
    console.log('Получен id_token:', id_token);
    
    // --- Сравнение id_token ---
    if (dbIdToken !== id_token) {
      console.warn('[WARNING] id_token из базы и из OIDC НЕ СОВПАДАЮТ!');
    } else {
      console.log('[OK] id_token из базы и из OIDC совпадают.');
    }

    // 3. Создать процесс
    console.log('\nШаг 3: Создание нового процесса...');
    const processResponse = await axios.post(`${MOCK_API_URL}/api/processes`, {
      name: amqp_test.processName,
      applicationId: application._id,
    });
    const processData = processResponse.data.data;
    console.log(`Процесс "${processData.name}" создан с ID: ${processData._id}, applicationId: ${processData.applicationId}`);
    // Проверка наличия процесса в базе через API
    const procCheck = await axios.get(`${MOCK_API_URL}/api/processes/${processData._id}`).catch(e => e.response?.data);
    console.log('Проверка процесса в базе:', procCheck?.data || procCheck);

    // 4. Создать каналы
    console.log('\nШаг 4: Создание каналов...');
    const outChannelResponse = await axios.post(`${MOCK_API_URL}/api/channels`, {
      name: amqp_test.outChannelName,
      destination: 'Office',
      processId: processData._id,
      direction: 'outbound',
    });
    const outChannel = outChannelResponse.data.data;
    console.log(`Канал "${outChannel.name}" создан с ID: ${outChannel._id}, processId: ${outChannel.processId}`);
    // Проверка наличия канала в базе через API
    const outChCheck = await axios.get(`${MOCK_API_URL}/api/channels/${outChannel._id}`).catch(e => e.response?.data);
    console.log('Проверка канала (out) в базе:', outChCheck?.data || outChCheck);

    const inChannelResponse = await axios.post(`${MOCK_API_URL}/api/channels`, {
      name: amqp_test.inChannelName,
      destination: 'Shop',
      processId: processData._id,
      direction: 'inbound',
    });
    const inChannel = inChannelResponse.data.data;
    console.log(`Канал "${inChannel.name}" создан с ID: ${inChannel._id}, processId: ${inChannel.processId}`);
    const inChCheck = await axios.get(`${MOCK_API_URL}/api/channels/${inChannel._id}`).catch(e => e.response?.data);
    console.log('Проверка канала (in) в базе:', inChCheck?.data || inChCheck);

    // Ждём 500 мс, чтобы база успела зафиксировать каналы
    await new Promise(r => setTimeout(r, 500));

    // 5. Получить runtime/channels через публичный API
    console.log('\nШаг 5: Получение runtime-конфигурации через /applications/:application/sys/esb/runtime/channels...');
    const runtimeResponse = await axios.get(
      `${MOCK_API_URL}/applications/${amqp_test.applicationName}/sys/esb/runtime/channels`,
      {
        headers: {
          'Authorization': 'Bearer ' + id_token,
        },
      }
    );
    const runtime = runtimeResponse.data;
    if (!runtime.items || !runtime.items.length) throw new Error('runtime.items пуст');
    const sender = runtime.items[0].destination;
    const receiver = runtime.items[1] ? runtime.items[1].destination : null;
    console.log('Получены destination:', sender, receiver);

    // 6. Подключиться к Artemis и отправить сообщение (подход 1С:Шины)
    console.log('\nШаг 6: Отправка тестового сообщения по AMQP...');
    const hostname = process.env.AMQP_HOST || 'localhost'; // для запуска вне docker
    const port = 6698;
    try {
      const uri = formatAmqpUri({
        hostname,
        port,
        vhost: `/applications/${amqp_test.applicationName}`,
        username: id_token, // Используем id_token как username
        password: id_token, // Используем id_token как password
        frameMax: 1000000,
        channelMax: 7000,
        heartbeat: 6000,
        locale: 'en_EN',
      });
      console.log('[DEBUG] AMQP URI:', uri);
      const client = new AMQPClient(amqpPolicy.ActiveMQ);
      await client.connect(uri, { saslMechanism: 'PLAIN' });
      const senderLink = await client.createSender(sender, { target: { address: sender, capabilities: ['queue'] } });
      const message = {
        body: `Тестовое сообщение от E2E-теста в ${new Date().toISOString()}`,
        header: { durable: true },
      };
      await senderLink.send(message);
      console.log('Сообщение успешно отправлено');
      await client.disconnect();
      console.log('Отключено от AMQP-брокера');
    } catch (amqpErr) {
      console.error('AMQP ERROR:', amqpErr);
      throw amqpErr;
    }

    console.log('\nE2E-тест успешно завершен!');
  } catch (error) {
    console.error('\nОшибка в ходе E2E-теста:');
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runTest();
