import React, { useState } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import axios from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onFinish = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/admin/login', { username, password });
      login(res.data.token);
      message.success('Успешный вход');
      navigate('/applications');
    } catch {
      message.error('Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Card title="Вход в админку" style={{ width: 350 }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}> 
            <Input autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /> 
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}> 
            <Input.Password autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} /> 
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block disabled={!username || !password}>Войти</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage; 