import Application, { IApplication } from '../models/Application';
import Process from '../models/Process';
import Channel from '../models/Channel';
import ArtemisUserService from './ArtemisUserService';
import JolokiaQueueService from './JolokiaQueueService';
import logger from './logger';

class ArtemisConfiguratorService {
    constructor() {}

    public async configure(): Promise<void> {
        logger.info('Starting Artemis configuration...');
        
        const applications: IApplication[] = await Application.find();
        logger.info(`Found ${applications.length} applications for configuration`);

        for (const app of applications) {
            logger.info(`Configuring application: ${app.name}`);

            const artemisUser = await ArtemisUserService.findUser(app.id_token);
            if (!artemisUser) {
                logger.info(`User ${app.id_token} not found in Artemis. Creating...`);
                await ArtemisUserService.createUser(app.id_token, app.id_token);
            } else {
                logger.debug(`User ${app.id_token} already exists in Artemis`);
            }

            // Найти все процессы для данного приложения
            const processes = await Process.find({ applicationId: app._id });
            const processIds = processes.map(p => p._id);

            // Найти все каналы для этих процессов
            const channels = await Channel.find({ processId: { $in: processIds } });

            logger.info(`Found ${channels.length} channels for application ${app.name}`);

            for (const channel of channels) {
                const queueName = channel.destination || channel.name; // Используем destination, если есть, иначе name
                const exists = await JolokiaQueueService.queueExists(queueName);
                if (!exists) {
                    logger.info(`Queue ${queueName} not found. Creating...`);
                    await JolokiaQueueService.createQueue(queueName);
                } else {
                    logger.debug(`Queue ${queueName} already exists`);
                }
            }
        }
    }
}

export default new ArtemisConfiguratorService();
