import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Typography, Select, Space, Table, Switch } from 'antd';
import axios from '../api/axiosInstance';
import { CopyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Интерфейс для свойств 1С
interface Property1C {
  key: string;
  value: string;
  description: string;
}

const IntegrationTestPage: React.FC = () => {
  const [form] = Form.useForm();
  const [apps, setApps] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [idToken, setIdToken] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [use1CProperties, setUse1CProperties] = useState(false);
  const [properties1C, setProperties1C] = useState<Property1C[]>([]);

  // Инициализация свойств 1С по умолчанию
  const initialize1CProperties = () => {
    return [
      { key: 'integ_message_body_size', value: '0', description: 'Размер тела сообщения' },
      { key: 'integ_message_id', value: '', description: 'Уникальный ID сообщения' },
      { key: 'integ_recipient_code', value: 'MainOffice', description: 'Код получателя' },
      { key: 'integ_sender_code', value: 'test', description: 'Код отправителя' },
      { key: 'JMS_AMQP_HEADER', value: 'true', description: 'Флаг AMQP заголовка' },
      { key: 'JMS_AMQP_HEADERDURABLE', value: 'true', description: 'Флаг долговечности' },
      { key: 'JMS_AMQP_ORIGINAL_ENCODING', value: '6', description: 'Оригинальная кодировка' },
      { key: 'NATIVE_MESSAGE_ID', value: '', description: 'Нативный ID сообщения' },
      { key: 'RecipientCode', value: 'MainOffice', description: 'Код получателя' },
      { key: 'SenderCode', value: 'test', description: 'Код отправителя' },
      { key: 'РазмерСообщения', value: '0', description: 'Размер сообщения' },
      { key: 'ТипСообщения', value: 'ОбменДанными', description: 'Тип сообщения на русском' }
    ];
  };

  useEffect(() => {
    setProperties1C(initialize1CProperties());
  }, []);

  useEffect(() => {
    axios.get('/api/applications').then(res => setApps(res.data.data));
    axios.get('/api/processes').then(res => setProcesses(res.data.data));
    axios.get('/api/channels').then(res => setChannels(res.data.data));
  }, []);

  useEffect(() => {
    if (selectedApp) {
      form.setFieldsValue({
        artemisHost: 'artemis',
        artemisPort: 6698,
      });
      const appProcesses = processes.filter(p => p.applicationId === selectedApp._id);
      const appChannels = channels.filter(c => appProcesses.some(p => p._id === c.processId));
      setFilteredChannels(appChannels);
      // Получаем id_token для выбранного приложения
      getTokenForApp(selectedApp);
    } else {
      setFilteredChannels([]);
      setIdToken('');
    }
    form.setFieldsValue({ queue: null }); // Reset queue selection
  }, [selectedApp, processes, channels, form]);

  const getTokenForApp = async (app: any) => {
    try {
      const base64data = btoa(`${app.name}:${app.clientSecret}`);
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      
      const res = await axios.post('/auth/oidc/token', 
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${base64data}`,
            'skipAuth': 'true' // Пропускаем автоматическую авторизацию
          }
        }
      );
      setIdToken(res.data.id_token);
      message.success('ID Token получен');
    } catch (err: any) {
      console.error('Ошибка получения ID Token:', err);
      message.error('Ошибка получения ID Token');
      setIdToken('');
    }
  };

  // Функция для обновления размера сообщения
  const updateMessageSize = (message: string) => {
    const size = new TextEncoder().encode(message).length;
    setProperties1C(prev => prev.map(prop => {
      if (prop.key === 'integ_message_body_size' || prop.key === 'РазмерСообщения') {
        return { ...prop, value: size.toString() };
      }
      return prop;
    }));
  };

  // Функция для применения свойств 1С
  const apply1CProperties = () => {
    const message = form.getFieldValue('message') || '';
    const size = new TextEncoder().encode(message).length;
    
    // Генерируем UUID
    const messageId = crypto.randomUUID();
    
    setProperties1C(prev => prev.map(prop => {
      switch (prop.key) {
        case 'integ_message_body_size':
        case 'РазмерСообщения':
          return { ...prop, value: size.toString() };
        case 'integ_message_id':
          return { ...prop, value: messageId };
        case 'NATIVE_MESSAGE_ID':
          return { ...prop, value: `ID:AMQP_UUID:${messageId}` };
        default:
          return prop;
      }
    }));
    
    message.success('Свойства 1С применены');
  };

  const sendMessage = async (values: any) => {
    if (!idToken) {
      message.error('ID Token не получен. Выберите приложение.');
      return;
    }

    setSending(true);
    try {
      const requestData: any = {
        queue: values.queue,
        message: values.message,
        id_token: idToken,
        artemisHost: values.artemisHost,
        artemisPort: values.artemisPort,
        use1CProperties: use1CProperties
      };

      const res = await axios.post('/api/test/send', requestData);
      
      if (res.data.success) {
        message.success('Сообщение отправлено');
        if (use1CProperties && res.data.properties) {
          console.log('Использованные свойства 1С:', res.data.properties);
        }
      }
    } catch (err: any) {
      console.error(err);
      message.error('Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const receiveMessage = async () => {
    if (!idToken) {
      message.error('ID Token не получен. Выберите приложение.');
      return;
    }

    setReceiving(true);
    setLastMessage(null);
    try {
      const values = await form.validateFields(['artemisHost', 'artemisPort', 'queue']);
      const res = await axios.get('/api/test/receive', {
        params: {
          queue: values.queue,
          id_token: idToken,
          artemisHost: values.artemisHost,
          artemisPort: values.artemisPort,
        },
        validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
      });

      if (res.data.success) {
        setLastMessage(res.data.message);
        message.success('Сообщение получено');
      } else {
        message.info(res.data.message);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setReceiving(false);
    }
  };

  // Колонки для таблицы свойств
  const columns = [
    {
      title: 'Ключ',
      dataIndex: 'key',
      key: 'key',
      width: '30%',
    },
    {
      title: 'Значение',
      dataIndex: 'value',
      key: 'value',
      width: '40%',
      render: (value: string, record: Property1C) => (
        <Input
          value={value}
          onChange={(e) => {
            setProperties1C(prev => prev.map(prop => 
              prop.key === record.key ? { ...prop, value: e.target.value } : prop
            ));
          }}
          size="small"
        />
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
    },
  ];

  return (
    <Card title={<Title level={4}>Тестирование интеграций (Artemis)</Title>} style={{ maxWidth: 800, margin: '32px auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>Выберите приложение:</Text>
          <Select
            showSearch
            style={{ width: 300, marginLeft: 16 }}
            placeholder="Приложение"
            optionFilterProp="children"
            onChange={id => setSelectedApp(apps.find(a => a._id === id))}
            filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            options={apps.map(app => ({ label: app.name, value: app._id }))}
          />
        </div>
        
        {selectedApp && (
          <div>
            <Text strong>ID Token (AMQP):</Text>
            <Input 
              value={idToken || 'Получение токена...'} 
              readOnly 
              addonAfter={<CopyOutlined onClick={() => navigator.clipboard.writeText(idToken)} />}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        <Form form={form} layout="vertical" onFinish={sendMessage} initialValues={{ queue: '', message: '' }}>
          <Form.Item name="artemisHost" label="Host Artemis" rules={[{ required: true, message: 'Введите host' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="artemisPort" label="Port Artemis" rules={[{ required: true, message: 'Введите порт' }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="queue" label="Очередь" rules={[{ required: true, message: 'Выберите очередь' }]}>
            <Select placeholder="Выберите очередь из списка" disabled={!selectedApp}>
              {filteredChannels.map(channel => (
                <Select.Option key={channel._id} value={channel.name}>{channel.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="message" label="Сообщение" rules={[{ required: true, message: 'Введите сообщение для отправки' }]}>
            <Input.TextArea 
              rows={3} 
              onChange={(e) => updateMessageSize(e.target.value)}
            />
          </Form.Item>
          
          {/* Секция свойств 1С */}
          <Form.Item label="Свойства 1С">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Switch 
                  checked={use1CProperties} 
                  onChange={setUse1CProperties}
                />
                <Text>Использовать свойства 1С</Text>
                {use1CProperties && (
                  <Button size="small" onClick={apply1CProperties}>
                    Применить свойства 1С
                  </Button>
                )}
              </div>
              
              {use1CProperties && (
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 16 }}>
                  <Text strong style={{ marginBottom: 8, display: 'block' }}>
                    Свойства сообщения 1С:
                  </Text>
                  <Table
                    dataSource={properties1C}
                    columns={columns}
                    pagination={false}
                    size="small"
                    rowKey="key"
                  />
                </div>
              )}
            </Space>
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={sending} style={{ marginRight: 8 }} disabled={!idToken}>
              Отправить
            </Button>
            <Button onClick={receiveMessage} loading={receiving} disabled={!idToken}>
              Получить последнее сообщение
            </Button>
          </Form.Item>
        </Form>
        
        {lastMessage !== null && (
          <div style={{ marginTop: 16 }}>
            <b>Последнее сообщение:</b>
            <pre style={{ background: '#f5f5f5', padding: 8 }}>{lastMessage}</pre>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default IntegrationTestPage; 