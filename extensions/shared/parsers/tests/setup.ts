import { TextDecoder, TextEncoder } from "node:util";

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

import { JSDOM } from "jsdom";

const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;
(global as any).window = dom.window;
