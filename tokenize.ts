import { JsonToken, JSONLexer } from "./json.ts";
export class LexerStream extends TransformStream<string, JsonToken[]> {
  constructor() {
    let lexer = new JSONLexer();
    super({
      transform(chunk, controller) {
        let buffer = Array.from(chunk);
        while (buffer.length > 0) {
          const tokens = lexer.analyze(buffer);
          controller.enqueue(tokens);
          if (lexer.done) {
            const result = lexer.end();
            controller.enqueue(result.tokens);

            lexer = new JSONLexer();
            buffer = result.buffer;
          }
        }
      },
      flush(controller) {
        const { tokens, buffer } = lexer.end();
        controller.enqueue(tokens);

        if (buffer[0] != "EOF") {
          throw new Error("Unexpected EOF");
        }
      },
    });
  }
}
