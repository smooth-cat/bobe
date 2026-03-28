import { Computed } from './computed';
import { Effect } from './effect';
import { Scope } from './scope';
import { Signal } from './signal';


export type SignalNode = Partial<Signal & Effect & Scope & Computed>;
export type Link = {
  execId: number;
  up: SignalNode;
  down: SignalNode;
  nextEmitLine: Link;
  prevEmitLine: Link;
  nextRecLine: Link;
  prevRecLine: Link;
};

export type OutLink = Link & {
  nextOutLink: OutLink;
  prevOutLink: OutLink;
};



export type SideEffect = Effect | Computed;
