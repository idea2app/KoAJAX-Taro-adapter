import { parseBody, parseHeaders, Request, RequestResult, Response } from "koajax";
import Blob from "miniprogram-blob";
import { fetch, Headers } from "taro-fetch-polyfill";
import { ReadableStream } from "web-streams-polyfill";

export function request<B>({
  path,
  method,
  headers,
  withCredentials,
  body,
  signal,
  timeout,
  responseType,
}: Request): RequestResult<B> {
  const signals = [signal, timeout && AbortSignal.timeout(timeout)].filter(Boolean);
  headers =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : headers instanceof Array
      ? Object.fromEntries(headers)
      : headers;
  headers =
    responseType === "text"
      ? { ...headers, Accept: "text/plain" }
      : responseType === "json"
      ? { ...headers, Accept: "application/json" }
      : responseType === "document"
      ? {
          ...headers,
          Accept: "text/html, application/xhtml+xml, application/xml",
        }
      : responseType === "arraybuffer" || responseType === "blob"
      ? { ...headers, Accept: "application/octet-stream" }
      : headers;

  const responsePromise = fetch(path + "", {
    method,
    headers,
    credentials: withCredentials ? "include" : "omit",
    body,
    signal: signals[0] && AbortSignal.any(signals),
  });

  return {
    response: parseResponse(responsePromise, responseType),
    download: iterateFetchBody(responsePromise),
  };
}

export async function parseResponse<B>(
  responsePromise: Promise<globalThis.Response>,
  responseType: Request["responseType"]
): Promise<Response<B>> {
  const { status, statusText, headers, body } = (await responsePromise).clone();

  const contentType = headers.get("Content-Type") || "";

  const header = parseHeaders([...headers].map(([key, value]) => `${key}: ${value}`).join("\n"));
  const rBody =
    status === 204
      ? undefined
      : await parseFetchBody<B>(body as ReadableStream<Uint8Array>, contentType, responseType);
  return { status, statusText, headers: header, body: rBody };
}

export async function parseFetchBody<B>(
  stream: ReadableStream<Uint8Array>,
  contentType: string,
  responseType: Request["responseType"]
) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of stream) chunks.push(chunk);

  const blob = new Blob(chunks, { type: contentType });

  if (responseType === "blob") return blob as B;

  if (responseType === "arraybuffer") return blob.arrayBuffer() as B;

  const text = await blob.text();

  if (responseType === "text") return text as B;

  return parseBody<B>(text, contentType);
}

export async function* iterateFetchBody(responsePromise: Promise<globalThis.Response>) {
  const { headers, body } = (await responsePromise).clone();

  const total = +headers.get("Content-Length");
  var loaded = 0;

  for await (const { byteLength } of body as ReadableStream<Uint8Array>) {
    loaded += byteLength;

    yield { total, loaded };
  }
}
