import mongoose from 'mongoose';
import logger from './services/logger';
import dotenv from 'dotenv';

dotenv.config();

const {
  MONGO_HOST = 'localhost',
  MONGO_PORT = '27017',
  MONGO_DB = 'mockbus',
  MONGO_USER = '',
  MONGO_PASS = ''
} = process.env;

let mongoUri: string;
if (MONGO_USER && MONGO_PASS) {
  mongoUri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
} else {
  mongoUri = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}`;
}

const connectDB = async () => {
  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected');
  } catch (err: any) {
    logger.error('MongoDB connection error:', { error: err.message });
    process.exit(1);
  }
};

export default connectDB;