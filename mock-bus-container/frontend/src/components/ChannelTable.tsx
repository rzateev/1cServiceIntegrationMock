import React, { useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Select } from 'antd';
import axios from '../api/axiosInstance';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ... (интерфейсы Channel, Process, Application остаются теми же)
interface Channel { _id?: string; name: string; destination?: string; processId?: string; direction?: 'inbound' | 'outbound'; config?: any; }
interface Process { _id: string; name: string; applicationId?: string; }
interface Application { _id: string; name: string; }

// API-функции
const fetchChannels = async (): Promise<Channel[]> => {
  const { data } = await axios.get('/api/channels');
  return data.data;
};
const fetchProcesses = async (): Promise<Process[]> => {
  const { data } = await axios.get('/api/processes');
  return data.data;
};
const fetchApplications = async (): Promise<Application[]> => {
  const { data } = await axios.get('/api/applications');
  return data.data;
};
const saveChannel = (channel: Channel) => channel._id ? axios.put(`/api/channels/${channel._id}`, channel) : axios.post('/api/channels', channel);
const deleteChannel = (id: string) => axios.delete(`/api/channels/${id}`);

const ChannelTable: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [appFilter, setAppFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  // Запросы данных
  const { data: channels, isLoading: isLoadingChannels } = useQuery({ queryKey: ['channels'], queryFn: fetchChannels });
  const { data: processes, isLoading: isLoadingProcesses } = useQuery({ queryKey: ['processes'], queryFn: fetchProcesses });
  const { data: applications, isLoading: isLoadingApps } = useQuery({ queryKey: ['applications'], queryFn: fetchApplications });

  // Мутации
  const saveMutation = useMutation({ 
    mutationFn: saveChannel, 
    onSuccess: () => {
      message.success(editing ? 'Изменено' : 'Создано');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setModalOpen(false);
    },
    // onError будет обработан централизованным перехватчиком
  });

  const deleteMutation = useMutation({ 
    mutationFn: deleteChannel,
    onSuccess: (res) => {
        message.success(res.data.message || 'Удалено');
        queryClient.invalidateQueries({ queryKey: ['channels'] });
    }
  });

  const openModal = (record?: Channel) => {
    setEditing(record || null);
    setModalOpen(true);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
      // Устанавливаем значение по умолчанию для destination при создании
      form.setFieldsValue({ destination: 'Office' });
    }
  };

  const handleOk = () => form.validateFields().then(values => saveMutation.mutate(editing ? { ...editing, ...values } : values));

  const handleDelete = (record: Channel) => {
    Modal.confirm({
      title: `Удалить канал "${record.name}"?`,
      content: 'Операция будет прервана, если в очереди есть сообщения.',
      onOk: () => record._id && deleteMutation.mutate(record._id),
    });
  };

  const filteredData = useMemo(() => {
    if (!appFilter) return channels;
    return channels?.filter(ch => {
        const proc = processes?.find(p => p._id === ch.processId);
        return proc && proc.applicationId === appFilter;
      })
  }, [appFilter, channels, processes]);

  return (
    <>
      <Button type="primary" onClick={() => openModal()} style={{ marginBottom: 16 }}>Создать</Button>
      <Table
        rowKey="_id"
        loading={isLoadingChannels || isLoadingProcesses || isLoadingApps || saveMutation.isPending || deleteMutation.isPending}
        dataSource={filteredData}
        columns={[
            { title: 'Название', dataIndex: 'name' },
            { title: 'Назначение', dataIndex: 'destination' },
            { title: 'Направление', dataIndex: 'direction' },
            { title: 'Приложение', render: (_, record: Channel) => applications?.find(a => a._id === processes?.find(p => p._id === record.processId)?.applicationId)?.name || '-' },
            { title: 'Процесс', render: (_, record: Channel) => processes?.find(p => p._id === record.processId)?.name || record.processId },
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
        title={() => (
          <Space>
            <span>Фильтр по приложению:</span>
            <Select allowClear style={{ minWidth: 180 }} placeholder="Выберите приложение" value={appFilter} onChange={setAppFilter}>
              {applications?.map(app => <Select.Option key={app._id} value={app._id}>{app.name}</Select.Option>)}
            </Select>
          </Space>
        )}
      />
      <Modal open={modalOpen} title={editing ? 'Изменить канал' : 'Создать канал'} onCancel={() => setModalOpen(false)} onOk={handleOk} confirmLoading={saveMutation.isPending} okText="Сохранить">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="destination" label="Назначение" rules={[{ required: true }]}><Input autoComplete="off" placeholder="Office" /></Form.Item>
          <Form.Item name="direction" label="Направление" rules={[{ required: true }]}><Select><Select.Option value="outbound">outbound</Select.Option><Select.Option value="inbound">inbound</Select.Option></Select></Form.Item>
          <Form.Item name="processId" label="Процесс" rules={[{ required: true }]}><Select>{processes?.map(proc => <Select.Option key={proc._id} value={proc._id}>{proc.name}</Select.Option>)}</Select></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ChannelTable;