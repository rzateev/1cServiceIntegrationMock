# Диаграмма потоков сообщений при использовании сервисов интеграции 1С и Mock-сервиса интеграции
> [English Version](MessageFlowDiagram_EN.md)

## Описание процесса

Эта диаграмма показывает процесс обмена сообщениями между приложением на платформе 1С:Предприятие и внешним mock-сервисом интеграции, предоставляемым этой платформой. Она иллюстрирует, как клиент (1С) проходит аутентификацию, получает конфигурацию и обменивается сообщениями с сервисом.


## Диаграмма последовательности

Процесс обмена сообщениями состоит из следующих основных шагов:

1.  **Аутентификация**: Техническое фоновое задание 1С:Предприятие (Отправитель или Получатель) аутентифицируется в Mock API, используя свой `client_id` (= имя приложения) и `client_secret`  для получения `id_token`.
2.  **Получение конфигурации**: Клиент использует `id_token` для запроса конфигурации своих каналов, которая включает destination (имя очереди в брокере сообщений) и порт брокера сообщений.
3.  **Отправка сообщения**: Отправитель подключается к брокеру ActiveMQ Artemis, создает AMQP Session и Sender, используя `id_token` в качестве учетных данных. Перед отправкой проверяется дата устаревания сообщений в `IntegChannelOutQueue` - просроченные сообщения удаляются. Отправленные сообщения также удаляются из `IntegChannelOutQueue` (паттерн OutboxTable). Соединение удерживается в течение 2 минут или до следующего вызова `СервисыИнтеграции.ВыполнитьОбработку()`.
4.  **Получение сообщения**: Получатель подключается к брокеру, создает AMQP Session и Receiver, подписывается на свою назначенную очередь и получает сообщение по протоколу AMQP 1.0. После подтверждения получения (Disposition: Accepted) сообщение автоматически удаляется из очереди брокера. Соединение удерживается в течение 2 минут или до следующего вызова `СервисыИнтеграции.ВыполнитьОбработку()`.
5.  **Обработка**: Получатель обрабатывает сообщение в соответствии со своей внутренней бизнес-логикой.
6.  **Очистка**: После успешной обработки сообщение помечается как обработанное в `IntegChannelInQueue` (Processed = 0x01), поля MessageHeader и MessageBody очищаются (NULL), но запись в очереди НЕ удаляется (паттерн InboxTable).

```mermaid
sequenceDiagram
    participant Sender as Отправитель (1С:Предприятие)
    participant API as Mock API (9090)
    participant MongoDB as MongoDB
    participant Artemis as ActiveMQ Artemis (6698)
    participant Receiver as Получатель (1С:Предприятие)

    Note over Sender,Receiver: 1. Аутентификация и получение токена
    Sender->>API: POST /auth/oidc/token<br/>Basic Auth (client_id:client_secret)
    API->>MongoDB: Найти приложение по client_id
    MongoDB-->>API: Данные приложения (id_token)
    API-->>Sender: {id_token, access_token}

    Note over Sender,Receiver: 2. Получение конфигурации каналов
    Sender->>API: GET /applications/{app}/sys/esb/runtime/channels<br/>Bearer {id_token}
    API->>MongoDB: Найти каналы приложения
    MongoDB-->>API: Конфигурация каналов <br/> (процесс, канал,<br/> destination = Очередь)
    API-->>Sender: {items: [{process, channel, destination}], port: 6698}

    Note over Sender,Receiver: 3. Отправка сообщения
    Sender->>Sender: Определить очередь и порт для отправки <br/> на основе процесса и канала <br/> хост Artemis = хост из URL приложения
    Sender->>Artemis: AMQP Connect (username=id_token, password=id_token)
    Sender->>Artemis: Создать AMQP Session
    Sender->>Artemis: Создать AMQP Sender (Producer) для destination
    Sender->>Sender: Проверить дату устаревания сообщений<br/>в IntegChannelOutQueue
    Sender->>Sender: Удалить просроченные сообщения<br/>из IntegChannelOutQueue
    Sender->>Sender: Выборка сообщения из <br/> IntegChannelOutQueue (статус 0=PENDING)
    Sender->>Artemis: Отправить сообщение в очередь destination<br/>+ Свойства 1С (integ_*, JMS_AMQP_*, и т.д.)
    Artemis-->>Sender: Подтверждение доставки (Disposition)
    Sender->>Sender: Удалить отправленное сообщение<br/>из IntegChannelOutQueue
    Note over Sender,Artemis: Соединение удерживается 2 минуты<br/>или до следующего вызова ВыполнитьОбработку()

    Note over Sender,Receiver: 4. Получение сообщения получателем
    Receiver->>API: POST /auth/oidc/token<br/>Basic Auth (client_id:client_secret)
    API->>MongoDB: Найти приложение получателя
    MongoDB-->>API: Данные приложения получателя
    API-->>Receiver: {id_token, access_token}

    Receiver->>API: GET /applications/{app}/sys/esb/runtime/channels<br/>Bearer {id_token}
    API->>MongoDB: Найти каналы приложения получателя
    MongoDB-->>API: Конфигурация каналов
    API-->>Receiver: {items: [{process, channel, destination}], port: 6698}

    Receiver->>Artemis: AMQP Connect (username=id_token, password=id_token)
    Receiver->>Artemis: Создать AMQP Session
    Receiver->>Artemis: Создать AMQP Receiver (Consumer) для destination
    Artemis->>Receiver: Доставить сообщение (Transfer)
    Receiver->>Receiver: Сохранение сообщения <br/> в локальную очередь <br/> IntegChannelInQueue
    Receiver-->>Artemis: Подтверждение получения (Disposition: Accepted)
    Artemis->>Artemis: Удалить доставленное сообщение из очереди
    Note over Receiver,Artemis: Соединение удерживается 2 минуты<br/>или до следующего вызова ВыполнитьОбработку()

    Note over Sender,Receiver: 5. Обработка сообщения
    Receiver->>Receiver: Обработать сообщение в конфигурации 1С
    Receiver->>Receiver: Подтверждение обработки сообщения <br/> в IntegChannelInQueue
    

    Note over Sender,Receiver: 6. Очистка (InboxTable паттерн)
    Receiver->>Receiver: Пометить сообщение как обработанное <br/>в IntegChannelInQueue (Processed = 0x01)
    Receiver->>Receiver: Очистить поля MessageHeader = NULL,<br/>MessageBody = NULL (данные удаляются)
    Note over Receiver,Receiver: Сообщение НЕ удаляется из очереди,<br/>только очищаются поля и меняется статус

```

