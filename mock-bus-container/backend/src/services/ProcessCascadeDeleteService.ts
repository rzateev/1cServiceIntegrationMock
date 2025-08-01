import Process from '../models/Process';
import Channel from '../models/Channel';
import JolokiaQueueService from './JolokiaQueueService';

interface DeletionReport {
    success: boolean;
    message: string;
    undeletedChannels: { name: string; reason: string }[];
}

class ProcessCascadeDeleteService {
    public async delete(processId: string): Promise<DeletionReport> {
        const report: DeletionReport = {
            success: false,
            message: '',
            undeletedChannels: [],
        };

        const process = await Process.findById(processId);
        if (!process) {
            report.message = 'Процесс не найден.';
            return report;
        }

        const channels = await Channel.find({ processId: process._id });

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

        if (report.undeletedChannels.length > 0) {
            report.message = 'Не удалось удалить процесс, так как некоторые каналы содержат сообщения.';
            return report;
        }

        await Process.findByIdAndDelete(process._id);

        report.success = true;
        report.message = 'Процесс и все связанные каналы успешно удалены.';
        return report;
    }
}

export default new ProcessCascadeDeleteService();
