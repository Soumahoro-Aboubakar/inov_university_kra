import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConflictGroups, summarizeConflictGroups } from './conflictGroups.js';

test('buildConflictGroups merges same room and time into one group', () => {
  const conflicts = [
    { sessionId: 'a', scheduleId: 's1', level: 'Licence 1', room: 'B204', teacher: 'Dr A', subjectName: 'Maths', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T10:00:00.000Z', conflictTypes: ['room'] },
    { sessionId: 'b', scheduleId: 's2', level: 'Licence 2', room: 'B204', teacher: 'Dr B', subjectName: 'Physique', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T10:00:00.000Z', conflictTypes: ['room'] },
    { sessionId: 'c', scheduleId: 's3', level: 'Licence 3', room: 'C101', teacher: 'Dr C', subjectName: 'Chimie', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T10:00:00.000Z', conflictTypes: ['room'] },
  ];

  const groups = buildConflictGroups(conflicts);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].memberCount, 2);
  assert.equal(groups[1].memberCount, 1);
});

test('summarizeConflictGroups returns correct counts from real data', () => {
  const conflicts = [
    { room: 'B204', level: 'L1', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T10:00:00.000Z', scheduleId: 's1', conflictTypes: ['room'] },
    { room: 'B204', level: 'L2', startsAt: '2026-09-15T08:00:00.000Z', endsAt: '2026-09-15T10:00:00.000Z', scheduleId: 's2', conflictTypes: ['room'] },
    { room: 'A110', level: 'L3', startsAt: '2026-09-15T11:00:00.000Z', endsAt: '2026-09-15T12:00:00.000Z', scheduleId: 's3', conflictTypes: ['room'] },
  ];

  const summary = summarizeConflictGroups(conflicts);
  assert.equal(summary.totalConflicts, 3);
  assert.equal(summary.rooms.size, 2);
  assert.equal(summary.levels.size, 3);
  assert.equal(summary.slots.size, 2);
});
