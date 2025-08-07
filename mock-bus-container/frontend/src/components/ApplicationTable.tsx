import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Space } from 'antd';
import axios from '../api/axiosInstance';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EyeOutlined, EyeInvisibleOutlined, CopyOutlined } from '@ant-design/icons';

interface Application {
  _id?: string;
  name: string;
  description?: string;
  clientSecret?: string;
  id_token?: string;
}

// API-функции вынесены отдельно
const fetchApplications = async (): Promise<Application[]> => {
  const { data } = await axios.get('/api/applications');
  return data.data;
};

const createApplication = async (application: Application): Promise<any> => {
  const { data } = await axios.post('/api/applications', application);
  return data.data;
};

const updateApplication = async (application: Application): Promise<any> => {
  const { data } = await axios.put(`/api/applications/${application._id}`, application);
  return data.data;
};

const deleteApplication = async (id: string): Promise<any> => {
  const { data } = await axios.delete(`/api/applications/${id}`);
  return data;
};

const ApplicationTable: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [form] = Form.useForm();
  const [showSecret, setShowSecret] = useState<{[id: string]: boolean}>({});
  const [showIdToken, setShowIdToken] = useState<{[id: string]: boolean}>({});

  const createE2eTestData = async () => {
    const amqp_test = {
      applicationName: 'testAppE2e',
      processName: 'e1c::ТестовыйПроект::Основной::OfficeToShop',
      outChannelOfficeToOffice: 'e2eOutOfficeToOffice',
      outChannelOfficeToShop: 'e2eOutOfficeToShop',
      inChannelOfficeToOffice: 'e2eInOfficeToOffice',
    };

    message.info('Запуск создания тестовых данных E2E...');

    try {
      // 1. Очистка (игнорируем ошибки 404, если сущностей нет, с помощью validateStatus)
      message.loading({ content: 'Шаг 1/5: Очистка старых данных...', key: 'e2e' });
      const silentDelete = { validateStatus: (status: number) => (status >= 200 && status < 300) || status === 404 };
      await axios.delete(`/api/applications/by-name/${amqp_test.applicationName}`, silentDelete);
      await axios.delete(`/api/processes/by-name/${amqp_test.processName}`, silentDelete);
      await axios.delete(`/api/channels/by-name/${amqp_test.outChannelOfficeToOffice}`, silentDelete);
      await axios.delete(`/api/channels/by-name/${amqp_test.outChannelOfficeToShop}`, silentDelete);
      await axios.delete(`/api/channels/by-name/${amqp_test.inChannelOfficeToOffice}`, silentDelete);

      // 2. Создание приложения
      message.loading({ content: 'Шаг 2/5: Создание приложения...', key: 'e2e' });
      const appResponse = await axios.post('/api/applications', {
        name: amqp_test.applicationName,
        description: 'Тестовое приложение для E2E-теста',
        clientSecret: 'e2e-secret-123',
      });
      const application = appResponse.data.data;

      // 3. Создание процесса
      message.loading({ content: 'Шаг 3/5: Создание процесса...', key: 'e2e' });
      const processResponse = await axios.post('/api/processes', {
        name: amqp_test.processName,
        applicationId: application._id,
      });
      const process = processResponse.data.data;

      // 4. Создание каналов для OfficeToOffice (автоматическое потребление)
      message.loading({ content: 'Шаг 4/5: Создание каналов OfficeToOffice...', key: 'e2e' });
      await axios.post('/api/channels', {
        name: amqp_test.outChannelOfficeToOffice,
        processId: process._id,
        direction: 'outbound',
        destination: 'OfficeToOffice',
      });
      await axios.post('/api/channels', {
        name: amqp_test.inChannelOfficeToOffice,
        processId: process._id,
        direction: 'inbound',
        destination: 'OfficeToOffice',
      });

      // 5. Создание канала для OfficeToShop (без автоматического потребления)
      message.loading({ content: 'Шаг 5/5: Создание канала OfficeToShop...', key: 'e2e' });
      await axios.post('/api/channels', {
        name: amqp_test.outChannelOfficeToShop,
        processId: process._id,
        direction: 'outbound',
        destination: 'OfficeToShop',
      });

      message.success({ content: 'Тестовые данные E2E успешно созданы!', key: 'e2e', duration: 5 });
      queryClient.invalidateQueries({ queryKey: ['applications'] }); // Обновить таблицу

    } catch (error: any) {
      console.error('Ошибка при создании тестовых данных E2E:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Неизвестная ошибка';
      message.error({ content: `Ошибка: ${errorMsg}`, key: 'e2e', duration: 5 });
    }
  };

  // useQuery для получения данных
  const { data, isLoading } = useQuery({ 
    queryKey: ['applications'], 
    queryFn: fetchApplications 
  });

  // useMutation для создания/обновления
  const mutation = useMutation({
    mutationFn: (application: Application) => 
      editing ? updateApplication(application) : createApplication(application),
    onSuccess: () => {
      message.success(editing ? 'Изменено' : 'Создано');
      queryClient.invalidateQueries({ queryKey: ['applications'] }); // Автоматическое обновление данных
      setModalOpen(false);
    },
    // onError будет обработан централизованным перехватчиком
  });

  // useMutation для удаления
  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: (report) => {
      if (report.success) {
        message.success(report.message);
      } else {
        message.error(report.message, 10);
      }
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const openModal = (record?: Application) => {
    setEditing(record || null);
    setModalOpen(true);
    if (record) form.setFieldsValue(record);
    else form.resetFields();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      mutation.mutate(editing ? { ...editing, ...values } : values);
    } catch (e) {
      // Ошибки валидации формы
    }
  };

  const handleDelete = (record: Application) => {
    Modal.confirm({
      title: `Удалить приложение "${record.name}"?`,
      content: 'Будет предпринята попытка каскадного удаления...',
      onOk: () => {
        if (record._id) deleteMutation.mutate(record._id);
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Скопировано');
  };

  const getIntegrationUrl = (appName: string) => {
    const backendPort = 9090;
    const url = new URL(window.location.origin);
    url.port = backendPort.toString();
    return `${url.origin}/applications/${appName}`;
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>Создать</Button>
        <Button onClick={createE2eTestData}>Создать тестовое приложение</Button>
      </Space>
      <Table
        rowKey="_id"
        loading={isLoading || mutation.isPending || deleteMutation.isPending}
        dataSource={data}
        columns={[
            { title: 'Название', dataIndex: 'name' },
            { title: 'Описание', dataIndex: 'description' },
            { title: 'Client Secret', dataIndex: 'clientSecret', render: (v: string, record: Application) => v && (
              <span>
                {showSecret[record._id!] ? v : '••••••••'}
                <Button type="link" size="small" icon={showSecret[record._id!] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowSecret(s => ({...s, [record._id!]: !s[record._id!]}))} />
                <CopyOutlined onClick={() => copyToClipboard(v)} style={{cursor:'pointer'}} />
              </span>
            ) },
            { title: 'ID Token (AMQP)', dataIndex: 'id_token', render: (v: string, record: Application) => v && (
              <span>
                {showIdToken[record._id!] ? v : '••••••••'}
                <Button type="link" size="small" icon={showIdToken[record._id!] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowIdToken(s => ({...s, [record._id!]: !s[record._id!]}))} />
                <CopyOutlined onClick={() => copyToClipboard(v)} style={{cursor:'pointer'}} />
              </span>
            ) },
            {
              title: 'Действия',
              render: (_, record) => (
                <Space>
                  <Button onClick={() => openModal(record)} size="small">Изменить</Button>
                  <Button danger onClick={() => handleDelete(record)} size="small">Удалить</Button>
                </Space>
              ),
            },
          ]}
      />
      <Modal
        open={modalOpen}
        title={editing ? 'Изменить приложение' : 'Создать приложение'}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        confirmLoading={mutation.isPending}
        okText="Сохранить"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название (идентификатор ключа)" rules={[{ required: true, message: 'Введите название' }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="description" label="Описание"><Input autoComplete="off" /></Form.Item>
          {editing && (
            <>
              <Form.Item label="Client Secret (OIDC)">
                <Input value={showSecret[editing._id!] ? editing.clientSecret : '••••••••'} readOnly addonAfter={
                  <Space.Compact>
                    <Button type="link" icon={showSecret[editing._id!] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowSecret(s => ({...s, [editing._id!]: !s[editing._id!]}))} />
                    <CopyOutlined onClick={() => copyToClipboard(editing.clientSecret!)} />
                  </Space.Compact>
                } />
              </Form.Item>
              <Form.Item label="ID Token (AMQP)">
                <Input value={showIdToken[editing._id!] ? editing.id_token : '••••••••'} readOnly addonAfter={
                  <Space.Compact>
                    <Button type="link" icon={showIdToken[editing._id!] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowIdToken(s => ({...s, [editing._id!]: !s[editing._id!]}))} />
                    <CopyOutlined onClick={() => copyToClipboard(editing.id_token!)} />
                  </Space.Compact>
                } />
              </Form.Item>
              <Form.Item label="URL для 1С">
                <Input value={getIntegrationUrl(editing.name)} readOnly addonAfter={<CopyOutlined onClick={() => copyToClipboard(getIntegrationUrl(editing.name))} />} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  );
};

export default ApplicationTable;