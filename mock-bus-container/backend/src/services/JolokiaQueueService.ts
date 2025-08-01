import axios from 'axios';
import logger from './logger';

const JOLOKIA_URL = process.env.JOLOKIA_URL || 'http://artemis:8161/console/jolokia';

class JolokiaQueueService {
    private brokerName: string | null = null;

    private async getBrokerName(): Promise<string> {
        if (this.brokerName) {
            return this.brokerName;
        }

        try {
            const response = await axios.get(`${JOLOKIA_URL}/search/org.apache.activemq.artemis:broker=*`, {
                auth: {
                    username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                    password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                }
            });

            const brokers = response.data.value;
            if (brokers && brokers.length > 0) {
                // Извлекаем имя брокера из MBean
                const mbean = brokers[0];
                const match = mbean.match(/broker="([^"]+)"/);
                if (match) {
                    const brokerName = match[1];
                    this.brokerName = brokerName;
                    logger.info(`Artemis broker identified: ${brokerName}`);
                    return brokerName;
                }
            }
            
            throw new Error('Failed to find Artemis broker');
        } catch (error) {
            logger.error('Error identifying broker name:', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    private async getBrokerMBean(): Promise<string> {
        const brokerName = await this.getBrokerName();
        return `org.apache.activemq.artemis:broker="${brokerName}"`;
    }

    private async getQueueNames(): Promise<string[]> {
        try {
            const requestBody = {
                type: "read",
                mbean: await this.getBrokerMBean(),
                attribute: "QueueNames"
            };
            const response = await axios.post(JOLOKIA_URL, requestBody, {
                auth: {
                    username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                    password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                }
            });
            return response.data.value || [];
        } catch (error) {
            logger.error('Error getting queue list from Jolokia:', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    }

    private async getAddressNames(): Promise<string[]> {
        try {
            const requestBody = {
                type: "read",
                mbean: await this.getBrokerMBean(),
                attribute: "AddressNames"
            };
            const response = await axios.post(JOLOKIA_URL, requestBody, {
                auth: {
                    username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                    password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                }
            });
            return response.data.value || [];
        } catch (error) {
            logger.error('Error getting address list from Jolokia:', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    }

    private async addressExists(addressName: string): Promise<boolean> {
        const addressNames = await this.getAddressNames();
        return addressNames.includes(addressName);
    }

    public async queueExists(queueName: string): Promise<boolean> {
        const queueNames = await this.getQueueNames();
        return queueNames.includes(queueName);
    }

    public async createQueue(queueName: string): Promise<boolean> {
        try {
            // Проверяем, существует ли адрес
            if (!(await this.addressExists(queueName))) {
                // Создаем адрес с ANYCAST routing type
                const createAddressRequest = {
                    type: "exec",
                    mbean: await this.getBrokerMBean(),
                    operation: "createAddress(java.lang.String,java.lang.String)",
                    arguments: [queueName, "ANYCAST"] // address, routing types
                };
                
                await axios.post(JOLOKIA_URL, createAddressRequest, {
                    auth: {
                        username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                        password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                    }
                });
                logger.info(`Address ${queueName} created with ANYCAST routing type`);
            } else {
                logger.debug(`Address ${queueName} already exists`);
            }
            
            // Проверяем, существует ли очередь
            if (!(await this.queueExists(queueName))) {
                // Создаем очередь в этом адресе
                const createQueueRequest = {
                    type: "exec",
                    mbean: await this.getBrokerMBean(),
                    operation: "createQueue(java.lang.String,java.lang.String,java.lang.String,boolean)",
                    arguments: [queueName, queueName, null, true] // address, name, filter, durable
                };
                
                await axios.post(JOLOKIA_URL, createQueueRequest, {
                    auth: {
                        username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                        password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                    }
                });
                logger.info(`Queue ${queueName} created`);
            } else {
                logger.debug(`Queue ${queueName} already exists`);
            }
            
            return true;
        } catch (error) {
            logger.error(`Error creating queue ${queueName} via Jolokia:`, { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }

    public async getQueueMessageCount(queueName: string): Promise<number> {
        try {
            // 100% ПРАВИЛЬНЫЙ MBean, полученный через диагностику
            const mbean = `${await this.getBrokerMBean()},component=addresses,address="${queueName}",queue="${queueName}",routing-type="anycast",subcomponent=queues`;
            const requestBody = {
                type: "read",
                mbean: mbean,
                attribute: "MessageCount"
            };
            const response = await axios.post(JOLOKIA_URL, requestBody, {
                auth: {
                    username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                    password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                }
            });
            return Number(response.data.value) || 0;
        } catch (error) {
            logger.warn(`Failed to get message count for queue ${queueName}. Queue may have been deleted.`);
            return 0;
        }
    }

    public async deleteQueue(queueName: string): Promise<boolean> {
        try {
            const requestBody = {
                type: "exec",
                mbean: await this.getBrokerMBean(),
                operation: "destroyQueue(java.lang.String)",
                arguments: [queueName]
            };
            await axios.post(JOLOKIA_URL, requestBody, {
                auth: {
                    username: process.env.ARTEMIS_ADMIN_USER || 'admin',
                    password: process.env.ARTEMIS_ADMIN_PASSWORD || 'admin'
                }
            });
            logger.info(`Queue ${queueName} successfully deleted via Jolokia`);
            return true;
        } catch (error) {
            logger.error(`Error deleting queue ${queueName} via Jolokia:`, { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
}

export default new JolokiaQueueService();
