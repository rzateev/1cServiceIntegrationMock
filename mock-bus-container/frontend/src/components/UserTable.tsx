import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Switch, Tag } from 'antd';
import axios from '../api/axiosInstance';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Интерфейсы
interface User {
  _id?: string;
  username: string;
  password?: string; // Работаем с чистым паролем
  roles?: string[];
  isActive?: boolean;
}

// API-функции
const fetchUsers = async (): Promise<User[]> => {
  const { data } = await axios.get('/api/users');
  return data.data;
};
const saveUser = (user: User) => user._id ? axios.put(`/api/users/${user._id}`, user) : axios.post('/api/users', user);
const deleteUser = (id: string) => axios.delete(`/api/users/${id}`);

const UserTable: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();

  // Запросы
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  // Мутации
  const saveMutation = useMutation({ 
    mutationFn: saveUser, 
    onSuccess: () => {
      message.success(editing ? 'Пользователь изменен' : 'Пользователь создан');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
    }
  });

  const deleteMutation = useMutation({ 
    mutationFn: deleteUser,
    onSuccess: () => {
        message.success('Пользователь удален');
        queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const openModal = (record?: User) => {
    setEditing(record || null);
    setModalOpen(true);
    if (record) {
      form.setFieldsValue({ ...record, roles: record.roles?.join(', ') });
    } else {
      form.resetFields();
    }
  };

  const handleOk = () => {
    form.validateFields().then(values => {
        // Преобразуем строку ролей обратно в массив
        const roles = values.roles ? values.roles.split(',').map((r: string) => r.trim()) : [];
        const finalValues = { ...values, roles };
        saveMutation.mutate(editing ? { ...editing, ...finalValues } : finalValues);
    });
  };

  const handleDelete = (record: User) => {
    Modal.confirm({
      title: `Удалить пользователя "${record.username}"?`,
      onOk: () => record._id && deleteMutation.mutate(record._id),
    });
  };

  return (
    <>
      <Button type="primary" onClick={() => openModal()} style={{ marginBottom: 16 }}>Создать</Button>
      <Table
        rowKey="_id"
        loading={isLoading || saveMutation.isPending || deleteMutation.isPending}
        dataSource={data}
        columns={[
          { title: 'Логин', dataIndex: 'username' },
          { title: 'Роли', dataIndex: 'roles', render: (roles: string[]) => roles?.map(role => <Tag key={role}>{role}</Tag>) },
          { title: 'Активен', dataIndex: 'isActive', render: (v: boolean) => <Switch checked={v} disabled /> },
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
        title={editing ? 'Изменить пользователя' : 'Создать пользователя'}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        confirmLoading={saveMutation.isPending}
        okText="Сохранить"
      >
        <Form form={form} layout="vertical" initialValues={{ isActive: true }}>
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: !editing, message: 'Пароль обязателен при создании' }]}>
            <Input.Password autoComplete="off" placeholder={editing ? 'Оставьте пустым, чтобы не менять' : ''} />
          </Form.Item>
          <Form.Item name="roles" label="Роли (через запятую)"><Input autoComplete="off" /></Form.Item>
          <Form.Item name="isActive" label="Активен" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserTable;