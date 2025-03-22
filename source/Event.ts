import { Event, EventTarget } from 'event-target-shim';

export class ProgressEvent<T extends EventTarget = EventTarget> extends Event {
  lengthComputable: boolean;
  total: number;
  loaded: number;

  constructor(
    type: string,
    { lengthComputable, total, loaded, ...meta }: ProgressEventInit = {}
  ) {
    super(type, meta);

    this.lengthComputable = lengthComputable;
    this.total = total;
    this.loaded = loaded;
  }
}
