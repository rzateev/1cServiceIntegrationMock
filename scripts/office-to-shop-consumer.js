require('dotenv').config();
const axios = require('axios');
const AMQPClient = require('amqp10').Client;
const amqpPolicy = require('amqp10').Policy;
const { formatAmqpUri } = require('./amqp-uri-helper');
const fs = require('fs');

const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:9090';

// Конфигурация для получения сообщений из очереди OfficeToShop
const test_config = {
  applicationName: 'testAppE2e',
  processName: 'testProcessE2e',
  channelName: 'e2eOutQueue', // Исходящий канал (OfficeToShop)
  destination: 'OfficeToShop', // Destination для очереди OfficeToShop
  maxMessages: 1000, // Максимальное количество сообщений для получения
  timeoutMs: 60000, // Таймаут получения в мс (1 минута)
  batchReportSize: 10 // Отчет о прогрессе каждые N сообщений
};

/**
 * Получает тестовую среду (приложение и токен авторизации)
 */
async function getTestEnvironment() {
  console.log('\n=== Подключение к тестовому приложению ===');
  
  try {
    // 1. Найти приложение testAppE2e
    console.log(`Поиск приложения "${test_config.applicationName}"...`);
    const appsResponse = await axios.get(`${MOCK_API_URL}/api/applications`);
    const apps = appsResponse.data.data || [];
    const application = apps.find(app => app.name === test_config.applicationName);
    
    if (!application) {
      throw new Error(`Приложение "${test_config.applicationName}" не найдено. Сначала запустите e2e-test.js для создания тестовой среды.`);
    }
    
    console.log(`✅ Приложение найдено: ID=${application._id}, clientSecret существует`);

    // 2. Получить id_token через OIDC
    console.log('Получение id_token через OIDC...');
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
    if (!id_token) {
      throw new Error('Не удалось получить id_token');
    }
    
    console.log('✅ id_token получен успешно');

    // 3. Получить runtime-конфигурацию для проверки доступности канала
    console.log('Проверка runtime-конфигурации каналов...');
    const runtimeResponse = await axios.get(
      `${MOCK_API_URL}/applications/${test_config.applicationName}/sys/esb/runtime/channels`,
      {
        headers: {
          'Authorization': 'Bearer ' + id_token,
        },
      }
    );
    
    const runtime = runtimeResponse.data;
    if (!runtime.items || !runtime.items.length) {
      throw new Error('Runtime-конфигурация каналов пуста');
    }
    
    // Найти destination для OfficeToShop (исходящий канал)
    const officeToShopChannel = runtime.items.find(item => item.destination === test_config.destination);
    if (!officeToShopChannel) {
      console.warn(`⚠️ Канал с destination "${test_config.destination}" не найден в runtime-конфигурации`);
      console.log('Доступные каналы:', runtime.items.map(item => item.destination));
    } else {
      console.log(`✅ Канал "${test_config.destination}" найден и доступен`);
    }

    return { application, id_token };
    
  } catch (error) {
    console.error('❌ Ошибка получения тестовой среды:', error.message);
    if (error.response) {
      console.error('HTTP статус:', error.response.status);
      console.error('HTTP данные:', error.response.data);
    }
    throw error;
  }
}

/**
 * Получает статистику очереди через Jolokia API
 */
async function getQueueStatistics(destination) {
  try {
    console.log(`📊 Получение статистики очереди "${destination}"...`);
    
    // Пробуем несколько вариантов URL для Jolokia API
    const jolokiaUrls = [
      // Вариант 1: Правильный путь (проверен curl)
      `http://localhost:8161/console/jolokia/read/org.apache.activemq.artemis:broker="0.0.0.0",component=addresses,address="${destination}",subcomponent=queues,routing-type="anycast",queue="${destination}"/MessageCount`,
      // Вариант 2: Альтернативный формат для адреса
      `http://localhost:8161/console/jolokia/read/org.apache.activemq.artemis:address="${destination}",broker="0.0.0.0",component=addresses,queue="${destination}",routing-type="anycast",subcomponent=queues/MessageCount`,
      // Вариант 3: Упрощенный путь
      `http://localhost:8161/console/jolokia/read/org.apache.activemq.artemis:broker="0.0.0.0",component=addresses,address="${destination}"/MessageCount`
    ];
    
    const authHeaders = [
      'YXJ0ZW1pczphcnRlbWlz', // artemis:artemis
      'YWRtaW46YWRtaW4=',     // admin:admin
    ];
    
    for (const baseUrl of jolokiaUrls) {
      for (const auth of authHeaders) {
        try {
          console.log(`  🔄 Попытка подключения: ${baseUrl.split('/jolokia/')[0]}/jolokia/...`);
          
          const jolokiaResponse = await axios.get(baseUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            },
            timeout: 3000
          });
          
          if (jolokiaResponse.data && typeof jolokiaResponse.data.value === 'number') {
            const messageCount = jolokiaResponse.data.value;
            console.log(`📈 Сообщений в очереди "${destination}": ${messageCount}`);
            return messageCount;
          }
          
        } catch (urlError) {
          console.log(`    ❌ Неуспешно: ${urlError.response?.status || urlError.message}`);
          continue;
        }
      }
    }
    
    // Если все варианты не сработали, используем альтернативный метод
    console.log(`⚠️ Jolokia API недоступен. Используем альтернативный метод...`);
    return await getQueueStatisticsAlternative(destination);
    
  } catch (error) {
    console.warn(`⚠️ Не удалось получить статистику очереди "${destination}":`, error.message);
    return null;
  }
}

/**
 * Альтернативный метод получения статистики через REST API mock-сервиса
 */
async function getQueueStatisticsAlternative(destination) {
  try {
    console.log(`🔄 Получение статистики через mock-сервис API...`);
    
    // Пытаемся получить информацию через наш mock API
    const response = await axios.get(`${MOCK_API_URL}/api/applications/${test_config.applicationName}/channels`, {
      timeout: 3000
    });
    
    if (response.data && response.data.data) {
      const channels = response.data.data;
      const channel = channels.find(ch => ch.destination === destination);
      
      if (channel) {
        console.log(`📋 Канал найден: ${channel.name} -> ${channel.destination}`);
        console.log(`ℹ️ Статистика очереди недоступна через API, но канал существует`);
        return 0; // Возвращаем 0 как заглушку
      }
    }
    
    console.log(`⚠️ Канал с destination "${destination}" не найден`);
    return null;
    
  } catch (error) {
    console.warn(`⚠️ Альтернативный метод также не сработал:`, error.message);
    return null;
  }
}

/**
 * Основная функция для получения сообщений из очереди OfficeToShop
 */
async function receiveMessages(id_token, destination, maxMessages, timeoutMs, batchReportSize) {
  console.log(`\n=== Получение сообщений из очереди OfficeToShop ("${destination}") ===`);
  console.log(`Максимум сообщений: ${maxMessages}`);
  console.log(`Таймаут: ${timeoutMs} мс`);
  
  const hostname = process.env.AMQP_HOST || 'localhost';
  const port = 6698;
  
  // Формируем AMQP URI для подключения к виртуальному хосту приложения
  const uri = formatAmqpUri({
    hostname,
    port,
    vhost: `/applications/${test_config.applicationName}`,
    username: id_token,
    password: id_token,
    frameMax: 1000000,
    channelMax: 7000,
    heartbeat: 6000,
    locale: 'en_EN',
  });

  console.log('[DEBUG] AMQP URI:', uri);
  
  // Подключаемся к AMQP брокеру
  const client = new AMQPClient(amqpPolicy.ActiveMQ);
  await client.connect(uri, { saslMechanism: 'PLAIN' });
  console.log('✅ Подключено к AMQP-брокеру');
  
  // Создаем receiver для очереди
  const receiverLink = await client.createReceiver(destination, { 
    source: { address: destination, capabilities: ['queue'] },
    creditWindow: 100 // Предварительно запросить до 100 сообщений
  });
  console.log(`✅ Receiver создан для очереди "${destination}"`);

  // Переменные для отслеживания прогресса и статистики
  const startTime = Date.now();
  let receivedCount = 0;
  let errorCount = 0;
  let processedMessages = [];
  let isReceiving = true;
  let firstMessageTime = null;
  let lastMessageTime = null;

  // Детальная статистика времени
  const timeStats = {
    minProcessingTime: Infinity,
    maxProcessingTime: 0,
    totalProcessingTime: 0,
    processingTimes: []
  };

  // Обработчик получения сообщений
  receiverLink.on('message', async (message) => {
    const messageReceiveTime = Date.now();
    
    if (!firstMessageTime) {
      firstMessageTime = messageReceiveTime;
      console.log('🎯 Получено первое сообщение');
    }
    
    try {
      // Обработка сообщения
      const processingStartTime = Date.now();
      
      // Извлекаем информацию из сообщения
      const messageData = {
        index: receivedCount + 1,
        receivedAt: new Date(messageReceiveTime).toISOString(),
        body: message.body,
        properties: message.properties || {},
        header: message.header || {},
        messageId: message.properties?.messageId || `msg_${receivedCount + 1}`,
        timestamp: message.properties?.timestamp || message.header?.timestamp
      };
      
      // Эмуляция обработки сообщения (можно добавить бизнес-логику)
      await new Promise(resolve => setTimeout(resolve, 1)); // 1мс задержка
      
      const processingEndTime = Date.now();
      const processingTime = processingEndTime - processingStartTime;
      
      // Обновляем статистику времени
      timeStats.totalProcessingTime += processingTime;
      timeStats.processingTimes.push(processingTime);
      if (processingTime < timeStats.minProcessingTime) {
        timeStats.minProcessingTime = processingTime;
      }
      if (processingTime > timeStats.maxProcessingTime) {
        timeStats.maxProcessingTime = processingTime;
      }
      
      // Сохраняем информацию о сообщении
      processedMessages.push({
        ...messageData,
        processingTime,
        processingStartTime,
        processingEndTime
      });
      
      receivedCount++;
      lastMessageTime = messageReceiveTime;
      
      // Отчет о прогрессе
      if (receivedCount % batchReportSize === 0) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTime;
        const avgSpeed = (receivedCount / elapsedTime) * 1000;
        console.log(`  📈 Получено: ${receivedCount} сообщений | Скорость: ${avgSpeed.toFixed(2)} сообщ/сек | Время обработки: ${processingTime}мс`);
      }
      
      // Принимаем сообщение (acknowledge)
      await receiverLink.accept(message);
      
      // Проверяем условия остановки
      if (receivedCount >= maxMessages) {
        console.log(`🏁 Достигнуто максимальное количество сообщений: ${maxMessages}`);
        isReceiving = false;
        await receiverLink.detach();
      }
      
    } catch (err) {
      errorCount++;
      console.error(`❌ Ошибка обработки сообщения ${receivedCount + 1}:`, err.message);
      try {
        // Отклоняем сообщение при ошибке
        await receiverLink.release(message);
      } catch (releaseErr) {
        console.error(`❌ Ошибка освобождения сообщения:`, releaseErr.message);
      }
    }
  });

  // Обработчик ошибок receiver
  receiverLink.on('errorReceived', (err) => {
    console.error('❌ Ошибка receiver:', err.message);
    errorCount++;
  });

  // Обработчик отключения receiver
  receiverLink.on('detached', () => {
    console.log('🔌 Receiver отключен');
    isReceiving = false;
  });

  console.log(`⏳ Ожидание сообщений (максимум ${timeoutMs/1000} секунд)...`);

  // Ожидание получения сообщений или таймаута
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      if (isReceiving) {
        console.log('⏰ Достигнут таймаут получения сообщений');
        isReceiving = false;
        resolve();
      }
    }, timeoutMs);
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

  // Закрываем соединения
  try {
    if (receiverLink && !receiverLink.isClosed()) {
      await receiverLink.detach();
    }
  } catch (err) {
    console.warn('Ошибка при отключении receiver:', err.message);
  }

  await client.disconnect();
  console.log('🔌 Отключено от AMQP-брокера');

  // Расчет итоговой статистики
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const messagesPerSecond = receivedCount > 0 ? (receivedCount / totalTime) * 1000 : 0;
  const avgProcessingTime = receivedCount > 0 ? timeStats.totalProcessingTime / receivedCount : 0;

  console.log('\n=== 📊 РЕЗУЛЬТАТЫ ПОЛУЧЕНИЯ СООБЩЕНИЙ ===');
  console.log(`✅ Всего получено: ${receivedCount} сообщений`);
  console.log(`❌ Ошибок: ${errorCount}`);
  console.log(`⏱️  Общее время: ${totalTime} мс (${(totalTime/1000).toFixed(2)} сек)`);
  console.log(`🚀 Средняя скорость: ${messagesPerSecond.toFixed(2)} сообщений/сек`);
  console.log(`⚡ Среднее время обработки: ${avgProcessingTime.toFixed(2)} мс`);
  
  if (receivedCount > 0) {
    console.log(`📏 Мин. время обработки: ${timeStats.minProcessingTime} мс`);
    console.log(`📏 Макс. время обработки: ${timeStats.maxProcessingTime} мс`);
    
    if (firstMessageTime && lastMessageTime) {
      const messageSpan = lastMessageTime - firstMessageTime;
      console.log(`📅 Время от первого до последнего сообщения: ${messageSpan} мс`);
    }
  }

  return {
    receivedCount,
    errorCount,
    totalTime,
    messagesPerSecond,
    avgProcessingTime,
    timeStats,
    processedMessages,
    firstMessageTime,
    lastMessageTime
  };
}

/**
 * Сохраняет результаты теста в файлы
 */
async function saveResults(results) {
  console.log('\n💾 Сохранение результатов...');
  
  const timestamp = new Date().toISOString();
  const resultsData = {
    timestamp,
    testType: 'office-to-shop-consumer',
    config: test_config,
    ...results
  };
  
  // Убираем детальную информацию о сообщениях для основного файла
  const summaryData = { ...resultsData };
  delete summaryData.processedMessages;
  delete summaryData.timeStats.processingTimes;
  
  // Сохраняем краткие результаты
  const summaryFilename = `office-to-shop-results-${Date.now()}.json`;
  fs.writeFileSync(summaryFilename, JSON.stringify(summaryData, null, 2));
  console.log(`📄 Краткие результаты сохранены в ${summaryFilename}`);
  
  // Сохраняем детальную информацию о сообщениях
  if (results.processedMessages && results.processedMessages.length > 0) {
    const messagesData = {
      timestamp,
      messageCount: results.processedMessages.length,
      messages: results.processedMessages.slice(0, 100), // Первые 100 сообщений для анализа
      allProcessingTimes: results.timeStats.processingTimes
    };
    
    const detailsFilename = `office-to-shop-messages-${Date.now()}.json`;
    fs.writeFileSync(detailsFilename, JSON.stringify(messagesData, null, 2));
    console.log(`📋 Детали сообщений сохранены в ${detailsFilename}`);
  }
}

/**
 * Основная функция запуска теста
 */
async function runOfficeToShopConsumerTest() {
  try {
    console.log('🚀 ЗАПУСК ТЕСТА ПОЛУЧЕНИЯ СООБЩЕНИЙ ИЗ ОЧЕРЕДИ OfficeToShop');
    console.log(`🎯 Цель: получить до ${test_config.maxMessages} сообщений из очереди OfficeToShop ("${test_config.destination}")`);
    
    // Получаем статистику очереди перед началом
    const initialQueueStats = await getQueueStatistics(test_config.destination);
    
    // Подключаемся к тестовой среде
    const { id_token } = await getTestEnvironment();
    
    // Запускаем получение сообщений
    const results = await receiveMessages(
      id_token, 
      test_config.destination, 
      test_config.maxMessages, 
      test_config.timeoutMs, 
      test_config.batchReportSize
    );

    // Получаем финальную статистику очереди
    const finalQueueStats = await getQueueStatistics(test_config.destination);
    
    // Выводим статистику только если есть валидные данные
    if (initialQueueStats !== null || finalQueueStats !== null) {
      console.log(`\n📊 Статистика очереди:`);
      
      if (initialQueueStats !== null && finalQueueStats !== null) {
        const consumedFromQueue = initialQueueStats - finalQueueStats;
        console.log(`   До теста: ${initialQueueStats} сообщений`);
        console.log(`   После теста: ${finalQueueStats} сообщений`);
        console.log(`   Обработано из очереди: ${consumedFromQueue} сообщений`);
        
        if (consumedFromQueue !== results.receivedCount) {
          console.warn(`⚠️ Расхождение: получено клиентом ${results.receivedCount}, а из очереди удалено ${consumedFromQueue}`);
        } else {
          console.log(`✅ Статистика совпадает: обработано ${consumedFromQueue} сообщений`);
        }
      } else {
        console.log(`   ℹ️ Статистика очереди недоступна через Jolokia API`);
        console.log(`   📋 Получено клиентом: ${results.receivedCount} сообщений`);
        console.log(`   💡 Для просмотра статистики очереди используйте веб-консоль Artemis: http://localhost:8161`);
      }
    } else {
      console.log(`\n📋 Результат: получено ${results.receivedCount} сообщений`);
      console.log(`ℹ️ Статистика очереди недоступна. Проверьте веб-консоль Artemis: http://localhost:8161`);
    }

    // Сохраняем результаты
    await saveResults(results);

    console.log('\n✅ ТЕСТ УСПЕШНО ЗАВЕРШЕН!');
    
    if (results.receivedCount === 0) {
      console.log('\n💡 Сообщения не были получены. Возможные причины:');
      console.log('   • Очередь пуста');
      console.log('   • Сообщения были уже обработаны');
      console.log('   • Проблемы с подключением к брокеру');
      console.log('   • Неправильный destination или канал');
    }

  } catch (error) {
    console.error('\n❌ ОШИБКА В ХОДЕ ТЕСТА:');
    if (error.response) {
      console.error('HTTP статус:', error.response.status);
      console.error('HTTP данные:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Запуск теста, если файл запущен напрямую
if (require.main === module) {
  runOfficeToShopConsumerTest();
}

module.exports = { 
  runOfficeToShopConsumerTest, 
  test_config,
  getTestEnvironment,
  receiveMessages 
};