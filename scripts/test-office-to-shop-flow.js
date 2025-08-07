require('dotenv').config();
const axios = require('axios');
const AMQPClient = require('amqp10').Client;
const amqpPolicy = require('amqp10').Policy;
const { formatAmqpUri } = require('./amqp-uri-helper');

const MOCK_API_URL = process.env.MOCK_API_URL || 'http://localhost:9090';

/**
 * Демонстрационный скрипт для тестирования полного цикла:
 * 1. Создание тестового приложения (если не существует)
 * 2. Отправка тестовых сообщений в очередь OfficeToShop
 * 3. Получение и обработка сообщений с замерами времени
 */

const test_config = {
  applicationName: 'testAppE2e',
  processName: 'testProcessE2e',
  inChannelName: 'e2eInQueue',
  outChannelName: 'e2eOutQueue',
  testMessageCount: 20 // Количество тестовых сообщений для отправки
};

async function ensureTestEnvironment() {
  console.log('\n=== Проверка и создание тестовой среды ===');
  
  try {
    // Проверяем существование приложения
    const appsResponse = await axios.get(`${MOCK_API_URL}/api/applications`);
    const apps = appsResponse.data.data || [];
    let application = apps.find(app => app.name === test_config.applicationName);
    
    if (!application) {
      console.log('Тестовое приложение не найдено, создаем новое...');
      
      // Создаем приложение
      const appResponse = await axios.post(`${MOCK_API_URL}/api/applications`, {
        name: test_config.applicationName,
        description: 'Тестовое приложение для демонстрации OfficeToShop потока',
        clientSecret: 'demo-secret-123',
      });
      application = appResponse.data.data;
      console.log(`✅ Приложение "${application.name}" создано с ID: ${application._id}`);
      
      // Создаем процесс
      const processResponse = await axios.post(`${MOCK_API_URL}/api/processes`, {
        name: test_config.processName,
        applicationId: application._id,
      });
      const processData = processResponse.data.data;
      console.log(`✅ Процесс "${processData.name}" создан с ID: ${processData._id}`);
      
      // Создаем исходящий канал (OfficeToShop)
      const outChannelResponse = await axios.post(`${MOCK_API_URL}/api/channels`, {
        name: test_config.outChannelName,
        destination: 'OfficeToShop',
        processId: processData._id,
        direction: 'outbound',
      });
      const outChannel = outChannelResponse.data.data;
      console.log(`✅ Исходящий канал "${outChannel.name}" создан (destination: OfficeToShop)`);
      
      // Создаем входящий канал (ShopToOffice)
      const inChannelResponse = await axios.post(`${MOCK_API_URL}/api/channels`, {
        name: test_config.inChannelName,
        destination: 'Shop',
        processId: processData._id,
        direction: 'inbound',
      });
      const inChannel = inChannelResponse.data.data;
      console.log(`✅ Входящий канал "${inChannel.name}" создан (destination: Shop)`);
      
    } else {
      console.log(`✅ Тестовое приложение "${application.name}" уже существует`);
    }
    
    return application;
    
  } catch (error) {
    console.error('❌ Ошибка создания тестовой среды:', error.message);
    throw error;
  }
}

async function getAuthToken(application) {
  console.log('\n=== Получение токена авторизации ===');
  
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
  console.log('✅ Токен авторизации получен');
  return id_token;
}

async function sendTestMessages(id_token, messageCount) {
  console.log(`\n=== Отправка ${messageCount} тестовых сообщений ===`);
  
  const hostname = process.env.AMQP_HOST || 'localhost';
  const port = 6698;
  
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
  
  const client = new AMQPClient(amqpPolicy.ActiveMQ);
  await client.connect(uri, { saslMechanism: 'PLAIN' });
  console.log('✅ Подключено к AMQP-брокеру для отправки');
  
  const senderLink = await client.createSender('OfficeToShop', { 
    target: { address: 'OfficeToShop', capabilities: ['queue'] } 
  });
  
  const startTime = Date.now();
  
  for (let i = 1; i <= messageCount; i++) {
    const message = {
      body: JSON.stringify({
        messageId: `test-msg-${i}`,
        timestamp: new Date().toISOString(),
        content: `Тестовое сообщение ${i} для демонстрации OfficeToShop потока`,
        sequenceNumber: i,
        totalMessages: messageCount
      }),
      properties: {
        messageId: `test-msg-${i}`,
        timestamp: Date.now(),
        messageIndex: i
      },
      header: { 
        durable: true,
        timestamp: Date.now()
      },
    };
    
    await senderLink.send(message);
    
    if (i % 5 === 0) {
      console.log(`  📤 Отправлено: ${i}/${messageCount} сообщений`);
    }
    
    // Небольшая задержка между сообщениями
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const sendTime = Date.now() - startTime;
  console.log(`✅ Все ${messageCount} сообщений отправлены за ${sendTime}мс`);
  
  await client.disconnect();
  console.log('🔌 Отключено от AMQP-брокера');
  
  return { messageCount, sendTime };
}

async function runCompleteTest() {
  try {
    console.log('🚀 ЗАПУСК ДЕМОНСТРАЦИОННОГО ТЕСТА OFFICE-TO-SHOP ПОТОКА');
    
    // 1. Создаем/проверяем тестовую среду
    const application = await ensureTestEnvironment();
    
    // 2. Получаем токен
    const id_token = await getAuthToken(application);
    
    // 3. Отправляем тестовые сообщения
    const sendResults = await sendTestMessages(id_token, test_config.testMessageCount);
    
    console.log('\n⏳ Ждем 2 секунды для стабилизации очереди...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Запускаем consumer для получения сообщений
    console.log('\n🔄 Запуск office-to-shop-consumer для получения отправленных сообщений...');
    
    const { runOfficeToShopConsumerTest } = require('./office-to-shop-consumer');
    await runOfficeToShopConsumerTest();
    
    console.log('\n✅ ДЕМОНСТРАЦИОННЫЙ ТЕСТ УСПЕШНО ЗАВЕРШЕН!');
    console.log('\n📊 Сводка теста:');
    console.log(`   🏭 Создано тестовое окружение: ${application.name}`);
    console.log(`   📤 Отправлено сообщений: ${sendResults.messageCount}`);
    console.log(`   ⏱️  Время отправки: ${sendResults.sendTime}мс`);
    console.log(`   🔄 Запущен consumer для получения и замеров`);
    
  } catch (error) {
    console.error('\n❌ ОШИБКА В ДЕМОНСТРАЦИОННОМ ТЕСТЕ:');
    if (error.response) {
      console.error('HTTP статус:', error.response.status);
      console.error('HTTP данные:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Запуск демонстрационного теста
if (require.main === module) {
  runCompleteTest();
}

module.exports = { runCompleteTest, ensureTestEnvironment, sendTestMessages };