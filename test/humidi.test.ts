import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';
import HuMIDI, { AccessStatus } from '@/humidi';


interface PitchBendTestCase {
  msb: number;
  lsb: number;
  expected: number;
  description: string;
}

const mockMIDIInput = {
  onmidimessage: null as any,
};

const mockMIDIInput2 = {
  onmidimessage: null as any,
  id: 'input2',
  name: 'Test Input 2',
  manufacturer: 'Test Manufacturer',
  type: 'input',
  state: 'connected',
};

const mockMIDIOutput = {
  id: 'output1',
  name: 'Test Output',
  manufacturer: 'Test Manufacturer',
  type: 'output',
  state: 'connected',
};

const mockMIDIAccess = {
  inputs: new Map([
    ['input1', { ...mockMIDIInput, id: 'input1', name: 'Test Input 1', manufacturer: 'Test Manufacturer', type: 'input', state: 'connected' }],
    ['input2', mockMIDIInput2]
  ]),
  outputs: new Map([['output1', mockMIDIOutput]]),
  onstatechange: null as any,
};


const testCases: PitchBendTestCase[] = [
  { msb: 0, lsb: 0, expected: 0, description: "should handle maximum pitch bend down" },
  { msb: 127, lsb: 127, expected: 16383, description: "should handle maximum pitch bend up" },
  { msb: 64, lsb: 0, expected: 8192, description: "should handle no pitch bend" },
  { msb: 32, lsb: 0, expected: 4096, description: "should handle quarter range down" },
  { msb: 96, lsb: 0, expected: 12288, description: "should handle quarter range up" },
  { msb: 63, lsb: 127, expected: 8191, description: "should handle just below center" },
  { msb: 64, lsb: 1, expected: 8193, description: "should handle just above center" },
] as const;


describe('HuMIDI', () => {
  beforeEach(() => {
    navigator.requestMIDIAccess = vi.fn();
    if (!navigator.permissions) {
      Object.defineProperty(navigator, 'permissions', {
        value: { query: vi.fn() },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator.permissions, 'query');
    }
    HuMIDI.reset();
    vi.clearAllMocks();
    mockMIDIInput.onmidimessage = null;
  });

  describe('requestAccess', () => {
    it('should request MIDI access successfully', async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);

      await HuMIDI.requestAccess();

      expect(navigator.requestMIDIAccess).toHaveBeenCalled();
      expect(HuMIDI.getAccessStatus()).toBe(AccessStatus.ACCEPTED);
      const input1 = mockMIDIAccess.inputs.get('input1') as any;
      expect(input1.onmidimessage).not.toBeNull();
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

  describe('events', () => {
    beforeEach(async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);
      await HuMIDI.requestAccess();
    });

    describe('notes', () => {
      it('should register and trigger noteon event handlers', () => {
        const handler = vi.fn();
        HuMIDI.on('noteon', handler, 0);

        dispatchMidi(144, 60, 100);

        expect(handler).toHaveBeenCalledWith({
          note: 60,
          velocity: 100,
        });
      });

      it('should register and trigger noteoff event handlers', () => {
        const handler = vi.fn();
        HuMIDI.on('noteoff', handler, 0);

        dispatchMidi(128, 60, 0);

        expect(handler).toHaveBeenCalledWith({
          note: 60,
        });
      });

      it('should handle noteon with zero velocity as noteoff', () => {
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler, 0);

        dispatchMidi(144, 60, 0);

        expect(noteOffHandler).toHaveBeenCalledWith({
          note: 60,
        });
      });

      it('should remove event handlers with off method', () => {
        const handler = vi.fn();

        HuMIDI.on('noteon', handler, 0);
        HuMIDI.off('noteon', handler, 0);

        dispatchMidi(144, 60, 100);

        expect(handler).not.toHaveBeenCalled();
      });
    });


    describe('channels', () => {
      it('should handle channel-specific events', () => {
        const channel0Handler = vi.fn();
        const channel5Handler = vi.fn();

        HuMIDI.on('noteon', channel0Handler, 0);
        HuMIDI.on('noteon', channel5Handler, 5);

        dispatchMidi(149, 60, 100);

        expect(channel0Handler).not.toHaveBeenCalled();
        expect(channel5Handler).toHaveBeenCalled();
      });

      it('should register for all channels if none is provided', () => {
        const handler = vi.fn();

        HuMIDI.on('noteon', handler);

        dispatchMidi(144, 60, 100);
        dispatchMidi(149, 60, 100);


        expect(handler).toHaveBeenCalledTimes(2);
      });

      it('should unsubscribe all events for channel with unsubscribeChannel', () => {
        const channel0Handlers = [vi.fn(), vi.fn()];
        const channel1Handler = vi.fn();
        const channel2Handler = vi.fn();

        HuMIDI.on('noteon', channel0Handlers[0], 0);
        HuMIDI.on('noteon', channel0Handlers[1], 0);
        HuMIDI.on('noteon', channel1Handler, 1);
        HuMIDI.on('noteon', channel2Handler, 2);

        HuMIDI.unsubscribeToChannel(0);

        dispatchAllChannels();

        expect(channel0Handlers[0]).not.toHaveBeenCalled();
        expect(channel0Handlers[1]).not.toHaveBeenCalled();
        expect(channel1Handler).toHaveBeenCalled();
        expect(channel2Handler).toHaveBeenCalled();

        function dispatchAllChannels() {
          dispatchMidi(144, 60, 100);
          dispatchMidi(145, 60, 100);
          dispatchMidi(146, 60, 100);
        }
      });
    });



    it('should handle multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      HuMIDI.on('noteon', handler1, 0);
      HuMIDI.on('noteon', handler2, 0);

      dispatchMidi(144, 60, 100);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });


    describe('pitch bend events', () => {
      testCases.forEach(tc => {
        it(tc.description, () => {
          const handler = vi.fn();
          HuMIDI.on('pitchbend', handler);

          dispatchMidi(224, tc.lsb, tc.msb);

          expect(handler).toHaveBeenCalledWith({
            value: normalize14BitValue(tc.expected),
          });
        });
      });

      function normalize14BitValue(val: number): number {
        return (val - 8192) / 8192;
      }
    });

    describe('sustain events', () => {
      it('should trigger sustainon event when control value is 64 or greater', () => {
        const handler = vi.fn();
        HuMIDI.on('sustainon', handler, 0);

        dispatchMidi(176, 64, 127);

        expect(handler).toHaveBeenCalledWith({
          value: 127,
        });
      });

      it('should trigger sustainoff event when control value is less than 64', () => {
        const handler = vi.fn();
        HuMIDI.on('sustainoff', handler, 0);

        dispatchMidi(176, 64, 0);

        expect(handler).toHaveBeenCalledWith({
          value: 0,
        });
      });

      it('should handle sustain on boundary condition (value = 64)', () => {
        const onHandler = vi.fn();
        const offHandler = vi.fn();
        HuMIDI.on('sustainon', onHandler, 0);
        HuMIDI.on('sustainoff', offHandler, 0);

        dispatchMidi(176, 64, 64);

        expect(onHandler).toHaveBeenCalledWith({ value: 64 });
        expect(offHandler).not.toHaveBeenCalled();
      });

      it('should handle sustain off boundary condition (value = 63)', () => {
        const onHandler = vi.fn();
        const offHandler = vi.fn();
        HuMIDI.on('sustainon', onHandler, 0);
        HuMIDI.on('sustainoff', offHandler, 0);

        dispatchMidi(176, 64, 63);

        expect(offHandler).toHaveBeenCalledWith({ value: 63 });
        expect(onHandler).not.toHaveBeenCalled();
      });

      it('should handle sustain events on different channels', () => {
        const channel0Handler = vi.fn();
        const channel1Handler = vi.fn();
        const allChannelsHandler = vi.fn();

        HuMIDI.on('sustainon', channel0Handler, 0);
        HuMIDI.on('sustainon', channel1Handler, 1);
        HuMIDI.on('sustainon', allChannelsHandler);

        dispatchMidi(176, 64, 127);
        dispatchMidi(177, 64, 100);

        expect(channel0Handler).toHaveBeenCalledWith({ value: 127 });
        expect(channel1Handler).toHaveBeenCalledWith({ value: 100 });
        expect(allChannelsHandler).toHaveBeenCalledTimes(2);
      });

      it('should remove sustain event handlers with off method', () => {
        const onHandler = vi.fn();
        const offHandler = vi.fn();

        HuMIDI.on('sustainon', onHandler, 0);
        HuMIDI.on('sustainoff', offHandler, 0);
        HuMIDI.off('sustainon', onHandler, 0);
        HuMIDI.off('sustainoff', offHandler, 0);

        dispatchMidi(176, 64, 127);
        dispatchMidi(176, 64, 0);

        expect(onHandler).not.toHaveBeenCalled();
        expect(offHandler).not.toHaveBeenCalled();
      });

      it('should handle multiple sustain state changes', () => {
        const onHandler = vi.fn();
        const offHandler = vi.fn();

        HuMIDI.on('sustainon', onHandler);
        HuMIDI.on('sustainoff', offHandler);

        dispatchMidi(176, 64, 127);
        dispatchMidi(176, 64, 0);
        dispatchMidi(176, 64, 100);
        dispatchMidi(176, 64, 50);

        expect(onHandler).toHaveBeenCalledTimes(2);
        expect(offHandler).toHaveBeenCalledTimes(2);
        expect(onHandler).toHaveBeenNthCalledWith(1, { value: 127 });
        expect(offHandler).toHaveBeenNthCalledWith(1, { value: 0 });
        expect(onHandler).toHaveBeenNthCalledWith(2, { value: 100 });
        expect(offHandler).toHaveBeenNthCalledWith(2, { value: 50 });
      });
    });

    describe('enabled/disabled state', () => {
      beforeEach(async () => {
        (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);
        await HuMIDI.requestAccess();
      });

      it('should not trigger events when disabled', () => {
        const handler = vi.fn();
        HuMIDI.on('noteon', handler, 0);
        
        HuMIDI.setEnabled(false);
        dispatchMidi(144, 60, 100);
        
        expect(handler).not.toHaveBeenCalled();
      });

      it('should trigger events when re-enabled', () => {
        const handler = vi.fn();
        HuMIDI.on('noteon', handler, 0);
        
        HuMIDI.setEnabled(false);
        HuMIDI.setEnabled(true);
        dispatchMidi(144, 60, 100);
        
        expect(handler).toHaveBeenCalled();
      });

      it('should return current enabled state', () => {
        expect(HuMIDI.isEnabled()).toBe(true);
        
        HuMIDI.setEnabled(false);
        expect(HuMIDI.isEnabled()).toBe(false);
        
        HuMIDI.setEnabled(true);
        expect(HuMIDI.isEnabled()).toBe(true);
      });
    });
  });

  describe('hasPermissions', () => {
    it('should return true when permissions are granted', async () => {
      (navigator.permissions.query as any).mockResolvedValue({ state: 'granted' });
      
      const result = await HuMIDI.hasPermissions();
      
      expect(result).toBe(true);
      expect(navigator.permissions.query).toHaveBeenCalledWith({ name: 'midi' });
    });

    it('should return false when permissions are denied', async () => {
      (navigator.permissions.query as any).mockResolvedValue({ state: 'denied' });
      
      const result = await HuMIDI.hasPermissions();
      
      expect(result).toBe(false);
    });

    it('should return false when permissions are prompt', async () => {
      (navigator.permissions.query as any).mockResolvedValue({ state: 'prompt' });
      
      const result = await HuMIDI.hasPermissions();
      
      expect(result).toBe(false);
    });

    it('should return false when permissions API is not supported', async () => {
      Object.defineProperty(navigator, 'permissions', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      
      const result = await HuMIDI.hasPermissions();
      
      expect(result).toBe(false);
    });

    it('should return false when query throws an error', async () => {
      (navigator.permissions.query as any).mockRejectedValue(new Error('Not supported'));
      
      const result = await HuMIDI.hasPermissions();
      
      expect(result).toBe(false);
    });
  });

  describe('device hot-plugging', () => {
    beforeEach(async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);
      await HuMIDI.requestAccess();
    });

    it('should setup statechange handler on access', () => {
      expect(mockMIDIAccess.onstatechange).not.toBeNull();
    });

    it('should setup message handler for newly connected input devices', () => {
      const newInput = { onmidimessage: null as any };
      const connectionEvent = {
        port: {
          type: 'input',
          state: 'connected',
          onmidimessage: null as any,
        }
      };

      mockMIDIAccess.onstatechange(connectionEvent);

      expect(connectionEvent.port.onmidimessage).not.toBeNull();
    });

    it('should not setup handler for output devices', () => {
      const connectionEvent = {
        port: {
          type: 'output',
          state: 'connected',
          onmidimessage: null as any,
        }
      };

      mockMIDIAccess.onstatechange(connectionEvent);

      expect(connectionEvent.port.onmidimessage).toBeNull();
    });

    it('should not setup handler for disconnected devices', () => {
      const connectionEvent = {
        port: {
          type: 'input',
          state: 'disconnected',
          onmidimessage: null as any,
        }
      };

      mockMIDIAccess.onstatechange(connectionEvent);

      expect(connectionEvent.port.onmidimessage).toBeNull();
    });

    it('should handle messages from hot-plugged devices', () => {
      const handler = vi.fn();
      HuMIDI.on('noteon', handler, 0);

      const newInput = { onmidimessage: null as any };
      const connectionEvent = {
        port: {
          type: 'input',
          state: 'connected',
          onmidimessage: null as any,
        }
      };

      mockMIDIAccess.onstatechange(connectionEvent);

      connectionEvent.port.onmidimessage({
        data: new Uint8Array([144, 60, 100])
      });

      expect(handler).toHaveBeenCalledWith({
        note: 60,
        velocity: 100,
      });
    });
  });

  describe('input management', () => {
    beforeEach(async () => {
      (navigator.requestMIDIAccess as any).mockResolvedValue(mockMIDIAccess);
      await HuMIDI.requestAccess();
    });

    describe('getInputs', () => {
      it('should return empty array when no access', () => {
        HuMIDI.reset();
        const inputs = HuMIDI.getInputs();
        expect(inputs).toEqual([]);
      });

      it('should return list of input devices only', () => {
        const inputs = HuMIDI.getInputs();
        
        expect(inputs).toHaveLength(2); // Only inputs, no outputs
        
        const input1 = inputs.find(i => i.id === 'input1');
        const input2 = inputs.find(i => i.id === 'input2');
        
        expect(input1?.name).toBe('Test Input 1');
        expect(input1?.manufacturer).toBe('Test Manufacturer');
        expect(input1?.state).toBe('connected');
        
        expect(input2?.name).toBe('Test Input 2');
        expect(input2?.manufacturer).toBe('Test Manufacturer');
        expect(input2?.state).toBe('connected');
      });

      it('should allow enabling and disabling inputs', () => {
        const inputs = HuMIDI.getInputs();
        const input1 = inputs.find(i => i.id === 'input1');
        
        expect(input1?.isEnabled()).toBe(true);
        
        input1?.disable();
        expect(input1?.isEnabled()).toBe(false);
        
        input1?.enable();
        expect(input1?.isEnabled()).toBe(true);
      });
    });

    describe('input connection events', () => {
      it('should emit input connected event when input device connects', () => {
        const inputHandler = vi.fn();
        HuMIDI.on('inputconnected', inputHandler);

        const connectionEvent = {
          port: {
            id: 'newinput',
            name: 'New Input Device',
            manufacturer: 'New Manufacturer',
            type: 'input',
            state: 'connected',
            onmidimessage: null as any,
          }
        };

        mockMIDIAccess.onstatechange(connectionEvent);

        expect(inputHandler).toHaveBeenCalled();
        const call = inputHandler.mock.calls[inputHandler.mock.calls.length - 1][0];
        expect(call.input.id).toBe('newinput');
        expect(call.input.name).toBe('New Input Device');
        expect(call.input.manufacturer).toBe('New Manufacturer');
        expect(call.input.state).toBe('connected');
      });

      it('should not emit events for output device connections', () => {
        const inputHandler = vi.fn();
        HuMIDI.on('inputconnected', inputHandler);

        const connectionEvent = {
          port: {
            id: 'newoutput',
            name: 'New Output Device',
            manufacturer: 'New Manufacturer',
            type: 'output',
            state: 'connected',
          }
        };

        mockMIDIAccess.onstatechange(connectionEvent);

        expect(inputHandler).not.toHaveBeenCalled();
      });

      it('should emit input disconnected event', () => {
        const inputHandler = vi.fn();
        HuMIDI.on('inputdisconnected', inputHandler);

        const disconnectionEvent = {
          port: {
            id: 'disconnectedinput',
            name: 'Disconnected Device',
            manufacturer: 'Test Manufacturer',
            type: 'input',
            state: 'disconnected',
          }
        };

        mockMIDIAccess.onstatechange(disconnectionEvent);

        expect(inputHandler).toHaveBeenCalledTimes(1);
        const call = inputHandler.mock.calls[0][0];
        expect(call.input.id).toBe('disconnectedinput');
        expect(call.input.name).toBe('Disconnected Device');
        expect(call.input.manufacturer).toBe('Test Manufacturer');
        expect(call.input.state).toBe('disconnected');
      });

      it('should handle inputs with missing properties', () => {
        const inputHandler = vi.fn();
        HuMIDI.on('inputconnected', inputHandler);

        const connectionEvent = {
          port: {
            id: '',
            name: '',
            manufacturer: '',
            type: 'input',
            state: 'connected',
            onmidimessage: null as any,
          }
        };

        mockMIDIAccess.onstatechange(connectionEvent);

        expect(inputHandler).toHaveBeenCalledTimes(1);
        const call = inputHandler.mock.calls[0][0];
        expect(call.input.id).toBe('unknown');
        expect(call.input.name).toBe('Unknown Device');
        expect(call.input.manufacturer).toBe('Unknown');
        expect(call.input.state).toBe('connected');
      });

      it('should setup message handler for connected input devices but not outputs', () => {
        const inputEvent = {
          port: {
            id: 'newinput',
            name: 'New Input',
            manufacturer: 'Test',
            type: 'input',
            state: 'connected',
            onmidimessage: null as any,
          }
        };

        const outputEvent = {
          port: {
            id: 'newoutput',
            name: 'New Output',
            manufacturer: 'Test',
            type: 'output',
            state: 'connected',
          }
        };

        mockMIDIAccess.onstatechange(inputEvent);
        mockMIDIAccess.onstatechange(outputEvent);

        expect(inputEvent.port.onmidimessage).not.toBeNull();
        expect(outputEvent.port.onmidimessage).toBeUndefined();
      });

      it('should filter messages from disabled inputs', () => {
        const noteHandler = vi.fn();
        HuMIDI.on('noteon', noteHandler);

        const inputs = HuMIDI.getInputs();
        const input1 = inputs.find(i => i.id === 'input1');
        
        // Disable the input
        input1?.disable();

        // Try to send a MIDI message
        dispatchMidi(144, 60, 100);

        // Message should be filtered out
        expect(noteHandler).not.toHaveBeenCalled();

        // Re-enable and try again
        input1?.enable();
        dispatchMidi(144, 60, 100);

        // Now it should work
        expect(noteHandler).toHaveBeenCalledWith({
          note: 60,
          velocity: 100,
        });
      });
    });

    describe('per-device note tracking', () => {
      it('should track notes separately for different devices', () => {
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler);

        // Device 1 plays note 60
        const input1 = (mockMIDIAccess.inputs.get('input1') as any);
        input1.onmidimessage({
          data: new Uint8Array([144, 60, 100]) // Note on
        });

        // Device 2 plays the same note 60
        const input2 = (mockMIDIAccess.inputs.get('input2') as any);
        input2.onmidimessage({
          data: new Uint8Array([144, 60, 100]) // Note on
        });

        // Simulate device 1 disconnection
        const disconnectionEvent = {
          port: {
            id: 'input1',
            name: 'Test Input 1',
            manufacturer: 'Test Manufacturer',
            type: 'input',
            state: 'disconnected',
          }
        };

        mockMIDIAccess.onstatechange(disconnectionEvent);

        // Should only send note off for device 1's note, not device 2's
        expect(noteOffHandler).toHaveBeenCalledTimes(1);
        expect(noteOffHandler).toHaveBeenCalledWith({ note: 60 });
      });

      it('should handle multiple notes on same channel from different devices', () => {
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler);

        // Device 1 plays notes 60 and 64 on channel 0
        const input1 = (mockMIDIAccess.inputs.get('input1') as any);
        input1.onmidimessage({
          data: new Uint8Array([144, 60, 100]) // Note on
        });
        input1.onmidimessage({
          data: new Uint8Array([144, 64, 100]) // Note on
        });

        // Device 2 plays notes 62 and 67 on same channel 0
        const input2 = (mockMIDIAccess.inputs.get('input2') as any);
        input2.onmidimessage({
          data: new Uint8Array([144, 62, 100]) // Note on
        });
        input2.onmidimessage({
          data: new Uint8Array([144, 67, 100]) // Note on
        });

        // Simulate device 1 disconnection
        const disconnectionEvent = {
          port: {
            id: 'input1',
            name: 'Test Input 1',
            manufacturer: 'Test Manufacturer',
            type: 'input',
            state: 'disconnected',
          }
        };

        mockMIDIAccess.onstatechange(disconnectionEvent);

        // Should send note off for device 1's notes (60, 64) but not device 2's (62, 67)
        expect(noteOffHandler).toHaveBeenCalledTimes(2);
        
        const calls = noteOffHandler.mock.calls.map(call => call[0].note).sort();
        expect(calls).toEqual([60, 64]);
      });

      it('should handle notes on different channels from same device', () => {
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler);

        // Device 1 plays note 60 on channel 0 and note 64 on channel 1
        const input1 = (mockMIDIAccess.inputs.get('input1') as any);
        input1.onmidimessage({
          data: new Uint8Array([144, 60, 100]) // Channel 0, Note on
        });
        input1.onmidimessage({
          data: new Uint8Array([145, 64, 100]) // Channel 1, Note on
        });

        // Simulate device 1 disconnection
        const disconnectionEvent = {
          port: {
            id: 'input1',
            name: 'Test Input 1',
            manufacturer: 'Test Manufacturer',
            type: 'input',
            state: 'disconnected',
          }
        };

        mockMIDIAccess.onstatechange(disconnectionEvent);

        // Should send note off for both notes from device 1
        expect(noteOffHandler).toHaveBeenCalledTimes(2);
        
        const calls = noteOffHandler.mock.calls.map(call => call[0].note).sort();
        expect(calls).toEqual([60, 64]);
      });

      it('should not send note off events if device has no active notes', () => {
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler);

        // No notes played on any device

        // Simulate device 1 disconnection
        const disconnectionEvent = {
          port: {
            id: 'input1',
            name: 'Test Input 1',
            manufacturer: 'Test Manufacturer',
            type: 'input',
            state: 'disconnected',
          }
        };

        mockMIDIAccess.onstatechange(disconnectionEvent);

        // Should not send any note off events
        expect(noteOffHandler).not.toHaveBeenCalled();
      });

      it('should properly clean up device note tracking after disconnect', () => {
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler);

        // Device 1 plays a note
        const input1 = (mockMIDIAccess.inputs.get('input1') as any);
        input1.onmidimessage({
          data: new Uint8Array([144, 60, 100]) // Note on
        });

        // Simulate device 1 disconnection
        const disconnectionEvent = {
          port: {
            id: 'input1',
            name: 'Test Input 1',
            manufacturer: 'Test Manufacturer',
            type: 'input',
            state: 'disconnected',
          }
        };

        mockMIDIAccess.onstatechange(disconnectionEvent);

        // Clear the handler calls
        noteOffHandler.mockClear();

        // Simulate the same device disconnecting again
        mockMIDIAccess.onstatechange(disconnectionEvent);

        // Should not send any additional note off events since device tracking was cleaned up
        expect(noteOffHandler).not.toHaveBeenCalled();
      });

      it('should handle note off events properly with per-device tracking', () => {
        // Test that shows a note was played and released normally, so disconnect shouldn't trigger cleanup
        const noteOffHandler = vi.fn();
        HuMIDI.on('noteoff', noteOffHandler);

        // Play and release note on input1 (should track properly)
        const input1 = (mockMIDIAccess.inputs.get('input1') as any);
        
        // Note on
        input1.onmidimessage({
          data: new Uint8Array([144, 60, 100])
        });
        
        // Note off
        input1.onmidimessage({
          data: new Uint8Array([128, 60, 0])
        });
        
        // Should have called note off once for normal release
        expect(noteOffHandler).toHaveBeenCalledTimes(1);
        noteOffHandler.mockClear();

        // Now disconnect input1 - should NOT trigger stuck note cleanup
        const event = {
          port: {
            id: 'input1',
            type: 'input',
            state: 'disconnected',
            name: 'Test Input 1',
            manufacturer: 'Test Manufacturer'
          }
        };
        
        mockMIDIAccess.onstatechange(event);
        
        // Should not have been called again since note was already released
        expect(noteOffHandler).not.toHaveBeenCalled();
      });
    });
  });

});

function dispatchMidi(status: number, data1: number, data2: number) {
  const input1 = (mockMIDIAccess.inputs.get('input1') as any);
  if (input1?.onmidimessage) {
    input1.onmidimessage({
      data: new Uint8Array([status, data1, data2])
    });
  }
}
