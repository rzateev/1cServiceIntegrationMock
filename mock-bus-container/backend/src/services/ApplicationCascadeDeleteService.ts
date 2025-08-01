import Application from '../models/Application';
import Process from '../models/Process';
import Channel from '../models/Channel';
import ArtemisUserService from './ArtemisUserService';
import JolokiaQueueService from './JolokiaQueueService';

interface DeletionReport {
    success: boolean;
    message: string;
    undeletedChannels: { name: string; reason: string }[];
}

class ApplicationCascadeDeleteService {
    public async delete(applicationId: string): Promise<DeletionReport> {
        const report: DeletionReport = {
            success: false,
            message: '',
            undeletedChannels: [],
        };

        const app = await Application.findById(applicationId);
        if (!app) {
            report.message = 'Приложение не найдено.';
            return report;
        }

        const processes = await Process.find({ applicationId: app._id });
        const processIds = processes.map(p => p._id);
        const channels = await Channel.find({ processId: { $in: processIds } });

        // 1. Попытка удалить каналы
        for (const channel of channels) {
            const messageCount = await JolokiaQueueService.getQueueMessageCount(channel.name);
            if (messageCount > 0) {
                report.undeletedChannels.push({ 
                    name: channel.name, 
                    reason: `В очереди ${messageCount} сообщений.` 
                });
            } else {
                await JolokiaQueueService.deleteQueue(channel.name);
                await Channel.findByIdAndDelete(channel._id);
            }
        }

        // Если остались неудаленные каналы, прерываем операцию
        if (report.undeletedChannels.length > 0) {
            report.message = 'Не удалось удалить приложение, так как некоторые каналы содержат сообщения.';
            return report;
        }

        // 2. Удаление пустых процессов
        await Process.deleteMany({ _id: { $in: processIds } });

        // 3. Удаление пользователя Artemis по id_token
        if (app.id_token) {
            await ArtemisUserService.deleteUser(app.id_token);
        }

        // 4. Удаление приложения
        await Application.findByIdAndDelete(app._id);

        report.success = true;
        report.message = 'Приложение и все связанные сущности успешно удалены.';
        return report;
    }
}

export default new ApplicationCascadeDeleteService();
