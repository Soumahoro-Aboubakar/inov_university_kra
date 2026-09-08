import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import {
  Comment, Communication, ContractorDispatch, Discussion, Level, Notification,
  Room, Schedule, Session, Subject, User
} from './models/index.js';
import scheduleData from './seedScheduleData.js';

// ---------------------------------------------------------------------------
// Seed basé sur les emplois du temps réels de l'UAO (fichiers
// Planning_UAO-ST_*.xlsx). Les données de niveaux / matières / séances /
// enseignants / salles proviennent de ces fichiers et sont importées depuis
// `seedScheduleData.js` (généré par le script d'extraction, voir
// `scripts/extractSchedules.mjs` fourni à côté). Les comptes utilisateurs
// (admins, étudiants) et l'espace communautaire (discussions/communications)
// n'existent pas dans les fichiers Excel : ils sont générés de façon
// fictive et cohérente, uniquement pour permettre de tester l'application.
// ---------------------------------------------------------------------------

const keepExistingData = process.argv.includes('--keep');
const password = 'UaoTest2026!';

const log = (message) => console.log(`  ✓ ${message}`);

async function resetDatabase() {
  await Promise.all([
    Comment.deleteMany({}), Notification.deleteMany({}), ContractorDispatch.deleteMany({}),
    Communication.deleteMany({}), Discussion.deleteMany({}), Session.deleteMany({}),
    Schedule.deleteMany({}), Subject.deleteMany({}), Room.deleteMany({}),
    User.deleteMany({}), Level.deleteMany({})
  ]);
  log('Données précédentes supprimées');
}

async function assertSeedCoverage() {
  const models = { User, Level, Room, Subject, Schedule, Session, Discussion, Comment, Communication, ContractorDispatch, Notification };
  const counts = Object.fromEntries(await Promise.all(Object.entries(models).map(async ([name, model]) => [name, await model.countDocuments()])));
  const missing = Object.entries(counts).filter(([, count]) => count === 0).map(([name]) => name);
  if (missing.length) throw new Error(`Seed incomplet : ${missing.join(', ')}`);
  console.table(counts);
}

// --- Utilitaires -----------------------------------------------------------

// Convertit "2026-09-07" + [8, 0] en objet Date local (comme le fait le
// reste de l'application : setHours en heure locale, sans forcer l'UTC).
function toDate(isoDay, [hour, minute]) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(hour, minute, 0, 0);
  return dt;
}

function slugToTitle(str) {
  return str.replace(/\s+/g, ' ').trim();
}

// --- Seed --------------------------------------------------------------

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log(`\nConnexion MongoDB établie : ${mongoose.connection.name}`);

  if (keepExistingData && await User.exists({})) {
    throw new Error('La base contient déjà des données. Relancez sans --keep pour recréer le jeu de données.');
  }
  if (!keepExistingData) await resetDatabase();

  const { levels: levelDefs, rooms: roomDefs, teachers: teacherDefs, subjects: subjectDefs, sessions: sessionDefs } = scheduleData;

  // 1) Niveaux (7 filières issues des 7 fichiers Excel) -----------------
  console.log('Création des niveaux (filières UAO-ST)...');
  const levelDocs = await Level.create(
    levelDefs.map(({ name, code, order }) => ({ name, code, order }))
  );
  const levelByKey = Object.fromEntries(levelDefs.map((l, i) => [l.key, levelDocs[i]]));
  log(`${levelDocs.length} niveaux créés (${levelDefs.map((l) => l.code).join(', ')})`);

  // 2) Salles ------------------------------------------------------------
  // Les fichiers Excel ne précisent une salle nommée que pour une minorité
  // de séances (Amphi MI, Salle informatique, CEMV). Pour toutes les autres,
  // la ligne "SALLE" ne contient que le lien de la plateforme de gestion des
  // salles (https://uao.mygrr.net) : une salle générique "à confirmer" est
  // utilisée dans ce cas plutôt que d'inventer une salle précise.
  console.log('Création des salles...');
  const roomDocs = await Room.create(
    roomDefs.map(({ name, code }) => ({ name, code, location: undefined }))
  );
  const roomByKey = Object.fromEntries(roomDefs.map((r, i) => [r.key, roomDocs[i]]));
  log(`${roomDocs.length} salles créées`);

  // 3) Utilisateurs --------------------------------------------------------
  console.log('Création des comptes utilisateurs...');
  const passwordHash = await bcrypt.hash(password, 12);

  const principal = await User.create({
    firstName: 'Admin', lastName: 'Principal', email: 'admin.principal@uao-st.test',
    passwordHash, role: 'principal_admin'
  });

  // Un compte "level_admin" fictif par niveau (aucune info de ce type dans
  // les fichiers Excel).
  const levelAdmins = {};
  for (const l of levelDefs) {
    const [firstName, ...rest] = l.code.split('-');
    levelAdmins[l.key] = await User.create({
      firstName: 'Responsable', lastName: l.code, email: `responsable.${l.code.toLowerCase()}@uao-st.test`,
      passwordHash, role: 'level_admin', level: levelByKey[l.key]._id
    });
  }
  await Promise.all(levelDefs.map((l) => Level.findByIdAndUpdate(levelByKey[l.key]._id, { manager: levelAdmins[l.key]._id })));
  log(`1 admin principal + ${levelDefs.length} responsables de niveau créés`);

  // Enseignants extraits des colonnes "ENSEIGNANT" des emplois du temps.
  // Le fichier Excel ne distingue pas enseignant permanent ("local_doctor")
  // et vacataire ("contract_doctor") : tous sont importés en tant que
  // "local_doctor" par défaut (à ajuster manuellement si besoin). Les
  // libellés génériques "UP Mathématiques / UP Informatique / UP Physique"
  // (Unité Pédagogique, créneau non encore affecté à un enseignant nommé)
  // sont importés comme des comptes "enseignant" placeholders, au même
  // titre que les enseignants nommés, sans invention d'identité.
  const teacherDocs = await User.create(
    teacherDefs.map((t) => ({
      firstName: t.firstName, lastName: t.lastName, email: t.email,
      passwordHash, role: 'local_doctor', certified: true
    }))
  );
  const teacherByKey = Object.fromEntries(teacherDefs.map((t, i) => [t.key, teacherDocs[i]]));
  log(`${teacherDocs.length} enseignants créés à partir des emplois du temps`);

  // Quelques étudiants fictifs par niveau, pour pouvoir tester les
  // fonctionnalités côté étudiant (non présents dans les fichiers Excel).
  const students = {};
  let studentCounter = 0;
  for (const l of levelDefs) {
    students[l.key] = [];
    for (let i = 1; i <= 3; i += 1) {
      studentCounter += 1;
      const student = await User.create({
        firstName: `Etudiant${i}`, lastName: l.code, email: `etudiant${studentCounter}.${l.code.toLowerCase()}@etu.uao-st.test`,
        passwordHash, role: 'student', level: levelByKey[l.key]._id
      });
      students[l.key].push(student);
    }
  }
  log(`${studentCounter} étudiants fictifs créés (3 par niveau)`);

  // 4) Matières ------------------------------------------------------------
  // Les assignations enseignant <-> matière <-> niveau sont déduites
  // directement des colonnes ENSEIGNANT des emplois du temps (regroupées
  // par matière et par niveau), et non inventées.
  console.log('Création des matières...');
  const assignmentsBySubject = new Map(); // subjectKey -> Map(levelKey -> Set(teacherKey))
  for (const s of sessionDefs) {
    if (!s.subjectKey) continue;
    if (!assignmentsBySubject.has(s.subjectKey)) assignmentsBySubject.set(s.subjectKey, new Map());
    const byLevel = assignmentsBySubject.get(s.subjectKey);
    if (!byLevel.has(s.level)) byLevel.set(s.level, new Set());
    s.teacherKeys.forEach((tk) => byLevel.get(s.level).add(tk));
  }

  const subjectDocsBySource = [];
  for (const subj of subjectDefs) {
    const byLevel = assignmentsBySubject.get(subj.key) || new Map();
    const assignments = [...byLevel.entries()].map(([levelKey, teacherSet]) => ({
      level: levelByKey[levelKey]._id,
      doctors: [...teacherSet].map((tk) => teacherByKey[tk]._id)
    }));
    const allDoctors = [...new Set(assignments.flatMap((a) => a.doctors.map(String)))].map((id) => new mongoose.Types.ObjectId(id));
    subjectDocsBySource.push({ name: slugToTitle(subj.name), code: subj.code, doctors: allDoctors, assignments });
  }
  const subjectDocs = await Subject.create(subjectDocsBySource);
  const subjectByKey = Object.fromEntries(subjectDefs.map((s, i) => [s.key, subjectDocs[i]]));
  log(`${subjectDocs.length} matières créées à partir des emplois du temps`);

  // 5) Emplois du temps (Schedule) : un par niveau et par semestre --------
  console.log('Création des emplois du temps (par niveau et par semestre)...');
  const sessionsByLevelSemester = new Map(); // "levelKey-semester" -> sessions[]
  for (const s of sessionDefs) {
    const k = `${s.level}-${s.semester}`;
    if (!sessionsByLevelSemester.has(k)) sessionsByLevelSemester.set(k, []);
    sessionsByLevelSemester.get(k).push(s);
  }

  const scheduleByLevelSemester = {};
  for (const l of levelDefs) {
    for (const semester of [1, 2]) {
      const key = `${l.key}-${semester}`;
      const hasSessions = (sessionsByLevelSemester.get(key) || []).length > 0;
      // M2 (BDGL / EDP-ANO) semestre 2 est réservé au stage / mémoire dans
      // les fichiers Excel fournis : aucune séance n'y est planifiée, le
      // planning correspondant reste donc à l'état "draft".
      const schedule = await Schedule.create({
        level: levelByKey[l.key]._id,
        createdBy: levelAdmins[l.key]._id,
        status: hasSessions ? 'published' : 'draft',
        ...(hasSessions ? {
          externalCheck: { checked: true, notes: 'Emploi du temps importé depuis le fichier Excel officiel UAO-ST.', checkedBy: principal._id, checkedAt: new Date() },
          submittedAt: new Date(),
          publishedAt: new Date()
        } : {})
      });
      scheduleByLevelSemester[key] = schedule;
    }
  }
  log(`${Object.keys(scheduleByLevelSemester).length} emplois du temps créés (${levelDefs.length} niveaux x 2 semestres)`);

  // 6) Séances (Session) ---------------------------------------------------
  // Une séance = une case (jour x créneau) d'un emploi du temps Excel.
  // Les créneaux "Férié"/"Férie" (jours fériés) ont été exclus lors de
  // l'extraction, de même que les blocs de calendrier d'examens (dates
  // globales, sans détail jour/matière/enseignant/salle exploitable).
  console.log('Création des séances à partir des emplois du temps Excel...');
  const BATCH = 500;
  let created = 0;
  for (let i = 0; i < sessionDefs.length; i += BATCH) {
    const batch = sessionDefs.slice(i, i + BATCH).map((s) => {
      const schedule = scheduleByLevelSemester[`${s.level}-${s.semester}`];
      const doctorIds = s.teacherKeys.length
        ? s.teacherKeys.map((tk) => teacherByKey[tk]._id)
        : [levelAdmins[s.level]._id]; // filet de sécurité : ne devrait pas arriver, aucun enseignant listé
      return {
        subject: s.subjectKey ? subjectByKey[s.subjectKey]._id : undefined,
        subjectName: s.subjectName,
        doctor: doctorIds[0],
        room: roomByKey[s.roomKey]._id,
        level: levelByKey[s.level]._id,
        schedule: schedule._id,
        createdBy: schedule.createdBy,
        updatedBy: schedule.createdBy,
        type: s.type,
        startsAt: toDate(s.date, s.start),
        endsAt: toDate(s.date, s.end)
      };
    });
    await Session.create(batch);
    created += batch.length;
  }
  log(`${created} séances créées (issues des 7 fichiers Excel, S1 + S2)`);

  // 7) Espace de préoccupations (communauté) -------------------------------
  // Non présent dans les fichiers Excel : quelques échanges fictifs sont
  // générés pour permettre de tester la fonctionnalité, en s'appuyant sur
  // les vraies matières et les vrais enseignants importés.
  console.log('Création de l’espace de préoccupations (données fictives de test)...');
  const sampleSubject = subjectDocs[0];
  const sampleLevelKey = levelDefs[0].key;
  const sampleTeacherId = sampleSubject.doctors[0] || teacherDocs[0]._id;
  const sampleStudent = students[sampleLevelKey][0];
  const discussion = await Discussion.create({
    subject: sampleSubject._id, level: levelByKey[sampleLevelKey]._id, author: sampleStudent._id,
    title: `Question sur ${sampleSubject.name}`,
    text: `Pourriez-vous revenir sur un point de "${sampleSubject.name}" abordé en cours ? Je souhaiterais un éclaircissement supplémentaire.`,
    notifiedDoctors: [sampleTeacherId]
  });
  const answer = await Comment.create({
    discussion: discussion._id, author: sampleTeacherId,
    text: 'Bonne question, je reprends ce point en détail lors de la prochaine séance de TD.',
    certified: true, accepted: true
  });
  await Comment.create({
    discussion: discussion._id, author: sampleStudent._id, parent: answer._id,
    text: 'Merci beaucoup pour cette précision !'
  });
  log('1 question et 2 commentaires créés (espace communauté)');

  // 8) Communications et envois vacataires ---------------------------------
  console.log('Création des communications et envois vacataires (données fictives de test)...');
  await Communication.create({
    channel: 'sms', sender: levelAdmins[sampleLevelKey]._id,
    recipients: students[sampleLevelKey].map((s) => s._id), audience: 'level_students',
    body: `Rappel : l'emploi du temps du niveau ${levelDefs[0].code} vient d'être publié.`,
    totalRecipients: students[sampleLevelKey].length, successfulCount: students[sampleLevelKey].length,
    status: 'sent'
  });
  await ContractorDispatch.create({
    recipient: teacherDocs[0]._id, email: teacherDocs[0].email,
    subject: 'Planning de cours — emploi du temps UAO-ST',
    file: { name: 'planning.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: Buffer.from('Fichier de test : planning transmis à l’enseignant.') },
    sentBy: principal._id, sentAt: new Date()
  });
  await Notification.create({
    recipient: sampleTeacherId, type: 'new_discussion',
    message: `Nouvelle question en ${sampleSubject.name}`, link: `/community/${discussion._id}`
  });
  log('1 communication, 1 envoi vacataire et 1 notification créés');

  await assertSeedCoverage();
  console.log(`\nSeed terminé. Mot de passe de tous les comptes générés : ${password}\n`);
}

seed()
  .catch((error) => { console.error('\nÉchec du seed :', error); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); console.log('Connexion MongoDB fermée.'); });