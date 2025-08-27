import { TextDecoder, TextEncoder } from "node:util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
import { JSDOM } from "jsdom";
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;
global.window = dom.window;
