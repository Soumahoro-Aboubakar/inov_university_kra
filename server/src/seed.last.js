import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import {
  Comment, Communication, ContractorDispatch, Discussion, Level, Notification,
  Room, Schedule, Session, Subject, User
} from './models/index.js';

// Le seed est prévu pour un environnement de développement : il remplace le jeu
// de données KRA par défaut. --keep permet de vérifier qu'une base est vide.
const keepExistingData = process.argv.includes('--keep');
const password = 'KraTest2026!';
const daysFromToday = (days, hour, minutes = 0, duration = 120) => {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + days);
  startsAt.setHours(hour, minutes, 0, 0);
  return { startsAt, endsAt: new Date(startsAt.getTime() + duration * 60_000) };
};

const log = (message) => console.log(`  ✓ ${message}`);

async function resetDatabase() {
  // Child collections are cleared first so this stays safe if references later gain constraints.
  await Promise.all([
    Comment.deleteMany({}), Notification.deleteMany({}), ContractorDispatch.deleteMany({}),
    Communication.deleteMany({}), Discussion.deleteMany({}), Session.deleteMany({}),
    Schedule.deleteMany({}), Subject.deleteMany({}), Room.deleteMany({}),
    User.deleteMany({}), Level.deleteMany({})
  ]);
  log('Données de test précédentes supprimées');
}

async function assertSeedCoverage() {
  const models = { User, Level, Room, Subject, Schedule, Session, Discussion, Comment, Communication, ContractorDispatch, Notification };
  const counts = Object.fromEntries(await Promise.all(Object.entries(models).map(async ([name, model]) => [name, await model.countDocuments()])));
  const missing = Object.entries(counts).filter(([, count]) => count === 0).map(([name]) => name);
  if (missing.length) throw new Error(`Seed incomplet : ${missing.join(', ')}`);
  console.table(counts);
}

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log(`\nConnexion MongoDB établie : ${mongoose.connection.name}`);

  if (keepExistingData && await User.exists({})) {
    throw new Error('La base contient déjà des données. Utilisez "npm run seed" pour recréer le jeu de données de test.');
  }
  if (!keepExistingData) await resetDatabase();

  console.log('Création des niveaux...');
  const [licence1, licence2, master1] = await Level.create([
    { name: 'Licence Informatique — 1re année', code: 'L1-INFO', order: 1 },
    { name: 'Licence Informatique — 2e année', code: 'L2-INFO', order: 2 },
    { name: 'Master Data & IA — 1re année', code: 'M1-DATA', order: 3 }
  ]);
  log('3 niveaux créés');

  console.log('Création des comptes utilisateurs...');
  const passwordHash = await bcrypt.hash(password, 12);
  const users = await User.create([
    { firstName: 'Aïcha', lastName: 'Diallo', email: 'aicha.diallo@kra.test', phone: '+221770000001', passwordHash, role: 'principal_admin' },
    { firstName: 'Mamadou', lastName: 'Sarr', email: 'mamadou.sarr@kra.test', phone: '+221770000002', passwordHash, role: 'level_admin', level: licence1._id },
    { firstName: 'Fatou', lastName: 'Ndiaye', email: 'fatou.ndiaye@kra.test', phone: '+221770000003', passwordHash, role: 'level_admin', level: licence2._id },
    { firstName: 'Ibrahima', lastName: 'Ba', email: 'ibrahima.ba@kra.test', phone: '+221770000004', passwordHash, role: 'level_admin', level: master1._id },
    { firstName: 'Nora', lastName: 'Mbaye', email: 'nora.mbaye@kra.test', phone: '+221770000101', passwordHash, role: 'local_doctor', certified: true },
    { firstName: 'Thomas', lastName: 'Fall', email: 'thomas.fall@kra.test', phone: '+221770000102', passwordHash, role: 'local_doctor', certified: true },
    { firstName: 'Sokhna', lastName: 'Diop', email: 'sokhna.diop@kra.test', phone: '+221770000103', passwordHash, role: 'local_doctor', certified: true },
    { firstName: 'Claire', lastName: 'Moreau', email: 'claire.moreau@kra.test', phone: '+33610000001', passwordHash, role: 'contract_doctor', certified: true },
    { firstName: 'Julien', lastName: 'Martin', email: 'julien.martin@kra.test', phone: '+33610000002', passwordHash, role: 'contract_doctor', certified: true },
    { firstName: 'Mariam', lastName: 'Kane', email: 'mariam.kane@etu.kra.test', phone: '+221781000001', passwordHash, role: 'student', level: licence1._id },
    { firstName: 'Ousmane', lastName: 'Cissé', email: 'ousmane.cisse@etu.kra.test', phone: '+221781000002', passwordHash, role: 'student', level: licence1._id },
    { firstName: 'Élodie', lastName: 'Faye', email: 'elodie.faye@etu.kra.test', phone: '+221781000003', passwordHash, role: 'student', level: licence2._id },
    { firstName: 'Cheikh', lastName: 'Sy', email: 'cheikh.sy@etu.kra.test', phone: '+221781000004', passwordHash, role: 'student', level: master1._id }
  ]);
  const [principal, managerL1, managerL2, managerM1, doctorMath, doctorAlgo, doctorData, contractorClaire, contractorJulien, studentMariam, studentOusmane, studentElodie, studentCheikh] = users;
  await Promise.all([
    Level.findByIdAndUpdate(licence1, { manager: managerL1._id }), Level.findByIdAndUpdate(licence2, { manager: managerL2._id }), Level.findByIdAndUpdate(master1, { manager: managerM1._id })
  ]);
  log('13 utilisateurs créés, dont les 5 rôles');

  console.log('Création des salles et matières...');
  const [amphiA, amphiB, room201, labInfo, room402] = await Room.create([
    { name: 'Amphithéâtre A', capacity: 220, location: 'Bâtiment Sciences, RDC' },
    { name: 'Amphithéâtre B', capacity: 160, location: 'Bâtiment Sciences, RDC' },
    { name: 'Salle 201', capacity: 48, location: 'Bâtiment Sciences, 2e étage' },
    { name: 'Laboratoire informatique', capacity: 32, location: 'Bâtiment Numérique, 1er étage' },
    { name: 'Salle 402', capacity: 36, location: 'Bâtiment Sciences, 4e étage' }
  ]);
  const [analysis, algorithms, databases, statistics, machineLearning, networks] = await Subject.create([
    { name: 'Analyse mathématique', code: 'MATH101', doctors: [doctorMath._id], assignments: [{ level: licence1._id, doctors: [doctorMath._id] }, { level: licence2._id, doctors: [doctorMath._id] }] },
    { name: 'Algorithmique avancée', code: 'INFO201', doctors: [doctorAlgo._id], assignments: [{ level: licence1._id, doctors: [doctorAlgo._id] }, { level: licence2._id, doctors: [doctorAlgo._id] }] },
    { name: 'Bases de données', code: 'INFO202', doctors: [doctorAlgo._id], assignments: [{ level: licence1._id, doctors: [doctorAlgo._id] }, { level: licence2._id, doctors: [doctorAlgo._id] }] },
    { name: 'Statistiques appliquées', code: 'STAT301', doctors: [doctorMath._id], assignments: [{ level: licence1._id, doctors: [doctorMath._id] }, { level: licence2._id, doctors: [doctorMath._id] }] },
    { name: 'Apprentissage automatique', code: 'IA401', doctors: [doctorData._id, contractorClaire._id], assignments: [{ level: master1._id, doctors: [doctorData._id, contractorClaire._id] }] },
    { name: 'Réseaux informatiques', code: 'NET201', doctors: [contractorJulien._id], assignments: [{ level: licence2._id, doctors: [contractorJulien._id] }] }
  ]);
  log('5 salles et 6 matières créées');

  console.log('Création des propositions et emplois du temps...');
  const [scheduleL1, scheduleL2, scheduleM1, returnedSchedule, draftSchedule] = await Schedule.create([
    { level: licence1._id, createdBy: managerL1._id, status: 'published', externalCheck: { checked: true, notes: 'Réservations externes vérifiées auprès de la régie.', checkedBy: principal._id, checkedAt: new Date() }, submittedAt: new Date(), publishedAt: new Date() },
    { level: licence2._id, createdBy: managerL2._id, status: 'published', externalCheck: { checked: true, notes: 'Aucune réservation extérieure signalée.', checkedBy: principal._id, checkedAt: new Date() }, submittedAt: new Date(), publishedAt: new Date() },
    { level: master1._id, createdBy: managerM1._id, status: 'submitted', submittedAt: new Date() },
    { level: licence1._id, createdBy: managerL1._id, status: 'returned', submittedAt: new Date() },
    { level: licence2._id, createdBy: managerL2._id, status: 'draft' }
  ]);
  const recurring = 'l1-algorithmique-semaine-a';
  await Session.create([
    { subject: analysis._id, subjectName: analysis.name, doctor: doctorMath._id, room: amphiA._id, level: licence1._id, schedule: scheduleL1._id, type: 'course', ...daysFromToday(1, 8, 0) },
    { subject: algorithms._id, subjectName: algorithms.name, doctor: doctorAlgo._id, room: room201._id, level: licence1._id, schedule: scheduleL1._id, type: 'tutorial', recurrenceGroup: recurring, ...daysFromToday(1, 10, 30, 90) },
    { subject: algorithms._id, subjectName: algorithms.name, doctor: doctorAlgo._id, room: room201._id, level: licence1._id, schedule: scheduleL1._id, type: 'tutorial', recurrenceGroup: recurring, ...daysFromToday(3, 10, 30, 90) },
    { subject: databases._id, subjectName: databases.name, doctor: doctorAlgo._id, room: labInfo._id, level: licence1._id, schedule: scheduleL1._id, type: 'lab', ...daysFromToday(2, 14, 0, 180) },
    { subject: statistics._id, subjectName: statistics.name, doctor: doctorMath._id, room: amphiB._id, level: licence2._id, schedule: scheduleL2._id, type: 'course', ...daysFromToday(1, 14, 0) },
    { subject: networks._id, subjectName: networks.name, doctor: contractorJulien._id, room: room402._id, level: licence2._id, schedule: scheduleL2._id, type: 'course', ...daysFromToday(2, 9, 0) },
    { subject: databases._id, subjectName: databases.name, doctor: doctorAlgo._id, room: labInfo._id, level: licence2._id, schedule: scheduleL2._id, type: 'exam', ...daysFromToday(4, 8, 0, 180) },
    { subject: machineLearning._id, subjectName: machineLearning.name, doctor: doctorData._id, room: room402._id, level: master1._id, schedule: scheduleM1._id, type: 'course', ...daysFromToday(1, 9, 0) },
    { subject: machineLearning._id, subjectName: machineLearning.name, doctor: contractorClaire._id, room: labInfo._id, level: master1._id, schedule: scheduleM1._id, type: 'lab', ...daysFromToday(3, 14, 0, 180) },
    { subject: statistics._id, subjectName: statistics.name, doctor: doctorMath._id, room: amphiB._id, level: licence1._id, schedule: returnedSchedule._id, type: 'quiz', ...daysFromToday(6, 8, 0, 60) },
    { subject: networks._id, subjectName: 'Atelier de configuration réseau', doctor: contractorJulien._id, room: labInfo._id, level: licence2._id, schedule: draftSchedule._id, type: 'other', ...daysFromToday(6, 10, 0, 120) }
  ]);
  log('5 emplois du temps et 11 séances sans conflit de salle créés');

  console.log('Création de l’espace de préoccupations...');
  const [questionAlgo, questionMath, questionMl] = await Discussion.create([
    { subject: algorithms._id, level: licence1._id, author: studentMariam._id, title: 'Comprendre la complexité logarithmique', text: 'Pourquoi la complexité de la recherche dichotomique est-elle logarithmique ? Je bloque sur l’intuition derrière la division de l’intervalle.', notifiedDoctors: [doctorAlgo._id] },
    { subject: analysis._id, level: licence1._id, author: studentOusmane._id, title: 'Continuité et dérivabilité', text: 'Pouvez-vous préciser la différence entre la continuité et la dérivabilité avec un contre-exemple simple ?', notifiedDoctors: [doctorMath._id] },
    { subject: machineLearning._id, level: master1._id, author: studentCheikh._id, title: 'Quand utiliser la validation croisée ?', text: 'Dans quel cas faut-il privilégier la validation croisée plutôt qu’une séparation entraînement/test classique ?', notifiedDoctors: [doctorData._id, contractorClaire._id] }
  ]);
  const answerAlgo = await Comment.create({ discussion: questionAlgo._id, author: doctorAlgo._id, text: 'À chaque étape, on élimine la moitié des valeurs possibles. Le nombre d’étapes nécessaires est donc le nombre de fois où l’on peut diviser n par deux avant d’atteindre 1 : log₂(n).', certified: true, accepted: true });
  await Comment.create([
    { discussion: questionAlgo._id, author: studentElodie._id, parent: answerAlgo._id, text: 'Cette explication avec la taille de l’intervalle m’aide beaucoup, merci !' },
    { discussion: questionMath._id, author: studentMariam._id, text: 'Je crois comprendre : dérivable implique continue, mais l’inverse n’est pas toujours vrai.' },
    { discussion: questionMath._id, author: doctorMath._id, text: 'Exact. La fonction valeur absolue est continue en 0, mais elle n’y est pas dérivable car ses pentes à gauche et à droite diffèrent.', certified: true, accepted: true },
    { discussion: questionMl._id, author: doctorData._id, text: 'La validation croisée est utile quand le jeu de données est limité : elle réutilise mieux les observations tout en fournissant une estimation plus robuste.', certified: true }
  ]);
  log('3 questions et 5 commentaires, dont réponses certifiées et imbriquées, créés');

  console.log('Création des communications et envois vacataires...');
  await Communication.create([
    { channel: 'sms', sender: principal._id, recipients: [studentMariam._id, studentOusmane._id], audience: 'level_students', body: 'Le TD d’algorithmique de lundi est maintenu en salle 201 à 10h30.', status: 'sent' },
    { channel: 'email', sender: principal._id, recipients: [doctorMath._id, doctorAlgo._id, doctorData._id], audience: 'all_doctors', subject: 'Réunion pédagogique du semestre', body: 'La réunion de coordination aura lieu vendredi à 15h en salle 402.', status: 'sent' },
    { channel: 'sms', sender: managerL2._id, recipients: [studentElodie._id], audience: 'level_students', body: 'Rappel : apportez votre carte étudiante pour l’examen de bases de données.', status: 'failed', error: 'Fournisseur SMS indisponible : délai de réponse dépassé.' }
  ]);
  await ContractorDispatch.create([
    { recipient: contractorClaire._id, email: contractorClaire.email, subject: 'Convention d’enseignement — Apprentissage automatique', file: { name: 'convention-claire-moreau.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.4\nDocument de test : convention signée de Claire Moreau.') }, sentBy: principal._id, sentAt: new Date() },
    { recipient: contractorJulien._id, email: contractorJulien.email, subject: 'Planning de cours — Réseaux informatiques', file: { name: 'planning-julien-martin.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: Buffer.from('Fichier de test : planning réseaux de Julien Martin.') }, sentBy: principal._id, sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  ]);
  await Notification.create([
    { recipient: doctorAlgo._id, type: 'new_discussion', message: 'Nouvelle question en Algorithmique avancée', link: `/community/${questionAlgo._id}` },
    { recipient: doctorMath._id, type: 'new_discussion', message: 'Nouvelle question en Analyse mathématique', link: `/community/${questionMath._id}`, readAt: new Date() },
    { recipient: contractorClaire._id, type: 'new_discussion', message: 'Nouvelle question en Apprentissage automatique', link: `/community/${questionMl._id}` },
    { recipient: studentMariam._id, type: 'answer_accepted', message: 'Une réponse validée est disponible pour votre question.', link: `/community/${questionAlgo._id}`, readAt: new Date() }
  ]);
  log('3 communications, 2 envois vacataires et 4 notifications créés');

  await assertSeedCoverage();
  console.log(`\nSeed terminé. Mot de passe de tous les comptes : ${password}\n`);
}

seed()
  .catch((error) => { console.error('\nÉchec du seed :', error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); console.log('Connexion MongoDB fermée.'); });
