import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { Communication } from '../models/index.js';
import { env } from '../config/env.js';

const smtpReady = () => ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].every((key) => process.env[key]);
const smsReady = () => ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'].every((key) => process.env[key]) && (process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER);

export const sendEmail = async ({ to, subject, text, attachments = [] }) => {
  if (!smtpReady()) { const e = new Error('Service e-mail non configuré.'); e.status = 503; throw e; }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  return transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text, attachments });
};
export const sendSms = async ({ to, body, statusCallback }) => {
  if (!smsReady()) { const e = new Error('Service SMS non configuré.'); e.status = 503; throw e; }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({ from: process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER, to, body, ...(statusCallback ? { statusCallback } : {}) });
};

const updateDelivery = async (campaignId, deliveryId, patch) => Communication.updateOne({ _id: campaignId, 'deliveries._id': deliveryId }, { $set: Object.fromEntries(Object.entries(patch).map(([key, value]) => [`deliveries.$.${key}`, value])) });

const refreshCampaignCounts = async (campaignId) => {
  const campaign = await Communication.findById(campaignId).select('deliveries');
  if (!campaign) return;
  const successfulCount = campaign.deliveries.filter((item) => ['sent', 'delivered'].includes(item.status)).length;
  const deliveredCount = campaign.deliveries.filter((item) => item.status === 'delivered').length;
  const failedCount = campaign.deliveries.filter((item) => ['failed', 'undelivered'].includes(item.status)).length;
  const pendingCount = campaign.deliveries.filter((item) => ['pending', 'queued', 'sending'].includes(item.status)).length;
  await Communication.updateOne({ _id: campaignId }, { $set: { successfulCount, deliveredCount, failedCount, status: pendingCount ? 'processing' : (failedCount === campaign.deliveries.length ? 'failed' : (failedCount ? 'partial' : 'sent')) } });
};

export const dispatchSmsCampaign = async ({ campaignId, deliveries, title, body }) => {
  const statusCallback = env.twilioStatusCallbackUrl;
  const message = `${title}\n${body}`;
  const sendOne = async (delivery) => {
    try {
      await updateDelivery(campaignId, delivery._id, { status: 'sending' });
      const result = await sendSms({ to: delivery.phoneNumber, body: message, statusCallback });
      await updateDelivery(campaignId, delivery._id, { status: result.status || 'queued', twilioMessageSid: result.sid, sentAt: new Date() });
    } catch (error) {
      await updateDelivery(campaignId, delivery._id, { status: 'failed', error: error.message, errorCode: error.code ? String(error.code) : undefined });
    }
  };
  for (let index = 0; index < deliveries.length; index += 8) await Promise.all(deliveries.slice(index, index + 8).map(sendOne));
  await refreshCampaignCounts(campaignId);
};

export const updateSmsDeliveryStatus = async ({ messageSid, status, errorCode, errorMessage }) => {
  if (!messageSid) return;
  const normalized = ['queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered'].includes(status) ? status : undefined;
  if (!normalized) return;
  const campaign = await Communication.findOne({ 'deliveries.twilioMessageSid': messageSid });
  if (!campaign) return;
  const delivery = campaign.deliveries.find((item) => item.twilioMessageSid === messageSid);
  await updateDelivery(campaign._id, delivery._id, { status: normalized, errorCode, error: errorMessage, ...(normalized === 'delivered' ? { deliveredAt: new Date() } : {}) });
  await refreshCampaignCounts(campaign._id);
};
