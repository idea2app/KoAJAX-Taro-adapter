import { EventTarget } from 'event-target-shim';
import fromAsync from 'core-js-pure/actual/array/from-async';
import {
  parseBody,
  parseHeaders,
  ProgressData,
  Request,
  RequestResult,
  Response
} from 'koajax';
import { Blob, fetch, Headers } from 'taro-fetch-polyfill';
import { ReadableStream } from 'web-streams-polyfill';

import { emitStreamProgress, streamFromProgress } from './utility';

export * from './utility';

export function request<B>({
  path,
  method,
  headers,
  withCredentials,
  body,
  signal,
  timeout,
  responseType
}: Request): RequestResult<B> {
  const signals = [signal, timeout && AbortSignal.timeout(timeout)].filter(
    Boolean
  );
  headers =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : headers instanceof Array
        ? Object.fromEntries(headers)
        : headers;
  headers =
    responseType === 'text'
      ? { ...headers, Accept: 'text/plain' }
      : responseType === 'json'
        ? { ...headers, Accept: 'application/json' }
        : responseType === 'document'
          ? {
              ...headers,
              Accept: 'text/html, application/xhtml+xml, application/xml'
            }
          : responseType === 'arraybuffer' || responseType === 'blob'
            ? { ...headers, Accept: 'application/octet-stream' }
            : headers;
  const isStream = body instanceof ReadableStream;
  var upload: AsyncGenerator<ProgressData> | undefined;

  if (isStream) {
    const uploadProgress = new EventTarget();

    body = ReadableStream.from(
      emitStreamProgress(
        body as ReadableStream<Uint8Array>,
        +headers['Content-Length'],
        uploadProgress
      )
    ) as ReadableStream<Uint8Array>;

    upload = streamFromProgress(uploadProgress);
  }
  const downloadProgress = new EventTarget();

  const response = fetch(path + '', {
    method,
    headers,
    credentials: withCredentials ? 'include' : 'omit',
    body,
    signal: signals[0] && AbortSignal.any(signals),
    // @ts-expect-error https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests
    duplex: isStream ? 'half' : undefined
  }).then(response =>
    parseResponse<B>(response, responseType, downloadProgress)
  );
  return { response, upload, download: streamFromProgress(downloadProgress) };
}

export async function parseResponse<B>(
  { status, statusText, headers, body }: import('taro-fetch-polyfill').Response,
  responseType: Request['responseType'],
  downloadProgress: EventTarget
): Promise<Response<B>> {
  const stream = ReadableStream.from(
    emitStreamProgress(
      body as ReadableStream<Uint8Array>,
      +headers.get('Content-Length'),
      downloadProgress
    )
  ) as ReadableStream<Uint8Array>;

  const contentType = headers.get('Content-Type') || '';

  const header = parseHeaders(
    [...headers].map(([key, value]) => `${key}: ${value}`).join('\n')
  );
  const rBody =
    status === 204
      ? undefined
      : await parseFetchBody<B>(stream, contentType, responseType);

  return { status, statusText, headers: header, body: rBody };
}

export async function parseFetchBody<B>(
  stream: ReadableStream<Uint8Array>,
  contentType: string,
  responseType: Request['responseType']
) {
  const blob = new Blob(await fromAsync(stream), { type: contentType });

  if (responseType === 'blob') return blob as B;

  if (responseType === 'arraybuffer') return blob.arrayBuffer() as B;

  const text = await blob.text();

  if (responseType === 'text') return text as B;

  return parseBody<B>(text, contentType);
}
