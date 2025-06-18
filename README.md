# humidi

Simple and lightweight MIDI library for humans. Zero dependencies, less than 5kB gzipped.

Currently handles simple use cases for note event.

```typescript
import HuMIDI, {
	type NoteOnEvent,
	type NoteOffEvent,
    type PitchBendEvent,
} from 'humidi';
// request midi access
HuMIDI.requestAccess().then(() => console.log('MIDI permissions accepted');

// listen for note presses
HuMIDI.on('noteon', (noteEvent: NoteOnEvent) => {
	console.log(`Note ${note} pressed with velocity ${velocity}`);
});

// listen for note releases
HuMIDI.on('noteoff', (noteEvent: NoteOffEvent) => {
	console.log(`Note ${note} released`);
});

// listen for note presses only on channel0
HuMIDI.on('noteon', console.log, 0);

// unsubscribe to all listeners on channel0
HuMIDI.unsubscribeToChannel(0);

// listen for pitch bends
HuMIDI.on('pitchbend', (pitchBendEvent: PitchBendEvent) => {
    console.log(`${pitchBendEvent.value * 100}% pitch bend`);
});
```
