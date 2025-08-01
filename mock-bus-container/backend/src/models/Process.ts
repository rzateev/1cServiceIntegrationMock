import { Schema, model, Document } from 'mongoose';

export interface IProcess extends Document {
  name: string;
  description: string;
  applicationId: Schema.Types.ObjectId;
}

const ProcessSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
}, {
  timestamps: true,
  collection: 'processes'
});

export default model<IProcess>('Process', ProcessSchema);