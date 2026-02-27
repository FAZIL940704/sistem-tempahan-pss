export interface Booking {
  room: string;
  date: string;
  slot: string;
  name: string;
  aim: string;
  version: Version;
}

export interface Block {
  room: string;
  date: string;
  slot: string | null;
  type: 'slot' | 'day';
}

export type Version = 'T12' | 'T35';

export interface TimeSlot {
  t: string;
  r?: number; // rehat
}
