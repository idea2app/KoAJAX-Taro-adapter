export class Event implements globalThis.Event {
  constructor(
    public type: string,
    { bubbles, cancelable, composed = false }: EventInit = {}
  ) {
    this.initEvent(type, bubbles, cancelable);
    this.composed = composed;
  }

  NONE: 0;
  CAPTURING_PHASE: 1;
  AT_TARGET: 2;
  BUBBLING_PHASE: 3;

  bubbles: boolean;
  cancelable: boolean;
  cancelBubble = false;
  composed: boolean;
  defaultPrevented = false;
  eventPhase = 0;
  isTrusted = false;
  returnValue = true;
  srcElement: EventTarget | null = null;
  timeStamp = Date.now();

  initEvent(type: string, bubbles = false, cancelable = false) {
    Object.assign(this, { type, bubbles, cancelable });
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
      this.returnValue = false;
    }
  }

  stopPropagation() {
    this.cancelBubble = true;
  }

  stopImmediatePropagation() {
    this.stopPropagation;
  }

  get currentTarget() {
    return null;
  }

  get target() {
    return null;
  }

  composedPath() {
    return [];
  }
}

export class ProgressEvent<T extends EventTarget = EventTarget>
  extends Event
  implements globalThis.ProgressEvent
{
  get target(): T | null {
    return null;
  }

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
