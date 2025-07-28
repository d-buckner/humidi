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
  INPUT_CONNECTED: 'inputconnected',
  INPUT_DISCONNECTED: 'inputdisconnected',
} as const;

/**
 * Event data for MIDI note on messages
 */
export type NoteOnEvent = {
  /** MIDI note number (0-127) */
  note: number;
  /** Note velocity (0-127) */
  velocity: number;
};

/**
 * Event data for MIDI note off messages
 */
export type NoteOffEvent = {
  /** MIDI note number (0-127) */
  note: number;
};

/**
 * Base type for events with a numeric value
 */
type ValueEvent = {
  /** The value associated with the event */
  value: number;
};

/**
 * Event data for MIDI pitch bend messages
 * Value ranges from -1.0 (maximum down) to +1.0 (maximum up), with 0.0 being center
 */
export type PitchBendEvent = ValueEvent;

/**
 * Event data for MIDI sustain pedal messages
 * Value is the raw MIDI value (0-127)
 */
export type SustainEvent = ValueEvent;

/**
 * Information about a MIDI input device
 */
export type MIDIInputInfo = {
  /** Unique identifier for the device */
  id: string;
  /** Human-readable name of the device */
  name: string;
  /** Device manufacturer name */
  manufacturer: string;
  /** Current connection state */
  state: 'connected' | 'disconnected';
};

/**
 * Represents a MIDI input device with enable/disable functionality.
 * 
 * @example
 * ```typescript
 * // Get all available inputs
 * const inputs = HuMIDI.getInputs();
 * 
 * // Disable a specific input
 * const pianInput = inputs.find(input => input.name.includes('Piano'));
 * pianInput?.disable();
 * 
 * // Check if input is enabled
 * if (pianInput?.isEnabled()) {
 *   console.log('Piano input is active');
 * }
 * ```
 */
export class MIDIInput {
  public readonly info: MIDIInputInfo;
  private enabled: boolean = true;

  constructor(info: MIDIInputInfo) {
    this.info = info;
  }

  /**
   * Enable this MIDI input device.
   * When enabled, MIDI messages from this device will be processed and trigger events.
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * Disable this MIDI input device.
   * When disabled, MIDI messages from this device will be ignored.
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * Check if this MIDI input device is currently enabled.
   * @returns True if the device is enabled, false otherwise
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Unique identifier for this MIDI input device
   */
  public get id(): string {
    return this.info.id;
  }

  /**
   * Human-readable name of this MIDI input device
   */
  public get name(): string {
    return this.info.name;
  }

  /**
   * Manufacturer name of this MIDI input device
   */
  public get manufacturer(): string {
    return this.info.manufacturer;
  }

  /**
   * Current connection state of this MIDI input device
   */
  public get state(): 'connected' | 'disconnected' {
    return this.info.state;
  }
}

/**
 * Event data for MIDI input device connection/disconnection
 */
export type InputEvent = {
  /** The MIDI input device that was connected or disconnected */
  input: MIDIInput;
};

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


/**
 * HuMIDI - A human-friendly MIDI library for the Web MIDI API
 * 
 * Provides a simple event-driven interface for working with MIDI input devices,
 * including automatic device management, note tracking for stuck note prevention,
 * and per-device enable/disable functionality.
 * 
 * @example Basic Usage
 * ```typescript
 * import HuMIDI from 'humidi';
 * 
 * // Request MIDI access
 * await HuMIDI.requestAccess();
 * 
 * // Listen for note events
 * HuMIDI.on('noteon', (event) => {
 *   console.log(`Note ${event.note} played with velocity ${event.velocity}`);
 * });
 * 
 * HuMIDI.on('noteoff', (event) => {
 *   console.log(`Note ${event.note} released`);
 * });
 * ```
 * 
 * @example Device Management
 * ```typescript
 * // Get all available input devices
 * const inputs = HuMIDI.getInputs();
 * 
 * // Disable a specific device
 * const piano = inputs.find(input => input.name.includes('Piano'));
 * piano?.disable();
 * 
 * // Listen for device connections
 * HuMIDI.on('inputconnected', (event) => {
 *   console.log(`Device connected: ${event.input.name}`);
 * });
 * ```
 * 
 * @example Channel-Specific Events
 * ```typescript
 * // Listen to events on channel 1 only
 * HuMIDI.on('noteon', (event) => {
 *   console.log('Note on channel 1:', event.note);
 * }, 1);
 * 
 * // Listen to all channels (default)
 * HuMIDI.on('noteon', (event) => {
 *   console.log('Note on any channel:', event.note);
 * });
 * ```
 */
export default class HuMIDI {
  private static eventHandlersByChannel: Map<Channel, Map<Event, Set<EventHandler>>> | null = new Map();
  private static accessStatus:  AccessStatus = AccessStatus.UNREQUESTED;
  private static midiAccess: WebMidi.MIDIAccess | null = null;
  private static enabled: boolean = true;
  private static activeNotes: Map<Channel, Set<number>> = new Map();
  private static activeNotesByDevice: Map<string, Map<Channel, Set<number>>> = new Map();
  
  private static inputs: Map<string, MIDIInput> = new Map();
  private static readonly commandHandler: Record<Command, MidiMessageHandler> = {
    [Commands.NOTE_ON]: HuMIDI.onNoteOn,
    [Commands.NOTE_OFF]: HuMIDI.onNoteOff,
    [Commands.PITCH_BEND]: HuMIDI.onPitchBend,
    [Commands.CONTROL_CHANGE]: HuMIDI.onControlChange,
  };

  /**
   * Request access to MIDI devices from the browser.
   * This must be called before using any other MIDI functionality.
   * 
   * @throws {Error} When MIDI access is denied by the user or not supported
   * 
   * @example
   * ```typescript
   * try {
   *   await HuMIDI.requestAccess();
   *   console.log('MIDI access granted');
   * } catch (error) {
   *   console.error('MIDI access denied:', error.message);
   * }
   * ```
   */
  static async requestAccess(): Promise<void> {
    if (HuMIDI.accessStatus !== AccessStatus.UNREQUESTED) {
      return;
    }

    try {
      HuMIDI.midiAccess = await navigator.requestMIDIAccess();
      HuMIDI.accessStatus = AccessStatus.ACCEPTED;
      HuMIDI.enabled = true;
    } catch (err) {
      HuMIDI.accessStatus = AccessStatus.DENIED;
      throw new Error('MIDI permissions denied');
    }

    HuMIDI.setupInputHandlers();
    HuMIDI.midiAccess.onstatechange = HuMIDI.onStateChange;
  }

  private static setupInputHandlers() {
    if (!HuMIDI.midiAccess) return;
    
    HuMIDI.midiAccess.inputs.forEach(input => {
      const inputId = input.id || 'unknown';
      const inputInfo: MIDIInputInfo = {
        id: inputId,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state as 'connected' | 'disconnected',
      };
      
      let midiInput = HuMIDI.inputs.get(inputId);
      if (!midiInput) {
        midiInput = new MIDIInput(inputInfo);
        HuMIDI.inputs.set(inputId, midiInput);
      }
      
      input.onmidimessage = (msg) => HuMIDI.onMessage(msg, inputId);
    });
  }

  private static onStateChange(event: WebMidi.MIDIConnectionEvent) {
    // Only handle input devices
    if (event.port.type !== 'input') return;

    const inputInfo: MIDIInputInfo = {
      id: event.port.id || 'unknown',
      name: event.port.name || 'Unknown Device',
      manufacturer: event.port.manufacturer || 'Unknown',
      state: event.port.state as 'connected' | 'disconnected',
    };

    if (event.port.state === 'connected') {
      let midiInput = HuMIDI.inputs.get(inputInfo.id);
      if (!midiInput) {
        midiInput = new MIDIInput(inputInfo);
        HuMIDI.inputs.set(inputInfo.id, midiInput);
      }
      
      HuMIDI.emit<InputEvent>(Event.INPUT_CONNECTED, { input: midiInput });
      
      const inputPort = event.port as WebMidi.MIDIInput;
      inputPort.onmidimessage = (msg) => HuMIDI.onMessage(msg, inputInfo.id);
      return;
    }
    
    if (event.port.state === 'disconnected') {
      let midiInput = HuMIDI.inputs.get(inputInfo.id);
      if (!midiInput) {
        // Create input object for disconnection event even if not previously tracked
        midiInput = new MIDIInput(inputInfo);
        HuMIDI.inputs.set(inputInfo.id, midiInput);
      }
      
      // Send note off for all active notes from this device to prevent stuck notes
      HuMIDI.handleDeviceDisconnect(inputInfo.id);
      HuMIDI.emit<InputEvent>(Event.INPUT_DISCONNECTED, { input: midiInput });
    }
  }

  /**
   * Get the current MIDI access status
   * @returns The current access status
   */
  public static getAccessStatus(): AccessStatus {
    return HuMIDI.accessStatus;
  }

  /**
   * Check if MIDI permissions have been granted without requesting access.
   * This uses the Permissions API to query the current permission state.
   * 
   * @returns Promise that resolves to true if MIDI permissions are granted, false otherwise
   * 
   * @example
   * ```typescript
   * const hasPermissions = await HuMIDI.hasPermissions();
   * if (hasPermissions) {
   *   console.log('MIDI permissions already granted');
   * } else {
   *   console.log('Need to request MIDI permissions');
   * }
   * ```
   */
  public static async hasPermissions(): Promise<boolean> {
    if (!navigator.permissions) {
      return false;
    }

    try {
      const result = await navigator.permissions.query({ name: "midi" as PermissionName });
      return result.state === "granted";
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable or disable all MIDI processing.
   * When disabled, all MIDI messages will be ignored.
   * 
   * @param enabled - True to enable MIDI processing, false to disable
   * 
   * @example
   * ```typescript
   * // Temporarily disable all MIDI input
   * HuMIDI.setEnabled(false);
   * 
   * // Re-enable MIDI input
   * HuMIDI.setEnabled(true);
   * ```
   */
  public static setEnabled(enabled: boolean): void {
    HuMIDI.enabled = enabled;
  }

  /**
   * Check if MIDI processing is currently enabled
   * @returns True if MIDI processing is enabled, false otherwise
   */
  public static isEnabled(): boolean {
    return HuMIDI.enabled;
  }

  /**
   * Get all available MIDI input devices
   * 
   * @returns Array of MIDIInput objects representing connected input devices
   * 
   * @example
   * ```typescript
   * const inputs = HuMIDI.getInputs();
   * console.log('Available MIDI inputs:');
   * inputs.forEach(input => {
   *   console.log(`- ${input.name} by ${input.manufacturer}`);
   * });
   * ```
   */
  public static getInputs(): MIDIInput[] {
    return Array.from(HuMIDI.inputs.values());
  }

  private static trackNoteOn(channel: number, note: number, deviceId?: string) {
    // Track globally (for backward compatibility)
    if (!HuMIDI.activeNotes.has(channel)) {
      HuMIDI.activeNotes.set(channel, new Set());
    }
    HuMIDI.activeNotes.get(channel)!.add(note);
    
    // Track per device
    if (deviceId) {
      if (!HuMIDI.activeNotesByDevice.has(deviceId)) {
        HuMIDI.activeNotesByDevice.set(deviceId, new Map());
      }
      const deviceNotes = HuMIDI.activeNotesByDevice.get(deviceId)!;
      if (!deviceNotes.has(channel)) {
        deviceNotes.set(channel, new Set());
      }
      deviceNotes.get(channel)!.add(note);
    }
  }

  private static trackNoteOff(channel: number, note: number, deviceId?: string) {
    // Track globally (for backward compatibility)
    const channelNotes = HuMIDI.activeNotes.get(channel);
    if (channelNotes) {
      channelNotes.delete(note);
      if (channelNotes.size === 0) {
        HuMIDI.activeNotes.delete(channel);
      }
    }
    
    // Track per device
    if (deviceId) {
      const deviceNotes = HuMIDI.activeNotesByDevice.get(deviceId);
      if (deviceNotes) {
        const deviceChannelNotes = deviceNotes.get(channel);
        if (deviceChannelNotes) {
          deviceChannelNotes.delete(note);
          if (deviceChannelNotes.size === 0) {
            deviceNotes.delete(channel);
          }
        }
        if (deviceNotes.size === 0) {
          HuMIDI.activeNotesByDevice.delete(deviceId);
        }
      }
    }
  }

  private static handleDeviceDisconnect(deviceId: string) {
    const deviceNotes = HuMIDI.activeNotesByDevice.get(deviceId);
    if (!deviceNotes) return;

    // Send note off events for all active notes from this device
    deviceNotes.forEach((notes, channel) => {
      notes.forEach(note => {
        HuMIDI.emit<NoteOffEvent>(
          Event.NOTE_OFF,
          { note },
          channel,
        );
      });
    });

    // Clear the device's note tracking
    HuMIDI.activeNotesByDevice.delete(deviceId);
  }

  /**
   * Reset the HuMIDI library to its initial state.
   * This clears all event handlers, resets access status, and clears device tracking.
   * Useful for testing or when you need to reinitialize the library.
   * 
   * @example
   * ```typescript
   * // Reset everything
   * HuMIDI.reset();
   * 
   * // Now you can request access again
   * await HuMIDI.requestAccess();
   * ```
   */
  public static reset(): void {
    this.eventHandlersByChannel = null;
    this.accessStatus = AccessStatus.UNREQUESTED;
    this.midiAccess = null;
    this.enabled = true;
    this.activeNotes.clear();
    this.activeNotesByDevice.clear();
    this.inputs.clear();
  }

  /**
   * Register an event handler for MIDI events
   * 
   * @param event - The MIDI event type to listen for
   * @param handler - Function to call when the event occurs
   * @param channel - MIDI channel to listen on (-1 for all channels, 0-15 for specific channels)
   * 
   * @example
   * ```typescript
   * // Listen for note events on all channels
   * HuMIDI.on('noteon', (event) => {
   *   console.log(`Note ${event.note} pressed with velocity ${event.velocity}`);
   * });
   * 
   * // Listen for note events on channel 1 only
   * HuMIDI.on('noteon', (event) => {
   *   console.log(`Channel 1 note: ${event.note}`);
   * }, 1);
   * 
   * // Listen for input device connections
   * HuMIDI.on('inputconnected', (event) => {
   *   console.log(`New device: ${event.input.name}`);
   * });
   * ```
   */
  public static on<T = any>(event: Event, handler: EventHandler<T>, channel = -1): void {
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

  /**
   * Remove an event handler
   * 
   * @param event - The MIDI event type
   * @param handler - The handler function to remove
   * @param channel - MIDI channel the handler was registered for (-1 for all channels)
   * 
   * @example
   * ```typescript
   * const noteHandler = (event) => console.log('Note:', event.note);
   * 
   * // Add handler
   * HuMIDI.on('noteon', noteHandler);
   * 
   * // Remove handler
   * HuMIDI.off('noteon', noteHandler);
   * ```
   */
  public static off(event: Event, handler: EventHandler, channel = -1): void {
    HuMIDI.getEventHandlers(event, channel)?.delete(handler);
  }

  /**
   * Remove all event handlers for a specific MIDI channel
   * 
   * @param channel - MIDI channel to unsubscribe from (0-15)
   * 
   * @example
   * ```typescript
   * // Remove all handlers for channel 1
   * HuMIDI.unsubscribeToChannel(1);
   * ```
   */
  public static unsubscribeToChannel(channel: number): void {
    HuMIDI.eventHandlersByChannel?.delete(channel);
  }

  private static emit<T>(event: Event, payload: T, channel = -1) {
    HuMIDI.getEventHandlers(event, channel)?.forEach(handler => handler(payload));
    if (channel !== -1) {
      HuMIDI.getEventHandlers(event, -1)?.forEach(handler => handler(payload));
    }
  }

  private static getEventHandlers(event: Event, channel = -1) {
    const channelHandlers = HuMIDI.eventHandlersByChannel?.get(channel);
    return channelHandlers?.get(event);
  }

  private static onMessage(midiMessage: WebMidi.MIDIMessageEvent, inputId?: string) {
    if (!HuMIDI.enabled) {
      return;
    }

    // Check if input is enabled
    if (inputId) {
      const input = HuMIDI.inputs.get(inputId);
      if (input && !input.isEnabled()) {
        return;
      }
    }

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

    // Pass device ID to note handlers for per-device tracking
    if (command === Commands.NOTE_ON) {
      (handler as any)(channel, data1, data2, inputId);
    } else if (command === Commands.NOTE_OFF) {
      (handler as any)(channel, data1, inputId);
    } else {
      handler(channel, data1, data2);
    }
  }

  private static onNoteOn(channel: number, note: number, velocity: number, deviceId?: string) {
    // not really spec, but some keyboards send note on with no velocity as note off events
    if (!velocity) {
      HuMIDI.onNoteOff(channel, note, deviceId);
      return;
    }

    HuMIDI.trackNoteOn(channel, note, deviceId);
    HuMIDI.emit<NoteOnEvent>(
      Event.NOTE_ON,
      { note, velocity },
      channel,
    );
  }

  private static onNoteOff(channel: number, note: number, deviceId?: string) {
    HuMIDI.trackNoteOff(channel, note, deviceId);
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
