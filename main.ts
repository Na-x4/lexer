import { readableStreamFromReader as toStream } from "https://deno.land/std/streams/conversion.ts";
import { StreamingJSONParserStream } from "./json/parser.ts";

async function* streamAsyncIterator<R>(stream: ReadableStream<R>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) return;
      yield result.value;
    }
  } finally {
    reader.releaseLock();
  }
}

const stream = toStream(Deno.stdin)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new StreamingJSONParserStream());

for await (const value of streamAsyncIterator(stream)) {
  console.log(value);
}
