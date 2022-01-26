export type LL1LexerGenerator = Generator<void, void, string[]>;
export type LL1LexerFunction<T> = (
  controller: LL1LexerController<T>
) => LL1LexerGenerator;

type LL1LexerInstance<T> = {
  controller: LL1LexerController<T>;
  generator: LL1LexerGenerator;
};
export class LL1Lexer<T> {
  #f;
  #instance: LL1LexerInstance<T> | null = null;
  #done = false;

  constructor(f: LL1LexerFunction<T>) {
    this.#f = f;
  }

  get done(): boolean {
    return this.#done;
  }

  analyze(input: string[]) {
    if (this.#done) {
      return [];
    }

    if (this.#instance === null) {
      const controller = new LL1LexerController<T>(input);
      let generator: LL1LexerGenerator;

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

    const tokens = this.analyze(["EOF"]);

    if (!this.#done) {
      throw new Error("Unexpected EOF");
    } else {
      const buffer = this.#instance?.controller?.buffer ?? [];
      return { buffer, tokens };
    }
  }
}

export class LL1LexerController<T> {
  #buffer: string[] = [];
  #tokens: T[] = [];

  constructor(input: string[]) {
    this.#buffer = input;
  }

  nextChar(): string {
    if (this.#buffer.length == 0) {
      throw new Error("Buffer is empty");
    }
    return this.#buffer[0];
  }

  moveTokens(): T[] {
    const tokens = this.#tokens;
    this.#tokens = [];

    return tokens;
  }

  get buffer(): string[] {
    return this.#buffer;
  }

  *consume() {
    this.#buffer.shift();
    while (this.#buffer.length == 0) {
      this.#buffer = yield;
    }
  }

  pushToken(token: T) {
    this.#tokens.push(token);
  }
}
