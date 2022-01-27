export type LL1LexerGenerator<I, R> = Generator<void, R, I[]>;
export type LL1LexerFunction<I, O, R> = (
  controller: LL1LexerController<I, O>
) => LL1LexerGenerator<I, R>;

interface LL1LexerInstance<I, O> {
  controller: LL1LexerController<I, O>;
  generator: LL1LexerGenerator<I, void>;
}
export class LL1LexerStream<I, O> {
  #instance: LL1LexerInstance<I, O> | null = null;
  writable: WritableStream<I[]>;
  readable: ReadableStream<O[]>;

  constructor(f: LL1LexerFunction<I, O, void>) {
    const { writable, readable } = new TransformStream<I[], O[]>({
      transform: (chunk, controller) => {
        if (this.#instance === null) {
          const controller = new LL1LexerController<I, O>(chunk);
          let generator: LL1LexerGenerator<I, void>;

          if (chunk.length > 0) {
            generator = f(controller);
          } else {
            generator = (function* (controller) {
              yield* controller.consume();
              return yield* f(controller);
            })(controller);
          }

          this.#instance = { controller, generator };
        }

        this.#instance.generator.next(chunk);
        controller.enqueue(this.#instance.controller.moveTokens());
      },
    });

    this.writable = writable;
    this.readable = readable;
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
