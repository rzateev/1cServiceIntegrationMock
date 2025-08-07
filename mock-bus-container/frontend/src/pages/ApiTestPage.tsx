import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Input, message, Typography, Space } from 'antd';
import axios from '../api/axiosInstance';
import { CopyOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

const IntegrationTestPage: React.FC = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [ticket, setTicket] = useState<string>('');
  const [metaResult, setMetaResult] = useState<string>('');
  const [runtimeResult, setRuntimeResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [curlCommands, setCurlCommands] = useState<{
    auth: string;
    metadata: string;
    runtime: string;
  }>({ auth: '', metadata: '', runtime: '' });

  useEffect(() => {
    axios.get('/api/applications').then(res => setApps(res.data.data));
  }, []);

  const generateCurlCommands = (app: any, token?: string) => {
    const clientId = app.name;
    const clientSecret = app.clientSecret;
    const base64 = btoa(`${clientId}:${clientSecret}`);
    
    const authCommand = `curl -X POST http://localhost:9090/auth/oidc/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -H "Authorization: Basic ${base64}" \\
  -d "grant_type=client_credentials"`;
    
    const metadataCommand = `curl -H "Authorization: Bearer ${token || '<token>'}" \\
  http://localhost:9090/applications/${clientId}/sys/esb/metadata/channels`;
    
    const runtimeCommand = `curl -H "Authorization: Bearer ${token || '<token>'}" \\
  http://localhost:9090/applications/${clientId}/sys/esb/runtime/channels`;
    
    setCurlCommands({
      auth: authCommand,
      metadata: metadataCommand,
      runtime: runtimeCommand
    });
  };

  const getTicket = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const clientId = selectedApp.name;
      const clientSecret = selectedApp.clientSecret;
      const base64 = btoa(`${clientId}:${clientSecret}`);
      console.log('[DEBUG FRONT] clientId:', clientId, 'clientSecret:', clientSecret, 'len:', clientSecret.length);
      console.log('[DEBUG FRONT] base64:', base64);
      console.log('[DEBUG FRONT] Authorization header:', `Basic ${base64}`);
      const res = await axios.post('/auth/oidc/token', { grant_type: 'client_credentials' }, {
        headers: { Authorization: `Basic ${base64}`, skipAuth: true }
      });
      setTicket(res.data.id_token);
      message.success('Билет получен');
      generateCurlCommands(selectedApp, res.data.id_token);
    } catch {
      // Ошибка обработана перехватчиком
    } finally {
      setLoading(false);
    }
  };

  const testMeta = async () => {
    if (!selectedApp || !ticket) return;
    setLoading(true);
    try {
      const res = await axios.get(`/applications/${selectedApp.name}/sys/esb/metadata/channels`, {
        headers: { Authorization: `Bearer ${ticket}` }
      });
      setMetaResult(JSON.stringify(res.data, null, 2));
    } catch (e: any) {
      setMetaResult(e?.response?.data ? JSON.stringify(e.response.data, null, 2) : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const testRuntime = async () => {
    if (!selectedApp || !ticket) return;
    setLoading(true);
    try {
      const res = await axios.get(`/applications/${selectedApp.name}/sys/esb/runtime/channels`, {
        headers: { Authorization: `Bearer ${ticket}` }
      });
      setRuntimeResult(JSON.stringify(res.data, null, 2));
    } catch (e: any) {
      setRuntimeResult(e?.response?.data ? JSON.stringify(e.response.data, null, 2) : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Проверка интеграции приложения и каналов" style={{ maxWidth: 700, margin: '32px auto' }}>
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
            <Text>Client Secret (OIDC): <code>{selectedApp.clientSecret}</code> <CopyOutlined onClick={() => navigator.clipboard.writeText(selectedApp.clientSecret)} /></Text><br/>
            <Text>ID Token (AMQP): <code>{selectedApp.id_token}</code> <CopyOutlined onClick={() => navigator.clipboard.writeText(selectedApp.id_token)} /></Text>
            <Button 
              size="small" 
              onClick={() => generateCurlCommands(selectedApp)} 
              style={{ marginTop: 8 }}
            >
              Сгенерировать команды curl
            </Button>
          </div>
        )}
        <Button type="primary" onClick={getTicket} disabled={!selectedApp} loading={loading}>Получить билет</Button>
        {ticket && (
          <Paragraph copyable>{ticket}</Paragraph>
        )}
        <Button onClick={testMeta} disabled={!ticket || !selectedApp} loading={loading}>Проверить метаданные каналов</Button>
        {metaResult && (
          <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 4 }}>{metaResult}</pre>
        )}
        <Button onClick={testRuntime} disabled={!ticket || !selectedApp} loading={loading}>Проверить runtime каналов</Button>
        {runtimeResult && (
          <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 4 }}>{runtimeResult}</pre>
        )}
        
        {/* Секция с командами curl */}
        {(curlCommands.auth || curlCommands.metadata || curlCommands.runtime) && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Команды curl для тестирования:</Text>
            <div style={{ marginTop: 8 }}>
              <Text strong>1. Аутентификация:</Text>
              <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 4, marginTop: 4 }}>
                {curlCommands.auth}
              </pre>
              <Button 
                size="small" 
                onClick={() => navigator.clipboard.writeText(curlCommands.auth)}
                style={{ marginBottom: 8 }}
              >
                Копировать
              </Button>
            </div>
            
            <div style={{ marginTop: 8 }}>
              <Text strong>2. Метаданные каналов:</Text>
              <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 4, marginTop: 4 }}>
                {curlCommands.metadata}
              </pre>
              <Button 
                size="small" 
                onClick={() => navigator.clipboard.writeText(curlCommands.metadata)}
                style={{ marginBottom: 8 }}
              >
                Копировать
              </Button>
            </div>
            
            <div style={{ marginTop: 8 }}>
              <Text strong>3. Runtime конфигурация:</Text>
              <pre style={{ background: '#f6f6f6', padding: 12, borderRadius: 4, marginTop: 4 }}>
                {curlCommands.runtime}
              </pre>
              <Button 
                size="small" 
                onClick={() => navigator.clipboard.writeText(curlCommands.runtime)}
                style={{ marginBottom: 8 }}
              >
                Копировать
              </Button>
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default IntegrationTestPage; 