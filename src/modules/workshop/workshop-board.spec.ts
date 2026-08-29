import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  hasCapacity,
  loadByTechnician,
  unassigned,
  type BoardJob,
} from './workshop-board';

const now = new Date('2026-08-29T09:00:00Z');
const inMinutes = (m: number) => new Date(now.getTime() + m * 60_000);

const job = (over: Partial<BoardJob> & Pick<BoardJob, 'jobRef'>): BoardJob => ({
  vehiclePlate: `RAB ${over.jobRef}`,
  state: 'IN_PROGRESS',
  promisedAt: inMinutes(480),
  technicianId: 'TECH-1',
  ...over,
});

describe('the ordering, which is the product', () => {
  it('puts the late ones first, then at-risk, then blocked-on-us, then blocked-on-them', () => {
    const board = buildBoard(
      [
        job({ jobRef: 'ontrack', promisedAt: inMinutes(600) }),
        job({ jobRef: 'parts', state: 'AWAITING_PARTS' }),
        job({ jobRef: 'auth', state: 'AWAITING_AUTHORISATION' }),
        job({ jobRef: 'risk', promisedAt: inMinutes(45) }),
        job({ jobRef: 'late', promisedAt: inMinutes(-30) }),
      ],
      now,
    );
    expect(board.map((r) => r.jobRef)).toEqual(['late', 'risk', 'auth', 'parts', 'ontrack']);
  });

  it('ranks awaiting-authorisation above awaiting-parts', () => {
    // Blocked-on-us beats blocked-on-them: the workshop can fix one of these with a phone
    // call, and the vehicle is occupying a bay meanwhile.
    const board = buildBoard(
      [
        job({ jobRef: 'parts', state: 'AWAITING_PARTS' }),
        job({ jobRef: 'auth', state: 'AWAITING_AUTHORISATION' }),
      ],
      now,
    );
    expect(board[0]!.jobRef).toBe('auth');
  });

  it('treats additional work found as awaiting authorisation, because it is', () => {
    const [row] = buildBoard([job({ jobRef: 'x', state: 'ADDITIONAL_WORK_FOUND' })], now);
    expect(row!.attention).toBe('AWAITING_AUTHORISATION');
  });

  it('keeps lateness above being blocked — a late blocked job is still late', () => {
    // The customer still needs telling, whatever the workshop is waiting on.
    const [row] = buildBoard(
      [job({ jobRef: 'x', state: 'AWAITING_PARTS', promisedAt: inMinutes(-10) })],
      now,
    );
    expect(row!.attention).toBe('OVERDUE');
  });

  it('breaks ties by promise time, then by ref so the order is stable', () => {
    const a = buildBoard(
      [job({ jobRef: 'b' }), job({ jobRef: 'a' })],
      now,
    ).map((r) => r.jobRef);
    const b = buildBoard(
      [job({ jobRef: 'a' }), job({ jobRef: 'b' })],
      now,
    ).map((r) => r.jobRef);
    expect(a).toEqual(b);
    expect(a).toEqual(['a', 'b']);
  });
});

describe('what is on the board and what is not', () => {
  it('drops jobs that have left the workshop’s hands', () => {
    // A board is a list of things to do. Anything needing no action is noise on it.
    const board = buildBoard(
      [
        job({ jobRef: 'done', state: 'HANDED_OVER' }),
        job({ jobRef: 'closed', state: 'CLOSED' }),
        job({ jobRef: 'cancelled', state: 'CANCELLED' }),
        job({ jobRef: 'declined', state: 'DECLINED' }),
        job({ jobRef: 'live' }),
      ],
      now,
    );
    expect(board.map((r) => r.jobRef)).toEqual(['live']);
  });

  it('returns an empty board rather than failing when nothing is open', () => {
    expect(buildBoard([], now)).toEqual([]);
  });
});

describe('the note a manager reads', () => {
  it('says how late, and to call', () => {
    const [row] = buildBoard([job({ jobRef: 'x', promisedAt: inMinutes(-45) })], now);
    expect(row!.note).toContain('45 min past');
    expect(row!.note).toMatch(/call the customer/i);
  });

  it('says when nobody is assigned to a job that is nearly due', () => {
    const [row] = buildBoard(
      [job({ jobRef: 'x', promisedAt: inMinutes(30), technicianId: null })],
      now,
    );
    expect(row!.note).toMatch(/nobody is assigned/i);
  });

  it('says why an authorisation delay costs money', () => {
    const [row] = buildBoard([job({ jobRef: 'x', state: 'AWAITING_AUTHORISATION' })], now);
    expect(row!.note).toMatch(/earning nothing/i);
  });
});

describe('the quiet one that costs most', () => {
  it('finds work in progress with nobody on it', () => {
    // A car in a bay everybody assumes somebody else is working on.
    const board = buildBoard(
      [
        job({ jobRef: 'orphan', state: 'IN_PROGRESS', technicianId: null }),
        job({ jobRef: 'staffed', state: 'IN_PROGRESS' }),
        job({ jobRef: 'booked', state: 'BOOKED', technicianId: null }),
      ],
      now,
    );
    expect(unassigned(board).map((r) => r.jobRef)).toEqual(['orphan']);
  });
});

describe('load and capacity', () => {
  it('counts open jobs per technician', () => {
    const board = buildBoard(
      [
        job({ jobRef: '1', technicianId: 'A' }),
        job({ jobRef: '2', technicianId: 'A' }),
        job({ jobRef: '3', technicianId: 'B' }),
        job({ jobRef: '4', technicianId: null }),
      ],
      now,
    );
    const load = loadByTechnician(board);
    expect(load.get('A')).toBe(2);
    expect(load.get('B')).toBe(1);
    expect(load.has('null')).toBe(false);
  });

  it('counts a bay as free once the job is ready for handover', () => {
    // The vehicle is finished; the bay is not the constraint any more.
    const board = buildBoard(
      [
        job({ jobRef: '1', state: 'IN_PROGRESS' }),
        job({ jobRef: '2', state: 'READY_FOR_HANDOVER' }),
        job({ jobRef: '3', state: 'BOOKED' }),
      ],
      now,
    );
    expect(hasCapacity(board, 2)).toBe(true);
    expect(hasCapacity(board, 1)).toBe(false);
  });

  it('rejects a nonsensical bay count rather than dividing by it', () => {
    expect(() => hasCapacity([], 0)).toThrow(BadRequestException);
    expect(() => hasCapacity([], 2.5)).toThrow(BadRequestException);
  });
});
