import type { ValueOf } from './utils';

export const ControlCommands = {
  SUSTAIN: 'sustain',
} as const;

export const ControllerCommands = {
  SUSTAIN_ON: 'sustainon',
  SUSTAIN_OFF: 'sustainoff',
} as const;


export type ControlCommand = ValueOf<typeof ControlCommands>;

export const controlCommandTable: Record<string, ControlCommand> = {
  64: ControlCommands.SUSTAIN,
};
