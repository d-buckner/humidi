import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';
import HuMIDI from '../src/HuMIDI';


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
      expect(HuMIDI.getAccessStatus()).toBe('accepted');
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
  })
});

function dispatchMidi(status: number, data1: number, data2: number) {
  mockMIDIInput.onmidimessage({
    data: new Uint8Array([status, data1, data2])
  });
}
