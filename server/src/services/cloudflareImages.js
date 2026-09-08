import { env } from '../config/env.js';

export async function uploadForumImage(file) {
  if (!env.cloudflareAccountId || !env.cloudflareApiToken) {
    const error = new Error('Le stockage Cloudflare Images n’est pas configuré.');
    error.status = 503;
    throw error;
  }
  const body = new FormData();
  body.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.cloudflareApiToken}` },
    body,
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    const error = new Error('L’image n’a pas pu être envoyée vers Cloudflare.');
    error.status = 502;
    throw error;
  }
  const url = result.result.variants?.[0] || (env.cloudflareImagesHash ? `https://imagedelivery.net/${env.cloudflareImagesHash}/${result.result.id}/public` : '');
  if (!url) {
    const error = new Error('Cloudflare Images ne fournit pas d’URL publique pour cette image.');
    error.status = 502;
    throw error;
  }
  return { url, key: result.result.id, name: file.originalname, mime: file.mimetype };
}