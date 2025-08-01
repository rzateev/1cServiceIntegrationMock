import React, { useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Select } from 'antd';
import axios from '../api/axiosInstance';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Интерфейсы
interface Process { _id?: string; name: string; description?: string; applicationId?: string; }
interface Application { _id: string; name: string; }

// API-функции
const fetchProcesses = async (): Promise<Process[]> => {
  const { data } = await axios.get('/api/processes');
  return data.data;
};
const fetchApplications = async (): Promise<Application[]> => {
  const { data } = await axios.get('/api/applications');
  return data.data;
};
const saveProcess = (process: Process) => process._id ? axios.put(`/api/processes/${process._id}`, process) : axios.post('/api/processes', process);
const deleteProcess = (id: string) => axios.delete(`/api/processes/${id}`);

const ProcessTable: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Process | null>(null);
  const [appFilter, setAppFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  // Запросы
  const { data: processes, isLoading: isLoadingProcesses } = useQuery({ queryKey: ['processes'], queryFn: fetchProcesses });
  const { data: applications, isLoading: isLoadingApps } = useQuery({ queryKey: ['applications'], queryFn: fetchApplications });

  // Мутации
  const saveMutation = useMutation({ 
    mutationFn: saveProcess, 
    onSuccess: () => {
      message.success(editing ? 'Изменено' : 'Создано');
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setModalOpen(false);
    },
    // onError будет обработан централизованным перехватчиком
  });

  const deleteMutation = useMutation({ 
    mutationFn: deleteProcess,
    onSuccess: (res) => {
        message.success(res.data.message || 'Удалено');
        queryClient.invalidateQueries({ queryKey: ['processes'] });
        queryClient.invalidateQueries({ queryKey: ['channels'] }); // Каналы тоже могли удалиться
    }
  });

  const openModal = (record?: Process) => {
    setEditing(record || null);
    setModalOpen(true);
    if (record) form.setFieldsValue(record);
    else form.resetFields();
  };

  const handleOk = () => form.validateFields().then(values => saveMutation.mutate(editing ? { ...editing, ...values } : values));

  const handleDelete = (record: Process) => {
    Modal.confirm({
      title: `Удалить процесс "${record.name}"?`,
      content: 'Будет предпринята попытка каскадного удаления всех дочерних каналов.',
      onOk: () => record._id && deleteMutation.mutate(record._id),
    });
  };

  const filteredData = useMemo(() => appFilter ? processes?.filter(p => p.applicationId === appFilter) : processes, [appFilter, processes]);

  return (
    <>
      <Button type="primary" onClick={() => openModal()} style={{ marginBottom: 16 }}>Создать</Button>
      <Table
        rowKey="_id"
        loading={isLoadingProcesses || isLoadingApps || saveMutation.isPending || deleteMutation.isPending}
        dataSource={filteredData}
        columns={[
            { title: 'Название', dataIndex: 'name' },
            { title: 'Описание', dataIndex: 'description' },
            { title: 'Приложение', render: (_, record: Process) => applications?.find(a => a._id === record.applicationId)?.name || '-' },
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
      <Modal open={modalOpen} title={editing ? 'Изменить процесс' : 'Создать процесс'} onCancel={() => setModalOpen(false)} onOk={handleOk} confirmLoading={saveMutation.isPending} okText="Сохранить">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="description" label="Описание"><Input autoComplete="off" /></Form.Item>
          <Form.Item name="applicationId" label="Приложение" rules={[{ required: true }]}><Select>{applications?.map(app => <Select.Option key={app._id} value={app._id}>{app.name}</Select.Option>)}</Select></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ProcessTable;