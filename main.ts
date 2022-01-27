import { readableStreamFromReader as toStream } from "https://deno.land/std/streams/conversion.ts";
import { StreamingJSONLexer, JSONToken } from "./json.ts";

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

const lexer = new StreamingJSONLexer();
const stream = toStream(Deno.stdin)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(
    new TransformStream<string, JSONToken[]>({
      transform(chunk, controller) {
        controller.enqueue(lexer.analyze(Array.from(chunk)));
      },
      flush(controller) {
        controller.enqueue(lexer.analyze(["EOF"]));
      },
    })
  );

for await (const tokens of streamAsyncIterator(stream)) {
  tokens.forEach((token) => {
    console.log(token);
  });
}
