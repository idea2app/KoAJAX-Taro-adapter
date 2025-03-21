import { ProgressData, ProgressEventTarget } from 'koajax';
import { ReadableStream } from 'web-streams-polyfill';
import { createAsyncIterator } from 'web-utility';

import { ProgressEvent } from './Event';

export const streamFromProgress = <T extends ProgressEventTarget>(target: T) =>
  createAsyncIterator<ProgressData, ProgressEvent<T>>(
    ({ next, complete, error }) => {
      const handleProgress = ({ loaded, total }: ProgressEvent) => {
        next({ loaded, total });

        if (loaded >= total) complete();
      };
      target.addEventListener('progress', handleProgress);
      target.addEventListener('error', error);

      return () => {
        target.removeEventListener('progress', handleProgress);
        target.removeEventListener('error', error);
      };
    }
  );
export async function* emitStreamProgress(
  stream: ReadableStream<Uint8Array>,
  total: number,
  eventTarget: ProgressEventTarget
): AsyncGenerator<Uint8Array> {
  var loaded = 0;

  for await (const chunk of stream) {
    yield chunk;

    loaded += (chunk as Uint8Array).byteLength;

    const event = new ProgressEvent('progress', {
      lengthComputable: isNaN(total),
      loaded,
      total
    });
    eventTarget.dispatchEvent(event);
  }
}
