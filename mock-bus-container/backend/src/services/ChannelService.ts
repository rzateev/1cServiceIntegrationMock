import Channel, { IChannel } from '../models/Channel';

class ChannelService {
    public async getAll(): Promise<IChannel[]> {
        return Channel.find();
    }

    public async getByProcessId(processId: string): Promise<IChannel[]> {
        return Channel.find({ processId });
    }

    public async create(data: Partial<IChannel>): Promise<IChannel> {
        const newChannel = new Channel(data);
        await newChannel.save();
        return newChannel;
    }

    // ... другие методы CRUD
}

export default new ChannelService();
