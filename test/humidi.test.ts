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

const mockMIDIAccess = {
  inputs: new Map([['input1', mockMIDIInput]]),
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
  })
});

function dispatchMidi(status: number, data1: number, data2: number) {
  mockMIDIInput.onmidimessage({
    data: new Uint8Array([status, data1, data2])
  });
}
