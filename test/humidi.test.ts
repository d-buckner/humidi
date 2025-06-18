import { describe, it, expect, vi, beforeEach } from 'vitest';
import HuMIDI from '../src/HuMIDI';


// Mock navigator with Web MIDI API
const mockMIDIInput = {
  onmidimessage: null as any,
};

const mockMIDIAccess = {
  inputs: new Map([['input1', mockMIDIInput]]),
};


describe('HuMIDI', () => {
  beforeEach(() => {
    navigator.requestMIDIAccess = vi.fn();
    // Reset static state
    (HuMIDI as any).eventHandlersByChannel = new Map();
    (HuMIDI as any).accessStatus = 'unrequested';
    (HuMIDI as any).midiAccess = undefined;

    vi.clearAllMocks();
    mockMIDIInput.onmidimessage = null;
  });

  describe('requestAccess', () => {
    it('should request MIDI access successfully', async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);

      await HuMIDI.requestAccess();

      expect(navigator.requestMIDIAccess).toHaveBeenCalled();
      expect(mockMIDIInput.onmidimessage).not.toBeNull();
    });

    it('should handle MIDI access denial', async () => {
      (navigator.requestMIDIAccess as any).mockRejectedValue(new Error('Access denied'));

      await expect(HuMIDI.requestAccess()).rejects.toThrow('MIDI permissions denied');
    });

    it('should not request access multiple times', async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);

      await HuMIDI.requestAccess();
      await HuMIDI.requestAccess();

      expect(navigator.requestMIDIAccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);
      await HuMIDI.requestAccess();
    });

    it('should register and trigger noteon event handlers', () => {
      const handler = vi.fn();
      HuMIDI.on('noteon', handler, 0);

      const midiMessage = {
        data: new Uint8Array([144, 60, 100]) // 0x90 + channel 0
      };
      mockMIDIInput.onmidimessage(midiMessage);

      expect(handler).toHaveBeenCalledWith({
        note: 60,
        velocity: 100,
      });
    });

    it('should register and trigger noteoff event handlers', () => {
      const handler = vi.fn();
      HuMIDI.on('noteoff', handler, 0);

      const midiMessage = {
        data: new Uint8Array([128, 60, 0]) // 0x80 + channel 0
      };
      mockMIDIInput.onmidimessage(midiMessage);

      expect(handler).toHaveBeenCalledWith({
        note: 60,
      });
    });

    it('should register and trigger pitchbend event handlers', () => {
      const handler = vi.fn();
      HuMIDI.on('pitchbend', handler, 0);

      const midiMessage = {
        data: new Uint8Array([224, 0, 64]) // 0xE0 + channel 0
      };
      mockMIDIInput.onmidimessage(midiMessage);

      expect(handler).toHaveBeenCalledWith({
        lsb: 0,
        msb: 64,
      });
    });

    it('should handle noteon with zero velocity as noteoff', () => {
      const noteOffHandler = vi.fn();
      HuMIDI.on('noteoff', noteOffHandler, 0);

      const midiMessage = {
        data: new Uint8Array([144, 60, 0])
      };
      mockMIDIInput.onmidimessage(midiMessage);

      expect(noteOffHandler).toHaveBeenCalledWith({
        note: 60,
      });
    });

    it('should handle channel-specific events', () => {
      const channel0Handler = vi.fn();
      const channel5Handler = vi.fn();

      HuMIDI.on('noteon', channel0Handler, 0);
      HuMIDI.on('noteon', channel5Handler, 5);

      const midiMessage0 = {
        data: new Uint8Array([149, 60, 100]) // Channel 1
      };
      mockMIDIInput.onmidimessage(midiMessage0);

      expect(channel0Handler).not.toHaveBeenCalled();
      expect(channel5Handler).toHaveBeenCalled();
    });

    it('should remove event handlers with off method', () => {
      const handler = vi.fn();

      HuMIDI.on('noteon', handler, 0);
      HuMIDI.off('noteon', handler, 0);

      const midiMessage = {
        data: new Uint8Array([144, 60, 100])
      };
      mockMIDIInput.onmidimessage(midiMessage);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      HuMIDI.on('noteon', handler1, 0);
      HuMIDI.on('noteon', handler2, 0);

      const midiMessage = {
        data: new Uint8Array([144, 60, 100])
      };
      mockMIDIInput.onmidimessage(midiMessage);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle multiple channels if none is provided', () => {
      const handler = vi.fn();

      HuMIDI.on('noteon', handler);

      mockMIDIInput.onmidimessage({
        data: new Uint8Array([144, 60, 100]) // channel 0
      });

      mockMIDIInput.onmidimessage({
        data: new Uint8Array([149, 60, 100]) // channel 5
      });


      expect(handler).toHaveBeenCalledTimes(2);
    });
  })
});
