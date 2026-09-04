import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const base = { timestamps: true };
export const ROLES = ['principal_admin', 'level_admin', 'local_doctor', 'contract_doctor', 'student'];

const userSchema = new Schema({
  firstName: { type: String, required: true, trim: true }, lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ROLES, required: true },
  level: { type: Schema.Types.ObjectId, ref: 'Level' }, active: { type: Boolean, default: true }
}, base);
userSchema.index({ role: 1, level: 1 });
export const User = model('User', userSchema);

export const Level = model('Level', new Schema({ name: { type: String, required: true, unique: true, trim: true }, code: { type: String, required: true, unique: true, uppercase: true }, manager: { type: Schema.Types.ObjectId, ref: 'User' } }, base));
export const Room = model('Room', new Schema({ name: { type: String, required: true, unique: true, trim: true }, code: { type: String, required: true, unique: true, uppercase: true, trim: true }, capacity: Number, location: String }, base));
export const Subject = model('Subject', new Schema({ name: { type: String, required: true, trim: true, unique: true }, code: { type: String, required: true, trim: true, uppercase: true, unique: true }, doctors: [{ type: Schema.Types.ObjectId, ref: 'User' }] }, base));

const sessionSchema = new Schema({
  subject: { type: Schema.Types.ObjectId, ref: 'Subject' }, subjectName: { type: String, required: true, trim: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true }, room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  level: { type: Schema.Types.ObjectId, ref: 'Level', required: true }, startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true },
  type: { type: String, enum: ['course', 'tutorial', 'lab', 'exam', 'quiz', 'other'], default: 'course' }, schedule: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true },
  recurrenceGroup: String
}, base);
sessionSchema.index({ room: 1, startsAt: 1, endsAt: 1 }); sessionSchema.index({ level: 1, startsAt: 1 }); sessionSchema.index({ doctor: 1, startsAt: 1 });
export const Session = model('Session', sessionSchema);

export const Schedule = model('Schedule', new Schema({ level: { type: Schema.Types.ObjectId, ref: 'Level', required: true }, status: { type: String, enum: ['draft', 'submitted', 'returned', 'validated', 'published'], default: 'draft' }, publicationIntent: { type: String, enum: ['draft', 'publish'], default: 'draft' }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, externalCheck: { checked: { type: Boolean, default: false }, notes: String, checkedBy: { type: Schema.Types.ObjectId, ref: 'User' }, checkedAt: Date }, submittedAt: Date, validatedAt: Date, validatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, publishedAt: Date }, base));

export const Discussion = model('Discussion', new Schema({ subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true }, author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true, maxlength: 5000 }, imageUrl: String, image: { name: String, mime: String, data: { type: Buffer, select: false } }, notifiedDoctors: [{ type: Schema.Types.ObjectId, ref: 'User' }] }, base));
export const Comment = model('Comment', new Schema({ discussion: { type: Schema.Types.ObjectId, ref: 'Discussion', required: true }, author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true, maxlength: 3000 }, parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null }, certified: { type: Boolean, default: false }, accepted: { type: Boolean, default: false } }, base));
export const Communication = model('Communication', new Schema({ channel: { type: String, enum: ['sms', 'email'], required: true }, sender: { type: Schema.Types.ObjectId, ref: 'User', required: true }, recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }], audience: String, subject: String, body: { type: String, required: true }, status: { type: String, enum: ['sent', 'failed'], required: true }, error: String }, base));
export const ContractorDispatch = model('ContractorDispatch', new Schema({ recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true }, email: { type: String, required: true }, subject: { type: String, required: true }, file: { name: String, mime: String, data: { type: Buffer, select: false } }, sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, sentAt: { type: Date, default: Date.now } }, base));
export const Notification = model('Notification', new Schema({ recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true }, type: String, message: String, readAt: Date, link: String }, base));
