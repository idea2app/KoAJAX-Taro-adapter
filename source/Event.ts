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

export async function fromAsync<T>(
  iterableOrArrayLike:
    | AsyncIterable<T>
    | Iterable<T | PromiseLike<T>>
    | ArrayLike<T | PromiseLike<T>>
): Promise<T[]> {
  if (typeof iterableOrArrayLike[Symbol.asyncIterator] !== 'function')
    iterableOrArrayLike = Array.from(
      iterableOrArrayLike as ArrayLike<T | PromiseLike<T>>
    );
  const result: T[] = [];

  for await (const item of iterableOrArrayLike as Iterable<T | PromiseLike<T>>)
    result.push(item);

  return result;
}
