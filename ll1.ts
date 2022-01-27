export type LL1LexerGenerator<I> = Generator<void, void, I[]>;
export type LL1LexerFunction<I, O> = (
  controller: LL1LexerController<I, O>
) => LL1LexerGenerator<I>;

interface LL1LexerInstance<I, O> {
  controller: LL1LexerController<I, O>;
  generator: LL1LexerGenerator<I>;
}
export class LL1Lexer<I, O> {
  #f;
  #instance: LL1LexerInstance<I, O> | null = null;
  #done = false;

  constructor(f: LL1LexerFunction<I, O>) {
    this.#f = f;
  }

  get done(): boolean {
    return this.#done;
  }

  analyze(input: I[]) {
    if (this.#done) {
      throw new Error(`not expected "${input[0]}"`);
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

  end() {
    this.#buffer.shift();
    if (this.#buffer.length > 0) {
      throw new Error("Unexpected %o", this.#buffer[0]);
    }
  }

  pushToken(token: O) {
    this.#tokens.push(token);
  }
}
