import nodemailer from 'nodemailer';
import twilio from 'twilio';

const smtpReady = () => ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].every((key) => process.env[key]);
const smsReady = () => ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'].every((key) => process.env[key]);

export const sendEmail = async ({ to, subject, text, attachments = [] }) => {
  if (!smtpReady()) { const e = new Error('Service e-mail non configuré.'); e.status = 503; throw e; }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  return transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text, attachments });
};
export const sendSms = async ({ to, body }) => {
  if (!smsReady()) { const e = new Error('Service SMS non configuré.'); e.status = 503; throw e; }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({ from: process.env.TWILIO_FROM, to, body });
};
