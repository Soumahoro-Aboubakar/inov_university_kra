import { z } from 'zod';
export const parse = (schema, payload) => { const result = schema.safeParse(payload); if (!result.success) { const error = new Error(result.error.issues.map((x) => x.message).join(' ')); error.status = 422; throw error; } return result.data; };
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identifiant invalide.');
