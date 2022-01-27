export type LL1LexerGenerator<I> = Generator<void, void, I[]>;
export type LL1LexerFunction<I, O> = (
  controller: LL1LexerController<I, O>
) => LL1LexerGenerator<I>;

type LL1LexerInstance<I, O> = {
  controller: LL1LexerController<I, O>;
  generator: LL1LexerGenerator<I>;
};
export class LL1Lexer<I, O> {
  #f;
  #instance: LL1LexerInstance<I, O> | null = null;
  #done = false;
  #eof: I;

  constructor(f: LL1LexerFunction<I, O>, eof: I) {
    this.#f = f;
    this.#eof = eof;
  }

  get done(): boolean {
    return this.#done;
  }

  analyze(input: I[]) {
    if (this.#done) {
      return [];
    }

    if (this.#instance === null) {
      const controller = new LL1LexerController<I, O>(input);
      let generator: LL1LexerGenerator<I>;

      if (input.length > 0) {
        generator = this.#f(controller);
      } else {
        const f = this.#f;
        generator = (function* (controller) {
          yield* controller.consume();
          return yield* f(controller);
        })(controller);
      }

      this.#instance = { controller, generator };
    }

    const { done } = this.#instance.generator.next(input);
    if (done) {
      this.#done = true;
    }

    return this.#instance.controller.moveTokens();
  }

  end() {
    if (this.#done && this.#instance !== null) {
      const buffer = this.#instance.controller.buffer;
      return { buffer, tokens: [] };
    }

    const tokens = this.analyze([this.#eof]);

    if (!this.#done) {
      throw new Error("Unexpected EOF");
    } else {
      const buffer = this.#instance?.controller?.buffer ?? [];
      return { buffer, tokens };
    }
  }
}

export class LL1LexerController<I, O> {
  #buffer: I[] = [];
  #tokens: O[] = [];

  constructor(input: I[]) {
    this.#buffer = input;
  }

  nextChar(): I {
    if (this.#buffer.length == 0) {
      throw new Error("Buffer is empty");
    }
    return this.#buffer[0];
  }

  moveTokens(): O[] {
    const tokens = this.#tokens;
    this.#tokens = [];

    return tokens;
  }

  get buffer(): I[] {
    return this.#buffer;
  }

  *consume() {
    this.#buffer.shift();
    while (this.#buffer.length == 0) {
      this.#buffer = yield;
    }
  }

  pushToken(token: O) {
    this.#tokens.push(token);
  }
}
