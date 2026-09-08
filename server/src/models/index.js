import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const base = { timestamps: true };
export const ROLES = ['principal_admin', 'level_admin', 'local_doctor', 'contract_doctor', 'student'];

const userSchema = new Schema({
  firstName: { type: String, required: true, trim: true }, lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ROLES, required: true },
  level: { type: Schema.Types.ObjectId, ref: 'Level' }, certified: { type: Boolean, default: false }, active: { type: Boolean, default: true }
}, base);
userSchema.index({ role: 1, level: 1 });
export const User = model('User', userSchema);

export const Level = model('Level', new Schema({ name: { type: String, required: true, unique: true, trim: true }, code: { type: String, required: true, unique: true, uppercase: true }, order: { type: Number, default: 0, index: true }, manager: { type: Schema.Types.ObjectId, ref: 'User' } }, base));
export const Room = model('Room', new Schema({ name: { type: String, required: true, unique: true, trim: true }, code: { type: String, required: true, unique: true, uppercase: true, trim: true }, capacity: Number, location: String }, base));
const subjectAssignmentSchema = new Schema({ level: { type: Schema.Types.ObjectId, ref: 'Level', required: true }, doctors: [{ type: Schema.Types.ObjectId, ref: 'User' }] }, { _id: false });
export const Subject = model('Subject', new Schema({ name: { type: String, required: true, trim: true, unique: true }, code: { type: String, required: true, trim: true, uppercase: true, unique: true }, doctors: [{ type: Schema.Types.ObjectId, ref: 'User' }], assignments: [subjectAssignmentSchema] }, base));

const sessionSchema = new Schema({
  subject: { type: Schema.Types.ObjectId, ref: 'Subject' }, subjectName: { type: String, required: true, trim: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true }, room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  level: { type: Schema.Types.ObjectId, ref: 'Level', required: true }, startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true },
  type: { type: String, enum: ['course', 'tutorial', 'lab', 'exam', 'quiz', 'other'], default: 'course' }, schedule: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  recurrenceGroup: String
}, base);
sessionSchema.index({ room: 1, startsAt: 1, endsAt: 1 }); sessionSchema.index({ level: 1, startsAt: 1 }); sessionSchema.index({ doctor: 1, startsAt: 1 });
export const Session = model('Session', sessionSchema);

export const Schedule = model('Schedule', new Schema({ level: { type: Schema.Types.ObjectId, ref: 'Level', required: true }, status: { type: String, enum: ['draft', 'submitted', 'returned', 'validated', 'published'], default: 'draft' }, publicationIntent: { type: String, enum: ['draft', 'publish'], default: 'draft' }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, externalCheck: { checked: { type: Boolean, default: false }, notes: String, checkedBy: { type: Schema.Types.ObjectId, ref: 'User' }, checkedAt: Date }, submittedAt: Date, validatedAt: Date, validatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, publishedAt: Date }, base));

const mediaSchema = new Schema({ url: { type: String, required: true }, key: String, name: String, mime: String }, { _id: false });
export const Discussion = model('Discussion', new Schema({ subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true }, level: { type: Schema.Types.ObjectId, ref: 'Level', required: true }, author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true, maxlength: 5000 }, imageUrl: String, image: { name: String, mime: String, data: { type: Buffer, select: false } }, images: { type: [mediaSchema], default: [] }, notifiedDoctors: [{ type: Schema.Types.ObjectId, ref: 'User' }] }, base));
Discussion.schema.index({ level: 1, subject: 1, createdAt: -1 });
Discussion.schema.index({ text: 'text' });
export const Comment = model('Comment', new Schema({ discussion: { type: Schema.Types.ObjectId, ref: 'Discussion', required: true }, author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true, maxlength: 3000 }, parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null }, certified: { type: Boolean, default: false }, accepted: { type: Boolean, default: false }, acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' }, acceptedAt: Date, images: { type: [mediaSchema], default: [] } }, base));
const smsDeliverySchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User' }, recipientType: { type: String, enum: ['student', 'doctor', 'user'], required: true },
  name: { type: String, required: true }, phoneNumber: { type: String, required: true }, level: { type: Schema.Types.ObjectId, ref: 'Level' }, levelName: String,
  status: { type: String, enum: ['pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'], default: 'pending' },
  twilioMessageSid: String, errorCode: String, error: String, sentAt: Date, deliveredAt: Date
}, { _id: true, timestamps: true });

export const Communication = model('Communication', new Schema({
  channel: { type: String, enum: ['sms', 'email'], required: true }, sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }], recipientType: String, level: { type: Schema.Types.ObjectId, ref: 'Level' },
  audience: String, subject: String, title: String, body: { type: String, required: true },
  totalRecipients: { type: Number, default: 0 }, successfulCount: { type: Number, default: 0 }, deliveredCount: { type: Number, default: 0 }, failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['processing', 'sent', 'partial', 'failed'], required: true }, error: String, deliveries: [smsDeliverySchema]
}, base));
export const ContractorDispatch = model('ContractorDispatch', new Schema({ recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true }, email: { type: String, required: true }, subject: { type: String, required: true }, file: { name: String, mime: String, data: { type: Buffer, select: false } }, sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, sentAt: { type: Date, default: Date.now } }, base));
export const Notification = model('Notification', new Schema({ recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true }, type: String, message: String, readAt: Date, link: String }, base));
