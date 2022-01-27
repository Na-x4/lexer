import { readableStreamFromReader as toStream } from "https://deno.land/std/streams/conversion.ts";
import { LL1LexerStream } from "./ll1.ts";
import { JSONLexer } from "./json.ts";

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
  .pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(Array.from(chunk));
      },
    })
  )
  .pipeThrough(new LL1LexerStream(() => new JSONLexer()));

for await (const tokens of streamAsyncIterator(stream)) {
  tokens.forEach((token) => {
    console.log(token);
  });
}
