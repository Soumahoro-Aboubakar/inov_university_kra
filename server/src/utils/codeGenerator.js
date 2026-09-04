import { Level, Room, Subject } from '../models/index.js';

/**
 * Génère un code court, lisible et unique à partir d'un nom.
 *
 * Stratégie :
 *  1. Découpe le nom en mots significatifs (ignore les articles/prépositions courts).
 *  2. Prend les 3-4 premières lettres de chaque mot significatif (max 3 mots).
 *  3. Joint le tout avec des tirets, en MAJUSCULES.
 *  4. Vérifie l'unicité dans la collection cible.
 *  5. Si collision, ajoute un suffixe numérique incrémental (-01, -02, …).
 */

const STOP_WORDS = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'l', 'un', 'une',
  'et', 'en', 'au', 'aux', 'à', 'a', 'pour', 'par', 'sur', 'dans', 'avec',
  'the', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'with'
]);

function slugify(name) {
  // Normaliser les accents, supprimer les caractères non alphanumériques
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retirer les accents
    .replace(/['']/g, ' ')          // apostrophes → espaces
    .replace(/[^a-zA-Z0-9\s-]/g, '') // garder uniquement alpha-num, espaces, tirets
    .trim();

  // Découper en mots et filtrer les stop-words
  const words = normalized
    .split(/[\s-]+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return 'CODE';

  // Prendre les 3 premiers mots significatifs, tronquer chacun à 4 caractères
  const parts = words.slice(0, 3).map(w => {
    const len = w.length <= 3 ? w.length : 4;
    return w.substring(0, len).toUpperCase();
  });

  return parts.join('-');
}

const MODELS = { level: Level, room: Room, subject: Subject };

/**
 * Génère un code unique pour le type donné.
 * @param {'level'|'room'|'subject'} type
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function generateCode(type, name) {
  const Model = MODELS[type];
  if (!Model) throw new Error(`Type inconnu : ${type}`);

  const base = slugify(name);

  // Vérifier si le code de base est disponible
  const existing = await Model.findOne({ code: base });
  if (!existing) return base;

  // Sinon, chercher la prochaine variante disponible
  for (let i = 1; i <= 999; i++) {
    const suffix = String(i).padStart(2, '0');
    const candidate = `${base}-${suffix}`;
    const found = await Model.findOne({ code: candidate });
    if (!found) return candidate;
  }

  // Fallback extrêmement improbable
  return `${base}-${Date.now()}`;
}
