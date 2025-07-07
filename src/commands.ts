import type { ValueOf } from './utils';

/**
 * MIDI command constants
 *
 * ref: https://midi.org/expanded-midi-1-0-messages-list
**/

export const Commands = {
  NOTE_OFF: 'noteoff',
  NOTE_ON: 'noteon',
  PITCH_BEND: 'pitchbend',
  CONTROL_CHANGE: 'controlchange',
} as const;

export type Command = ValueOf<typeof Commands>;

export const commandIndex: Record<Command, number> = {
  [Commands.NOTE_OFF]: 128,
  [Commands.NOTE_ON]: 144,
  [Commands.CONTROL_CHANGE]: 176,
  [Commands.PITCH_BEND]: 224,
} as const;

export const commandTable: Record<string, Command> = {
  128: Commands.NOTE_OFF,
  129: Commands.NOTE_OFF,
  130: Commands.NOTE_OFF,
  131: Commands.NOTE_OFF,
  132: Commands.NOTE_OFF,
  133: Commands.NOTE_OFF,
  134: Commands.NOTE_OFF,
  135: Commands.NOTE_OFF,
  136: Commands.NOTE_OFF,
  137: Commands.NOTE_OFF,
  138: Commands.NOTE_OFF,
  139: Commands.NOTE_OFF,
  140: Commands.NOTE_OFF,
  141: Commands.NOTE_OFF,
  142: Commands.NOTE_OFF,
  143: Commands.NOTE_OFF,
  144: Commands.NOTE_ON,
  145: Commands.NOTE_ON,
  146: Commands.NOTE_ON,
  147: Commands.NOTE_ON,
  148: Commands.NOTE_ON,
  149: Commands.NOTE_ON,
  150: Commands.NOTE_ON,
  151: Commands.NOTE_ON,
  152: Commands.NOTE_ON,
  153: Commands.NOTE_ON,
  154: Commands.NOTE_ON,
  155: Commands.NOTE_ON,
  156: Commands.NOTE_ON,
  157: Commands.NOTE_ON,
  158: Commands.NOTE_ON,
  159: Commands.NOTE_ON,
  176: Commands.CONTROL_CHANGE,
  177: Commands.CONTROL_CHANGE,
  178: Commands.CONTROL_CHANGE,
  179: Commands.CONTROL_CHANGE,
  180: Commands.CONTROL_CHANGE,
  181: Commands.CONTROL_CHANGE,
  182: Commands.CONTROL_CHANGE,
  183: Commands.CONTROL_CHANGE,
  184: Commands.CONTROL_CHANGE,
  185: Commands.CONTROL_CHANGE,
  186: Commands.CONTROL_CHANGE,
  187: Commands.CONTROL_CHANGE,
  188: Commands.CONTROL_CHANGE,
  189: Commands.CONTROL_CHANGE,
  190: Commands.CONTROL_CHANGE,
  191: Commands.CONTROL_CHANGE,
  224: Commands.PITCH_BEND,
  225: Commands.PITCH_BEND,
  226: Commands.PITCH_BEND,
  227: Commands.PITCH_BEND,
  228: Commands.PITCH_BEND,
  229: Commands.PITCH_BEND,
  230: Commands.PITCH_BEND,
  231: Commands.PITCH_BEND,
  232: Commands.PITCH_BEND,
  233: Commands.PITCH_BEND,
  234: Commands.PITCH_BEND,
  235: Commands.PITCH_BEND,
  236: Commands.PITCH_BEND,
  237: Commands.PITCH_BEND,
  238: Commands.PITCH_BEND,
  239: Commands.PITCH_BEND,
} as const;
