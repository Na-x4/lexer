import { readableStreamFromReader as toStream } from "https://deno.land/std/streams/conversion.ts";
import { LexerStream } from "./tokenize.ts";

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

const t = new LexerStream();

const stream = toStream(Deno.stdin)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(t);

for await (const tokens of streamAsyncIterator(stream)) {
  tokens.forEach((token) => {
    console.log(token);
  });
}
