import {
  LL1LexerStream,
  LL1LexerController,
  LL1LexerGenerator,
} from "../ll1.ts";
import {
  JSONLexerStream,
  StreamingJSONLexerStream,
  JSONToken,
} from "./lexer.ts";

export type JSONType =
  | { [key: string]: JSONType }
  | JSONType[]
  | string
  | number
  | true
  | false
  | null;

type JSONParserController = LL1LexerController<JSONToken, JSONType>;
type JSONParserGenerator<R = void> = LL1LexerGenerator<JSONToken, R>;

function assertEq<T, U extends T>(a: T, b: U): asserts a is U {
  if (a !== b) {
    throw new Error("wtf");
  }
}

export class JSONParserStream {
  readable: ReadableStream<JSONType>;
  writable: WritableStream<string>;

  constructor() {
    const lexer = new JSONLexerStream();
    const parser = new LL1LexerStream<JSONToken, JSONType>(json);
    const transform = new TransformStream<JSONType[], JSONType>({
      transform(values, controller) {
        values.forEach((value) => {
          controller.enqueue(value);
        });
      },
    });

    lexer.readable.pipeTo(parser.writable);
    parser.readable.pipeTo(transform.writable);

    this.writable = lexer.writable;
    this.readable = transform.readable;
  }
}

export class StreamingJSONParserStream {
  readable: ReadableStream<JSONType>;
  writable: WritableStream<string>;

  constructor() {
    const lexer = new StreamingJSONLexerStream();
    const parser = new LL1LexerStream<JSONToken, JSONType>(streamingJson);
    const transform = new TransformStream<JSONType[], JSONType>({
      transform(values, controller) {
        values.forEach((value) => {
          controller.enqueue(value);
        });
      },
    });

    lexer.readable.pipeTo(parser.writable);
    parser.readable.pipeTo(transform.writable);

    this.writable = lexer.writable;
    this.readable = transform.readable;
  }
}

function* streamingJson(controller: JSONParserController): JSONParserGenerator {
  while (controller.nextChar().type != "EOF") {
    controller.pushToken(yield* value(controller));
  }
  controller.end();
}

function* json(controller: JSONParserController): JSONParserGenerator {
  controller.pushToken(yield* value(controller));
  assertEq(controller.nextChar().type, "EOF");
  controller.end();
}

function* value(
  controller: JSONParserController
): JSONParserGenerator<JSONType> {
  let v: JSONType;
  switch (controller.nextChar().type) {
    case "objectStart":
      const obj: { [key: string]: JSONType } = {};
      yield* controller.consume();

      while (controller.nextChar().type != "objectEnd") {
        const k = yield* str(controller);

        assertEq(controller.nextChar().type, "colon");
        yield* controller.consume();

        const v = yield* value(controller);

        obj[k] = v;

        if (controller.nextChar().type != "comma") {
          break;
        }
        yield* controller.consume();
      }

      assertEq(controller.nextChar().type, "objectEnd");
      v = obj;
      yield* controller.consume();
      break;

    case "arrayStart":
      const arr: JSONType[] = [];
      yield* controller.consume();

      while (controller.nextChar().type != "arrayEnd") {
        const v = yield* value(controller);

        if (controller.nextChar().type != "comma") {
          break;
        }
        yield* controller.consume();
      }

      assertEq(controller.nextChar().type, "arrayEnd");
      v = arr;
      yield* controller.consume();
      break;

    case "stringStart":
      v = yield* str(controller);
      break;

    case "numberStart":
      yield* controller.consume();

      let numStr = "";
      let nextChar = controller.nextChar();
      if (nextChar.type == "sign") {
        assertEq(nextChar.value, "-");
        numStr += nextChar.value;
        yield* controller.consume();
      }

      nextChar = controller.nextChar();
      while (nextChar.type == "digit") {
        numStr += nextChar.value;
        yield* controller.consume();
        nextChar = controller.nextChar();
      }

      if (controller.nextChar().type == "decimalPoint") {
        numStr += ".";
        yield* controller.consume();

        let nextChar = controller.nextChar();
        while (nextChar.type == "digit") {
          numStr += nextChar.value;
          yield* controller.consume();
          nextChar = controller.nextChar();
        }
      }

      if (controller.nextChar().type == "exponent") {
        numStr += "e";
        yield* controller.consume();

        let nextChar = controller.nextChar();
        if (nextChar.type == "sign") {
          numStr += nextChar.value;
          yield* controller.consume();
        }

        nextChar = controller.nextChar();
        while (nextChar.type == "digit") {
          numStr += nextChar.value;
          yield* controller.consume();
          nextChar = controller.nextChar();
        }
      }

      assertEq(controller.nextChar().type, "numberEnd");
      v = parseFloat(numStr);
      yield* controller.consume();
      break;

    case "true":
      v = true;
      yield* controller.consume();
      break;

    case "false":
      v = false;
      yield* controller.consume();

    case "null":
      v = null;
      yield* controller.consume();
      break;

    default:
      throw new Error("wtf");
  }

  return v;
}

function* str(controller: JSONParserController): JSONParserGenerator<string> {
  let str = "";
  assertEq(controller.nextChar().type, "stringStart");
  yield* controller.consume();

  let nextChar = controller.nextChar();
  while (nextChar.type == "character") {
    str += nextChar.value;
    yield* controller.consume();
    nextChar = controller.nextChar();
  }

  assertEq(controller.nextChar().type, "stringEnd");
  yield* controller.consume();

  return str;
}
