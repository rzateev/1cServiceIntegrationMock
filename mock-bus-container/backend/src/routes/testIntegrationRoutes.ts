import express, { Request, Response } from 'express';
const amqp10 = require('amqp10');
const amqpuri = require('amqpuri');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /api/test/send
router.post('/send', async (req: Request, res: Response) => {
  console.log('[SEND] Received request with body:', req.body);

  const queue = req.body.queue;
  const msg = req.body.message;
  const id_token = req.body.id_token; // Используем id_token вместо username/password
  const host = req.body.artemisHost || process.env.ARTEMIS_HOST || 'localhost';
  const port = req.body.artemisPort || process.env.ARTEMIS_AMQP_PORT || 6698;
  const vhost = req.body.vhost || '/';
  const use1CProperties = req.body.use1CProperties || false; // Флаг использования свойств 1С

  if (!id_token) {
    return res.status(400).json({ success: false, message: 'id_token is required' });
  }

  const connectionOptions = {
    hostname: host,
    port: parseInt(port, 10),
    vhost,
    username: id_token, // Используем id_token как username
    password: id_token, // Используем id_token как password
  };

  console.log(`[SEND] Connecting to amqp://${id_token}@${host}:${port} and sending to queue '${queue}'`);

  try {
    const uri = amqpuri.format(connectionOptions);
    const client = new amqp10.Client(amqp10.Policy.ActiveMQ);
    await client.connect(uri, { saslMechanism: 'PLAIN' });
    console.log('[SEND] Connection successful.');
    const sender = await client.createSender(queue);
    console.log(`[SEND] Sender created for queue '${queue}'. Sending message...`);

    // Подготавливаем сообщение
    let messageToSend = msg;
    let messageProperties = {};

    if (use1CProperties) {
      // Генерируем UUID для сообщения
      const messageId = uuidv4();
      const messageSize = Buffer.byteLength(msg, 'utf8');
      
      // Создаем свойства 1С
      messageProperties = {
        'JMS_AMQP_INTEG_MESSAGE_BODY_SIZE': messageSize.toString(),
        'JMS_AMQP_INTEG_MESSAGE_ID': messageId,
        'JMS_AMQP_INTEG_RECIPIENT_CODE': 'Office',
        'JMS_AMQP_INTEG_SENDER_CODE': 'Office',
        'JMS_AMQP_HEADER': 'true',
        'JMS_AMQP_HEADERDURABLE': 'true',
        'JMS_AMQP_ORIGINAL_ENCODING': '6',
        'JMS_AMQP_NATIVE_MESSAGE_ID': `ID:AMQP_UUID:${messageId}`,
        'JMS_AMQP_RECIPIENT_CODE': 'Office',
        'JMS_AMQP_SENDER_CODE': 'Office',
        'JMS_AMQP_MESSAGE_SIZE': messageSize.toString(),
        'JMS_AMQP_MESSAGE_TYPE': 'ОбменДанными'
      };

      console.log('[SEND] Using 1C properties:', messageProperties);
      
      // Создаем сообщение со свойствами
      messageToSend = {
        body: msg,
        properties: {
          // Используем только стандартные AMQP свойства
          messageId: messageId,
          userId: 'Office',
          to: 'Office',
          subject: 'ОбменДанными',
          correlationId: `ID:AMQP_UUID:${messageId}`,
          contentType: 'text/plain',
          contentEncoding: 'UTF-8'
        }
      };
      
      // Добавляем пользовательские свойства как application_properties
      if (use1CProperties) {
        (messageToSend as any).applicationProperties = {
          'integ_message_body_size': messageSize.toString(),
          'integ_message_id': messageId,
          'integ_recipient_code': 'MainOffice',
          'integ_sender_code': 'test',
          'JMS_AMQP_HEADER': 'true',
          'JMS_AMQP_HEADERDURABLE': 'true',
          'JMS_AMQP_ORIGINAL_ENCODING': '6',
          'NATIVE_MESSAGE_ID': `ID:AMQP_UUID:${messageId}`,
          'RecipientCode': 'MainOffice',
          'SenderCode': 'test',
          'РазмерСообщения': messageSize.toString(),
          'ТипСообщения': 'ОбменДанными'
        };
      }
    }

    await sender.send(messageToSend);
    console.log('[SEND] Message sent successfully.');
    await client.disconnect();
    console.log('[SEND] Disconnected.');
    res.json({ success: true, status: 'Message sent', properties: messageProperties });
  } catch (e: any) {
    console.error('[SEND] Error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/test/receive
router.get('/receive', async (req: Request, res: Response) => {
  console.log('[RECEIVE] Received request with query:', req.query);
  const { queue, vhost } = req.query;
  const id_token = req.query.id_token as string; // Используем id_token вместо username/password
  const host = (req.query.artemisHost || 'localhost') as string;
  const port = (req.query.artemisPort || 6698) as string;

  if (!id_token) {
    return res.status(400).json({ success: false, message: 'id_token is required' });
  }

  const connectionOptions = {
    hostname: host,
    port: parseInt(port, 10),
    vhost: (vhost || '/') as string,
    username: id_token, // Используем id_token как username
    password: id_token, // Используем id_token как password
  };

  console.log(`[RECEIVE] Attempting to receive from queue '${queue}' on amqp://${id_token}@${host}:${port}`);
  let client: any; // amqp10.Client

  try {
    const uri = amqpuri.format(connectionOptions);
    client = new amqp10.Client(amqp10.Policy.ActiveMQ);
    await client.connect(uri, { saslMechanism: 'PLAIN' });
    console.log('[RECEIVE] Connection successful.');
    const receiver = await client.createReceiver(queue as string);
    console.log(`[RECEIVE] Receiver created for queue '${queue}'. Waiting for message...`);

    const timeout = setTimeout(async () => {
      if (client) await client.disconnect();
      if (!res.headersSent) {
        res.status(200).json({ success: false, message: 'В очереди нет новых сообщений.' });
      }
    }, 3000); // Уменьшим таймаут до 3 секунд для лучшего UX

    receiver.on('message', async (msg: any) => {
      console.log('[RECEIVE] Message received:', msg.body);
      console.log('[RECEIVE] Message properties:', msg.properties);
      console.log('[RECEIVE] Message application_properties:', msg.application_properties);
      console.log('[RECEIVE] Message deliveryAnnotations:', msg.deliveryAnnotations);
      clearTimeout(timeout);
      if (client) await client.disconnect();
      if (!res.headersSent) {
        res.json({ 
          success: true, 
          message: msg.body,
          properties: msg.properties || {},
          application_properties: msg.application_properties || {},
          deliveryAnnotations: msg.deliveryAnnotations || {}
        });
      }
    });

    receiver.on('errorReceived', async (err: any) => {
      console.error('[RECEIVE] Error received from broker:', err);
      clearTimeout(timeout);
      if (client) await client.disconnect();
      if (!res.headersSent) {
        // Проверяем, является ли ошибка "очередь не найдена"
        if (err.condition === 'amqp:not-found') {
            res.status(404).json({ success: false, message: `Очередь '${queue}' не найдена.` });
        } else {
            res.status(500).json({ success: false, message: err.message });
        }
      }
    });
  } catch (e: any) {
    console.error('[RECEIVE] Error:', e);
    if (client) await client.disconnect();
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
});

export default router;