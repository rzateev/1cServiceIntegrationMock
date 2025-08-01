require('dotenv').config();
const axios = require('axios');
const AMQPClient = require('amqp10').Client;
const amqpPolicy = require('amqp10').Policy;
const { formatAmqpUri } = require('./amqp-uri-helper');
const fs = require('fs');

const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:9090';

// Конфигурация для тестов производительности (должна совпадать с продюсером)
const performance_test = {
  applicationName: 'performanceTestApp',
  processName: 'performanceTestProcess',
  channelName: 'performanceQueue',
  destination: 'PerformanceQueue',
  expectedMessageCount: 5000,
  batchSize: 100, // Размер пакета для обработки
  processingDelay: 0 // Задержка обработки сообщения в мс
};

async function getTestEnvironment() {
  console.log('\n=== Получение тестовой среды ===');
  
  try {
    // 1. Получить приложение
    console.log('Получение приложения...');
    const appsResponse = await axios.get(`${MOCK_API_URL}/api/applications`);
    const apps = appsResponse.data.data || [];
    const application = apps.find(app => app.name === performance_test.applicationName);
    
    if (!application) {
      throw new Error(`Приложение ${performance_test.applicationName} не найдено`);
    }
    
    console.log(`Приложение "${application.name}" найдено с ID: ${application._id}`);

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

    return { application, id_token };
  } catch (error) {
    console.error('Ошибка получения тестовой среды:', error.message);
    throw new Error('Тестовая среда не найдена. Сначала запустите performance-producer.js');
  }
}

async function getQueueStatistics(destination) {
  try {
    // Получаем статистику очереди через Jolokia
    const jolokiaResponse = await axios.get(
      `http://localhost:8161/console/jolokia/read/org.apache.activemq.artemis:broker="0.0.0.0",component=addresses,address="${destination}",subcomponent=queues,queue="${destination}"/MessageCount`,
      {
        headers: {
          'Authorization': 'Basic YWRtaW46YWRtaW4='
        }
      }
    );
    
    const messageCount = jolokiaResponse.data.value;
    console.log(`📊 Сообщений в очереди ${destination}: ${messageCount}`);
    return messageCount;
  } catch (error) {
    console.warn('Не удалось получить статистику очереди:', error.message);
    return null;
  }
}

async function receiveMessages(id_token, destination, expectedMessageCount, batchSize, processingDelay) {
  console.log(`\n=== Получение сообщений из очереди ${destination} ===`);
  
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
  
  const receiverLink = await client.createReceiver(destination, { 
    source: { address: destination, capabilities: ['queue'] } 
  });

  const startTime = Date.now();
  let receivedCount = 0;
  let errorCount = 0;
  let processedMessages = [];
  let isReceiving = true;

  // Обработчик сообщений
  receiverLink.on('message', async (message) => {
    try {
      const messageIndex = message.properties?.messageIndex || receivedCount + 1;
      const receivedAt = new Date().toISOString();
      
      // Обработка сообщения
      if (processingDelay > 0) {
        await new Promise(r => setTimeout(r, processingDelay));
      }
      
      // Сохраняем информацию о сообщении
      processedMessages.push({
        index: messageIndex,
        receivedAt,
        body: message.body,
        properties: message.properties,
        header: message.header
      });
      
      receivedCount++;
      
      // Прогресс каждые 100 сообщений
      if (receivedCount % 100 === 0) {
        console.log(`  Получено: ${receivedCount}/${expectedMessageCount}`);
      }
      
      // Принимаем сообщение
      await receiverLink.accept(message);
      
      // Проверяем, получили ли мы все ожидаемые сообщения
      if (receivedCount >= expectedMessageCount) {
        isReceiving = false;
        await receiverLink.detach();
      }
      
    } catch (err) {
      errorCount++;
      console.error(`  Ошибка обработки сообщения:`, err.message);
      try {
        await receiverLink.release(message);
      } catch (releaseErr) {
        console.error(`  Ошибка освобождения сообщения:`, releaseErr.message);
      }
    }
  });

  // Обработчик ошибок
  receiverLink.on('errorReceived', (err) => {
    console.error('Ошибка receiver:', err);
    errorCount++;
  });

  // Обработчик отключения
  receiverLink.on('detached', () => {
    console.log('Receiver отключен');
  });

  console.log(`Начинаем получение сообщений...`);
  console.log(`Ожидаем ${expectedMessageCount} сообщений...`);

  // Ждем получения всех сообщений или таймаут
  const timeout = 300000; // 5 минут
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      if (isReceiving) {
        console.log('⏰ Таймаут получения сообщений');
        isReceiving = false;
        resolve();
      }
    }, timeout);
  });

  const receivePromise = new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (!isReceiving) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });

  await Promise.race([receivePromise, timeoutPromise]);

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const messagesPerSecond = (receivedCount / totalTime) * 1000;

  console.log('\n=== Результаты получения ===');
  console.log(`Всего получено: ${receivedCount} сообщений`);
  console.log(`Ошибок: ${errorCount}`);
  console.log(`Общее время: ${totalTime} мс`);
  console.log(`Средняя скорость: ${messagesPerSecond.toFixed(2)} сообщений/сек`);
  console.log(`Время на сообщение: ${(totalTime / receivedCount).toFixed(2)} мс`);

  await client.disconnect();
  console.log('Отключено от AMQP-брокера');

  return {
    receivedCount,
    errorCount,
    totalTime,
    messagesPerSecond,
    processedMessages
  };
}

async function analyzeResults(producerResults, consumerResults) {
  console.log('\n=== Анализ результатов ===');
  
  if (producerResults && consumerResults) {
    const producerSpeed = producerResults.messagesPerSecond;
    const consumerSpeed = consumerResults.messagesPerSecond;
    const speedRatio = consumerSpeed / producerSpeed;
    
    console.log(`📈 Скорость отправки: ${producerSpeed.toFixed(2)} сообщений/сек`);
    console.log(`📉 Скорость получения: ${consumerSpeed.toFixed(2)} сообщений/сек`);
    console.log(`⚖️  Соотношение скоростей: ${speedRatio.toFixed(2)}`);
    
    if (speedRatio > 1.1) {
      console.log('✅ Получение быстрее отправки');
    } else if (speedRatio < 0.9) {
      console.log('⚠️  Получение медленнее отправки');
    } else {
      console.log('🔄 Скорости примерно равны');
    }
  }
  
  const messageLoss = (producerResults?.sentCount || 0) - (consumerResults?.receivedCount || 0);
  if (messageLoss > 0) {
    console.log(`⚠️  Потеряно сообщений: ${messageLoss}`);
  } else {
    console.log('✅ Потери сообщений не обнаружены');
  }
}

async function runPerformanceConsumerTest() {
  try {
    console.log('🚀 Запуск теста производительности получения сообщений');
    console.log(`Цель: получить ${performance_test.expectedMessageCount} сообщений`);
    
    // Проверяем статистику очереди
    const queueStats = await getQueueStatistics(performance_test.destination);
    if (queueStats !== null && queueStats < performance_test.expectedMessageCount) {
      console.warn(`⚠️  В очереди только ${queueStats} сообщений из ожидаемых ${performance_test.expectedMessageCount}`);
    }
    
    const { id_token } = await getTestEnvironment();
    
    const results = await receiveMessages(
      id_token, 
      performance_test.destination, 
      performance_test.expectedMessageCount, 
      performance_test.batchSize, 
      performance_test.processingDelay
    );

    console.log('\n✅ Тест получения завершен успешно!');
    console.log('\n📊 Итоговая статистика:');
    console.log(`   Получено сообщений: ${results.receivedCount}`);
    console.log(`   Ошибок: ${results.errorCount}`);
    console.log(`   Общее время: ${results.totalTime} мс`);
    console.log(`   Скорость: ${results.messagesPerSecond.toFixed(2)} сообщений/сек`);
    
    // Загружаем результаты продюсера для сравнения
    let producerResults = null;
    try {
      if (fs.existsSync('performance-producer-results.json')) {
        const producerData = fs.readFileSync('performance-producer-results.json', 'utf8');
        producerResults = JSON.parse(producerData);
        console.log('\n📋 Результаты продюсера загружены');
      }
    } catch (err) {
      console.log('Результаты продюсера не найдены');
    }
    
    // Анализируем результаты
    await analyzeResults(producerResults, results);
    
    // Сохраняем результаты
    const resultsData = {
      timestamp: new Date().toISOString(),
      testType: 'consumer',
      ...results,
      config: performance_test,
      producerResults: producerResults
    };
    
    // Убираем processedMessages из сохранения (слишком большой объем)
    delete resultsData.processedMessages;
    
    fs.writeFileSync('performance-consumer-results.json', JSON.stringify(resultsData, null, 2));
    console.log('\n💾 Результаты сохранены в performance-consumer-results.json');
    
    // Сохраняем детальную информацию о сообщениях отдельно
    if (results.processedMessages.length > 0) {
      const messagesData = {
        timestamp: new Date().toISOString(),
        messageCount: results.processedMessages.length,
        messages: results.processedMessages.slice(0, 100) // Только первые 100 для анализа
      };
      fs.writeFileSync('performance-messages-detail.json', JSON.stringify(messagesData, null, 2));
      console.log('📄 Детали сообщений сохранены в performance-messages-detail.json');
    }

  } catch (error) {
    console.error('\n❌ Ошибка в ходе теста получения:');
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
  runPerformanceConsumerTest();
}

module.exports = { runPerformanceConsumerTest, performance_test }; 