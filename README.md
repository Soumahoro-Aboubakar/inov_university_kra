# KRA — gestion académique

Plateforme MERN de gestion d'emplois du temps, de communication et de suivi pédagogique.

## Démarrage

1. Copiez `server/.env.example` en `server/.env` et renseignez `MONGODB_URI` et `JWT_SECRET`.
2. `npm install && npm install --prefix server && npm install --prefix client`
3. `npm run dev`

L’API écoute sur `http://localhost:5000` et l’application sur `http://localhost:5173`.

## Données de test

Après avoir démarré MongoDB et renseigné `server/.env`, exécutez l’une des commandes suivantes :

```bash
# Depuis la racine du projet
npm run seed --prefix server

# Ou depuis le dossier server/
npm run seed
```

Cette commande efface uniquement les collections gérées par KRA, puis crée un jeu de données relationnel couvrant chaque modèle. Tous les comptes utilisent le mot de passe affiché à la fin de l’exécution. Pour refuser toute réinitialisation si des utilisateurs existent déjà, utilisez `npm run seed:keep` depuis `server/` (ou `npm run seed:keep --prefix server` depuis la racine).

Le premier administrateur principal se crée depuis l’écran d’inscription. Les autres comptes sont ensuite créés par lui via l’API. SMTP, Twilio et Cloudflare R2 sont optionnels : lorsqu’ils ne sont pas configurés, l’API refuse l’envoi plutôt que de prétendre l’avoir effectué.

## Rôles

`principal_admin`, `level_admin`, `local_doctor`, `contract_doctor`, `student`.

## Principes importants

- Les créneaux sont vérifiés à chaque écriture. Une publication reste impossible si un conflit interne existe.
- Les conflits externes sont consignés manuellement par le secrétariat avant publication.
- Les vues hebdomadaires sont natives en HTML/CSS ; Excel et PDF sont générés à la demande côté serveur.
