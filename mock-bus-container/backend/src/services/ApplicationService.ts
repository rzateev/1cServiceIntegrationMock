import Application, { IApplication } from '../models/Application';

class ApplicationService {
    public async getAll(): Promise<IApplication[]> {
        return Application.find();
    }

    public async getById(id: string): Promise<IApplication | null> {
        return Application.findById(id);
    }

    public async create(data: Partial<IApplication>): Promise<IApplication> {
        const newApp = new Application(data);
        await newApp.save();
        return newApp;
    }

    // ... другие методы CRUD
}

export default new ApplicationService();
