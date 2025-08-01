import axios from 'axios';
import logger from './logger';

const ARTEMIS_API_URL = process.env.ARTEMIS_API_URL || 'http://artemis:8162';
const ADMIN_USER = process.env.ARTEMIS_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ARTEMIS_ADMIN_PASS || 'admin';

class ArtemisUserService {
    public async findUser(username: string): Promise<any | null> {
        try {
            const response = await axios.get(`${ARTEMIS_API_URL}/users`, {
                headers: {
                    'X-Artemis-Admin-User': ADMIN_USER,
                    'X-Artemis-Admin-Pass': ADMIN_PASS
                }
            });
            const users = response.data.users || [];
            return users.find((u: any) => u.username === username) || null;
        } catch (error) {
            console.error(`Ошибка при поиске пользователя ${username} в Artemis:`, error);
            return null;
        }
    }

    public async createUser(username: string, password: string, role: string = 'amq'): Promise<boolean> {
        try {
            await axios.post(`${ARTEMIS_API_URL}/users`, { username, password, role }, {
                headers: {
                    'X-Artemis-Admin-User': ADMIN_USER,
                    'X-Artemis-Admin-Pass': ADMIN_PASS
                }
            });
            logger.info(`User ${username} successfully created in Artemis`);
            return true;
        } catch (error) {
            console.error(`Ошибка при создании пользователя ${username} в Artemis:`, error);
            return false;
        }
    }

    public async deleteUser(username: string): Promise<boolean> {
        try {
            await axios.delete(`${ARTEMIS_API_URL}/users/${username}`, {
                headers: {
                    'X-Artemis-Admin-User': ADMIN_USER,
                    'X-Artemis-Admin-Pass': ADMIN_PASS
                }
            });
            logger.info(`User ${username} successfully removed from Artemis`);
            return true;
        } catch (error) {
            console.error(`Ошибка при удалении пользователя ${username} из Artemis:`, error);
            return false;
        }
    }
}

export default new ArtemisUserService();