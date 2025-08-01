import { Schema, model, Document } from 'mongoose';

export interface IApplication extends Document {
  name: string;
  description: string;
  clientSecret: string;
  id_token: string;
}

const ApplicationSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  clientSecret: { type: String, required: true }, // OIDC client_secret
  id_token: { type: String, required: true, unique: true }, // AMQP credentials (username = password = id_token)
}, {
  timestamps: true,
  collection: 'applications'
});

export default model<IApplication>('Application', ApplicationSchema); 