import { cleanEnv, str, port } from 'envalid';

function validateEnv(): void {
  cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
    MOCK_API_PORT: port(),
    JWT_SECRET: str(),
    MONGO_HOST: str(),
    MONGO_PORT: port(),
    MONGO_DB: str(),
    MONGO_USER: str(),
    MONGO_PASS: str(),
    ARTEMIS_ADMIN_USER: str(),
    ARTEMIS_ADMIN_PASSWORD: str(),
    ARTEMIS_API_URL: str(),
    JOLOKIA_URL: str(),
    BROKER_NAME: str(),
  });
}

export default validateEnv;
