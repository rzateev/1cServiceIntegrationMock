require('dotenv').config();
const axios = require('axios');
const AMQPClient = require('amqp10').Client;
const amqpPolicy = require('amqp10').Policy;
const { formatAmqpUri } = require('./amqp-uri-helper');

const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:9090';

// Конфигурация для тестов производительности
const performance_test = {
  applicationName: 'performanceTestApp',
  processName: 'performanceTestProcess',
  channelName: 'performanceQueue',
  destination: 'PerformanceQueue',
  messageCount: 5000,
  batchSize: 100, // Размер пакета для отправки
  delayBetweenBatches: 10 // Задержка между пакетами в мс
};

async function cleanup() {
  console.log('\n=== Очистка старых данных ===');
  try {
    // Удалить старое приложение
    await axios.delete(`${MOCK_API_URL}/api/applications/by-name/${performance_test.applicationName}`).catch(() => {});
    console.log('Старые данные очищены');
  } catch (err) {
    console.log('Очистка не потребовалась');
  }
}

async function createTestEnvironment() {
  console.log('\n=== Создание тестовой среды ===');
  
  // 1. Создать приложение
  console.log('Создание приложения...');
  const appResponse = await axios.post(`${MOCK_API_URL}/api/applications`, {
    name: performance_test.applicationName,
    description: 'Приложение для тестирования производительности',
    clientSecret: 'perf-secret-123',
  });
  const application = appResponse.data.data;
  console.log(`Приложение "${application.name}" создано с ID: ${application._id}`);

  // 2. Получить id_token
  console.log('Получение id_token...');
  const base64data = Buffer.from(`${application.name}:${application.clientSecret}`, 'utf8').toString('base64');
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
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
  console.log('id_token получен');

  // 3. Создать процесс
  console.log('Создание процесса...');
  const processResponse = await axios.post(`${MOCK_API_URL}/api/processes`, {
    name: performance_test.processName,
    applicationId: application._id,
  });
  const processData = processResponse.data.data;
  console.log(`Процесс "${processData.name}" создан с ID: ${processData._id}`);

  // 4. Создать канал
  console.log('Создание канала...');
  const channelResponse = await axios.post(`${MOCK_API_URL}/api/channels`, {
    name: performance_test.channelName,
    destination: performance_test.destination,
    processId: processData._id,
    direction: 'outbound',
  });
  const channel = channelResponse.data.data;
  console.log(`Канал "${channel.name}" создан с ID: ${channel._id}`);

  // Ждём немного для синхронизации
  await new Promise(r => setTimeout(r, 500));

  return { application, processData, channel, id_token };
}

function generateRandomMessage(index) {
  const messages = [
    `Тестовое сообщение №${index} - ${new Date().toISOString()}`,
    `Performance test message ${index} at ${Date.now()}`,
    `Сообщение для тестирования производительности ${index}`,
    `Message ${index}: ${Math.random().toString(36).substring(7)}`,
    `Test data ${index}: ${Buffer.from(Math.random().toString()).toString('base64').substring(0, 20)}`
  ];
  
  return messages[index % messages.length];
}

async function sendMessages(id_token, destination, messageCount, batchSize, delayBetweenBatches) {
  console.log(`\n=== Отправка ${messageCount} сообщений ===`);
  
  const hostname = process.env.AMQP_HOST || 'localhost';
  const port = 6698;
  
  const uri = formatAmqpUri({
    hostname,
    port,
    vhost: `/applications/${performance_test.applicationName}`,
    username: id_token,
    password: id_token,
    frameMax: 1000000,
    channelMax: 7000,
    heartbeat: 6000,
    locale: 'en_EN',
  });

  console.log('[DEBUG] AMQP URI:', uri);
  
  const client = new AMQPClient(amqpPolicy.ActiveMQ);
  await client.connect(uri, { saslMechanism: 'PLAIN' });
  
  const senderLink = await client.createSender(destination, { 
    target: { address: destination, capabilities: ['queue'] } 
  });

  const startTime = Date.now();
  let sentCount = 0;
  let errorCount = 0;

  console.log(`Начинаем отправку ${messageCount} сообщений пакетами по ${batchSize}...`);

  for (let batch = 0; batch < Math.ceil(messageCount / batchSize); batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, messageCount);
    const currentBatchSize = batchEnd - batchStart;

    console.log(`Отправка пакета ${batch + 1}/${Math.ceil(messageCount / batchSize)} (сообщения ${batchStart + 1}-${batchEnd})...`);

    const promises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      const message = {
        body: generateRandomMessage(i + 1),
        header: { 
          durable: true,
          messageId: `msg-${i + 1}-${Date.now()}`,
          timestamp: Date.now()
        },
        properties: {
          messageIndex: i + 1,
          batchNumber: batch + 1,
          sentAt: new Date().toISOString()
        }
      };

      promises.push(
        senderLink.send(message)
          .then(() => {
            sentCount++;
            if (sentCount % 100 === 0) {
              console.log(`  Отправлено: ${sentCount}/${messageCount}`);
            }
          })
          .catch(err => {
            errorCount++;
            console.error(`  Ошибка отправки сообщения ${i + 1}:`, err.message);
          })
      );
    }

    await Promise.all(promises);

    // Задержка между пакетами
    if (batch < Math.ceil(messageCount / batchSize) - 1) {
      await new Promise(r => setTimeout(r, delayBetweenBatches));
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const messagesPerSecond = (sentCount / totalTime) * 1000;

  console.log('\n=== Результаты отправки ===');
  console.log(`Всего отправлено: ${sentCount} сообщений`);
  console.log(`Ошибок: ${errorCount}`);
  console.log(`Общее время: ${totalTime} мс`);
  console.log(`Средняя скорость: ${messagesPerSecond.toFixed(2)} сообщений/сек`);
  console.log(`Время на сообщение: ${(totalTime / sentCount).toFixed(2)} мс`);

  await client.disconnect();
  console.log('Отключено от AMQP-брокера');

  return {
    sentCount,
    errorCount,
    totalTime,
    messagesPerSecond
  };
}

async function runPerformanceTest() {
  try {
    console.log('🚀 Запуск теста производительности отправки сообщений');
    console.log(`Цель: отправить ${performance_test.messageCount} сообщений`);
    
    await cleanup();
    const { id_token } = await createTestEnvironment();
    
    const results = await sendMessages(
      id_token, 
      performance_test.destination, 
      performance_test.messageCount, 
      performance_test.batchSize, 
      performance_test.delayBetweenBatches
    );

    console.log('\n✅ Тест производительности завершен успешно!');
    console.log('\n📊 Итоговая статистика:');
    console.log(`   Отправлено сообщений: ${results.sentCount}`);
    console.log(`   Ошибок: ${results.errorCount}`);
    console.log(`   Общее время: ${results.totalTime} мс`);
    console.log(`   Скорость: ${results.messagesPerSecond.toFixed(2)} сообщений/сек`);
    
    // Сохраняем результаты в файл для консьюмера
    const fs = require('fs');
    const resultsData = {
      timestamp: new Date().toISOString(),
      testType: 'producer',
      ...results,
      config: performance_test
    };
    fs.writeFileSync('performance-producer-results.json', JSON.stringify(resultsData, null, 2));
    console.log('\n💾 Результаты сохранены в performance-producer-results.json');

  } catch (error) {
    console.error('\n❌ Ошибка в ходе теста производительности:');
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Запуск теста
if (require.main === module) {
  runPerformanceTest();
}

module.exports = { runPerformanceTest, performance_test }; 