import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTimeOverlap, sameCalendarDay } from './conflicts.js';

test('sameCalendarDay compares only the calendar date', () => {
  assert.equal(sameCalendarDay('2026-08-28T13:53:00Z', '2026-08-28T08:34:00Z'), true);
  assert.equal(sameCalendarDay('2026-08-28T22:00:00Z', '2026-08-29T00:30:00Z'), false);
});

test('hasTimeOverlap returns true only for real overlaps on the same day', () => {
  assert.equal(hasTimeOverlap('2026-08-28T10:00:00Z', '2026-08-28T12:00:00Z', '2026-08-28T11:00:00Z', '2026-08-28T13:00:00Z'), true);
  assert.equal(hasTimeOverlap('2026-08-28T10:00:00Z', '2026-08-28T12:00:00Z', '2026-08-29T11:00:00Z', '2026-08-29T13:00:00Z'), false);
  assert.equal(hasTimeOverlap('2026-08-28T10:00:00Z', '2026-08-28T12:00:00Z', '2026-08-28T12:00:00Z', '2026-08-28T14:00:00Z'), false);
  assert.equal(hasTimeOverlap('2026-08-28T10:00:00Z', '2026-08-28T12:00:00Z', '2026-08-28T09:00:00Z', '2026-08-28T09:30:00Z'), false);
});
