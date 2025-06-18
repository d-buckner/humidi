import {
  type Command,
  Commands,
  commandTable,
  commandIndex,
} from './commands';


import type { ValueOf } from './utils';


const Event = {
  NOTE_ON: Commands.NOTE_ON,
  NOTE_OFF: Commands.NOTE_OFF,
  PITCH_BEND: Commands.PITCH_BEND,
} as const;

export type NoteOnEvent = {
  note: number,
  velocity: number,
};

export type NoteOffEvent = {
  note: number,
};

type Event = ValueOf<typeof Event>;

const AccessStatus = {
  UNREQUESTED: 'unrequested',
  ACCEPTED: 'accepted',
  DENIED: 'denied',
} as const;
type AccessStatus = ValueOf<typeof AccessStatus>;

type EventHandler<T = any> = (event: T) => void;
type MidiMessageHandler = ((channel: number, dataByte1: number, dataByte2: number) => void)
  | ((channel: number, dataByte: number) => void);


export default class HuMIDI {
  private static eventHandlersByChannel: Map<number, Map<Event, Set<EventHandler>>> = new Map();
  private static accessStatus:  AccessStatus = AccessStatus.UNREQUESTED;
  private static midiAccess?: WebMidi.MIDIAccess;
  private static readonly commandHandler: Record<Command, MidiMessageHandler> = {
    [Commands.NOTE_ON]: HuMIDI.onNoteOn,
    [Commands.NOTE_OFF]: HuMIDI.onNoteOff,
    [Commands.PITCH_BEND]: HuMIDI.onPitchBend,
  };

  static async requestAccess() {
    if (HuMIDI.accessStatus !== AccessStatus.UNREQUESTED) {
      return;
    }

    try {
      HuMIDI.midiAccess = await navigator.requestMIDIAccess();
      HuMIDI.accessStatus = AccessStatus.ACCEPTED;
    } catch (err) {
      HuMIDI.accessStatus = AccessStatus.DENIED;
      throw new Error('MIDI permissions denied');
    }

    HuMIDI.midiAccess.inputs.forEach(input => {
      input.onmidimessage = HuMIDI.onMessage;
    });
  }

  public static on(event: Event, handler: EventHandler, channel = -1) {
    if (!HuMIDI.eventHandlersByChannel.get(channel)) {
      HuMIDI.eventHandlersByChannel.set(channel, new Map());
    }

    const channelHandlers = HuMIDI.eventHandlersByChannel.get(channel);
    if (!channelHandlers!.get(event)) {
      channelHandlers!.set(event, new Set());
    }

    const eventHandlers = channelHandlers!.get(event)!;
    eventHandlers.add(handler);
  }

  public static off(event: Event, handler: EventHandler, channel = -1) {
    HuMIDI.getEventHandlers(event, channel)?.delete(handler);
  }

  private static emit(event: Event, payload: Record<string, any>, channel = -1) {
    HuMIDI.getEventHandlers(event, channel)?.forEach(handler => handler(payload));
    HuMIDI.getEventHandlers(event, -1)?.forEach(handler => handler(payload));
  }

  private static getEventHandlers(event: Event, channel = -1) {
    const channelHandlers = HuMIDI.eventHandlersByChannel.get(channel);
    return channelHandlers?.get(event);
  }

  private static onMessage(midiMessage: WebMidi.MIDIMessageEvent) {
    const [statusByte, dataByte1, dataByte2] = midiMessage.data;

    const command = commandTable[statusByte];
    if (command === undefined) {
      // currently unsupported command
      return;
    }

    const channel = statusByte - commandIndex[command];
    const handler = HuMIDI.commandHandler[command];
    if (!handler) {
      return;
    }

    handler(channel, dataByte1, dataByte2);
  }

  private static onNoteOn(channel: number, note: number, velocity: number) {
    // not really spec, but some keyboards send note on with no velocity as note off events
    if (!velocity) {
      HuMIDI.onNoteOff(channel, note);
      return;
    }

    HuMIDI.emit(
      Event.NOTE_ON,
      {
        note,
        velocity,
      },
      channel
    );
  }

  private static onNoteOff(channel: number, note: number) {
    HuMIDI.emit(Event.NOTE_OFF, {
      note,
    }, channel);
  }

  private static onPitchBend(channel: number, lsb: number, msb: number) {
    HuMIDI.emit(Event.PITCH_BEND, {
      lsb,
      msb,
    }, channel);
  }
}
