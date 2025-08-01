/**
 * Собственная реализация форматирования AMQP URI
 * Заменяет amqpuri для избежания уязвимостей в lodash.pick
 */

function formatAmqpUri(options) {
  const {
    hostname = 'localhost',
    port = 5672,
    vhost = '/',
    username,
    password,
    frameMax = 1000000,
    channelMax = 7000,
    heartbeat = 6000,
    locale = 'en_EN'
  } = options;

  // Экранирование специальных символов в vhost
  const escapedVhost = vhost === '/' ? '%2F' : encodeURIComponent(vhost);
  
  // Формирование URI
  let uri = 'amqp://';
  
  if (username && password) {
    uri += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
  }
  
  uri += `${hostname}:${port}${escapedVhost}`;
  
  // Добавление параметров
  const params = [];
  if (frameMax !== 1000000) params.push(`frame-max=${frameMax}`);
  if (channelMax !== 7000) params.push(`channel-max=${channelMax}`);
  if (heartbeat !== 6000) params.push(`heartbeat=${heartbeat}`);
  if (locale !== 'en_EN') params.push(`locale=${locale}`);
  
  if (params.length > 0) {
    uri += '?' + params.join('&');
  }
  
  return uri;
}

module.exports = { formatAmqpUri }; 