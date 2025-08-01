import { Schema, model, Document } from 'mongoose';

export interface IChannel extends Document {
  name: string;
  description: string;
  destination: string;
  processId: Schema.Types.ObjectId;
  direction: 'inbound' | 'outbound' | 'bidirectional';
}

const ChannelSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true, // Удаляет пробелы в начале и конце
    validate: {
      validator: function(v: string) {
        return v && v.trim().length > 0 && !/\s$/.test(v); // Проверяет, что нет пробелов в конце
      },
      message: 'Название канала не может содержать пробелы в конце'
    }
  },
  description: { type: String },
  destination: { 
    type: String, 
    required: true,
    trim: true,
    default: 'Office' // Значение по умолчанию
  },
  processId: { type: Schema.Types.ObjectId, ref: 'Process', required: true },
  direction: { type: String, enum: ['inbound', 'outbound', 'bidirectional'], required: true },
}, {
  timestamps: true,
  collection: 'channels',
  autoIndex: false // Отключаем автоматическое создание индексов
});

// Создаем составной уникальный индекс для name + processId + direction
ChannelSchema.index({ name: 1, processId: 1, direction: 1 }, { unique: true });

export default model<IChannel>('Channel', ChannelSchema);