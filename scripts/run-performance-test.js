require('dotenv').config();
const { runPerformanceTest } = require('./performance-producer');
const { runPerformanceConsumerTest } = require('./performance-consumer');
const fs = require('fs');

async function runFullPerformanceTest() {
  console.log('🚀 Запуск полного теста производительности');
  console.log('==========================================');
  
  const startTime = Date.now();
  
  try {
    // Шаг 1: Запуск продюсера
    console.log('\n📤 ШАГ 1: Отправка сообщений');
    console.log('============================');
    await runPerformanceTest();
    
    // Небольшая пауза между тестами
    console.log('\n⏳ Пауза 2 секунды перед получением сообщений...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Шаг 2: Запуск консьюмера
    console.log('\n📥 ШАГ 2: Получение сообщений');
    console.log('==============================');
    await runPerformanceConsumerTest();
    
    // Шаг 3: Анализ результатов
    console.log('\n📊 ШАГ 3: Анализ результатов');
    console.log('=============================');
    await analyzeFullResults();
    
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Полный тест завершен за ${totalTime} мс`);
    
  } catch (error) {
    console.error('\n❌ Ошибка в ходе полного теста:', error.message);
    process.exit(1);
  }
}

async function analyzeFullResults() {
  try {
    // Загружаем результаты продюсера
    let producerResults = null;
    if (fs.existsSync('performance-producer-results.json')) {
      const producerData = fs.readFileSync('performance-producer-results.json', 'utf8');
      producerResults = JSON.parse(producerData);
    }
    
    // Загружаем результаты консьюмера
    let consumerResults = null;
    if (fs.existsSync('performance-consumer-results.json')) {
      const consumerData = fs.readFileSync('performance-consumer-results.json', 'utf8');
      consumerResults = JSON.parse(consumerData);
    }
    
    if (!producerResults || !consumerResults) {
      console.log('⚠️  Не удалось загрузить результаты для анализа');
      return;
    }
    
    console.log('\n📈 ДЕТАЛЬНЫЙ АНАЛИЗ ПРОИЗВОДИТЕЛЬНОСТИ');
    console.log('=====================================');
    
    // Основные метрики
    console.log(`📤 ПРОДЮСЕР:`);
    console.log(`   Отправлено: ${producerResults.sentCount} сообщений`);
    console.log(`   Время: ${producerResults.totalTime} мс`);
    console.log(`   Скорость: ${producerResults.messagesPerSecond.toFixed(2)} сообщений/сек`);
    console.log(`   Ошибок: ${producerResults.errorCount}`);
    
    console.log(`\n📥 КОНСЬЮМЕР:`);
    console.log(`   Получено: ${consumerResults.receivedCount} сообщений`);
    console.log(`   Время: ${consumerResults.totalTime} мс`);
    console.log(`   Скорость: ${consumerResults.messagesPerSecond.toFixed(2)} сообщений/сек`);
    console.log(`   Ошибок: ${consumerResults.errorCount}`);
    
    // Сравнительный анализ
    console.log(`\n⚖️  СРАВНЕНИЕ:`);
    const speedRatio = consumerResults.messagesPerSecond / producerResults.messagesPerSecond;
    const messageLoss = producerResults.sentCount - consumerResults.receivedCount;
    const lossPercentage = (messageLoss / producerResults.sentCount) * 100;
    
    console.log(`   Соотношение скоростей: ${speedRatio.toFixed(2)}`);
    console.log(`   Потеря сообщений: ${messageLoss} (${lossPercentage.toFixed(2)}%)`);
    
    // Оценка производительности
    console.log(`\n🏆 ОЦЕНКА ПРОИЗВОДИТЕЛЬНОСТИ:`);
    
    if (speedRatio > 1.2) {
      console.log(`   ✅ Получение значительно быстрее отправки (${speedRatio.toFixed(2)}x)`);
    } else if (speedRatio > 1.0) {
      console.log(`   ✅ Получение быстрее отправки (${speedRatio.toFixed(2)}x)`);
    } else if (speedRatio > 0.8) {
      console.log(`   ⚠️  Получение медленнее отправки (${speedRatio.toFixed(2)}x)`);
    } else {
      console.log(`   ❌ Получение значительно медленнее отправки (${speedRatio.toFixed(2)}x)`);
    }
    
    if (messageLoss === 0) {
      console.log(`   ✅ Потери сообщений отсутствуют`);
    } else if (lossPercentage < 1) {
      console.log(`   ⚠️  Минимальные потери сообщений (${lossPercentage.toFixed(2)}%)`);
    } else {
      console.log(`   ❌ Значительные потери сообщений (${lossPercentage.toFixed(2)}%)`);
    }
    
    // Рекомендации
    console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
    
    if (speedRatio < 0.9) {
      console.log(`   • Рассмотрите увеличение размера пакетов для получения`);
      console.log(`   • Проверьте настройки AMQP клиента`);
      console.log(`   • Увеличьте количество параллельных консьюмеров`);
    }
    
    if (messageLoss > 0) {
      console.log(`   • Проверьте настройки очереди в Artemis`);
      console.log(`   • Убедитесь в корректности обработки ошибок`);
      console.log(`   • Рассмотрите использование транзакций`);
    }
    
    if (producerResults.messagesPerSecond < 100) {
      console.log(`   • Скорость отправки низкая, проверьте сеть и настройки`);
    }
    
    if (consumerResults.messagesPerSecond < 100) {
      console.log(`   • Скорость получения низкая, оптимизируйте обработку`);
    }
    
    // Сохраняем сводный отчет
    const summaryReport = {
      timestamp: new Date().toISOString(),
      testType: 'full_performance',
      producer: {
        sentCount: producerResults.sentCount,
        totalTime: producerResults.totalTime,
        messagesPerSecond: producerResults.messagesPerSecond,
        errorCount: producerResults.errorCount
      },
      consumer: {
        receivedCount: consumerResults.receivedCount,
        totalTime: consumerResults.totalTime,
        messagesPerSecond: consumerResults.messagesPerSecond,
        errorCount: consumerResults.errorCount
      },
      analysis: {
        speedRatio: speedRatio,
        messageLoss: messageLoss,
        lossPercentage: lossPercentage,
        overallPerformance: speedRatio > 0.9 && messageLoss === 0 ? 'excellent' : 
                           speedRatio > 0.8 && lossPercentage < 1 ? 'good' : 'needs_improvement'
      },
      config: producerResults.config
    };
    
    fs.writeFileSync('performance-full-report.json', JSON.stringify(summaryReport, null, 2));
    console.log(`\n💾 Сводный отчет сохранен в performance-full-report.json`);
    
  } catch (error) {
    console.error('Ошибка при анализе результатов:', error.message);
  }
}

// Запуск полного теста
if (require.main === module) {
  runFullPerformanceTest();
}

module.exports = { runFullPerformanceTest, analyzeFullResults }; 