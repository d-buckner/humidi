import {
  Commands,
  commandTable,
  commandIndex,
} from './commands';
import {
  ControlCommands,
  controlCommandTable,
  ControllerCommands,
} from './controlCommands';

import type { Command } from './commands';
import type { ValueOf } from './utils';


const Event = {
  NOTE_ON: Commands.NOTE_ON,
  NOTE_OFF: Commands.NOTE_OFF,
  PITCH_BEND: Commands.PITCH_BEND,
  SUSTAIN_ON: ControllerCommands.SUSTAIN_ON,
  SUSTAIN_OFF: ControllerCommands.SUSTAIN_OFF,
} as const;

export type NoteOnEvent = {
  note: number,
  velocity: number,
};

export type NoteOffEvent = {
  note: number,
};

type ValueEvent = {
  value: number,
};

export type PitchBendEvent = ValueEvent;
export type SustainEvent = ValueEvent;

export const AccessStatus = {
  UNREQUESTED: 'unrequested',
  ACCEPTED: 'accepted',
  DENIED: 'denied',
} as const;

type Channel = number;
type Event = ValueOf<typeof Event>;

export type AccessStatus = ValueOf<typeof AccessStatus>;

type EventHandler<T = any> = (event: T) => void;
type MidiMessageHandler = ((channel: number, data1: number, data2: number) => void)
  | ((channel: number, data: number) => void);


export default class HuMIDI {
  private static eventHandlersByChannel: Map<Channel, Map<Event, Set<EventHandler>>> | null = new Map();
  private static accessStatus:  AccessStatus = AccessStatus.UNREQUESTED;
  private static midiAccess: WebMidi.MIDIAccess | null = null;
  private static readonly commandHandler: Record<Command, MidiMessageHandler> = {
    [Commands.NOTE_ON]: HuMIDI.onNoteOn,
    [Commands.NOTE_OFF]: HuMIDI.onNoteOff,
    [Commands.PITCH_BEND]: HuMIDI.onPitchBend,
    [Commands.CONTROL_CHANGE]: HuMIDI.onControlChange,
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

  public static getAccessStatus() {
    return HuMIDI.accessStatus;
  }

  public static reset() {
    this.eventHandlersByChannel = null;
    this.accessStatus = AccessStatus.UNREQUESTED;
    this.midiAccess = null;
  }

  public static on<T = any>(event: Event, handler: EventHandler<T>, channel = -1) {
    if (!HuMIDI.eventHandlersByChannel) {
      HuMIDI.eventHandlersByChannel = new Map();
    }

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

  public static unsubscribeToChannel(channel: number) {
    HuMIDI.eventHandlersByChannel?.delete(channel);
  }

  private static emit<T>(event: Event, payload: T, channel = -1) {
    HuMIDI.getEventHandlers(event, channel)?.forEach(handler => handler(payload));
    HuMIDI.getEventHandlers(event, -1)?.forEach(handler => handler(payload));
  }

  private static getEventHandlers(event: Event, channel = -1) {
    const channelHandlers = HuMIDI.eventHandlersByChannel?.get(channel);
    return channelHandlers?.get(event);
  }

  private static onMessage(midiMessage: WebMidi.MIDIMessageEvent) {
    const [status, data1, data2] = midiMessage.data;

    const command = commandTable[status];
    if (command === undefined) {
      // currently unsupported command
      return;
    }

    const channel = status - commandIndex[command];
    const handler = HuMIDI.commandHandler[command];
    if (!handler) {
      return;
    }

    handler(channel, data1, data2);
  }

  private static onNoteOn(channel: number, note: number, velocity: number) {
    // not really spec, but some keyboards send note on with no velocity as note off events
    if (!velocity) {
      HuMIDI.onNoteOff(channel, note);
      return;
    }

    HuMIDI.emit<NoteOnEvent>(
      Event.NOTE_ON,
      { note, velocity },
      channel,
    );
  }

  private static onNoteOff(channel: number, note: number) {
    HuMIDI.emit<NoteOffEvent>(
      Event.NOTE_OFF,
      { note },
      channel,
    );
  }

  private static onPitchBend(channel: number, lsb: number, msb: number) {
    const rawValue = (msb << 7) + lsb;
    HuMIDI.emit<PitchBendEvent>(
      Event.PITCH_BEND,
      { value: (rawValue - 8192) / 8192 },
      channel,
    );
  }

  private static onControlChange(channel: number, control: number, value:  number) {
    const controlCommand = controlCommandTable[control];

    switch (controlCommand) {
      case ControlCommands.SUSTAIN:
        const eventType = value >= 64
          ? Event.SUSTAIN_ON
          : Event.SUSTAIN_OFF;
        HuMIDI.emit<SustainEvent>(
          eventType,
          { value },
          channel,
        );
        break;
      default:
        break
    }
  }
}
