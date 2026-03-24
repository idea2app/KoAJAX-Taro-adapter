import { EventTarget } from 'event-target-shim';
import {
  parseBody,
  parseHeaders,
  ProgressData,
  readBytes,
  Request,
  RequestResult,
  Response
} from 'koajax';
import { Blob, fetch, Headers } from 'taro-fetch-polyfill';
import { ReadableStream } from 'web-streams-polyfill';

import { fromAsync } from './Event';
import { emitStreamProgress, streamFromProgress } from './utility';

export * from './utility';

export function rawRequest<B>({
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

/**
 * Minimum byte count for magic-number–based file type detection,
 * consistent with the file-type library
 * {@link https://github.com/sindresorhus/file-type}.
 */
export const FILE_TYPE_MAGIC_NUMBER_SIZE = 4100;

export interface HeadResponse {
  headers: Response['headers'];
  /** First {@link FILE_TYPE_MAGIC_NUMBER_SIZE} bytes from the response body. */
  body?: ArrayBuffer;
}

/**
 * Sends a `HEAD` request, falling back to simulation when the server does
 * not support `HEAD`. Tries, in order:
 * 1. A standard `HEAD` request via `fetch()`.
 * 2. A `Range` GET to retrieve the first {@link FILE_TYPE_MAGIC_NUMBER_SIZE}
 *    bytes (magic-number file header).
 * 3. A plain `GET` that reads the first {@link FILE_TYPE_MAGIC_NUMBER_SIZE}
 *    bytes then cancels the body stream.
 */
export async function requestHead({
  path,
  headers,
  withCredentials,
  timeout,
  signal
}: Request): Promise<HeadResponse> {
  const normalizedHeaders: Record<string, string> = !headers
    ? {}
    : headers instanceof Headers
      ? Object.fromEntries(headers)
      : Array.isArray(headers)
        ? Object.fromEntries(headers)
        : (headers as Record<string, string>);

  const signals = [signal, timeout && AbortSignal.timeout(timeout)].filter(
    Boolean
  ) as AbortSignal[];

  const fetchOptions: globalThis.RequestInit = {
    credentials: withCredentials ? 'include' : 'omit',
    signal: signals[1] ? AbortSignal.any(signals) : signals[0]
  };
  const toHeaders = (raw: globalThis.Headers) =>
    parseHeaders([...raw].map(([k, v]) => `${k}: ${v}`).join('\n'));

  // Tier 1: fetch() HEAD
  try {
    const response = await fetch(path + '', {
      method: 'HEAD',
      ...fetchOptions,
      headers: normalizedHeaders
    });
    if (response.ok) return { headers: toHeaders(response.headers) };
  } catch {
    // HEAD not supported; fall through to simulation tiers
  }

  // Tier 2: Range GET – read magic-number bytes only
  try {
    const response = await fetch(path + '', {
      ...fetchOptions,
      headers: {
        ...normalizedHeaders,
        Range: `bytes=0-${FILE_TYPE_MAGIC_NUMBER_SIZE - 1}`
      }
    });
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);

    return {
      headers: toHeaders(response.headers),
      body: await response.arrayBuffer()
    };
  } catch {
    // Server does not support Range requests; fall back to plain GET
  }

  // Tier 3: plain GET – read magic-number bytes then cancel the body stream
  const response = await fetch(path, {
    ...fetchOptions,
    headers: normalizedHeaders
  });
  const body = await readBytes(
    response.body as ReadableStream<Uint8Array>,
    FILE_TYPE_MAGIC_NUMBER_SIZE
  );
  return { headers: toHeaders(response.headers), body };
}

/**
 * Sends a {@link Request}, with automatic HEAD-simulation fallback for
 * servers that do not support the `HEAD` method.
 */
export function request<B>(option: Request): RequestResult<B> {
  if (option.method !== 'HEAD') return rawRequest<B>(option);

  const response = requestHead(option).then(
    ({ headers, body }) =>
      ({
        status: 204,
        statusText: 'No Content',
        headers,
        body
      }) as Response<B>
  );
  return {
    response,
    download: (async function* (): AsyncGenerator<ProgressData> {})()
  };
}
