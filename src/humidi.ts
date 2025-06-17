import { Commands, commandTable, commandIndex } from './commands';

import type { ValueOf } from './utils';


const Event = {
  NOTE_ON: Commands.NOTE_ON,
  NOTE_OFF: Commands.NOTE_ON,
  PITCH_BEND: Commands.PITCH_BEND,
} as const;

type Event = ValueOf<typeof Event>;

const AccessStatus = {
  UNREQUESTED: 'unrequested',
  ACCEPTED: 'accepted',
  DENIED: 'denied',
} as const;

type EventHandler<T = any> = (event: T) => void;
type MidiMessageHandler = ((channel: number, dataByte1: number, dataByte2: number) => void)
  | ((channel: number, dataByte: number) => void);


export default class HuMIDI {
  private static eventHandlers: Map<ValueOf<typeof Event>, Set<EventHandler>> = new Map();
  private static accessStatus:  ValueOf<typeof AccessStatus> = AccessStatus.UNREQUESTED;
  private static midiAccess?: WebMidi.MIDIAccess;
  private static readonly commandHandler: Record<ValueOf<typeof Commands>, MidiMessageHandler>= {
    [Commands.NOTE_ON]: this.onNoteOn,
    [Commands.NOTE_OFF]: this.onNoteOff,
    [Commands.PITCH_BEND]: this.onPitchBend,
  };

  static async requestAccess() {
    if (this.accessStatus !== AccessStatus.UNREQUESTED) {
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
    } catch (err) {
      throw new Error('MIDI permissions denied');
    }

    this.midiAccess.inputs.forEach(input => {
      input.onmidimessage = this.onMessage;
    });
  }

  public static on(event: ValueOf<typeof Event>, handler: EventHandler) {
    if (!this.eventHandlers.get(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event)!;
    handlers.add(handler);
  }

  public static off(event: ValueOf<typeof Event>, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    handlers?.delete(handler);
  }

  private static emit(event: Event, payload: Record<string, any>) {
    const handlers = this.eventHandlers.get(event);
    handlers?.forEach(handler => handler(payload));
  }

  private static onMessage(midiMessage: WebMidi.MIDIMessageEvent) {
    const [statusByte, dataByte1, dataByte2] = midiMessage.data;

    const command = commandTable[statusByte];
    if (command === undefined) {
      return;
    }

    const channel = statusByte - commandIndex[command];
    const handler = this.commandHandler[command];
    if (!handler) {
      return;
    }

    handler(channel, dataByte1, dataByte2);
  }

  private static onNoteOn(channel: number, note: number, velocity: number) {
    this.emit(Event.NOTE_ON, {
      note,
      velocity,
      channel,
    });
  }

  private static onNoteOff(channel: number, note: number) {
    this.emit(Event.NOTE_ON, {
      note,
      channel,
    });
  }

  private static onPitchBend(channel: number, lsb: number, msb: number) {
    this.emit(Event.NOTE_ON, {
      lsb,
      msb,
      channel,
    });
  }
}
