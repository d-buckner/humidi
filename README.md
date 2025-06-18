# humidi

Simple and lightweight MIDI library for humans. Zero dependencies, less than 5kB gzipped.

Currently handles simple use cases for note event.

```typescript
import HuMIDI, {
	type NoteOnEvent,
	type NoteOffEvent,
} from 'humidi';
// request midi access
await HuMIDI.requestAccess();

// listen to note presses
HuMIDI.on('noteon', (noteEvent: NoteOnEvent) => {
	console.log(`Note ${note} pressed with velocity ${velocity}`);
});

// listen to note releases
HuMIDI.on('noteoff', (noteEvent: NoteOffEvent) => {
	console.log(`Note ${note} released`);
});
```
