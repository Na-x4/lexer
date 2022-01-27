import {
  LL1LexerStream,
  LL1LexerController,
  LL1LexerGenerator,
} from "../ll1.ts";

export type JSONToken =
  | { type: "comma" }
  | { type: "colon" }
  | { type: "objectStart" }
  | { type: "objectEnd" }
  | { type: "arrayStart" }
  | { type: "arrayEnd" }
  | { type: "stringStart" }
  | { type: "stringEnd" }
  | { type: "character"; value: string }
  | { type: "numberStart" }
  | { type: "numberEnd" }
  | { type: "digit"; value: string }
  | { type: "sign"; value: string }
  | { type: "decimalPoint" }
  | { type: "exponent" }
  | { type: "true" }
  | { type: "false" }
  | { type: "null" };

type JSONLexerController = LL1LexerController<string, JSONToken>;
type JSONLexerGenerator<R = void> = LL1LexerGenerator<string, R>;

export class JSONLexerStream {
  readable: ReadableStream<JSONToken[]>;
  writable: WritableStream<string>;

  constructor() {
    const lexer = new LL1LexerStream(json);
    const transform = new TransformStream<string, string[]>({
      transform(chunk, controller) {
        controller.enqueue(Array.from(chunk));
      },
      flush(controller) {
        controller.enqueue(["EOF"]);
      },
    });

    transform.readable.pipeTo(lexer.writable);

    this.readable = lexer.readable;
    this.writable = transform.writable;
  }
}

export class StreamingJSONLexerStream {
  readable: ReadableStream<JSONToken[]>;
  writable: WritableStream<string>;

  constructor() {
    const lexer = new LL1LexerStream(streamingJson);
    const transform = new TransformStream<string, string[]>({
      transform(chunk, controller) {
        controller.enqueue(Array.from(chunk));
      },
      flush(controller) {
        controller.enqueue(["EOF"]);
      },
    });

    transform.readable.pipeTo(lexer.writable);

    this.readable = lexer.readable;
    this.writable = transform.writable;
  }
}

const objectFirstChar = "{";
const arrayFirstChar = "[";
const stringFirstChar = '"';
const oneNineChars = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const digitChars = oneNineChars.concat(["0"]);
const hexChars = digitChars.concat(
  ["a", "b", "c", "d", "e", "f"],
  ["A", "B", "C", "D", "E", "F"]
);
const numberFirstChars = digitChars.concat(["-"]);
const wsChars = [" ", "\n", "\r", "\t"];

function* streamingJson(controller: JSONLexerController): JSONLexerGenerator {
  while (controller.nextChar() != "EOF") {
    yield* element(controller);
  }
  controller.end();
}

function* json(controller: JSONLexerController): JSONLexerGenerator {
  yield* element(controller);
  if (controller.nextChar() != "EOF") {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
  controller.end();
}

function* value(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() == objectFirstChar) {
    yield* object(controller);
  } else if (controller.nextChar() == arrayFirstChar) {
    yield* array(controller);
  } else if (controller.nextChar() == stringFirstChar) {
    yield* str(controller);
  } else if (numberFirstChars.includes(controller.nextChar())) {
    yield* num(controller);
  } else if (controller.nextChar() == "t") {
    for (const expectedChar of "rue") {
      yield* controller.consume();
      if (controller.nextChar() != expectedChar) {
        throw new Error("not expected");
      }
    }

    controller.pushToken({ type: "true" });
    yield* controller.consume();
  } else if (controller.nextChar() == "f") {
    for (const expectedChar of "alse") {
      yield* controller.consume();
      if (controller.nextChar() != expectedChar) {
        throw new Error("not expected");
      }
    }

    controller.pushToken({ type: "false" });
    yield* controller.consume();
  } else if (controller.nextChar() == "n") {
    for (const expectedChar of "ull") {
      yield* controller.consume();
      if (controller.nextChar() != expectedChar) {
        throw new Error("not expected");
      }
    }

    controller.pushToken({ type: "null" });
    yield* controller.consume();
  } else {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
}

function* object(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() != objectFirstChar) {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
  controller.pushToken({ type: "objectStart" });
  yield* controller.consume();

  yield* ws(controller);

  if (controller.nextChar() != "}") {
    yield* members(controller);

    if (controller.nextChar() != "}") {
      throw new Error(`not expected "${controller.nextChar()}"`);
    }
  }

  controller.pushToken({ type: "objectEnd" });
  yield* controller.consume();
}

function* members(controller: JSONLexerController): JSONLexerGenerator {
  yield* member(controller);

  while (controller.nextChar() == ",") {
    controller.pushToken({ type: "comma" });
    yield* controller.consume();

    yield* member(controller);
  }
}

function* member(controller: JSONLexerController): JSONLexerGenerator {
  yield* ws(controller);
  yield* str(controller);
  yield* ws(controller);

  if (controller.nextChar() != ":") {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
  controller.pushToken({ type: "colon" });
  yield* controller.consume();

  yield* element(controller);
}

function* array(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() != arrayFirstChar) {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
  controller.pushToken({ type: "arrayStart" });
  yield* controller.consume();

  yield* ws(controller);

  if (controller.nextChar() != "]") {
    yield* elements(controller);

    if (controller.nextChar() != "]") {
      throw new Error(`not expected "${controller.nextChar()}"`);
    }
  }

  controller.pushToken({ type: "arrayEnd" });
  return yield* controller.consume();
}

function* elements(controller: JSONLexerController): JSONLexerGenerator {
  yield* element(controller);

  while (controller.nextChar() == ",") {
    controller.pushToken({ type: "comma" });
    yield* controller.consume();

    yield* element(controller);
  }
}

function* element(controller: JSONLexerController): JSONLexerGenerator {
  yield* ws(controller);
  yield* value(controller);
  yield* ws(controller);
}

function* str(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() != '"') {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
  controller.pushToken({ type: "stringStart" });
  yield* controller.consume();

  yield* characters(controller);

  if (controller.nextChar() != '"') {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
  controller.pushToken({ type: "stringEnd" });
  yield* controller.consume();
}

function* characters(controller: JSONLexerController): JSONLexerGenerator {
  while (controller.nextChar() != '"') {
    yield* character(controller);
  }
}

function* character(controller: JSONLexerController): JSONLexerGenerator {
  const nextChar = controller.nextChar();
  const codePoint = nextChar.charCodeAt(0);
  if (codePoint >= 0x0 && codePoint < 0x20) {
    throw new Error(`not expected "${controller.nextChar()}"`);
  } else if (nextChar == '"') {
    throw new Error(`not expected "${controller.nextChar()}"`);
  } else if (nextChar == "\\") {
    yield* controller.consume();

    yield* escape(controller);
  } else {
    controller.pushToken({ type: "character", value: nextChar });
    yield* controller.consume();
  }
}

function* escape(controller: JSONLexerController): JSONLexerGenerator {
  switch (controller.nextChar()) {
    case '"':
      controller.pushToken({ type: "character", value: '"' });
      yield* controller.consume();
      break;

    case "\\":
      controller.pushToken({ type: "character", value: "\\" });
      yield* controller.consume();
      break;

    case "b":
      controller.pushToken({ type: "character", value: "\b" });
      yield* controller.consume();
      break;

    case "f":
      controller.pushToken({ type: "character", value: "\f" });
      yield* controller.consume();
      break;

    case "n":
      controller.pushToken({ type: "character", value: "\n" });
      yield* controller.consume();
      break;

    case "r":
      controller.pushToken({ type: "character", value: "\r" });
      yield* controller.consume();
      break;

    case "t":
      controller.pushToken({ type: "character", value: "\t" });
      yield* controller.consume();
      break;

    case "u":
      yield* controller.consume();

      let hexStr = "";
      for (let i = 0; i < 4; i++) {
        let char = controller.nextChar();
        if (hexChars.includes(char)) {
          yield* controller.consume();
        } else {
          throw new Error(`not expected "${controller.nextChar()}"`);
        }

        hexStr += char;
      }
      controller.pushToken({
        type: "character",
        value: String.fromCharCode(parseInt(hexStr, 16)),
      });
      break;

    default:
      throw new Error(`not expected "${controller.nextChar()}"`);
  }
}

function* num(controller: JSONLexerController): JSONLexerGenerator {
  controller.pushToken({ type: "numberStart" });
  yield* integer(controller);
  yield* fraction(controller);
  yield* exponent(controller);
  controller.pushToken({ type: "numberEnd" });
}

function* integer(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() == "0") {
    yield* digit(controller);
  } else if (oneNineChars.includes(controller.nextChar())) {
    yield* digit(controller);
    if (digitChars.includes(controller.nextChar())) {
      yield* digits(controller);
    }
  } else if (controller.nextChar() == "-") {
    controller.pushToken({ type: "sign", value: controller.nextChar() });
    yield* controller.consume();

    if (controller.nextChar() == "0") {
      yield* digit(controller);
    } else if (oneNineChars.includes(controller.nextChar())) {
      yield* digit(controller);
      if (digitChars.includes(controller.nextChar())) {
        yield* digits(controller);
      }
    } else {
      throw new Error(`not expected "${controller.nextChar()}"`);
    }
  } else {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
}

function* digits(controller: JSONLexerController): JSONLexerGenerator {
  yield* digit(controller);

  while (digitChars.includes(controller.nextChar())) {
    yield* digit(controller);
  }
}

function* digit(controller: JSONLexerController): JSONLexerGenerator {
  const nextChar = controller.nextChar();
  if (digitChars.includes(nextChar)) {
    controller.pushToken({ type: "digit", value: nextChar });
    yield* controller.consume();
  } else {
    throw new Error(`not expected "${controller.nextChar()}"`);
  }
}

function* fraction(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() == ".") {
    controller.pushToken({ type: "decimalPoint" });
    yield* controller.consume();

    yield* digits(controller);
  }
}

function* exponent(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() == "E" || controller.nextChar() == "e") {
    controller.pushToken({ type: "exponent" });
    yield* controller.consume();

    yield* sign(controller);
    yield* digits(controller);
  }
}

function* sign(controller: JSONLexerController): JSONLexerGenerator {
  if (controller.nextChar() == "+" || controller.nextChar() == "-") {
    controller.pushToken({ type: "sign", value: controller.nextChar() });
    yield* controller.consume();
  }
}

function* ws(controller: JSONLexerController): JSONLexerGenerator {
  while (wsChars.includes(controller.nextChar())) {
    yield* controller.consume();
  }
}
