#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/punycode.js/punycode.js
var require_punycode = __commonJS({
  "node_modules/punycode.js/punycode.js"(exports, module) {
    "use strict";
    var maxInt = 2147483647;
    var base = 36;
    var tMin = 1;
    var tMax = 26;
    var skew = 38;
    var damp = 700;
    var initialBias = 72;
    var initialN = 128;
    var delimiter = "-";
    var regexPunycode = /^xn--/;
    var regexNonASCII = /[^\0-\x7F]/;
    var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
    var errors = {
      "overflow": "Overflow: input needs wider integers to process",
      "not-basic": "Illegal input >= 0x80 (not a basic code point)",
      "invalid-input": "Invalid input"
    };
    var baseMinusTMin = base - tMin;
    var floor = Math.floor;
    var stringFromCharCode = String.fromCharCode;
    function error(type) {
      throw new RangeError(errors[type]);
    }
    function map(array, callback) {
      const result = [];
      let length = array.length;
      while (length--) {
        result[length] = callback(array[length]);
      }
      return result;
    }
    function mapDomain(domain, callback) {
      const parts = domain.split("@");
      let result = "";
      if (parts.length > 1) {
        result = parts[0] + "@";
        domain = parts[1];
      }
      domain = domain.replace(regexSeparators, ".");
      const labels = domain.split(".");
      const encoded = map(labels, callback).join(".");
      return result + encoded;
    }
    function ucs2decode(string) {
      const output = [];
      let counter = 0;
      const length = string.length;
      while (counter < length) {
        const value = string.charCodeAt(counter++);
        if (value >= 55296 && value <= 56319 && counter < length) {
          const extra = string.charCodeAt(counter++);
          if ((extra & 64512) == 56320) {
            output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
          } else {
            output.push(value);
            counter--;
          }
        } else {
          output.push(value);
        }
      }
      return output;
    }
    var ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
    var basicToDigit = function(codePoint) {
      if (codePoint >= 48 && codePoint < 58) {
        return 26 + (codePoint - 48);
      }
      if (codePoint >= 65 && codePoint < 91) {
        return codePoint - 65;
      }
      if (codePoint >= 97 && codePoint < 123) {
        return codePoint - 97;
      }
      return base;
    };
    var digitToBasic = function(digit, flag) {
      return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
    };
    var adapt = function(delta, numPoints, firstTime) {
      let k = 0;
      delta = firstTime ? floor(delta / damp) : delta >> 1;
      delta += floor(delta / numPoints);
      for (; delta > baseMinusTMin * tMax >> 1; k += base) {
        delta = floor(delta / baseMinusTMin);
      }
      return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
    };
    var decode2 = function(input) {
      const output = [];
      const inputLength = input.length;
      let i = 0;
      let n = initialN;
      let bias = initialBias;
      let basic = input.lastIndexOf(delimiter);
      if (basic < 0) {
        basic = 0;
      }
      for (let j = 0; j < basic; ++j) {
        if (input.charCodeAt(j) >= 128) {
          error("not-basic");
        }
        output.push(input.charCodeAt(j));
      }
      for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
        const oldi = i;
        for (let w = 1, k = base; ; k += base) {
          if (index >= inputLength) {
            error("invalid-input");
          }
          const digit = basicToDigit(input.charCodeAt(index++));
          if (digit >= base) {
            error("invalid-input");
          }
          if (digit > floor((maxInt - i) / w)) {
            error("overflow");
          }
          i += digit * w;
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (digit < t) {
            break;
          }
          const baseMinusT = base - t;
          if (w > floor(maxInt / baseMinusT)) {
            error("overflow");
          }
          w *= baseMinusT;
        }
        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi == 0);
        if (floor(i / out) > maxInt - n) {
          error("overflow");
        }
        n += floor(i / out);
        i %= out;
        output.splice(i++, 0, n);
      }
      return String.fromCodePoint(...output);
    };
    var encode2 = function(input) {
      const output = [];
      input = ucs2decode(input);
      const inputLength = input.length;
      let n = initialN;
      let delta = 0;
      let bias = initialBias;
      for (const currentValue of input) {
        if (currentValue < 128) {
          output.push(stringFromCharCode(currentValue));
        }
      }
      const basicLength = output.length;
      let handledCPCount = basicLength;
      if (basicLength) {
        output.push(delimiter);
      }
      while (handledCPCount < inputLength) {
        let m = maxInt;
        for (const currentValue of input) {
          if (currentValue >= n && currentValue < m) {
            m = currentValue;
          }
        }
        const handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
          error("overflow");
        }
        delta += (m - n) * handledCPCountPlusOne;
        n = m;
        for (const currentValue of input) {
          if (currentValue < n && ++delta > maxInt) {
            error("overflow");
          }
          if (currentValue === n) {
            let q = delta;
            for (let k = base; ; k += base) {
              const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (q < t) {
                break;
              }
              const qMinusT = q - t;
              const baseMinusT = base - t;
              output.push(
                stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
              );
              q = floor(qMinusT / baseMinusT);
            }
            output.push(stringFromCharCode(digitToBasic(q, 0)));
            bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
            delta = 0;
            ++handledCPCount;
          }
        }
        ++delta;
        ++n;
      }
      return output.join("");
    };
    var toUnicode = function(input) {
      return mapDomain(input, function(string) {
        return regexPunycode.test(string) ? decode2(string.slice(4).toLowerCase()) : string;
      });
    };
    var toASCII = function(input) {
      return mapDomain(input, function(string) {
        return regexNonASCII.test(string) ? "xn--" + encode2(string) : string;
      });
    };
    var punycode2 = {
      /**
       * A string representing the current Punycode.js version number.
       * @memberOf punycode
       * @type String
       */
      "version": "2.3.1",
      /**
       * An object of methods to convert from JavaScript's internal character
       * representation (UCS-2) to Unicode code points, and back.
       * @see <https://mathiasbynens.be/notes/javascript-encoding>
       * @memberOf punycode
       * @type Object
       */
      "ucs2": {
        "decode": ucs2decode,
        "encode": ucs2encode
      },
      "decode": decode2,
      "encode": encode2,
      "toASCII": toASCII,
      "toUnicode": toUnicode
    };
    module.exports = punycode2;
  }
});

// src/cli/main.ts
import { existsSync } from "node:fs";
import { dirname as dirname9, join as join10, resolve as resolve9 } from "node:path";
import { parseArgs } from "node:util";

// src/cli/build.ts
import { join as join4, resolve as resolve5 } from "node:path";

// src/knowledge/paths.ts
var SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
function normalizePath(path) {
  return path.split("/").filter((segment) => segment !== "" && segment !== ".").join("/");
}
function directoryOf(path) {
  return normalizePath(path).split("/").filter(Boolean).slice(0, -1);
}
function resolveLink(fromPath, href) {
  if (href.startsWith("/") || SCHEME_PATTERN.test(href)) {
    return void 0;
  }
  const target = href.split(/[?#]/)[0] ?? "";
  if (target === "") {
    return void 0;
  }
  let decoded = target;
  try {
    decoded = decodeURI(target);
  } catch {
  }
  const segments = directoryOf(fromPath);
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.pop() === void 0) {
        return void 0;
      }
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
}

// src/cli/config.ts
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parse, YAMLParseError } from "yaml";

// src/config.ts
var DEFAULT_FEATURES = {
  print: true,
  table: true,
  callout: true,
  tabs: true,
  steps: true,
  tree: true,
  badge: true,
  toc: true,
  anchors: true,
  sections: true,
  "row-details": true,
  figures: true,
  diagrams: true,
  glossary: true,
  backlinks: true
};
var DEFAULT_LIBRARIES = {};
var MARK_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
function resolveConfig(options) {
  const { config: config2, defaultLibraries = DEFAULT_LIBRARIES } = options;
  const features = { ...DEFAULT_FEATURES };
  for (const name of Object.keys(DEFAULT_FEATURES)) {
    const value = config2?.features?.[name];
    if (typeof value === "boolean") {
      features[name] = value;
    }
  }
  const libraries = {};
  for (const [name, entry] of Object.entries(defaultLibraries)) {
    libraries[name] = { ...entry };
  }
  for (const [name, url] of Object.entries(config2?.libraries ?? {})) {
    if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
      continue;
    }
    const existing = Object.hasOwn(libraries, name) ? libraries[name] : void 0;
    libraries[name] = existing ? { ...existing, url } : { url, figure: true };
  }
  return { features, libraries };
}

// src/cli/versions.ts
var VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;
function parseVersion(text2) {
  const match = VERSION_PATTERN.exec(text2);
  if (!match) {
    return void 0;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new Error(`\u7248\u306E\u66F8\u5F0F\u304C\u9055\u3044\u307E\u3059: ${left ? b : a}`);
  }
  for (const [index, value] of left.entries()) {
    const other = right[index] ?? 0;
    if (value !== other) {
      return value < other ? -1 : 1;
    }
  }
  return 0;
}
function cliVersion() {
  return "v0.5.0";
}

// src/cli/config.ts
var CONFIG_FILE = "mdmark.config.yaml";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
async function findConfigFile(cwd, explicit) {
  if (explicit !== void 0) {
    const path = resolve(cwd, explicit);
    if (await isFile(path)) {
      return path;
    }
    throw new CliError(
      `${explicit} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08--config \u306E\u30D1\u30B9\uFF09\u3002\u30D1\u30B9\u3092\u76F4\u3059\u304B\u3001mdmark init \u3067\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  let dir = cwd;
  for (; ; ) {
    const path = join(dir, CONFIG_FILE);
    if (await isFile(path)) {
      return path;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new CliError(
        `${CONFIG_FILE} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08${cwd} \u304B\u3089\u4E0A\u3092\u63A2\u3057\u307E\u3057\u305F\uFF09\u3002mdmark init \u3067\u7F6E\u3051\u307E\u3059\u3002`
      );
    }
    dir = parent;
  }
}
async function loadConfig(path) {
  const name = basename(path);
  let text2;
  try {
    text2 = await readFile(path, "utf8");
  } catch (error) {
    throw new CliError(
      `${name} \u3092\u958B\u3051\u307E\u305B\u3093\uFF08${error instanceof Error ? error.message : String(error)}\uFF09\u3002\u30D1\u30B9\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  try {
    return { path, dir: dirname(path), raw: parse(text2) };
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0].line;
      const reason = error.message.split("\n")[0] ?? "";
      throw new CliError(
        `${name} \u306E ${line ?? "?"} \u884C\u76EE\u3092 YAML \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08${reason}\uFF09\u3002\u5B57\u4E0B\u3052\u3068\u66F8\u304D\u65B9\u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
    throw error;
  }
}
function schemaIssue(file, where, message) {
  return { file, where, kind: "schema", message };
}
function validateBuild(value, file, issues) {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(file, "build", "`build` \u306F\u30AD\u30FC\u3068\u5024\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002")
    );
    return void 0;
  }
  const before = issues.length;
  if (value.include === void 0) {
    issues.push(
      schemaIssue(
        file,
        "build",
        "`build.include` \u304C\u3042\u308A\u307E\u305B\u3093\u3002\u307E\u3068\u3081\u308B Markdown \u306E glob \u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      )
    );
  } else if (!isStringArray(value.include) || value.include.length === 0) {
    issues.push(
      schemaIssue(
        file,
        "build.include",
        "`build.include` \u306F 1 \u3064\u4EE5\u4E0A\u306E glob \u306E\u4E26\u3073\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      )
    );
  }
  if (value.out === void 0) {
    issues.push(
      schemaIssue(
        file,
        "build",
        "`build.out` \u304C\u3042\u308A\u307E\u305B\u3093\u3002\u66F8\u304D\u51FA\u3059 HTML \u306E\u30D1\u30B9\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      )
    );
  } else if (typeof value.out !== "string" || !value.out.endsWith(".html")) {
    issues.push(
      schemaIssue(
        file,
        "build.out",
        "`build.out` \u306F\u62E1\u5F35\u5B50 `.html` \u306E\u30D1\u30B9\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      )
    );
  }
  for (const key of ["exclude", "glossary"]) {
    if (value[key] !== void 0 && !isStringArray(value[key])) {
      issues.push(
        schemaIssue(
          file,
          `build.${key}`,
          `\`build.${key}\` \u306F\u6587\u5B57\u5217\u306E\u4E26\u3073\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
        )
      );
    }
  }
  if (value.entry !== void 0 && typeof value.entry !== "string") {
    issues.push(
      schemaIssue(
        file,
        "build.entry",
        "`build.entry` \u306F\u6587\u66F8\u306E\u30D1\u30B9\u306E\u6587\u5B57\u5217\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      )
    );
  }
  return issues.length === before ? value : void 0;
}
function validateConfig(raw, file) {
  const issues = [];
  if (!isRecord(raw)) {
    issues.push(
      schemaIssue(
        file,
        "",
        `${file} \u304C\u7A7A\u304B\u3001\u30AD\u30FC\u3068\u5024\u306E\u5F62\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u306E\u30AD\u30FC\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
      )
    );
    return { config: {}, issues };
  }
  const config2 = { ...raw };
  if (raw.features !== void 0) {
    const features = {};
    if (isRecord(raw.features)) {
      for (const [name, value] of Object.entries(raw.features)) {
        if (typeof value === "boolean") {
          features[name] = value;
        } else {
          issues.push(
            schemaIssue(
              file,
              `features.${name}`,
              `\`features.${name}\` \u306F true \u304B false \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
            )
          );
        }
      }
      config2.features = features;
    } else {
      issues.push(
        schemaIssue(
          file,
          "features",
          "`features` \u306F\u6A5F\u80FD\u540D\u3068 true / false \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
        )
      );
      delete config2.features;
    }
  }
  if (raw.libraries !== void 0) {
    if (isRecord(raw.libraries)) {
      const libraries = {};
      for (const [name, url] of Object.entries(raw.libraries)) {
        if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
          issues.push(
            schemaIssue(
              file,
              `libraries.${name}`,
              `\`libraries.${name}\` \u306F\u3001\u82F1\u5C0F\u6587\u5B57\u3067\u59CB\u307E\u308B\u5370\u306E\u540D\u524D\u3068 URL \u306E\u6587\u5B57\u5217\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
            )
          );
        } else {
          libraries[name] = url;
        }
      }
      config2.libraries = libraries;
    } else {
      issues.push(
        schemaIssue(
          file,
          "libraries",
          "`libraries` \u306F\u5370\u306E\u540D\u524D\u3068 URL \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
        )
      );
      delete config2.libraries;
    }
  }
  if (raw.version !== void 0) {
    if (typeof raw.version !== "string" || !VERSION_PATTERN.test(raw.version)) {
      issues.push(
        schemaIssue(
          file,
          "version",
          "`version` \u306F v{MAJOR}.{MINOR}.{PATCH} \u306E\u5F62\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
        )
      );
      delete config2.version;
    }
  }
  for (const key of ["index", "theme"]) {
    if (raw[key] !== void 0 && typeof raw[key] !== "string") {
      issues.push(
        schemaIssue(
          file,
          key,
          `\`${key}\` \u306F\u30D5\u30A1\u30A4\u30EB\u306E\u30D1\u30B9\u306E\u6587\u5B57\u5217\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
        )
      );
      delete config2[key];
    }
  }
  if (raw.extensions !== void 0 && !isStringArray(raw.extensions)) {
    issues.push(
      schemaIssue(
        file,
        "extensions",
        "`extensions` \u306F\u62E1\u5F35\u306E\u30E2\u30B8\u30E5\u30FC\u30EB\u306E\u30D1\u30B9\u306E\u4E26\u3073\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
      )
    );
    delete config2.extensions;
  }
  if (raw.build !== void 0) {
    const build2 = validateBuild(raw.build, file, issues);
    if (build2) {
      config2.build = build2;
    } else {
      delete config2.build;
    }
  }
  return { config: config2, issues };
}
async function requireConfig(cwd, explicit) {
  const loaded = await loadConfig(await findConfigFile(cwd, explicit));
  const file = basename(loaded.path);
  const { config: config2, issues } = validateConfig(loaded.raw, file);
  const first = issues[0];
  if (first) {
    const where = first.where === "" ? "\u5168\u4F53" : first.where;
    throw new CliError(
      `${file} \u306E ${where} \u304C\u8A2D\u5B9A\u306E\u5F62\u306B\u5408\u3044\u307E\u305B\u3093\uFF08${first.message}\uFF09\u3002mdmark check \u3067\u5408\u308F\u306A\u3044\u3068\u3053\u308D\u3092\u78BA\u304B\u3081\u3089\u308C\u307E\u3059\u3002`
    );
  }
  return { path: loaded.path, dir: loaded.dir, config: config2 };
}

// src/cli/documents.ts
import { glob, readFile as readFile2 } from "node:fs/promises";
import {
  basename as basename2,
  dirname as dirname2,
  extname,
  join as join2,
  relative,
  resolve as resolve2,
  sep
} from "node:path";
import { parse as parse2 } from "yaml";
var MARKDOWN_EXTENSION = ".md";
function toPosix(path) {
  return path.split(sep).join("/");
}
async function globFiles(options) {
  const found = [];
  for await (const entry of glob(options.pattern, {
    cwd: options.cwd,
    exclude: options.exclude,
    withFileTypes: true
  })) {
    if (entry.isFile()) {
      found.push(
        toPosix(relative(options.cwd, join2(entry.parentPath, entry.name)))
      );
    }
  }
  return found.sort();
}
async function collectBuildDocuments(dir, build2) {
  const seen = /* @__PURE__ */ new Set();
  for (const pattern of build2.include) {
    const files = await globFiles({
      cwd: dir,
      pattern,
      exclude: build2.exclude ?? []
    });
    for (const file of files) {
      if (extname(file) === MARKDOWN_EXTENSION) {
        seen.add(file);
      }
    }
  }
  return [...seen];
}
async function readIndexWithDocuments(loaded) {
  const index = loaded.config.index;
  if (index === void 0) {
    return void 0;
  }
  const indexPath = resolve2(loaded.dir, index);
  const indexFile = toPosix(relative(loaded.dir, indexPath));
  let raw;
  try {
    raw = parse2(await readFile2(indexPath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new CliError(
      `\u7D22\u5F15 ${indexFile} \u3092\u8AAD\u3081\u307E\u305B\u3093\uFF08${reason}\uFF09\u3002\u8A2D\u5B9A\u306E index \u306E\u30D1\u30B9\u3092\u76F4\u3059\u304B\u3001\u7D22\u5F15\u3092\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  const indexDir = dirname2(indexPath);
  const indexDirFromConfig = toPosix(relative(loaded.dir, indexDir));
  const files = await globFiles({
    cwd: loaded.dir,
    pattern: indexDirFromConfig === "" ? `**/*${MARKDOWN_EXTENSION}` : `${indexDirFromConfig}/**/*${MARKDOWN_EXTENSION}`,
    exclude: loaded.config.build?.exclude ?? []
  });
  const documents = {};
  for (const file of files) {
    const key = toPosix(relative(indexDir, join2(loaded.dir, file)));
    documents[key] = await readFile2(join2(loaded.dir, file), "utf8");
  }
  return { indexFile, indexDir, raw, documents };
}
function firstHeading(markdown) {
  let fence2;
  for (const line of markdown.split("\n")) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1].charAt(0);
      fence2 = fence2 === void 0 ? marker : fence2 === marker ? void 0 : fence2;
      continue;
    }
    if (fence2 !== void 0) {
      continue;
    }
    const heading2 = /^ {0,3}#\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (heading2?.[1]) {
      return heading2[1];
    }
  }
  return void 0;
}
function documentTitle(doc) {
  return doc.indexTitle ?? firstHeading(doc.markdown) ?? basename2(normalizePath(doc.path), extname(doc.path));
}

// src/cli/embed.ts
import { readFile as readFile3 } from "node:fs/promises";
import { dirname as dirname3, extname as extname2, resolve as resolve3 } from "node:path";
import { build } from "esbuild";

// node_modules/mdurl/index.mjs
var mdurl_exports = {};
__export(mdurl_exports, {
  decode: () => decode_default,
  encode: () => encode_default,
  format: () => format,
  parse: () => parse_default
});

// node_modules/mdurl/lib/decode.mjs
var decodeCache = {};
function getDecodeCache(exclude) {
  let cache = decodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = decodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache.push(ch);
  }
  for (let i = 0; i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
  }
  return cache;
}
function decode(string, exclude) {
  if (typeof exclude !== "string") {
    exclude = decode.defaultChars;
  }
  const cache = getDecodeCache(exclude);
  return string.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
    let result = "";
    for (let i = 0, l = seq.length; i < l; i += 3) {
      const b1 = parseInt(seq.slice(i + 1, i + 3), 16);
      if (b1 < 128) {
        result += cache[b1];
        continue;
      }
      if ((b1 & 224) === 192 && i + 3 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        if ((b2 & 192) === 128) {
          const chr = b1 << 6 & 1984 | b2 & 63;
          if (chr < 128) {
            result += "\uFFFD\uFFFD";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 3;
          continue;
        }
      }
      if ((b1 & 240) === 224 && i + 6 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128) {
          const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
          if (chr < 2048 || chr >= 55296 && chr <= 57343) {
            result += "\uFFFD\uFFFD\uFFFD";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 6;
          continue;
        }
      }
      if ((b1 & 248) === 240 && i + 9 < l) {
        const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq.slice(i + 10, i + 12), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
          let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
          if (chr < 65536 || chr > 1114111) {
            result += "\uFFFD\uFFFD\uFFFD\uFFFD";
          } else {
            chr -= 65536;
            result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
          }
          i += 9;
          continue;
        }
      }
      result += "\uFFFD";
    }
    return result;
  });
}
decode.defaultChars = ";/?:@&=+$,#";
decode.componentChars = "";
var decode_default = decode;

// node_modules/mdurl/lib/encode.mjs
var encodeCache = {};
function getEncodeCache(exclude) {
  let cache = encodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = encodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    if (/^[0-9a-z]$/i.test(ch)) {
      cache.push(ch);
    } else {
      cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
    }
  }
  for (let i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }
  return cache;
}
function encode(string, exclude, keepEscaped) {
  if (typeof exclude !== "string") {
    keepEscaped = exclude;
    exclude = encode.defaultChars;
  }
  if (typeof keepEscaped === "undefined") {
    keepEscaped = true;
  }
  const cache = getEncodeCache(exclude);
  let result = "";
  for (let i = 0, l = string.length; i < l; i++) {
    const code2 = string.charCodeAt(i);
    if (keepEscaped && code2 === 37 && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue;
      }
    }
    if (code2 < 128) {
      result += cache[code2];
      continue;
    }
    if (code2 >= 55296 && code2 <= 57343) {
      if (code2 >= 55296 && code2 <= 56319 && i + 1 < l) {
        const nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 56320 && nextCode <= 57343) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue;
        }
      }
      result += "%EF%BF%BD";
      continue;
    }
    result += encodeURIComponent(string[i]);
  }
  return result;
}
encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";
var encode_default = encode;

// node_modules/mdurl/lib/format.mjs
function format(url) {
  let result = "";
  result += url.protocol || "";
  result += url.slashes ? "//" : "";
  result += url.auth ? url.auth + "@" : "";
  if (url.hostname && url.hostname.indexOf(":") !== -1) {
    result += "[" + url.hostname + "]";
  } else {
    result += url.hostname || "";
  }
  result += url.port ? ":" + url.port : "";
  result += url.pathname || "";
  result += url.search || "";
  result += url.hash || "";
  return result;
}

// node_modules/mdurl/lib/parse.mjs
function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}
var protocolPattern = /^([a-z0-9.+-]+:)/i;
var portPattern = /:[0-9]*$/;
var simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
var delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
var unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
var autoEscape = ["'"].concat(unwise);
var nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
var hostEndingChars = ["/", "?", "#"];
var hostnameMaxLen = 255;
var hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
var hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
var hostlessProtocol = {
  javascript: true,
  "javascript:": true
};
var slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  "http:": true,
  "https:": true,
  "ftp:": true,
  "gopher:": true,
  "file:": true
};
function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url) return url;
  const u = new Url();
  u.parse(url, slashesDenoteHost);
  return u;
}
Url.prototype.parse = function(url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;
  rest = rest.trim();
  if (!slashesDenoteHost && url.split("#").length === 1) {
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }
  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === "//";
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }
  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
    let hostEnd = -1;
    for (let i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    let auth, atSign;
    if (hostEnd === -1) {
      atSign = rest.lastIndexOf("@");
    } else {
      atSign = rest.lastIndexOf("@", hostEnd);
    }
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }
    hostEnd = -1;
    for (let i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }
    if (rest[hostEnd - 1] === ":") {
      hostEnd--;
    }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);
    this.parseHost(host);
    this.hostname = this.hostname || "";
    const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length; i < l; i++) {
        const part = hostparts[i];
        if (!part) {
          continue;
        }
        if (!part.match(hostnamePartPattern)) {
          let newpart = "";
          for (let j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              newpart += "x";
            } else {
              newpart += part[j];
            }
          }
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join(".") + rest;
            }
            this.hostname = validParts.join(".");
            break;
          }
        }
      }
    }
    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = "";
    }
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf("?");
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) {
    this.pathname = rest;
  }
  if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
    this.pathname = "";
  }
  return this;
};
Url.prototype.parseHost = function(host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ":") {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) {
    this.hostname = host;
  }
};
var parse_default = urlParse;

// node_modules/uc.micro/build/index.mjs
var build_exports = {};
__export(build_exports, {
  Any: () => Any,
  Cc: () => Cc,
  Cf: () => Cf,
  P: () => P,
  S: () => S,
  Z: () => Z
});
var Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var Cc = /[\0-\x1F\x7F-\x9F]/;
var Cf = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
var P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B4E\u1B4F\u1B5A-\u1B60\u1B7D-\u1B7F\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDD6E\uDEAD\uDED0\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9\uDFD4\uDFD5\uDFD7\uDFD8]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09\uDFE1]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDD6D-\uDD6F\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD839\uDDFF|\uD83A[\uDD5E\uDD5F]/;
var S = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C1\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2429\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E5\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD803[\uDD8E\uDD8F\uDED1-\uDED8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDC00-\uDCEF\uDCFA-\uDCFC\uDD00-\uDEB3\uDEBA-\uDED0\uDEE0-\uDEF0\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED8\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0-\uDCBB\uDCC0\uDCC1\uDCD0-\uDCD8\uDD00-\uDE57\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE8A\uDE8E-\uDEC6\uDEC8\uDECD-\uDEDC\uDEDF-\uDEEA\uDEEF-\uDEF8\uDF00-\uDF92\uDF94-\uDFEF\uDFFA]/;
var Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

// node_modules/entities/dist/decode-codepoint.js
var c1 = [
  8364,
  0,
  8218,
  402,
  8222,
  8230,
  8224,
  8225,
  710,
  8240,
  352,
  8249,
  338,
  0,
  381,
  0,
  0,
  8216,
  8217,
  8220,
  8221,
  8226,
  8211,
  8212,
  732,
  8482,
  353,
  8250,
  339,
  0,
  382,
  376
];
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}
function codePointToString(codePoint) {
  return codePoint - 1 >>> 0 < 127 || codePoint - 160 >>> 0 < 55136 ? String.fromCharCode(codePoint) : String.fromCodePoint(replaceCodePoint(codePoint));
}

// node_modules/entities/dist/internal/decode-shared.js
var BASE91_INVERSE = /* @__PURE__ */ (() => {
  const table2 = new Uint8Array(127);
  let code2 = 0;
  for (let char = 33; char <= 126; char++) {
    if (char !== 34 && char !== 36 && char !== 92) {
      table2[char] = code2++;
    }
  }
  return table2;
})();
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
  const base = 91;
  const inputLength = input.length;
  const twoCharBias = dictSize * (base - 1);
  let pos = 0;
  const readSlotCode = () => {
    const c12 = BASE91_INVERSE[input.charCodeAt(pos++)];
    return c12 < dictSize ? c12 : c12 * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
  };
  const dict2AtomCount = atomCount - dict1AtomCount;
  const slotCount = atomCount + ngramCount;
  const single = new Int32Array(slotCount);
  single.fill(-1, dict1AtomCount, dictSize);
  single.fill(-1, dictSize + dict2AtomCount, slotCount);
  const start = new Int32Array(slotCount);
  const length = new Int32Array(slotCount);
  function decodeDelta(count, off) {
    let previous = 0;
    let slot = off;
    const end = off + count;
    while (slot < end) {
      const code2 = BASE91_INVERSE[input.charCodeAt(pos++)];
      if (code2 < 89) {
        previous += code2;
        single[slot++] = previous;
      } else if (code2 === 89) {
        let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
        while (runLength--)
          single[slot++] = ++previous;
      } else {
        const next = BASE91_INVERSE[input.charCodeAt(pos++)];
        previous += 89 + // eslint-disable-next-line unicorn/prefer-minimal-ternary -- branches read a different number of side-effecting input bytes
        (next < 90 ? next * base + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base + BASE91_INVERSE[input.charCodeAt(pos++)]);
        single[slot++] = previous;
      }
    }
  }
  decodeDelta(dict1AtomCount, 0);
  decodeDelta(dict2AtomCount, dictSize);
  const references = new Int32Array(ngramCount * 2);
  let poolSize = 0;
  let ngramIndex = 0;
  function readNgramReferences(count, startSlot) {
    for (let index = 0; index < count; index++) {
      const slot = startSlot + index;
      const a = readSlotCode();
      const b = readSlotCode();
      references[ngramIndex * 2] = a;
      references[ngramIndex * 2 + 1] = b;
      ngramIndex += 1;
      start[slot] = poolSize;
      const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
      length[slot] = entryLength;
      poolSize += entryLength;
    }
  }
  readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
  readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
  const pool = new Uint16Array(poolSize);
  let write = 0;
  for (let index = 0; index < ngramIndex; index++) {
    for (let half = 0; half < 2; half++) {
      const source = references[index * 2 + half];
      const value = single[source];
      if (value < 0) {
        let read = start[source];
        const readEnd = read + length[source];
        while (read < readEnd)
          pool[write++] = pool[read++];
      } else {
        pool[write++] = value;
      }
    }
  }
  const out = new Uint16Array(resultLength);
  let outIndex = 0;
  while (pos < inputLength) {
    let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
    if (slot >= dictSize) {
      slot = slot * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
    }
    const value = single[slot];
    if (value < 0) {
      let read = start[slot];
      const readEnd = read + length[slot];
      while (read < readEnd)
        out[outIndex++] = pool[read++];
    } else {
      out[outIndex++] = value;
    }
  }
  return out;
}

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree = /* @__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);

// node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags;
(function(BinTrieFlags2) {
  BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags2[BinTrieFlags2["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  BinTrieFlags2[BinTrieFlags2["VALUE_MASK"] = 8191] = "VALUE_MASK";
})(BinTrieFlags || (BinTrieFlags = {}));

// node_modules/entities/dist/decode.js
var CharCodes;
(function(CharCodes2) {
  CharCodes2[CharCodes2["AMP"] = 38] = "AMP";
  CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
  CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
  CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
  CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
  CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
  CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
  CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
})(CharCodes || (CharCodes = {}));
var TO_LOWER_BIT = 32;
var CONSUMED_SHIFT = 21;
var CODE_POINT_MASK = 2097151;
var CONSUMED_OVERFLOW = 2047;
var longNumericConsumed = 0;
function unpackConsumed(packed) {
  const consumed = packed >>> CONSUMED_SHIFT;
  return consumed === CONSUMED_OVERFLOW ? longNumericConsumed : consumed;
}
function isNumber(code2) {
  return code2 - CharCodes.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter(code2) {
  return (code2 | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 5;
}
function isAlpha(code2) {
  return (code2 | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd(code2) {
  return code2 === CharCodes.EQUALS || isAlpha(code2) || isNumber(code2);
}
var EntityDecoderState;
(function(EntityDecoderState2) {
  EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function(DecodingMode2) {
  DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
  DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
  DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (jumpOffset) {
    if (branchCount === 0) {
      return char === jumpOffset ? nodeIndex : -1;
    }
    const slot = char - jumpOffset;
    if (slot >>> 0 >= branchCount)
      return -1;
    const stored = decodeTree[nodeIndex + slot];
    return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
  }
  if (branchCount === 0)
    return -1;
  const packedKeySlots = branchCount + 1 >> 1;
  const branchEnd = nodeIndex + packedKeySlots + branchCount;
  for (let index = 0; index < branchCount; index++) {
    const packed = decodeTree[nodeIndex + (index >> 1)];
    const key = packed >> ((index & 1) << 3) & 255;
    if (key === char) {
      const pointerIndex = nodeIndex + packedKeySlots + index;
      return branchEnd + decodeTree[pointerIndex] & 65535;
    }
    if (key > char)
      return -1;
  }
  return -1;
}
function readTrieValue(decodeTree, nodeIndex, valueLength) {
  if (valueLength === 1) {
    return String.fromCharCode(decodeTree[nodeIndex] & BinTrieFlags.VALUE_MASK);
  }
  if (valueLength === 2) {
    return String.fromCharCode(decodeTree[nodeIndex + 1]);
  }
  return String.fromCharCode(decodeTree[nodeIndex + 1], decodeTree[nodeIndex + 2]);
}
function parseNumericEntity(input, numberStart, inputLength) {
  let offset = numberStart + 1;
  let cp = 0;
  let digitStart = offset;
  if (offset < inputLength && (input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
    offset += 1;
    digitStart = offset;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        cp = cp * 16 + (char - CharCodes.ZERO);
      } else if (isHexadecimalCharacter(char)) {
        cp = cp * 16 + ((char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10);
      } else {
        break;
      }
      offset += 1;
    }
  } else {
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9)
        break;
      cp = cp * 10 + digit;
      offset += 1;
    }
  }
  if (offset === digitStart)
    return 0;
  if (offset < inputLength && input.charCodeAt(offset) === CharCodes.SEMI) {
    offset += 1;
  }
  if (cp > 1114111)
    cp = 1114112;
  let consumed = offset - numberStart;
  if (consumed >= CONSUMED_OVERFLOW) {
    longNumericConsumed = consumed;
    consumed = CONSUMED_OVERFLOW;
  }
  return consumed << CONSUMED_SHIFT | cp;
}
function decodeWithTrie(input, isStrict, isAttribute) {
  const decodeTree = htmlDecodeTree;
  let offset = input.indexOf("&");
  if (offset < 0)
    return input;
  const inputLength = input.length;
  let chunkStart = 0;
  let result = "";
  const root = decodeTree[0];
  const rootJumpOffset = root & BinTrieFlags.JUMP_TABLE;
  const rootBranchCount = (root & BinTrieFlags.BRANCH_LENGTH) >> 7;
  do {
    const entityStart = offset + 1;
    const firstChar = input.charCodeAt(entityStart);
    let consumed;
    let value;
    if (firstChar === CharCodes.NUM) {
      const packed = parseNumericEntity(input, entityStart, inputLength);
      consumed = unpackConsumed(packed);
      if (isStrict && consumed > 0 && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI) {
        consumed = 0;
      }
      value = consumed === 0 ? "" : codePointToString(packed & CODE_POINT_MASK);
    } else if (isAlpha(firstChar)) {
      consumed = 0;
      value = "";
      const rootSlotIndex = firstChar - rootJumpOffset;
      let nodeIndex;
      if (rootSlotIndex >>> 0 < rootBranchCount) {
        const stored = decodeTree[1 + rootSlotIndex];
        nodeIndex = stored === 0 ? -1 : rootBranchCount + stored & 65535;
      } else {
        nodeIndex = -1;
      }
      let bestNodeIndex = 0;
      let bestValueLength = 0;
      let current = nodeIndex < 0 ? 0 : decodeTree[nodeIndex];
      let index = entityStart + 1;
      trie: while (index < inputLength) {
        while (
          // Value-less, non-run node with a nonzero jump offset.
          (current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0
        ) {
          const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
          const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
          if (branchCount === 0) {
            if (input.charCodeAt(index) !== jumpOffset)
              break trie;
            nodeIndex += 1;
          } else {
            const slot = input.charCodeAt(index) - jumpOffset;
            if (slot >>> 0 >= branchCount)
              break trie;
            const stored = decodeTree[nodeIndex + 1 + slot];
            if (stored === 0)
              break trie;
            nodeIndex = nodeIndex + branchCount + stored & 65535;
          }
          current = decodeTree[nodeIndex];
          index += 1;
          if (index >= inputLength)
            break trie;
        }
        if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
          const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
          if (input.charCodeAt(index) !== (current & BinTrieFlags.JUMP_TABLE)) {
            break;
          }
          index += 1;
          const remaining = runLength - 1;
          let wordIndex = nodeIndex + 1;
          let charIndexInPacked = 0;
          for (; charIndexInPacked + 1 < remaining; charIndexInPacked += 2) {
            const packed = decodeTree[wordIndex];
            if (input.charCodeAt(index) !== (packed & 255))
              break trie;
            index += 1;
            if (input.charCodeAt(index) !== (packed >> 8 & 255))
              break trie;
            index += 1;
            wordIndex += 1;
          }
          if (charIndexInPacked < remaining) {
            if (input.charCodeAt(index) !== (decodeTree[wordIndex] & 255))
              break;
            index += 1;
          }
          nodeIndex += 1 + (runLength >> 1);
          current = decodeTree[nodeIndex];
          continue;
        }
        const valueLength = current >>> 14;
        const char = input.charCodeAt(index);
        if (valueLength !== 0) {
          if (char === CharCodes.SEMI) {
            consumed = index - entityStart + 1;
            value = valueLength === 1 ? String.fromCharCode(current & BinTrieFlags.VALUE_MASK) : readTrieValue(decodeTree, nodeIndex, valueLength);
            break;
          }
          if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
            consumed = index - entityStart;
            bestNodeIndex = nodeIndex;
            bestValueLength = valueLength;
          }
          if (valueLength === 1)
            break;
        }
        const next = determineBranch(decodeTree, current, nodeIndex + (valueLength || 1), char);
        if (next < 0)
          break;
        nodeIndex = next;
        current = decodeTree[nodeIndex];
        index += 1;
      }
      if (value === "") {
        const finalVL = current >>> 14;
        if (finalVL !== 0 && !isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          consumed = index - entityStart;
          bestNodeIndex = nodeIndex;
          bestValueLength = finalVL;
        }
        if (consumed > 0) {
          value = readTrieValue(decodeTree, bestNodeIndex, bestValueLength);
        }
      }
    } else {
      consumed = 0;
      value = "";
    }
    if (consumed === 0 || isAttribute && firstChar !== CharCodes.NUM && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI && entityStart + consumed < inputLength && isEntityInAttributeInvalidEnd(input.charCodeAt(entityStart + consumed))) {
      offset = entityStart;
    } else {
      if (chunkStart < offset) {
        result += input.slice(chunkStart, offset);
      }
      result += value;
      offset = chunkStart = entityStart + consumed;
    }
    if (input.charCodeAt(offset) !== CharCodes.AMP) {
      offset = input.indexOf("&", offset);
    }
  } while (offset >= 0);
  return result + input.slice(chunkStart);
}
function decodeHTMLStrict(htmlString) {
  return decodeWithTrie(htmlString, true, false);
}

// node_modules/entities/dist/index.js
var EntityLevel;
(function(EntityLevel2) {
  EntityLevel2[EntityLevel2["XML"] = 0] = "XML";
  EntityLevel2[EntityLevel2["HTML"] = 1] = "HTML";
})(EntityLevel || (EntityLevel = {}));
var EncodingMode;
(function(EncodingMode2) {
  EncodingMode2[EncodingMode2["UTF8"] = 0] = "UTF8";
  EncodingMode2[EncodingMode2["ASCII"] = 1] = "ASCII";
  EncodingMode2[EncodingMode2["Extensive"] = 2] = "Extensive";
  EncodingMode2[EncodingMode2["Attribute"] = 3] = "Attribute";
  EncodingMode2[EncodingMode2["Text"] = 4] = "Text";
})(EncodingMode || (EncodingMode = {}));

// node_modules/linkify-it/build/index.mjs
var REBuilder = class {
  src_Any = Any.source;
  src_Cc = Cc.source;
  src_Z = Z.source;
  src_P = P.source;
  src_ZPCc = [
    this.src_Z,
    this.src_P,
    this.src_Cc
  ].join("|");
  src_ZCc = [this.src_Z, this.src_Cc].join("|");
  cache = {};
  opts = {
    maxLength: 1e4,
    urlAuth: false,
    schema_names: []
  };
  constructor(opts = {}) {
    this.opts = {
      ...this.opts,
      ...opts
    };
  }
  set(opts = {}) {
    this.opts = {
      ...this.opts,
      ...opts
    };
    this.cache = {};
    return this;
  }
  escapeRE(str) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
  }
  nestedPairRE(open, close, depth = 4) {
    const openRE = this.escapeRE(open);
    const closeRE = this.escapeRE(close);
    const atom = `(?:(?!${this.src_ZCc}|${openRE}|${closeRE}).)`;
    let pair = `${openRE}${atom}{0,1000}${closeRE}`;
    for (let level = 2; level <= depth; level++) pair = `${openRE}(?:${atom}|${pair}){0,1000}${closeRE}`;
    return pair;
  }
  get_text_separators() {
    return this.cache.text_separators ??= /[><\uff5c]/;
  }
  get_pseudo_letter() {
    return this.cache.src_pseudo_letter ??= new RegExp(`(?:(?!${this.get_text_separators().source}|${this.src_ZPCc})${this.src_Any})`);
  }
  get_ipv4_addr() {
    return this.cache.src_ip4 ??= /* @__PURE__ */ new RegExp("(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])[.]){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])");
  }
  get_ipv6_addr() {
    const h16 = "[0-9A-Fa-f]{1,4}";
    const ls32 = `(?:(?:${h16}:${h16})|${this.get_ipv4_addr().source})`;
    return this.cache.src_ip6_addr ??= new RegExp(`(?:(?:${h16}:){6}${ls32}|::(?:${h16}:){5}${ls32}|(?:${h16})?::(?:${h16}:){4}${ls32}|(?:(?:${h16}:){0,1}${h16})?::(?:${h16}:){3}${ls32}|(?:(?:${h16}:){0,2}${h16})?::(?:${h16}:){2}${ls32}|(?:(?:${h16}:){0,3}${h16})?::${h16}:${ls32}|(?:(?:${h16}:){0,4}${h16})?::${ls32}|(?:(?:${h16}:){0,5}${h16})?::${h16}|(?:(?:${h16}:){0,6}${h16})?::)`);
  }
  get_ipv6_url_host() {
    return this.cache.src_ip6_host ??= new RegExp(`\\[${this.get_ipv6_addr().source}\\]`);
  }
  get_ipv6_mail_host() {
    return this.cache.src_ipv6_mail_host ??= new RegExp(`\\[IPv6:${this.get_ipv6_addr().source}\\]`);
  }
  get_auth() {
    return this.cache.src_auth ??= new RegExp(`(?:(?:(?!${this.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`);
  }
  get_port() {
    return this.cache.src_port ??= /* @__PURE__ */ new RegExp("(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?");
  }
  get_host_terminator() {
    return this.cache.src_host_terminator ??= new RegExp(`(?=$|${this.get_text_separators().source}|${this.src_ZPCc})(?!${this.opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${this.src_ZPCc}))`);
  }
  get_path_terminator() {
    return this.cache.src_path_terminator ??= new RegExp(`${this.src_ZPCc}|${this.get_text_separators().source}`);
  }
  get_path() {
    return this.cache.src_path ??= new RegExp(`(?:[/?#](?:${this.nestedPairRE("[", "]")}|${this.nestedPairRE("(", ")")}|${this.nestedPairRE("{", "}")}|\\"(?:(?!${this.src_ZCc}|["]).){1,100}\\"|\\'(?:(?!${this.src_ZCc}|[']).){1,100}\\'|\\'(?=${this.get_pseudo_letter().source}|[-])|\\.{2,20}[:]?[a-zA-Z0-9%/&]|\\.(?!${this.src_ZCc}|[.]|$)|` + (this.opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-{0,19})|" : "\\-{1,20}|") + `,(?!${this.src_ZCc}|$)|;(?!${this.src_ZCc}|$)|\\!{1,20}(?!${this.src_ZCc}|[!]|$)|\\?(?!${this.src_ZCc}|[?]|$)|` + this.get_path_extra().source + `[\\\\/:%@#&=_~*]|(?!${this.get_path_terminator().source}).){1,${this.opts.maxLength}}|\\/)?`);
  }
  get_mail_name() {
    return this.cache.src_mail_name ??= /* @__PURE__ */ new RegExp("[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9](?:[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9]|[.](?=[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9])){0,63}");
  }
  get_xn() {
    return this.cache.src_xn ??= /* @__PURE__ */ new RegExp("xn--[a-z0-9\\-]{1,59}");
  }
  get_tld() {
    if (this.cache.tld) return this.cache.tld;
    const tlds_src = [...new Set(this.opts.tlds || [])].sort().reverse().join("|");
    this.cache.tld = new RegExp(`${tlds_src || "$#none#$"}|${this.get_xn().source}`);
    return this.cache.tld;
  }
  get_domain_root() {
    return this.cache.src_domain_root ??= new RegExp("(?:" + this.get_xn().source + `|${this.get_pseudo_letter().source}{1,63})`);
  }
  get_domain() {
    return this.cache.src_domain ??= new RegExp("(?:" + this.get_xn().source + `|(?:${this.get_pseudo_letter().source})|(?:${this.get_pseudo_letter().source}(?:-|${this.get_pseudo_letter().source}){0,61}${this.get_pseudo_letter().source}))`);
  }
  get_url_host_port() {
    return this.cache.url_host_port ??= new RegExp("(?:" + this.get_ipv6_url_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,10}${this.get_domain().source}))` + this.get_port().source + this.get_host_terminator().source);
  }
  get_fuzzy_url_host_port() {
    return this.cache.fuzzy_url_host_port ??= new RegExp("(?:" + (this.opts.fuzzyIP ? this.get_ipv4_addr().source + "|" : "") + `(?:(?:(?:${this.get_domain().source})\\.){1,10}(?:${this.get_tld().source})))` + this.get_host_terminator().source);
  }
  get_mail_host() {
    return this.cache.src_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,4}${this.get_domain().source}))` + this.get_host_terminator().source);
  }
  get_fuzzy_mail_host() {
    return this.cache.src_fuzzy_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})[.]){1,4}${this.get_domain_root().source}))` + this.get_host_terminator().source);
  }
  get_path_extra() {
    return this.cache.src_path_extra ??= /* @__PURE__ */ new RegExp("");
  }
  get_fuzzy_mail_host_search() {
    return this.cache.mail_fuzzy_host_search ??= new RegExp(`@${this.get_fuzzy_mail_host().source}`, "ig");
  }
  get_fuzzy_link_search() {
    return this.cache.link_fuzzy_search ??= new RegExp(`(^|(?![.:/\\-_@])(?:[$+<=>^\`|\uFF5C]|${this.src_ZPCc}))(?:(?![$+<=>^\`|\uFF5C])${this.get_fuzzy_url_host_port().source}${this.get_path().source})`, "ig");
  }
  get_http_validator() {
    return this.cache.http_validator ??= new RegExp("\\/\\/" + (this.opts.urlAuth ? this.get_auth().source : "") + this.get_url_host_port().source + this.get_path().source, "iy");
  }
  get_relative_proto_validator() {
    return this.cache.relative_proto_validator ??= new RegExp((this.opts.urlAuth ? this.get_auth().source : "") + `(?:localhost|${this.get_ipv6_url_host().source}|(?:(?:${this.get_domain().source})[.]){1,10}${this.get_domain_root().source})` + this.get_port().source + this.get_host_terminator().source + this.get_path().source, "iy");
  }
  get_mail_name_validator() {
    return this.cache.mail_name_validator ??= new RegExp(`(?:^|${this.get_text_separators().source}|"|\\(|${this.src_ZCc})(${this.get_mail_name().source})$`);
  }
  get_mailto_validator() {
    return this.cache.mailto_validator ??= new RegExp(`${this.get_mail_name().source}@${this.get_mail_host().source}`, "iy");
  }
  get_schema_names() {
    return this.cache.schema_names ??= new RegExp((this.opts.schema_names || []).map((name) => this.escapeRE(name)).join("|"));
  }
  get_schema_search() {
    return this.cache.schema_search ??= new RegExp(`(^|(?!_)(?:[><\uFF5C]|${this.src_ZPCc}))(${this.get_schema_names().source})`, "ig");
  }
  get_schema_at_start() {
    return this.cache.schema_at_start ??= new RegExp(`^${this.get_schema_search().source}`, "i");
  }
};
var web_schema = {
  validate: (text2, pos, self) => {
    const re = self.re.get_http_validator();
    re.lastIndex = pos;
    const m = re.exec(text2);
    return m ? m[0].length : 0;
  },
  normalize: (match, self) => self.normalize(match)
};
var defaultSchemas = {
  "http:": web_schema,
  "https:": web_schema,
  "ftp:": web_schema,
  "//": {
    validate: function(text2, pos, self) {
      const re = self.re.get_relative_proto_validator();
      re.lastIndex = pos;
      const m = re.exec(text2);
      if (m) {
        if (pos >= 3 && text2[pos - 3] === ":") return 0;
        if (pos >= 3 && text2[pos - 3] === "/") return 0;
        return m[0].length;
      }
      return 0;
    },
    normalize: (match, self) => self.normalize(match)
  },
  "mailto:": {
    validate: function(text2, pos, self) {
      const re = self.re.get_mailto_validator();
      re.lastIndex = pos;
      const m = re.exec(text2);
      return m ? m[0].length : 0;
    },
    normalize: (match, self) => self.normalize(match)
  }
};
var tlds_2ch = "a:cdefgilmnoqrstuwxz|b:abdefghijmnorstvwyz|c:acdfghiklmnoruvwxyz|d:ejkmoz|e:cegrstu|f:ijkmor|g:abdefghilmnpqrstuwy|h:kmnrtu|i:delmnoqrst|j:emop|k:eghimnprwyz|l:abcikrstuvy|m:acdeghklmnopqrstuvwxyz|n:acefgilopruz|o:m|p:aefghklmnrstwy|q:a|r:eosuw|s:abcdeghijklmnortuvxyz|t:cdfghjklmnortvwz|u:agksyz|v:aceginu|w:fs|y:et|z:amw";
var tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|\u0440\u0444";
function unpackTlds() {
  const result = tlds_default.split("|");
  tlds_2ch.split("|").forEach((item) => {
    const sep5 = item.indexOf(":");
    const prefix = item.slice(0, sep5);
    for (const suffix of item.slice(sep5 + 1)) result.push(prefix + suffix);
  });
  return result;
}
var defaultOptions = {
  fuzzyLink: false,
  fuzzyEmail: true,
  fuzzyIP: false,
  "---": false,
  tlds: unpackTlds(),
  urlAuth: false,
  maxLength: 1e4
};
var Match = class {
  /** Prefix (protocol) for matched string. Empty for fuzzy links. */
  schema;
  /** First position of matched string. */
  index;
  /** Next position after matched string. */
  lastIndex;
  /** Matched string. */
  raw;
  /** Normalized text of matched string. */
  text;
  /** Normalized URL of matched string. */
  url;
  constructor(text2, schema, index, lastIndex) {
    const raw = text2.slice(index, lastIndex);
    this.schema = schema.toLowerCase();
    this.index = index;
    this.lastIndex = lastIndex;
    this.raw = raw;
    this.text = raw;
    this.url = raw;
  }
};
var LinkifyIt = class {
  __opts__;
  __schemas__;
  re;
  /**
  * Creates new linkifier instance.
  *
  * By default understands:
  *
  * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
  * - "fuzzy" emails (foo@bar.com).
  *
  * See {@link LinkifyConstructorOptions} for available options.
  *
  * @param options Recognition options.
  *
  * @example
  * ```javascript
  * import { LinkifyIt } from 'linkify-it'
  *
  * const linkify = new LinkifyIt({ fuzzyLink: true })
  *
  * linkify
  *   .tlds(require('tlds'))       // Reload with full TLD list
  *   .tlds('onion', true)         // Add unofficial `.onion` domain
  *   .add('ftp:', null)           // Disable `ftp:` protocol
  *   .set({ fuzzyIP: true })      // Enable IPs in fuzzy links
  *
  * console.log(linkify.test('Site github.com!')) // true
  * console.log(linkify.match('Site github.com!'))
  * ```
  */
  constructor(options = {}) {
    const { rebuilder, ...linkifyOptions } = options;
    this.__opts__ = {
      ...defaultOptions,
      ...linkifyOptions
    };
    this.__schemas__ = { ...defaultSchemas };
    this.re = rebuilder || new REBuilder();
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
  }
  /**
  * Add new rule definition.
  *
  * `schema` is a link prefix (usually, protocol name with `:` at the end,
  * `skype:` for example). `linkify-it` makes sure that prefix is not
  * preceded with alphanumeric char and symbols. Only whitespaces and
  * punctuation allowed.
  *
  * `definition` is a rule to check tail after link prefix. To disable an
  * existing rule, pass `null`.
  *
  * @param schema Rule name (fixed pattern prefix).
  * @param definition Schema definition, or `null` to disable the rule.
  *
  * See [twitter mentions example](https://github.com/markdown-it/linkify-it/blob/master/examples/twitter.mjs).
  */
  add(schema, definition = null) {
    if (!definition) delete this.__schemas__[schema];
    else {
      const def = {
        normalize: (match, self) => self.normalize(match),
        ...definition
      };
      this.__schemas__[schema] = def;
    }
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Set recognition options for links without schema.
  *
  * @param options Recognition options.
  */
  set(options = {}) {
    this.__opts__ = {
      ...this.__opts__,
      ...options
    };
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Searches linkifiable pattern and returns `true` on success or `false` on fail.
  *
  * @param text Text to scan.
  */
  test(text2) {
    if (!text2.length) return false;
    let m, re;
    re = this.re.get_schema_search();
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) if (this.testSchemaAt(text2, m[2], re.lastIndex)) return true;
    if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
      re = this.re.get_fuzzy_link_search();
      re.lastIndex = 0;
      if (re.exec(text2) !== null) return true;
    }
    if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
      if (text2.indexOf("@") >= 0) {
        const mailHostRe = this.re.get_fuzzy_mail_host_search();
        const mailNameRe = this.re.get_mail_name_validator();
        mailHostRe.lastIndex = 0;
        while ((m = mailHostRe.exec(text2)) !== null) {
          const name = text2.slice(Math.max(0, m.index - 65), m.index);
          if (mailNameRe.test(name)) return true;
        }
      }
    }
    return false;
  }
  /**
  * Similar to {@link LinkifyIt.test} but checks only specific protocol tail exactly
  * at given position. Returns length of found pattern (0 on fail).
  *
  * @param text Text to scan.
  * @param schema Rule (schema) name.
  * @param pos Text offset to check from.
  */
  testSchemaAt(text2, schema, pos) {
    if (!this.__schemas__[schema.toLowerCase()]) return 0;
    return this.__schemas__[schema.toLowerCase()].validate(text2.slice(0, pos + this.__opts__.maxLength), pos, this);
  }
  /**
  * Returns array of found link descriptions or `null` on fail. We strongly
  * recommend to use {@link LinkifyIt.test} first, for best speed.
  *
  * @param text Text to scan.
  */
  match(text2) {
    const result = [];
    const schemaRe = this.re.get_schema_search();
    let fuzzyLinkRe;
    let mailHostRe;
    let mailNameRe;
    let fuzzyLinkCandidate;
    let fuzzyEmailCandidate;
    let schemaPrefix;
    let schemaDone = false;
    let fuzzyLinkDone = false;
    let fuzzyEmailDone = false;
    let pos = 0;
    if (!text2.length) return null;
    schemaRe.lastIndex = 0;
    if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
      fuzzyLinkRe = this.re.get_fuzzy_link_search();
      fuzzyLinkRe.lastIndex = 0;
    }
    if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
      mailHostRe = this.re.get_fuzzy_mail_host_search();
      mailHostRe.lastIndex = 0;
      mailNameRe = this.re.get_mail_name_validator();
    }
    for (; ; ) {
      const scanFrom = Math.max(pos - 1, 0);
      if (mailHostRe && mailNameRe && !fuzzyEmailDone && (!fuzzyEmailCandidate || fuzzyEmailCandidate.index < pos)) {
        if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
        for (; ; ) {
          const m = mailHostRe.exec(text2);
          if (!m) {
            fuzzyEmailDone = true;
            fuzzyEmailCandidate = void 0;
            break;
          }
          const name = mailNameRe.exec(text2.slice(Math.max(0, m.index - 65), m.index));
          if (!name) continue;
          fuzzyEmailCandidate = {
            schema: "mailto:",
            index: m.index - name[1].length,
            lastIndex: m.index + m[0].length
          };
          if (fuzzyEmailCandidate.index >= pos) break;
          if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
        }
      }
      if (fuzzyLinkRe && !fuzzyLinkDone && (!fuzzyLinkCandidate || fuzzyLinkCandidate.index < pos)) {
        if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
        for (; ; ) {
          const m = fuzzyLinkRe.exec(text2);
          if (!m) {
            fuzzyLinkDone = true;
            fuzzyLinkCandidate = void 0;
            break;
          }
          fuzzyLinkCandidate = {
            schema: "",
            index: m.index + m[1].length,
            lastIndex: m.index + m[0].length
          };
          if (fuzzyLinkCandidate.index >= pos) break;
          if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
        }
      }
      let fuzzyCandidate = fuzzyEmailCandidate;
      if (!fuzzyCandidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < fuzzyCandidate.index || fuzzyLinkCandidate.index === fuzzyCandidate.index && fuzzyLinkCandidate.lastIndex > fuzzyCandidate.lastIndex)) fuzzyCandidate = fuzzyLinkCandidate;
      let schemaCandidate;
      if (!schemaDone) for (; ; ) {
        if (!schemaPrefix) {
          if (schemaRe.lastIndex < scanFrom) schemaRe.lastIndex = scanFrom;
          const m = schemaRe.exec(text2);
          if (!m) {
            schemaDone = true;
            break;
          }
          schemaPrefix = {
            schema: m[2],
            index: m.index + m[1].length,
            lastIndex: m.index + m[0].length
          };
        }
        if (schemaPrefix.index < pos) {
          schemaPrefix = void 0;
          continue;
        }
        if (fuzzyCandidate && schemaPrefix.index > fuzzyCandidate.index) break;
        const prefix = schemaPrefix;
        schemaPrefix = void 0;
        const len = this.testSchemaAt(text2, prefix.schema, prefix.lastIndex);
        if (len) {
          schemaCandidate = {
            schema: prefix.schema,
            index: prefix.index,
            lastIndex: prefix.lastIndex + len
          };
          break;
        }
      }
      let candidate = schemaCandidate;
      if (!candidate || fuzzyEmailCandidate && (fuzzyEmailCandidate.index < candidate.index || fuzzyEmailCandidate.index === candidate.index && fuzzyEmailCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyEmailCandidate;
      if (!candidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < candidate.index || fuzzyLinkCandidate.index === candidate.index && fuzzyLinkCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyLinkCandidate;
      if (!candidate) break;
      if (candidate === fuzzyEmailCandidate) fuzzyEmailCandidate = void 0;
      else if (candidate === fuzzyLinkCandidate) fuzzyLinkCandidate = void 0;
      const match = new Match(text2, candidate.schema, candidate.index, candidate.lastIndex);
      if (match.schema) this.__schemas__[match.schema].normalize(match, this);
      else this.normalize(match);
      result.push(match);
      pos = candidate.lastIndex;
    }
    if (result.length) return result;
    return null;
  }
  /**
  * Returns fully-formed (not fuzzy) link if it starts at the beginning
  * of the string, and null otherwise.
  *
  * @param text Text to scan.
  */
  matchAtStart(text2) {
    if (!text2.length) return null;
    const m = this.re.get_schema_at_start().exec(text2);
    if (!m) return null;
    const len = this.testSchemaAt(text2, m[2], m[0].length);
    if (!len) return null;
    const match = new Match(text2, m[2], m.index + m[1].length, m.index + m[0].length + len);
    this.__schemas__[match.schema].normalize(match, this);
    return match;
  }
  /**
  * Load (or merge) new TLDs list. Those are used for fuzzy links (without
  * prefix) to avoid false positives. By default this algorithm is used:
  *
  * - hostname with any 2-letter root zones are ok.
  * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
  *   are ok.
  * - encoded (`xn--...`) root zones are ok.
  *
  * If list is replaced, then exact match for 2-chars root zones will be checked.
  *
  * @param list List of TLDs.
  * @param keepOld Merge with current list if `true` (`false` by default).
  */
  tlds(list2, keepOld = false) {
    list2 = Array.isArray(list2) ? list2 : [list2];
    if (!keepOld) this.__opts__.tlds = list2;
    else this.__opts__.tlds = this.__opts__.tlds.concat(list2);
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Default normalizer (if schema does not define its own).
  *
  * @param match Match to normalize.
  */
  normalize(match) {
    if (!match.schema) match.url = `http://${match.url}`;
    if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) match.url = `mailto:${match.url}`;
  }
};

// node_modules/markdown-it/dist/markdown-it.mjs
var import_punycode = __toESM(require_punycode(), 1);
var __defProp2 = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp2(target, name, {
    get: all[name],
    enumerable: true
  });
  if (!no_symbols) __defProp2(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
var utils_exports = /* @__PURE__ */ __exportAll({
  arrayReplaceAt: () => arrayReplaceAt,
  asciiTrim: () => asciiTrim,
  callable: () => callable,
  escapeHtml: () => escapeHtml,
  escapeRE: () => escapeRE,
  fromCodePoint: () => fromCodePoint,
  isMdAsciiPunct: () => isMdAsciiPunct,
  isPunctChar: () => isPunctChar,
  isPunctCharCode: () => isPunctCharCode,
  isSpace: () => isSpace,
  isValidEntityCode: () => isValidEntityCode,
  isWhiteSpace: () => isWhiteSpace,
  lib: () => lib,
  normalizeReference: () => normalizeReference,
  unescapeAll: () => unescapeAll,
  unescapeMd: () => unescapeMd
});
function callable(cls) {
  const wrapper = function(...args) {
    return Reflect.construct(cls, args, new.target && new.target !== wrapper ? new.target : cls);
  };
  Object.defineProperty(wrapper, "name", { value: cls.name });
  Object.setPrototypeOf(wrapper, cls);
  wrapper.prototype = cls.prototype;
  return wrapper;
}
function arrayReplaceAt(src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}
function isValidEntityCode(c) {
  if (c >= 55296 && c <= 57343) return false;
  if (c >= 64976 && c <= 65007) return false;
  if ((c & 65535) === 65535 || (c & 65535) === 65534) return false;
  if (c >= 0 && c <= 8) return false;
  if (c === 11) return false;
  if (c >= 14 && c <= 31) return false;
  if (c >= 127 && c <= 159) return false;
  if (c > 1114111) return false;
  return true;
}
function fromCodePoint(c) {
  if (c > 65535) {
    c -= 65536;
    const surrogate1 = 55296 + (c >> 10);
    const surrogate2 = 56320 + (c & 1023);
    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}
var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
var UNESCAPE_ALL_RE = new RegExp(`${UNESCAPE_MD_RE.source}|${/&([a-z#][a-z0-9]{1,31});/gi.source}`, "gi");
var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
function replaceEntityPattern(match, name) {
  if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code2 = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    if (isValidEntityCode(code2)) return fromCodePoint(code2);
    return match;
  }
  const decoded = decodeHTMLStrict(match);
  if (decoded !== match) return decoded;
  return match;
}
function unescapeMd(str) {
  if (str.indexOf("\\") < 0) return str;
  return str.replace(UNESCAPE_MD_RE, "$1");
}
function unescapeAll(str) {
  if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) return str;
  return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity2) {
    if (escaped) return escaped;
    return replaceEntityPattern(match, entity2);
  });
}
var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};
function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}
function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  return str;
}
var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
function escapeRE(str) {
  return str.replace(REGEXP_ESCAPE_RE, "\\$&");
}
function isSpace(code2) {
  switch (code2) {
    case 9:
    case 32:
      return true;
  }
  return false;
}
function isWhiteSpace(code2) {
  if (code2 >= 8192 && code2 <= 8202) return true;
  switch (code2) {
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 32:
    case 160:
    case 5760:
    case 8239:
    case 8287:
    case 12288:
      return true;
  }
  return false;
}
function isPunctChar(ch) {
  return P.test(ch) || S.test(ch);
}
function isPunctCharCode(code2) {
  return isPunctChar(fromCodePoint(code2));
}
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 33:
    case 34:
    case 35:
    case 36:
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
    case 42:
    case 43:
    case 44:
    case 45:
    case 46:
    case 47:
    case 58:
    case 59:
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 124:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function normalizeReference(str) {
  str = str.trim().replace(/\s+/g, " ");
  return str.toLowerCase().toUpperCase();
}
function isAsciiTrimmable(c) {
  return c === 32 || c === 9 || c === 10 || c === 13;
}
function asciiTrim(str) {
  let start = 0;
  for (; start < str.length; start++) if (!isAsciiTrimmable(str.charCodeAt(start))) break;
  let end = str.length - 1;
  for (; end >= start; end--) if (!isAsciiTrimmable(str.charCodeAt(end))) break;
  return str.slice(start, end + 1);
}
var lib = {
  mdurl: mdurl_exports,
  ucmicro: build_exports
};
function parseLinkLabel(state, start, disableNested) {
  let level, found, marker, prevPos;
  const max = state.posMax;
  const oldPos = state.pos;
  state.pos = start + 1;
  level = 1;
  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 93) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }
    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 91) {
      if (prevPos === state.pos - 1) level++;
      else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }
  let labelEnd = -1;
  if (found) labelEnd = state.pos;
  state.pos = oldPos;
  return labelEnd;
}
function parseLinkDestination(str, start, max) {
  let code2;
  let pos = start;
  const result = {
    ok: false,
    pos: 0,
    str: ""
  };
  if (str.charCodeAt(pos) === 60) {
    pos++;
    while (pos < max) {
      code2 = str.charCodeAt(pos);
      if (code2 === 10) return result;
      if (code2 === 60) return result;
      if (code2 === 62) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code2 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      pos++;
    }
    return result;
  }
  let level = 0;
  while (pos < max) {
    code2 = str.charCodeAt(pos);
    if (code2 === 32) break;
    if (code2 < 32 || code2 === 127) break;
    if (code2 === 92 && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 32) {
        pos++;
        continue;
      }
      pos += 2;
      continue;
    }
    if (code2 === 40) {
      level++;
      if (level > 32) return result;
    }
    if (code2 === 41) {
      if (level === 0) break;
      level--;
    }
    pos++;
  }
  if (start === pos) return result;
  if (level !== 0) return result;
  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result;
}
function parseLinkTitle(str, start, max, prev_state) {
  let code2;
  let pos = start;
  const state = {
    ok: false,
    can_continue: false,
    pos: 0,
    str: "",
    marker: 0
  };
  if (prev_state) {
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max) return state;
    let marker = str.charCodeAt(pos);
    if (marker !== 34 && marker !== 39 && marker !== 40) return state;
    start++;
    pos++;
    if (marker === 40) marker = 41;
    state.marker = marker;
  }
  while (pos < max) {
    code2 = str.charCodeAt(pos);
    if (code2 === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state;
    } else if (code2 === 40 && state.marker === 41) return state;
    else if (code2 === 92 && pos + 1 < max) pos++;
    pos++;
  }
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state;
}
var helpers_exports = /* @__PURE__ */ __exportAll({
  parseLinkDestination: () => parseLinkDestination,
  parseLinkLabel: () => parseLinkLabel,
  parseLinkTitle: () => parseLinkTitle
});
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}
function toPrimitive(t, r) {
  if ("object" != _typeof(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}
function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
var Token = class {
  constructor(type, tag, nesting) {
    _defineProperty(
      this,
      /**
      * Source map info. Format: `[ line_begin, line_end ]`
      */
      "map",
      null
    );
    _defineProperty(
      this,
      /**
      * nesting level, the same as `state.level`
      */
      "level",
      0
    );
    _defineProperty(
      this,
      /**
      * An array of child nodes (inline and img tokens)
      */
      "children",
      null
    );
    _defineProperty(
      this,
      /**
      * In a case of self-closing tag (code, html, fence, etc.),
      * it has contents of this tag.
      */
      "content",
      ""
    );
    _defineProperty(
      this,
      /**
      * '*' or '_' for emphasis, fence string for fence, etc.
      */
      "markup",
      ""
    );
    _defineProperty(
      this,
      /**
      * Additional information:
      *
      * - Info string for "fence" tokens
      * - The value "auto" for autolink "link_open" and "link_close" tokens
      * - The string value of the item marker for ordered-list "list_item_open" tokens
      */
      "info",
      ""
    );
    _defineProperty(
      this,
      /**
      * True for block-level tokens, false for inline tokens.
      * Used in renderer to calculate line breaks
      */
      "block",
      false
    );
    _defineProperty(
      this,
      /**
      * If it's true, ignore this element when rendering. Used for tight lists
      * to hide paragraphs.
      */
      "hidden",
      false
    );
    this.type = type;
    this.tag = tag;
    this.attrs = null;
    this.nesting = nesting;
    this.meta = null;
  }
  /**
  * Search attribute index by name.
  */
  attrIndex(name) {
    if (!this.attrs) return -1;
    const attrs = this.attrs;
    for (let i = 0, len = attrs.length; i < len; i++) if (attrs[i][0] === name) return i;
    return -1;
  }
  /**
  * Add `[ name, value ]` attribute to list. Init attrs if necessary
  */
  attrPush(attrData) {
    if (this.attrs) this.attrs.push(attrData);
    else this.attrs = [attrData];
  }
  /**
  * Set `name` attribute to `value`. Override old value if exists.
  */
  attrSet(name, value) {
    const idx = this.attrIndex(name);
    const attrData = [name, value];
    if (idx < 0) this.attrPush(attrData);
    else this.attrs[idx] = attrData;
  }
  /**
  * Get the value of attribute `name`, or null if it does not exist.
  */
  attrGet(name) {
    const idx = this.attrIndex(name);
    let value = null;
    if (idx >= 0) value = this.attrs[idx][1];
    return value;
  }
  /**
  * Join value to existing attribute via space. Or create new attribute if not
  * exists. Useful to operate with token classes.
  */
  attrJoin(name, value) {
    const idx = this.attrIndex(name);
    if (idx < 0) this.attrPush([name, value]);
    else this.attrs[idx][1] = `${this.attrs[idx][1]} ${value}`;
  }
};
var Ruler = class {
  constructor() {
    _defineProperty(
      this,
      /** @internal */
      "__rules__",
      []
    );
    _defineProperty(
      this,
      /** @internal */
      "__cache__",
      null
    );
  }
  /** @internal */
  __find__(name) {
    for (let i = 0; i < this.__rules__.length; i++) if (this.__rules__[i].name === name) return i;
    return -1;
  }
  /** @internal */
  __compile__() {
    const chains = /* @__PURE__ */ new Set();
    this.__rules__.forEach((rule) => {
      if (!rule.enabled) return;
      rule.alt.forEach((altName) => {
        if (altName) chains.add(altName);
      });
    });
    this.__cache__ = /* @__PURE__ */ Object.create(null);
    this.__cache__[""] = [];
    this.__rules__.forEach((rule) => {
      if (rule.enabled) this.__cache__[""].push(rule.fn);
    });
    chains.forEach((chain) => {
      this.__cache__[chain] = [];
      this.__rules__.forEach((rule) => {
        if (rule.enabled && rule.alt.indexOf(chain) >= 0) this.__cache__[chain].push(rule.fn);
      });
    });
  }
  /**
  * Replace rule by name with new function & options. Throws error if name not
  * found.
  *
  * @example Replace existing typographer replacement rule with new one
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.core.ruler.at('replacements', function replace(state) {
  *   //...
  * });
  * ```
  */
  at(name, fn, options = {}) {
    const index = this.__find__(name);
    if (index === -1) throw new Error(`Parser rule not found: ${name}`);
    this.__rules__[index].fn = fn;
    this.__rules__[index].alt = options.alt || [];
    this.__cache__ = null;
  }
  /**
  * Add new rule to chain before one with given name. See also
  * {@link Ruler.after}, {@link Ruler.push}.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  before(beforeName, ruleName, fn, options = {}) {
    const index = this.__find__(beforeName);
    if (index === -1) throw new Error(`Parser rule not found: ${beforeName}`);
    this.__rules__.splice(index, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Add new rule to chain after one with given name. See also
  * {@link Ruler.before}, {@link Ruler.push}.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.inline.ruler.after('text', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  after(afterName, ruleName, fn, options = {}) {
    const index = this.__find__(afterName);
    if (index === -1) throw new Error(`Parser rule not found: ${afterName}`);
    this.__rules__.splice(index + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Push new rule to the end of chain. See also
  * {@link Ruler.before}, {@link Ruler.after}.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.core.ruler.push('my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  push(ruleName, fn, options = {}) {
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Enable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * See also {@link Ruler.disable}, {@link Ruler.enableOnly}.
  *
  * Returns list of found rule names (if no exception happened).
  */
  enable(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    const result = [];
    list2.forEach((name) => {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) return;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = true;
      result.push(name);
    });
    this.__cache__ = null;
    return result;
  }
  /**
  * Enable rules with given names, and disable everything else. If any rule name
  * not found - throw Error. Errors can be disabled by second param.
  *
  * See also {@link Ruler.disable}, {@link Ruler.enable}.
  */
  enableOnly(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    this.__rules__.forEach((rule) => {
      rule.enabled = false;
    });
    this.enable(list2, ignoreInvalid);
  }
  /**
  * Disable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * See also {@link Ruler.enable}, {@link Ruler.enableOnly}.
  *
  * Returns list of found rule names (if no exception happened).
  */
  disable(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    const result = [];
    list2.forEach((name) => {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) return;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = false;
      result.push(name);
    });
    this.__cache__ = null;
    return result;
  }
  /**
  * Return array of active functions (rules) for given chain name. It analyzes
  * rules configuration, compiles caches if not exists and returns result.
  *
  * Default chain name is `''` (empty string). It can't be skipped. That's
  * done intentionally, to keep signature monomorphic for high speed.
  */
  getRules(chainName) {
    if (!this.__cache__) this.__compile__();
    return this.__cache__[chainName] || [];
  }
};
var default_rules = {};
default_rules.code_inline = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<code${slf.renderAttrs(token)}>${escapeHtml(token.content)}</code>`;
};
default_rules.code_block = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<pre${slf.renderAttrs(token)}><code>${escapeHtml(tokens[idx].content)}</code></pre>
`;
};
default_rules.fence = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : "";
  let langName = "";
  let langAttrs = "";
  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join("");
  }
  let highlighted;
  if (options.highlight) highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content);
  else highlighted = escapeHtml(token.content);
  if (highlighted.indexOf("<pre") === 0) return highlighted + "\n";
  if (info) {
    const i = token.attrIndex("class");
    const tmpAttrs = token.attrs ? token.attrs.slice() : [];
    if (i < 0) tmpAttrs.push(["class", `${options.langPrefix}${langName}`]);
    else {
      tmpAttrs[i] = [tmpAttrs[i][0], tmpAttrs[i][1]];
      tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`;
    }
    const tmpToken = { attrs: tmpAttrs };
    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>
`;
  }
  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>
`;
};
default_rules.image = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
  return slf.renderToken(tokens, idx, options);
};
default_rules.hardbreak = function(tokens, idx, options) {
  return options.xhtmlOut ? "<br />\n" : "<br>\n";
};
default_rules.softbreak = function(tokens, idx, options) {
  return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
};
default_rules.text = function(tokens, idx) {
  return escapeHtml(tokens[idx].content);
};
default_rules.html_block = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.html_inline = function(tokens, idx) {
  return tokens[idx].content;
};
var Renderer = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * Contains render rules for tokens. Can be updated and extended.
      *
      * See [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts)
      * for more details and examples.
      *
      * @example Custom render rules
      * ```javascript
      * import MarkdownIt from 'markdown-it'
      * const md = new MarkdownIt()
      *
      * md.renderer.rules.strong_open  = function () { return '<b>'; };
      * md.renderer.rules.strong_close = function () { return '</b>'; };
      *
      * const result = md.renderInline(...);
      * ```
      *
      * @example Each rule is called as independent static function with fixed signature
      * ```javascript
      * function my_token_render(tokens, idx, options, env, renderer) {
      *   // ...
      *   return renderedHTML;
      * }
      * ```
      */
      "rules",
      Object.assign({}, default_rules)
    );
  }
  /**
  * Render token attributes to string.
  */
  renderAttrs(token) {
    let i, l, result;
    if (!token.attrs) return "";
    result = "";
    for (i = 0, l = token.attrs.length; i < l; i++) result += ` ${escapeHtml(token.attrs[i][0])}="${escapeHtml(String(token.attrs[i][1]))}"`;
    return result;
  }
  /**
  * Default token renderer. Can be overriden by custom function
  * in {@link Renderer.rules}.
  */
  renderToken(tokens, idx, options) {
    const token = tokens[idx];
    let result = "";
    if (token.hidden) return "";
    let prev = idx - 1;
    while (prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === 0) prev--;
    if (token.block && token.nesting !== -1 && prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === -1) result += "\n";
    result += (token.nesting === -1 ? "</" : "<") + token.tag;
    result += this.renderAttrs(token);
    if (token.nesting === 0 && options.xhtmlOut) result += " /";
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        let next = idx + 1;
        while (next < tokens.length && tokens[next].hidden && tokens[next].nesting === 0) next++;
        if (next < tokens.length) {
          const nextToken = tokens[next];
          if (nextToken.type === "inline" || nextToken.hidden) needLf = false;
          else if (nextToken.nesting === -1 && nextToken.tag === token.tag) needLf = false;
        }
      }
    }
    result += needLf ? ">\n" : ">";
    return result;
  }
  /**
  * The same as {@link Renderer.render}, but for single token of `inline` type.
  */
  renderInline(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (typeof rules[type] !== "undefined") result += rules[type](tokens, i, options, env, this);
      else result += this.renderToken(tokens, i, options);
    }
    return result;
  }
  /**
  * Special kludge for image `alt` attributes to conform CommonMark spec.
  * Don't try to use it! Spec requires to show `alt` content with stripped markup,
  * instead of simple escaping.
  */
  renderInlineAsText(tokens, options, env) {
    let result = "";
    for (let i = 0, len = tokens.length; i < len; i++) switch (tokens[i].type) {
      case "text":
      case "code_inline":
        result += tokens[i].content;
        break;
      case "image":
        result += this.renderInlineAsText(tokens[i].children, options, env);
        break;
      case "html_inline":
      case "html_block":
        result += tokens[i].content;
        break;
      case "softbreak":
      case "hardbreak":
        result += "\n";
    }
    return result;
  }
  /**
  * Takes token stream and generates HTML. Probably, you will never need to call
  * this method directly.
  */
  render(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (type === "inline") result += this.renderInline(tokens[i].children, options, env);
      else if (typeof rules[type] !== "undefined") result += rules[type](tokens, i, options, env, this);
      else result += this.renderToken(tokens, i, options);
    }
    return result;
  }
};
var StateCore = class {
  constructor(src, md, env) {
    _defineProperty(this, "tokens", []);
    _defineProperty(this, "inlineMode", false);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.env = env;
    this.md = md;
  }
};
var UNNORMALIZED_NEWLINE_RE = /\r\n?/g;
var NULL_RE = /\0/g;
function normalize(state) {
  let str;
  str = state.src.replace(UNNORMALIZED_NEWLINE_RE, "\n");
  str = str.replace(NULL_RE, "\uFFFD");
  state.src = str;
}
function block(state) {
  let token;
  if (state.inlineMode) {
    token = new state.Token("inline", "", 0);
    token.content = state.src;
    token.map = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else state.md.block.parse(state.src, state.md, state.env, state.tokens);
}
function strip_references(state) {
  const tokens = state.tokens;
  let last = 0;
  for (let curr = 0; curr < tokens.length; curr++) {
    if (tokens[curr].type === "reference_definition") continue;
    if (curr !== last) tokens[last] = tokens[curr];
    last++;
  }
  if (tokens.length !== last) tokens.length = last;
}
function inline(state) {
  const tokens = state.tokens;
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i];
    if (tok.type === "inline") state.md.inline.parse(tok.content, state.md, state.env, tok.children);
  }
}
function isLinkOpen$1(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose$1(str) {
  return /^<\/a\s*>/i.test(str);
}
function linkify$1(state) {
  const blockTokens = state.tokens;
  if (!state.md.options.linkify) return;
  for (let j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== "inline" || !state.md.linkify.test(blockTokens[j].content)) continue;
    const tokens = blockTokens[j].children;
    const replacements = [];
    let htmlLinkLevel = 0;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i];
      if (currentToken.type === "link_close") {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") i--;
        continue;
      }
      if (currentToken.type === "html_inline") {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) htmlLinkLevel--;
        if (isLinkClose$1(currentToken.content)) htmlLinkLevel++;
      }
      if (htmlLinkLevel > 0) continue;
      if (currentToken.type === "text" && state.md.linkify.test(currentToken.content)) {
        const text2 = currentToken.content;
        let links = state.md.linkify.match(text2);
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;
        if (links.length > 0 && links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special") links = links.slice(1);
        for (let ln = 0; ln < links.length; ln++) {
          const url = links[ln].url;
          const fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) continue;
          let urlText = links[ln].text;
          if (!links[ln].schema) urlText = state.md.normalizeLinkText(`http://${urlText}`).replace(/^http:\/\//, "");
          else if (links[ln].schema === "mailto:" && !/^mailto:/i.test(urlText)) urlText = state.md.normalizeLinkText(`mailto:${urlText}`).replace(/^mailto:/, "");
          else urlText = state.md.normalizeLinkText(urlText);
          const pos = links[ln].index;
          if (pos > lastPos) {
            const token = new state.Token("text", "", 0);
            token.content = text2.slice(lastPos, pos);
            token.level = level;
            nodes.push(token);
          }
          const token_o = new state.Token("link_open", "a", 1);
          token_o.attrs = [["href", fullUrl]];
          token_o.level = level++;
          token_o.markup = "linkify";
          token_o.info = "auto";
          nodes.push(token_o);
          const token_t = new state.Token("text", "", 0);
          token_t.content = urlText;
          token_t.level = level;
          nodes.push(token_t);
          const token_c = new state.Token("link_close", "a", -1);
          token_c.level = --level;
          token_c.markup = "linkify";
          token_c.info = "auto";
          nodes.push(token_c);
          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text2.length) {
          const token = new state.Token("text", "", 0);
          token.content = text2.slice(lastPos);
          token.level = level;
          nodes.push(token);
        }
        replacements.push({
          index: i,
          nodes
        });
      }
    }
    if (replacements.length > 0) {
      let newTokensLength = tokens.length;
      for (const replacement of replacements) newTokensLength += replacement.nodes.length - 1;
      const newTokens = new Array(newTokensLength);
      let replacementIndex = 0;
      let newTokenIndex = 0;
      replacements.reverse();
      for (let i = 0; i < tokens.length; i++) {
        const replacement = replacements[replacementIndex];
        if ((replacement === null || replacement === void 0 ? void 0 : replacement.index) === i) {
          for (const node of replacement.nodes) newTokens[newTokenIndex++] = node;
          replacementIndex++;
        } else newTokens[newTokenIndex++] = tokens[i];
      }
      blockTokens[j].children = newTokens;
    }
  }
}
var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
var SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;
var SCOPED_ABBR_RE = /\((c|tm|r)\)/gi;
var SCOPED_ABBR = {
  c: "\xA9",
  r: "\xAE",
  tm: "\u2122"
};
function replaceFn(match, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}
function replace_scoped(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace_rare(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) {
      if (RARE_RE.test(token.content)) token.content = token.content.replace(/\+-/g, "\xB1").replace(/\.{2,}/g, "\u2026").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/gm, "$1\u2014").replace(/(^|\s)--(?=\s|$)/gm, "$1\u2013").replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1\u2013");
    }
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace(state) {
  let blkIdx;
  if (!state.md.options.typographer) return;
  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline") continue;
    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) replace_scoped(state.tokens[blkIdx].children);
    if (RARE_RE.test(state.tokens[blkIdx].content)) replace_rare(state.tokens[blkIdx].children);
  }
}
var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = "\u2019";
var MAX_OPENERS = 1e3;
function truncateStack(stack, heads, length) {
  while (stack.length > length) {
    const item = stack.pop();
    if (item.isSingleQuote) heads.single = item.prevSameQuoteIdx;
    else heads.double = item.prevSameQuoteIdx;
  }
}
function addReplacement(replacements, tokenIdx, pos, ch) {
  if (!replacements[tokenIdx]) replacements[tokenIdx] = [];
  replacements[tokenIdx].push({
    pos,
    ch
  });
}
function applyReplacements(str, replacements) {
  let result = "";
  let lastPos = 0;
  replacements.sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < replacements.length; i++) {
    const replacement = replacements[i];
    result += str.slice(lastPos, replacement.pos) + replacement.ch;
    lastPos = replacement.pos + 1;
  }
  return result + str.slice(lastPos);
}
function process_inlines(tokens, state) {
  let j;
  const stack = [];
  const heads = {
    single: -1,
    double: -1
  };
  const replacements = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const thisLevel = tokens[i].level;
    for (j = stack.length - 1; j >= 0; j--) if (stack[j].level <= thisLevel) break;
    truncateStack(stack, heads, j + 1);
    if (token.type !== "text") continue;
    const text2 = token.content;
    let pos = 0;
    const max = text2.length;
    OUTER: while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      const t = QUOTE_RE.exec(text2);
      if (!t) break;
      let canOpen = true;
      let canClose = true;
      pos = t.index + 1;
      const isSingle = t[0] === "'";
      let lastChar = 32;
      if (t.index - 1 >= 0) lastChar = text2.charCodeAt(t.index - 1);
      else for (j = i - 1; j >= 0; j--) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
        break;
      }
      let nextChar = 32;
      if (pos < max) nextChar = text2.charCodeAt(pos);
      else for (j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        nextChar = tokens[j].content.charCodeAt(0);
        break;
      }
      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
      const isLastWhiteSpace = isWhiteSpace(lastChar);
      const isNextWhiteSpace = isWhiteSpace(nextChar);
      if (isNextWhiteSpace) canOpen = false;
      else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) canOpen = false;
      }
      if (isLastWhiteSpace) canClose = false;
      else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) canClose = false;
      }
      if (nextChar === 34 && t[0] === '"') {
        if (lastChar >= 48 && lastChar <= 57) canClose = canOpen = false;
      }
      if (canOpen && canClose) {
        canOpen = isLastPunctChar;
        canClose = isNextPunctChar;
      }
      if (!canOpen && !canClose) {
        if (isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
        continue;
      }
      if (canClose) {
        j = isSingle ? heads.single : heads.double;
        if (j >= 0 && stack[j].level === thisLevel) {
          const item = stack[j];
          let openQuote;
          let closeQuote;
          if (isSingle) {
            openQuote = state.md.options.quotes[2];
            closeQuote = state.md.options.quotes[3];
          } else {
            openQuote = state.md.options.quotes[0];
            closeQuote = state.md.options.quotes[1];
          }
          addReplacement(replacements, i, t.index, closeQuote);
          addReplacement(replacements, item.tokenIdx, item.contentPos, openQuote);
          truncateStack(stack, heads, j);
          continue OUTER;
        }
      }
      if (canOpen) {
        if (stack.length >= MAX_OPENERS) return;
        stack.push({
          tokenIdx: i,
          contentPos: t.index,
          isSingleQuote: isSingle,
          level: thisLevel,
          prevSameQuoteIdx: isSingle ? heads.single : heads.double
        });
        if (isSingle) heads.single = stack.length - 1;
        else heads.double = stack.length - 1;
      } else if (canClose && isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
    }
  }
  Object.keys(replacements).forEach(function(tokenIdx) {
    const idx = Number(tokenIdx);
    tokens[idx].content = applyReplacements(tokens[idx].content, replacements[tokenIdx]);
  });
}
function smartquotes(state) {
  if (!state.md.options.typographer) return;
  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) continue;
    process_inlines(state.tokens[blkIdx].children, state);
  }
}
function join_alt(tokens) {
  let curr, last;
  const max = tokens.length;
  for (curr = 0; curr < max; curr++) if (tokens[curr].type === "text_special") tokens[curr].type = "text";
  for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
  else {
    if (curr !== last) tokens[last] = tokens[curr];
    last++;
  }
  if (curr !== last) tokens.length = last;
}
function text_join(state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;
  for (let j = 0; j < l; j++) {
    if (blockTokens[j].type !== "inline") continue;
    const tokens = blockTokens[j].children;
    const max = tokens.length;
    for (curr = 0; curr < max; curr++) {
      if (tokens[curr].type === "text_special") tokens[curr].type = "text";
      if (tokens[curr].children) join_alt(tokens[curr].children);
    }
    for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
    if (curr !== last) tokens.length = last;
  }
}
var _rules$2 = [
  ["normalize", normalize],
  ["block", block],
  ["strip_references", strip_references],
  ["inline", inline],
  ["linkify", linkify$1],
  ["replacements", replace],
  ["smartquotes", smartquotes],
  ["text_join", text_join]
];
var ParserCore = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of core rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(this, "State", StateCore);
    for (let i = 0; i < _rules$2.length; i++) this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
  }
  /**
  * Executes core chain rules.
  */
  process(state) {
    const rules = this.ruler.getRules("");
    for (let i = 0, l = rules.length; i < l; i++) rules[i](state);
  }
};
var StateBlock = class {
  constructor(src, md, env, tokens) {
    _defineProperty(this, "bMarks", []);
    _defineProperty(this, "eMarks", []);
    _defineProperty(this, "tShift", []);
    _defineProperty(this, "sCount", []);
    _defineProperty(this, "bsCount", []);
    _defineProperty(this, "blkIndent", 0);
    _defineProperty(this, "line", 0);
    _defineProperty(this, "lineMax", 0);
    _defineProperty(this, "tight", false);
    _defineProperty(this, "listIndent", -1);
    _defineProperty(this, "parentType", "root");
    _defineProperty(this, "level", 0);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.md = md;
    this.env = env;
    this.tokens = tokens;
    const s = this.src;
    for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
      const ch = s.charCodeAt(pos);
      if (!indent_found) if (isSpace(ch)) {
        indent++;
        if (ch === 9) offset += 4 - offset % 4;
        else offset++;
        continue;
      } else indent_found = true;
      if (ch === 10 || pos === len - 1) {
        if (ch !== 10) pos++;
        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        this.sCount.push(offset);
        this.bsCount.push(0);
        indent_found = false;
        indent = 0;
        offset = 0;
        start = pos + 1;
      }
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  push(type, tag, nesting) {
    const token = new Token(type, tag, nesting);
    token.block = true;
    if (nesting < 0) this.level--;
    token.level = this.level;
    if (nesting > 0) this.level++;
    this.tokens.push(token);
    return token;
  }
  isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  }
  skipEmptyLines(from) {
    for (let max = this.lineMax; from < max; from++) if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) break;
    return from;
  }
  skipSpaces(pos) {
    for (let max = this.src.length; pos < max; pos++) if (!isSpace(this.src.charCodeAt(pos))) break;
    return pos;
  }
  skipSpacesBack(pos, min) {
    if (pos <= min) return pos;
    while (pos > min) if (!isSpace(this.src.charCodeAt(--pos))) return pos + 1;
    return pos;
  }
  skipChars(pos, code2) {
    for (let max = this.src.length; pos < max; pos++) if (this.src.charCodeAt(pos) !== code2) break;
    return pos;
  }
  skipCharsBack(pos, code2, min) {
    if (pos <= min) return pos;
    while (pos > min) if (code2 !== this.src.charCodeAt(--pos)) return pos + 1;
    return pos;
  }
  getLines(begin, end, indent, keepLastLF) {
    if (begin >= end) return "";
    const queue = new Array(end - begin);
    for (let i = 0, line = begin; line < end; line++, i++) {
      let lineIndent = 0;
      const lineStart = this.bMarks[line];
      let first = lineStart;
      let last;
      if (line + 1 < end || keepLastLF) last = this.eMarks[line] + 1;
      else last = this.eMarks[line];
      while (first < last && lineIndent < indent) {
        const ch = this.src.charCodeAt(first);
        if (isSpace(ch)) if (ch === 9) lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
        else lineIndent++;
        else if (first - lineStart < this.tShift[line]) lineIndent++;
        else break;
        first++;
      }
      if (lineIndent > indent) queue[i] = new Array(lineIndent - indent + 1).join(" ") + this.src.slice(first, last);
      else queue[i] = this.src.slice(first, last);
    }
    return queue.join("");
  }
};
var MAX_AUTOCOMPLETED_CELLS = 65536;
function getLine(state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];
  return state.src.slice(pos, max);
}
function escapedSplit(str) {
  const result = [];
  const max = str.length;
  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = "";
  while (pos < max) {
    if (ch === 124) if (!isEscaped) {
      result.push(current + str.substring(lastPos, pos));
      current = "";
      lastPos = pos + 1;
    } else {
      current += str.substring(lastPos, pos - 1);
      lastPos = pos;
    }
    isEscaped = ch === 92;
    pos++;
    ch = str.charCodeAt(pos);
  }
  result.push(current + str.substring(lastPos));
  return result;
}
function table(state, startLine, endLine, silent) {
  if (startLine + 2 > endLine) return false;
  let nextLine = startLine + 1;
  if (state.sCount[nextLine] < state.blkIndent) return false;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) return false;
  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) return false;
  if (pos >= state.eMarks[nextLine]) return false;
  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) return false;
  if (firstCh === 45 && isSpace(secondCh)) return false;
  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) return false;
    pos++;
  }
  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split("|");
  const aligns = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t) if (i === 0 || i === columns.length - 1) continue;
    else return false;
    if (!/^:?-+:?$/.test(t)) return false;
    if (t.charCodeAt(t.length - 1) === 58) aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
    else if (t.charCodeAt(0) === 58) aligns.push("left");
    else aligns.push("");
  }
  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf("|") === -1) return false;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === "") columns.shift();
  if (columns.length && columns[columns.length - 1] === "") columns.pop();
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) return false;
  if (silent) return true;
  const oldParentType = state.parentType;
  state.parentType = "table";
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const token_to = state.push("table_open", "table", 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;
  const token_tho = state.push("thead_open", "thead", 1);
  token_tho.map = [startLine, startLine + 1];
  const token_htro = state.push("tr_open", "tr", 1);
  token_htro.map = [startLine, startLine + 1];
  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push("th_open", "th", 1);
    if (aligns[i]) token_ho.attrs = [["style", `text-align:${aligns[i]}`]];
    const token_il = state.push("inline", "", 0);
    token_il.content = columns[i].trim();
    token_il.children = [];
    state.push("th_close", "th", -1);
  }
  state.push("tr_close", "tr", -1);
  state.push("thead_close", "thead", -1);
  let tbodyLines;
  let autocompletedCells = 0;
  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    lineText = getLine(state, nextLine).trim();
    if (!lineText) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === "") columns.shift();
    if (columns.length && columns[columns.length - 1] === "") columns.pop();
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
    if (nextLine === startLine + 2) {
      const token_tbo = state.push("tbody_open", "tbody", 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }
    const token_tro = state.push("tr_open", "tr", 1);
    token_tro.map = [nextLine, nextLine + 1];
    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push("td_open", "td", 1);
      if (aligns[i]) token_tdo.attrs = [["style", `text-align:${aligns[i]}`]];
      const token_il = state.push("inline", "", 0);
      token_il.content = columns[i] ? columns[i].trim() : "";
      token_il.children = [];
      state.push("td_close", "td", -1);
    }
    state.push("tr_close", "tr", -1);
  }
  if (tbodyLines) {
    state.push("tbody_close", "tbody", -1);
    tbodyLines[1] = nextLine;
  }
  state.push("table_close", "table", -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
function code(state, startLine, endLine) {
  if (state.sCount[startLine] - state.blkIndent < 4) return false;
  let nextLine = startLine + 1;
  let last = nextLine;
  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }
  state.line = last;
  const token = state.push("code_block", "code", 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + "\n";
  token.map = [startLine, state.line];
  return true;
}
function fence(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (pos + 3 > max) return false;
  const marker = state.src.charCodeAt(pos);
  if (marker !== 126 && marker !== 96) return false;
  let mem = pos;
  pos = state.skipChars(pos, marker);
  let len = pos - mem;
  if (len < 3) return false;
  const markup = state.src.slice(mem, pos);
  const params = state.src.slice(pos, max);
  if (marker === 96) {
    if (params.indexOf(String.fromCharCode(marker)) >= 0) return false;
  }
  if (silent) return true;
  let nextLine = startLine;
  let haveEndMarker = false;
  for (; ; ) {
    nextLine++;
    if (nextLine >= endLine) break;
    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
    if (state.src.charCodeAt(pos) !== marker) continue;
    if (state.sCount[nextLine] - state.blkIndent >= 4) continue;
    pos = state.skipChars(pos, marker);
    if (pos - mem < len) continue;
    pos = state.skipSpaces(pos);
    if (pos < max) continue;
    haveEndMarker = true;
    break;
  }
  len = state.sCount[startLine];
  state.line = nextLine + (haveEndMarker ? 1 : 0);
  const token = state.push("fence", "code", 0);
  token.info = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup = markup;
  token.map = [startLine, state.line];
  return true;
}
function blockquote(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  const oldLineMax = state.lineMax;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 62) return false;
  if (silent) return true;
  const oldBMarks = [];
  const oldBSCount = [];
  const oldSCount = [];
  const oldTShift = [];
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const oldParentType = state.parentType;
  state.parentType = "blockquote";
  let lastLineEmpty = false;
  let nextLine;
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    const isOutdented = state.sCount[nextLine] < state.blkIndent;
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos >= max) break;
    if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;
      if (state.src.charCodeAt(pos) === 32) {
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 9) {
        spaceAfterMarker = true;
        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          pos++;
          initial++;
          adjustTab = false;
        } else adjustTab = true;
      } else spaceAfterMarker = false;
      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;
      while (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (isSpace(ch)) if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
        else offset++;
        else break;
        pos++;
      }
      lastLineEmpty = pos >= max;
      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;
      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }
    if (lastLineEmpty) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) {
      state.lineMax = nextLine;
      if (state.blkIndent !== 0) {
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }
      break;
    }
    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);
    state.sCount[nextLine] = -1;
  }
  const oldIndent = state.blkIndent;
  state.blkIndent = 0;
  const token_o = state.push("blockquote_open", "blockquote", 1);
  token_o.markup = ">";
  const lines = [startLine, 0];
  token_o.map = lines;
  state.md.block.tokenize(state, startLine, nextLine);
  const token_c = state.push("blockquote_close", "blockquote", -1);
  token_c.markup = ">";
  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;
  return true;
}
function hr(state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 95) return false;
  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) return false;
    if (ch === marker) cnt++;
  }
  if (cnt < 3) return false;
  if (silent) return true;
  state.line = startLine + 1;
  const token = state.push("hr", "hr", 0);
  token.map = [startLine, state.line];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
  return true;
}
function skipBulletListMarker(state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 43) return -1;
  if (pos < max) {
    if (!isSpace(state.src.charCodeAt(pos))) return -1;
  }
  return pos;
}
function skipOrderedListMarker(state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;
  if (pos + 1 >= max) return -1;
  let ch = state.src.charCodeAt(pos++);
  if (ch < 48 || ch > 57) return -1;
  for (; ; ) {
    if (pos >= max) return -1;
    ch = state.src.charCodeAt(pos++);
    if (ch >= 48 && ch <= 57) {
      if (pos - start >= 10) return -1;
      continue;
    }
    if (ch === 41 || ch === 46) break;
    return -1;
  }
  if (pos < max) {
    ch = state.src.charCodeAt(pos);
    if (!isSpace(ch)) return -1;
  }
  return pos;
}
function markTightParagraphs(state, idx) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
    state.tokens[i + 2].hidden = true;
    state.tokens[i].hidden = true;
    i += 2;
  }
}
function list(state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) return false;
  let isTerminatingParagraph = false;
  if (silent && state.parentType === "paragraph") {
    if (state.sCount[nextLine] >= state.blkIndent) isTerminatingParagraph = true;
  }
  let isOrdered;
  let markerValue;
  let posAfterMarker;
  if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));
    if (isTerminatingParagraph && markerValue !== 1) return false;
  } else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) isOrdered = false;
  else return false;
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false;
  }
  if (silent) return true;
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
  const listTokIdx = state.tokens.length;
  if (isOrdered) {
    token = state.push("ordered_list_open", "ol", 1);
    if (markerValue !== 1) token.attrs = [["start", markerValue]];
  } else token = state.push("bullet_list_open", "ul", 1);
  const listLines = [nextLine, 0];
  token.map = listLines;
  token.markup = String.fromCharCode(markerCharCode);
  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules("list");
  const oldParentType = state.parentType;
  state.parentType = "list";
  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];
    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      else if (ch === 32) offset++;
      else break;
      pos++;
    }
    const contentStart = pos;
    let indentAfterMarker;
    if (contentStart >= max) indentAfterMarker = 1;
    else indentAfterMarker = offset - initial;
    if (indentAfterMarker > 4) indentAfterMarker = 1;
    const indent = initial + indentAfterMarker;
    token = state.push("list_item_open", "li", 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines = [nextLine, 0];
    token.map = itemLines;
    if (isOrdered) token.info = state.src.slice(start, posAfterMarker - 1);
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;
    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;
    if (contentStart >= max && state.isEmpty(nextLine + 1)) state.line = Math.min(state.line + 2, endLine);
    else state.md.block.tokenize(state, nextLine, endLine);
    if (!state.tight || prevEmptyEnd) tight = false;
    prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;
    token = state.push("list_item_close", "li", -1);
    token.markup = String.fromCharCode(markerCharCode);
    nextLine = state.line;
    itemLines[1] = nextLine;
    if (nextLine >= endLine) break;
    if (state.sCount[nextLine] < state.blkIndent) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
    }
    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) break;
  }
  if (isOrdered) token = state.push("ordered_list_close", "ol", -1);
  else token = state.push("bullet_list_close", "ul", -1);
  token.markup = String.fromCharCode(markerCharCode);
  listLines[1] = nextLine;
  state.line = nextLine;
  state.parentType = oldParentType;
  if (tight) markTightParagraphs(state, listTokIdx);
  return true;
}
function reference(state, startLine, _endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  let nextLine = startLine + 1;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 91) return false;
  function getNextLine(nextLine2) {
    const endLine = state.lineMax;
    if (nextLine2 >= endLine || state.isEmpty(nextLine2)) return null;
    let isContinuation = false;
    if (state.sCount[nextLine2] - state.blkIndent > 3) isContinuation = true;
    if (state.sCount[nextLine2] < 0) isContinuation = true;
    if (!isContinuation) {
      const terminatorRules = state.md.block.ruler.getRules("reference");
      const oldParentType = state.parentType;
      state.parentType = "reference";
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine2, endLine, true)) {
        terminate = true;
        break;
      }
      state.parentType = oldParentType;
      if (terminate) return null;
    }
    const pos2 = state.bMarks[nextLine2] + state.tShift[nextLine2];
    const max2 = state.eMarks[nextLine2];
    return state.src.slice(pos2, max2 + 1);
  }
  let str = state.src.slice(pos, max + 1);
  max = str.length;
  let labelEnd = -1;
  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 91) return false;
    else if (ch === 93) {
      labelEnd = pos;
      break;
    } else if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (ch === 92) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      }
    }
  }
  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 58) return false;
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) {
    } else break;
  }
  const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
  if (!destRes.ok) return false;
  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href)) return false;
  pos = destRes.pos;
  const destEndPos = pos;
  const destEndLineNo = nextLine;
  const start = pos;
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 10) {
      const lineContent = getNextLine(nextLine);
      if (lineContent !== null) {
        str += lineContent;
        max = str.length;
        nextLine++;
      }
    } else if (isSpace(ch)) {
    } else break;
  }
  let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
  while (titleRes.can_continue) {
    const lineContent = getNextLine(nextLine);
    if (lineContent === null) break;
    str += lineContent;
    pos = max;
    max = str.length;
    nextLine++;
    titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
  }
  let title;
  if (pos < max && start !== pos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = "";
    pos = destEndPos;
    nextLine = destEndLineNo;
  }
  while (pos < max) {
    if (!isSpace(str.charCodeAt(pos))) break;
    pos++;
  }
  if (pos < max && str.charCodeAt(pos) !== 10) {
    if (title) {
      title = "";
      pos = destEndPos;
      nextLine = destEndLineNo;
      while (pos < max) {
        if (!isSpace(str.charCodeAt(pos))) break;
        pos++;
      }
    }
  }
  if (pos < max && str.charCodeAt(pos) !== 10) return false;
  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label) return false;
  if (silent) return true;
  if (typeof state.env.references === "undefined") state.env.references = {};
  if (typeof state.env.references[label] === "undefined") state.env.references[label] = {
    title,
    href
  };
  const token = state.push("reference_definition", "", 0);
  token.map = [startLine, nextLine];
  token.hidden = true;
  const meta = /* @__PURE__ */ Object.create(null);
  meta.label = label;
  token.meta = meta;
  state.line = nextLine;
  return true;
}
var html_blocks_default = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var open_tag = `<[A-Za-z][A-Za-z0-9\\-]*(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?)*\\s*\\/?>`;
var close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
var HTML_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag}|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<[?][\\s\\S]*?[?]>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`);
var HTML_OPEN_CLOSE_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag})`);
var HTML_SEQUENCES = [
  [
    /^<(script|pre|style|textarea)(?=(\s|>|$))/i,
    /<\/(script|pre|style|textarea)>/i,
    true
  ],
  [
    /^<!--/,
    /-->/,
    true
  ],
  [
    /^<\?/,
    /\?>/,
    true
  ],
  [
    /^<![A-Za-z]/,
    />/,
    true
  ],
  [
    /^<!\[CDATA\[/,
    /\]\]>/,
    true
  ],
  [
    new RegExp(`^</?(${html_blocks_default.join("|")})(?=(\\s|/?>|$))`, "i"),
    /^$/,
    true
  ],
  [
    new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`),
    /^$/,
    false
  ]
];
function html_block(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (!state.md.options.html) return false;
  if (state.src.charCodeAt(pos) !== 60) return false;
  let lineText = state.src.slice(pos, max);
  let i = 0;
  for (; i < HTML_SEQUENCES.length; i++) if (HTML_SEQUENCES[i][0].test(lineText)) break;
  if (i === HTML_SEQUENCES.length) return false;
  if (silent) return HTML_SEQUENCES[i][2];
  let nextLine = startLine + 1;
  const endsOnBlankLine = HTML_SEQUENCES[i][1].test("");
  if (!HTML_SEQUENCES[i][1].test(lineText)) for (; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) {
      if (endsOnBlankLine || !state.isEmpty(nextLine)) break;
    }
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    lineText = state.src.slice(pos, max);
    if (HTML_SEQUENCES[i][1].test(lineText)) {
      if (lineText.length !== 0) nextLine++;
      break;
    }
  }
  state.line = nextLine;
  const token = state.push("html_block", "", 0);
  token.map = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
  return true;
}
function heading(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let ch = state.src.charCodeAt(pos);
  if (ch !== 35 || pos >= max) return false;
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 35 && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }
  if (level > 6 || pos < max && !isSpace(ch)) return false;
  if (silent) return true;
  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 35, pos);
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) max = tmp;
  state.line = startLine + 1;
  const token_o = state.push("heading_open", `h${level}`, 1);
  token_o.markup = "########".slice(0, level);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = asciiTrim(state.src.slice(pos, max));
  token_i.map = [startLine, state.line];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${level}`, -1);
  token_c.markup = "########".slice(0, level);
  return true;
}
function lheading(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const oldParentType = state.parentType;
  state.parentType = "paragraph";
  let level = 0;
  let marker;
  let nextLine = startLine + 1;
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (pos < max) {
        marker = state.src.charCodeAt(pos);
        if (marker === 45 || marker === 61) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);
          if (pos >= max) {
            level = marker === 61 ? 1 : 2;
            break;
          }
        }
      }
    }
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  if (!level) {
    state.parentType = oldParentType;
    return false;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine + 1;
  const token_o = state.push("heading_open", `h${level}`, 1);
  token_o.markup = String.fromCharCode(marker);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line - 1];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${level}`, -1);
  token_c.markup = String.fromCharCode(marker);
  state.parentType = oldParentType;
  return true;
}
function paragraph(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = "paragraph";
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine;
  const token_o = state.push("paragraph_open", "p", 1);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line];
  token_i.children = [];
  state.push("paragraph_close", "p", -1);
  state.parentType = oldParentType;
  return true;
}
var _rules$1 = [
  [
    "table",
    table,
    ["paragraph", "reference"]
  ],
  ["code", code],
  [
    "fence",
    fence,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "blockquote",
    blockquote,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "hr",
    hr,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "list",
    list,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["reference", reference],
  [
    "html_block",
    html_block,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  [
    "heading",
    heading,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["lheading", lheading],
  ["paragraph", paragraph]
];
var ParserBlock = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of block rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(this, "State", StateBlock);
    for (let i = 0; i < _rules$1.length; i++) this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
  }
  tokenize(state, startLine, endLine) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    let line = startLine;
    let hasEmptyLines = false;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) break;
      if (state.sCount[line] < state.blkIndent) break;
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }
      const prevLine = state.line;
      let ok = false;
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) {
          if (prevLine >= state.line) throw new Error("block rule didn't increment state.line");
          break;
        }
      }
      if (!ok) throw new Error("none of the block rules matched");
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1)) hasEmptyLines = true;
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  }
  /**
  * Process input string and push block tokens into `outTokens`
  */
  parse(src, md, env, outTokens) {
    if (!src) return;
    const state = new this.State(src, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  }
};
var StateInline = class {
  constructor(src, md, env, outTokens) {
    _defineProperty(this, "pos", 0);
    _defineProperty(this, "level", 0);
    _defineProperty(this, "pending", "");
    _defineProperty(this, "pendingLevel", 0);
    _defineProperty(this, "cache", {});
    _defineProperty(this, "backticks", {});
    _defineProperty(this, "backticksScanned", false);
    _defineProperty(this, "linkLevel", 0);
    _defineProperty(this, "delimiters", []);
    _defineProperty(this, "_prev_delimiters", []);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = Array(outTokens.length);
    this.posMax = this.src.length;
  }
  pushPending() {
    const token = new Token("text", "", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }
  push(type, tag, nesting) {
    if (this.pending) this.pushPending();
    const token = new Token(type, tag, nesting);
    let token_meta = void 0;
    if (nesting < 0) {
      this.level--;
      this.delimiters = this._prev_delimiters.pop();
    }
    token.level = this.level;
    if (nesting > 0) {
      this.level++;
      this._prev_delimiters.push(this.delimiters);
      this.delimiters = [];
      token_meta = { delimiters: this.delimiters };
    }
    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokens_meta.push(token_meta);
    return token;
  }
  scanDelims(start, canSplitWord) {
    const max = this.posMax;
    const marker = this.src.charCodeAt(start);
    let lastChar;
    if (start === 0) lastChar = 32;
    else if (start === 1) {
      lastChar = this.src.charCodeAt(0);
      if ((lastChar & 63488) === 55296) lastChar = 65533;
    } else {
      lastChar = this.src.charCodeAt(start - 1);
      if ((lastChar & 64512) === 56320) {
        const highSurr = this.src.charCodeAt(start - 2);
        lastChar = (highSurr & 64512) === 55296 ? 65536 + (highSurr - 55296 << 10) + (lastChar - 56320) : 65533;
      } else if ((lastChar & 64512) === 55296) lastChar = 65533;
    }
    let pos = start;
    while (pos < max && this.src.charCodeAt(pos) === marker) pos++;
    const count = pos - start;
    let nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
    if ((nextChar & 64512) === 55296) {
      const lowSurr = this.src.charCodeAt(pos + 1);
      nextChar = (lowSurr & 64512) === 56320 ? 65536 + (nextChar - 55296 << 10) + (lowSurr - 56320) : 65533;
    } else if ((nextChar & 64512) === 56320) nextChar = 65533;
    const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
    const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
    const isLastWhiteSpace = isWhiteSpace(lastChar);
    const isNextWhiteSpace = isWhiteSpace(nextChar);
    const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
    const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
    return {
      can_open: left_flanking && (canSplitWord || !right_flanking || isLastPunctChar),
      can_close: right_flanking && (canSplitWord || !left_flanking || isNextPunctChar),
      length: count
    };
  }
};
function isTerminatorChar(ch) {
  switch (ch) {
    case 10:
    case 33:
    case 35:
    case 36:
    case 37:
    case 38:
    case 42:
    case 43:
    case 45:
    case 58:
    case 60:
    case 61:
    case 62:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function text(state, silent) {
  let pos = state.pos;
  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) pos++;
  if (pos === state.pos) return false;
  if (!silent) state.pending += state.src.slice(state.pos, pos);
  state.pos = pos;
  return true;
}
function isAsciiAlpha(code2) {
  return code2 >= 65 && code2 <= 90 || code2 >= 97 && code2 <= 122;
}
function isSchemeChar(code2) {
  return code2 >= 65 && code2 <= 90 || code2 >= 97 && code2 <= 122 || code2 >= 48 && code2 <= 57 || code2 === 43 || code2 === 45 || code2 === 46;
}
function linkify(state, silent) {
  if (!state.md.options.linkify) return false;
  if (state.linkLevel > 0) return false;
  const pos = state.pos;
  const max = state.posMax;
  if (pos + 3 > max) return false;
  if (state.src.charCodeAt(pos) !== 58) return false;
  if (state.src.charCodeAt(pos + 1) !== 47) return false;
  if (state.src.charCodeAt(pos + 2) !== 47) return false;
  const protoMin = pos - Math.min(10, state.pending.length, pos);
  let protoStart = pos;
  while (protoStart > protoMin && isSchemeChar(state.src.charCodeAt(protoStart - 1))) protoStart--;
  if (protoStart === pos || !isAsciiAlpha(state.src.charCodeAt(protoStart))) return false;
  const protoLength = pos - protoStart;
  const link2 = state.md.linkify.matchAtStart(state.src.slice(protoStart));
  if (!link2) return false;
  let url = link2.url;
  if (url.length <= protoLength) return false;
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 42) urlEnd--;
  if (urlEnd !== url.length) url = url.slice(0, urlEnd);
  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl)) return false;
  if (!silent) {
    state.pending = state.pending.slice(0, -protoLength);
    const token_o = state.push("link_open", "a", 1);
    token_o.attrs = [["href", fullUrl]];
    token_o.markup = "linkify";
    token_o.info = "auto";
    const token_t = state.push("text", "", 0);
    token_t.content = state.md.normalizeLinkText(url);
    const token_c = state.push("link_close", "a", -1);
    token_c.markup = "linkify";
    token_c.info = "auto";
  }
  state.pos += url.length - protoLength;
  return true;
}
function newline(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 10) return false;
  const pmax = state.pending.length - 1;
  const max = state.posMax;
  if (!silent) if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
    let ws = pmax - 1;
    while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32) ws--;
    state.pending = state.pending.slice(0, ws);
    state.push("hardbreak", "br", 0);
  } else {
    state.pending = state.pending.slice(0, -1);
    state.push("softbreak", "br", 0);
  }
  else state.push("softbreak", "br", 0);
  pos++;
  while (pos < max && isSpace(state.src.charCodeAt(pos))) pos++;
  state.pos = pos;
  return true;
}
var ESCAPED = [];
for (let i = 0; i < 256; i++) ESCAPED.push(0);
"\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
  ESCAPED[ch.charCodeAt(0)] = 1;
});
function escape(state, silent) {
  let pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 92) return false;
  pos++;
  if (pos >= max) return false;
  let ch1 = state.src.charCodeAt(pos);
  if (ch1 === 10) {
    if (!silent) state.push("hardbreak", "br", 0);
    pos++;
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1)) break;
      pos++;
    }
    state.pos = pos;
    return true;
  }
  if (ch1 === 32) {
    if (!silent) {
      const token = state.push("text_special", "", 0);
      token.content = "\\";
      token.markup = "\\";
      token.info = "escape";
    }
    state.pos = pos;
    return true;
  }
  let escapedStr = state.src[pos];
  if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);
    if (ch2 >= 56320 && ch2 <= 57343) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }
  const origStr = "\\" + escapedStr;
  if (!silent) {
    const token = state.push("text_special", "", 0);
    if (ch1 < 256 && ESCAPED[ch1] !== 0) token.content = escapedStr;
    else token.content = origStr;
    token.markup = origStr;
    token.info = "escape";
  }
  state.pos = pos + 1;
  return true;
}
function buildLastRuns(src) {
  const lastRuns = {};
  let pos = 0;
  while ((pos = src.indexOf("`", pos)) !== -1) {
    const start = pos;
    while (src.charCodeAt(++pos) === 96) ;
    lastRuns[pos - start] = start;
  }
  return lastRuns;
}
function backtick(state, silent) {
  var _state$backticks$open;
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 96) return false;
  const max = state.posMax;
  let pos = start + 1;
  while (pos < max && state.src.charCodeAt(pos) === 96) pos++;
  const marker = state.src.slice(start, pos);
  const openerLength = marker.length;
  if (!state.backticksScanned) {
    state.backticks = buildLastRuns(state.src);
    state.backticksScanned = true;
  }
  if (((_state$backticks$open = state.backticks[openerLength]) !== null && _state$backticks$open !== void 0 ? _state$backticks$open : -1) >= pos) {
    let matchEnd = pos;
    let matchStart;
    while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1 && matchStart < max) {
      matchEnd = matchStart + 1;
      while (state.src.charCodeAt(matchEnd) === 96) matchEnd++;
      if (matchEnd > max) break;
      if (matchEnd - matchStart === openerLength) {
        if (!silent) {
          const token = state.push("code_inline", "code", 0);
          token.markup = marker;
          let content = state.src.slice(pos, matchStart).replace(/\n/g, " ");
          if (content.startsWith(" ") && content.endsWith(" ") && /[^ ]/.test(content)) content = content.slice(1, -1);
          token.content = content;
        }
        state.pos = matchEnd;
        return true;
      }
    }
  }
  if (!silent) state.pending += marker;
  state.pos = pos;
  return true;
}
function strikethrough_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 126) return false;
  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);
  if (len < 2) return false;
  let token;
  if (len % 2) {
    token = state.push("text", "", 0);
    token.content = ch;
    len--;
  }
  for (let i = 0; i < len; i += 2) {
    token = state.push("text", "", 0);
    token.content = ch + ch;
    state.delimiters.push({
      marker,
      length: 0,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess$1(state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;
  for (let i = 0; i < max; i++) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 126) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    token = state.tokens[startDelim.token];
    token.type = "s_open";
    token.tag = "s";
    token.nesting = 1;
    token.markup = "~~";
    token.content = "";
    token = state.tokens[endDelim.token];
    token.type = "s_close";
    token.tag = "s";
    token.nesting = -1;
    token.markup = "~~";
    token.content = "";
    if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") loneMarkers.push(endDelim.token - 1);
  }
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;
    while (j < state.tokens.length && state.tokens[j].type === "s_close") j++;
    j--;
    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}
function strikethrough_postProcess(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess$1(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) postProcess$1(state, delimiters);
  }
}
var strikethrough_default = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};
function emphasis_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 95 && marker !== 42) return false;
  const scanned = state.scanDelims(state.pos, marker === 42);
  for (let i = 0; i < scanned.length; i++) {
    const token = state.push("text", "", 0);
    token.content = String.fromCharCode(marker);
    state.delimiters.push({
      marker,
      length: scanned.length,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess(state, delimiters) {
  const max = delimiters.length;
  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 95 && startDelim.marker !== 42) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
    const ch = String.fromCharCode(startDelim.marker);
    const token_o = state.tokens[startDelim.token];
    token_o.type = isStrong ? "strong_open" : "em_open";
    token_o.tag = isStrong ? "strong" : "em";
    token_o.nesting = 1;
    token_o.markup = isStrong ? ch + ch : ch;
    token_o.content = "";
    const token_c = state.tokens[endDelim.token];
    token_c.type = isStrong ? "strong_close" : "em_close";
    token_c.tag = isStrong ? "strong" : "em";
    token_c.nesting = -1;
    token_c.markup = isStrong ? ch + ch : ch;
    token_c.content = "";
    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = "";
      state.tokens[delimiters[startDelim.end + 1].token].content = "";
      i--;
    }
  }
}
function emphasis_post_process(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) postProcess(state, delimiters);
  }
}
var emphasis_default = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};
function link(state, silent) {
  let code2, label, res, ref;
  let href = "";
  let title = "";
  let start = state.pos;
  let parseReference = true;
  if (state.src.charCodeAt(state.pos) !== 91) return false;
  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
  if (labelEnd < 0) return false;
  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    parseReference = false;
    pos++;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
      start = pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) break;
      }
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;
        for (; pos < max; pos++) {
          code2 = state.src.charCodeAt(pos);
          if (!isSpace(code2) && code2 !== 10) break;
        }
      }
    }
    if (pos >= max || state.src.charCodeAt(pos) !== 41) parseReference = true;
    pos++;
  }
  if (parseReference) {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    label = normalizeReference(label);
    ref = state.env.references[label];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;
    const token_o = state.push("link_open", "a", 1);
    const attrs = [["href", href]];
    token_o.attrs = attrs;
    if (title) attrs.push(["title", title]);
    if (label) {
      const meta = /* @__PURE__ */ Object.create(null);
      meta.label = label;
      token_o.meta = meta;
    }
    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;
    state.push("link_close", "a", -1);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
function image(state, silent) {
  let code2, content, label, pos, ref, res, title, start;
  let href = "";
  const oldPos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(state.pos) !== 33) return false;
  if (state.src.charCodeAt(state.pos + 1) !== 91) return false;
  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
  if (labelEnd < 0) return false;
  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    pos++;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
    }
    start = pos;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) break;
      }
    } else title = "";
    if (pos >= max || state.src.charCodeAt(pos) !== 41) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    label = normalizeReference(label);
    ref = state.env.references[label];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);
    const tokens = [];
    state.md.inline.parse(content, state.md, state.env, tokens);
    const token = state.push("image", "img", 0);
    const attrs = [["src", href], ["alt", ""]];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;
    if (title) attrs.push(["title", title]);
    if (label) {
      const meta = /* @__PURE__ */ Object.create(null);
      meta.label = label;
      token.meta = meta;
    }
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
var EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
var AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
function autolink(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60) return false;
  const start = state.pos;
  const max = state.posMax;
  for (; ; ) {
    if (++pos >= max) return false;
    const ch = state.src.charCodeAt(pos);
    if (ch === 60) return false;
    if (ch === 62) break;
  }
  const url = state.src.slice(start + 1, pos);
  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(`mailto:${url}`);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  return false;
}
function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}
function isLetter(ch) {
  const lc = ch | 32;
  return lc >= 97 && lc <= 122;
}
function html_inline(state, silent) {
  if (!state.md.options.html) return false;
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) return false;
  const ch = state.src.charCodeAt(pos + 1);
  if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter(ch)) return false;
  const match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) return false;
  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = match[0];
    if (isLinkOpen(token.content)) state.linkLevel++;
    if (isLinkClose(token.content)) state.linkLevel--;
  }
  state.pos += match[0].length;
  return true;
}
var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
function entity(state, silent) {
  const pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 38) return false;
  if (pos + 1 >= max) return false;
  if (state.src.charCodeAt(pos + 1) === 35) {
    const match = state.src.slice(pos).match(DIGITAL_RE);
    if (match) {
      if (!silent) {
        const code2 = match[1][0].toLowerCase() === "x" ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
        const token = state.push("text_special", "", 0);
        token.content = isValidEntityCode(code2) ? fromCodePoint(code2) : fromCodePoint(65533);
        token.markup = match[0];
        token.info = "entity";
      }
      state.pos += match[0].length;
      return true;
    }
  } else {
    const match = state.src.slice(pos).match(NAMED_RE);
    if (match) {
      const decoded = decodeHTMLStrict(match[0]);
      if (decoded !== match[0]) {
        if (!silent) {
          const token = state.push("text_special", "", 0);
          token.content = decoded;
          token.markup = match[0];
          token.info = "entity";
        }
        state.pos += match[0].length;
        return true;
      }
    }
  }
  return false;
}
function processDelimiters(delimiters) {
  const openersBottom = {};
  const max = delimiters.length;
  if (!max) return;
  let headerIdx = 0;
  let lastTokenIdx = -2;
  const jumps = [];
  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];
    jumps.push(0);
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) headerIdx = closerIdx;
    lastTokenIdx = closer.token;
    closer.length = closer.length || 0;
    if (!closer.close) continue;
    if (!openersBottom.hasOwnProperty(closer.marker)) openersBottom[closer.marker] = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
    let openerIdx = headerIdx - jumps[headerIdx] - 1;
    let newMinOpenerIdx = openerIdx;
    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];
      if (opener.marker !== closer.marker) continue;
      if (opener.open && opener.end < 0) {
        let isOddMatch = false;
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) isOddMatch = true;
          }
        }
        if (!isOddMatch) {
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;
          closer.open = false;
          opener.end = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          lastTokenIdx = -2;
          break;
        }
      }
    }
    if (newMinOpenerIdx !== -1) openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
  }
}
function link_pairs(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  processDelimiters(state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) processDelimiters(delimiters);
  }
}
function fragments_join(state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;
  for (curr = last = 0; curr < max; curr++) {
    if (tokens[curr].nesting < 0) level--;
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++;
    if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
  }
  if (curr !== last) tokens.length = last;
}
var _rules = [
  ["text", text],
  ["linkify", linkify],
  ["newline", newline],
  ["escape", escape],
  ["backticks", backtick],
  ["strikethrough", strikethrough_default.tokenize],
  ["emphasis", emphasis_default.tokenize],
  ["link", link],
  ["image", image],
  ["autolink", autolink],
  ["html_inline", html_inline],
  ["entity", entity]
];
var _rules2 = [
  ["balance_pairs", link_pairs],
  ["strikethrough", strikethrough_default.postProcess],
  ["emphasis", emphasis_default.postProcess],
  ["fragments_join", fragments_join]
];
var ParserInline = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of inline rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Second ruler used for post-processing
      * (e.g. in emphasis-like rules).
      */
      "ruler2",
      new Ruler()
    );
    _defineProperty(this, "State", StateInline);
    for (let i = 0; i < _rules.length; i++) this.ruler.push(_rules[i][0], _rules[i][1]);
    for (let i = 0; i < _rules2.length; i++) this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
  skipToken(state) {
    const pos = state.pos;
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    const cache = state.cache;
    if (typeof cache[pos] !== "undefined") {
      state.pos = cache[pos];
      return;
    }
    let ok = false;
    if (state.level < maxNesting) for (let i = 0; i < len; i++) {
      state.level++;
      ok = rules[i](state, true);
      state.level--;
      if (ok) {
        if (pos >= state.pos) throw new Error("inline rule didn't increment state.pos");
        break;
      }
    }
    else state.pos = state.posMax;
    if (!ok) state.pos++;
    cache[pos] = state.pos;
  }
  tokenize(state) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const end = state.posMax;
    const maxNesting = state.md.options.maxNesting;
    while (state.pos < end) {
      const prevPos = state.pos;
      let ok = false;
      if (state.level < maxNesting) for (let i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) {
          if (prevPos >= state.pos) throw new Error("inline rule didn't increment state.pos");
          break;
        }
      }
      if (ok) {
        if (state.pos >= end) break;
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending) state.pushPending();
  }
  /**
  * Process input string and push inline tokens into `outTokens`
  */
  parse(str, md, env, outTokens) {
    const state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    const rules = this.ruler2.getRules("");
    const len = rules.length;
    for (let i = 0; i < len; i++) rules[i](state);
  }
};
var config = {
  default: {
    options: {
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 100
    },
    components: {
      core: {},
      block: {},
      inline: {}
    }
  },
  zero: {
    options: {
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 20
    },
    components: {
      core: { rules: [
        "normalize",
        "block",
        "strip_references",
        "inline",
        "text_join"
      ] },
      block: { rules: ["paragraph"] },
      inline: {
        rules: ["text"],
        rules2: ["balance_pairs", "fragments_join"]
      }
    }
  },
  commonmark: {
    options: {
      html: true,
      xhtmlOut: true,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 20
    },
    components: {
      core: { rules: [
        "normalize",
        "block",
        "strip_references",
        "inline",
        "text_join"
      ] },
      block: { rules: [
        "blockquote",
        "code",
        "fence",
        "heading",
        "hr",
        "html_block",
        "lheading",
        "list",
        "reference",
        "paragraph"
      ] },
      inline: {
        rules: [
          "autolink",
          "backticks",
          "emphasis",
          "entity",
          "escape",
          "html_inline",
          "image",
          "link",
          "newline",
          "text"
        ],
        rules2: [
          "balance_pairs",
          "emphasis",
          "fragments_join"
        ]
      }
    }
  }
};
var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
var RECODE_HOSTNAME_FOR = [
  "http:",
  "https:",
  "mailto:"
];
var MarkdownIt = class {
  /**
  * Link validation function. CommonMark allows too much in links. By default
  * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
  * except some embedded image types.
  *
  * You can change this behaviour:
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * // enable everything
  * md.validateLink = function () { return true; }
  * ```
  */
  validateLink(url) {
    const str = url.trim().toLowerCase();
    return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
  }
  /**
  * Function used to encode link url to a machine-readable format,
  * which includes url-encoding, punycode, etc.
  */
  normalizeLink(url) {
    const parsed = parse_default(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
        parsed.hostname = import_punycode.default.toASCII(parsed.hostname);
      } catch (er) {
      }
    }
    if (parsed.auth) parsed.auth = encode_default(parsed.auth);
    if (parsed.hostname) parsed.hostname = encode_default(parsed.hostname);
    if (parsed.pathname) parsed.pathname = encode_default(parsed.pathname);
    if (parsed.search) parsed.search = encode_default(parsed.search);
    if (parsed.hash) parsed.hash = encode_default(parsed.hash);
    return format(parsed);
  }
  /**
  * Function used to decode link url to a human-readable format`
  */
  normalizeLinkText(url) {
    const parsed = parse_default(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
        parsed.hostname = import_punycode.default.toUnicode(parsed.hostname);
      } catch (er) {
      }
    }
    return decode_default(format(parsed), decode_default.defaultChars + "%");
  }
  constructor(...args) {
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserInline}. You may need it to add new rules when
      * writing plugins. For simple rules control use {@link MarkdownIt.disable}
      * and {@link MarkdownIt.enable}.
      */
      "inline",
      new ParserInline()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserBlock}. You may need it to add new rules when
      * writing plugins. For simple rules control use {@link MarkdownIt.disable}
      * and {@link MarkdownIt.enable}.
      */
      "block",
      new ParserBlock()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserCore} chain executor. You may need it to add new
      * rules when writing plugins. For simple rules control use
      * {@link MarkdownIt.disable} and {@link MarkdownIt.enable}.
      */
      "core",
      new ParserCore()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link Renderer}. Use it to modify output look. Or to add rendering
      * rules for new token types, generated by plugins.
      *
      * See {@link Renderer} docs and
      * [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts).
      *
      * @example
      * ```javascript
      * import MarkdownIt from 'markdown-it'
      * const md = new MarkdownIt()
      *
      * function myToken(tokens, idx, options, env, self) {
      *   //...
      *   return result;
      * };
      *
      * md.renderer.rules['my_token'] = myToken
      * ```
      */
      "renderer",
      new Renderer()
    );
    _defineProperty(
      this,
      /**
      * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
      * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/src/rules_core/linkify.ts)
      * rule.
      */
      "linkify",
      new LinkifyIt()
    );
    _defineProperty(
      this,
      /**
      * Assorted utility functions, useful to write plugins. See details
      * [here](https://github.com/markdown-it/markdown-it/blob/master/src/common/utils.ts).
      */
      "utils",
      utils_exports
    );
    _defineProperty(
      this,
      /**
      * Link components parser functions, useful to write plugins. See details
      * [here](https://github.com/markdown-it/markdown-it/blob/master/src/helpers).
      */
      "helpers",
      Object.assign({}, helpers_exports)
    );
    const [presetNameOrOptions, options] = args;
    if (typeof presetNameOrOptions === "string") {
      this.configure(presetNameOrOptions);
      if (options) this.set(options);
    } else {
      this.configure("default");
      this.set(presetNameOrOptions || {});
    }
  }
  /**
  * Set parser options (in the same format as in constructor). Probably, you
  * will never need it, but you can change options after constructor call.
  *
  * __Note:__ To achieve the best possible performance, don't modify a
  * `markdown-it` instance options on the fly. If you need multiple configurations
  * it's best to create multiple instances and initialize each with separate
  * config.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  *
  * const md = new MarkdownIt()
  *   .set({ html: true, breaks: true })
  *   .set({ typographer: true })
  * ```
  */
  set(options) {
    Object.assign(this.options, options);
    return this;
  }
  /**
  * Batch load of all options and compenent settings. This is internal method,
  * and you probably will not need it. But if you will - see available presets
  * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/src/presets)
  *
  * We strongly recommend to use presets instead of direct config loads. That
  * will give better compatibility with next versions.
  */
  configure(presets) {
    let p;
    if (typeof presets === "string") {
      const presetName = presets;
      p = config[presetName];
      if (!p) throw new Error(`Wrong 'markdown-it' preset "${presetName}", check name`);
    } else p = presets;
    if (!p) throw new Error("Wrong `markdown-it` preset, can't be empty");
    if (p.options) this.options = { ...p.options };
    const components = p.components;
    if (components) {
      var _components$inline;
      [
        "core",
        "block",
        "inline"
      ].forEach((name) => {
        var _components$name;
        const rules = (_components$name = components[name]) === null || _components$name === void 0 ? void 0 : _components$name.rules;
        if (rules) this[name].ruler.enableOnly(rules);
      });
      const rules2 = (_components$inline = components.inline) === null || _components$inline === void 0 ? void 0 : _components$inline.rules2;
      if (rules2) this.inline.ruler2.enableOnly(rules2);
    }
    return this;
  }
  /**
  * Enable list or rules. It will automatically find appropriate components,
  * containing rules with given names. If rule not found, and `ignoreInvalid`
  * not set - throws exception.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  *
  * const md = new MarkdownIt()
  *   .enable(['sub', 'sup'])
  *   .disable('smartquotes')
  * ```
  */
  enable(list2, ignoreInvalid = false) {
    let result = [];
    if (!Array.isArray(list2)) list2 = [list2];
    [
      "core",
      "block",
      "inline"
    ].forEach((chain) => {
      result = result.concat(this[chain].ruler.enable(list2, true));
    });
    result = result.concat(this.inline.ruler2.enable(list2, true));
    const missed = list2.filter((name) => result.indexOf(name) < 0);
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to enable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * The same as {@link MarkdownIt.enable}, but turn specified rules off.
  */
  disable(list2, ignoreInvalid = false) {
    let result = [];
    if (!Array.isArray(list2)) list2 = [list2];
    [
      "core",
      "block",
      "inline"
    ].forEach((chain) => {
      result = result.concat(this[chain].ruler.disable(list2, true));
    });
    result = result.concat(this.inline.ruler2.disable(list2, true));
    const missed = list2.filter((name) => result.indexOf(name) < 0);
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to disable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * Load specified plugin with given params into current parser instance.
  * It's just a sugar to call `plugin(md, params)` with curring.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * import iterator from 'markdown-it-for-inline'
  *
  * const md = new MarkdownIt()
  *   .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
  *     tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar')
  *   })
  * ```
  */
  use(plugin, ...params) {
    plugin.apply(plugin, [this, ...params]);
    return this;
  }
  /**
  * Parse input string and return list of block tokens (special token type
  * "inline" will contain list of inline tokens). You should not call this
  * method directly, until you write custom renderer (for example, to produce
  * AST).
  *
  * `env` is used to pass data between "distributed" rules and return additional
  * metadata like reference info, needed for the renderer. It also can be used to
  * inject data in specific cases. Usually, you will be ok to pass `{}`,
  * and then pass updated object to renderer.
  */
  parse(src, env) {
    if (typeof src !== "string") throw new Error("Input data should be a String");
    const state = new this.core.State(src, this, env);
    this.core.process(state);
    return state.tokens;
  }
  /**
  * Render markdown string into html. It does all magic for you :).
  *
  * `env` can be used to inject additional metadata (`{}` by default).
  * But you will not need it with high probability. See also comment
  * in {@link MarkdownIt.parse}.
  */
  render(src, env = {}) {
    return this.renderer.render(this.parse(src, env), this.options, env);
  }
  /**
  * The same as {@link MarkdownIt.parse} but skip all block rules. It returns
  * the block tokens list with the single `inline` element, containing parsed
  * inline tokens in `children` property. Also updates `env` object.
  */
  parseInline(src, env) {
    const state = new this.core.State(src, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  }
  /**
  * Similar to {@link MarkdownIt.render} but for single paragraph content.
  * Result will NOT be wrapped into `<p>` tags.
  */
  renderInline(src, env = {}) {
    return this.renderer.render(this.parseInline(src, env), this.options, env);
  }
};
_defineProperty(MarkdownIt, "Token", Token);
_defineProperty(MarkdownIt, "Ruler", Ruler);
_defineProperty(MarkdownIt, "Renderer", Renderer);
_defineProperty(MarkdownIt, "ParserCore", ParserCore);
_defineProperty(MarkdownIt, "StateCore", StateCore);
_defineProperty(MarkdownIt, "ParserBlock", ParserBlock);
_defineProperty(MarkdownIt, "StateBlock", StateBlock);
_defineProperty(MarkdownIt, "ParserInline", ParserInline);
_defineProperty(MarkdownIt, "StateInline", StateInline);
var MarkdownItCallable = callable(MarkdownIt);

// src/diagram/definition.ts
function missingSymbols(text2) {
  const stack = [];
  let inString = false;
  for (let index = 0; index < text2.length; index++) {
    const char = text2[index];
    if (inString) {
      if (char === "\\") {
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      stack.push("}");
    } else if (char === "[") {
      stack.push("]");
    } else if (char === "}" || char === "]") {
      stack.pop();
    }
  }
  return `${inString ? '"' : ""}${stack.reverse().join("")}`;
}
function errorPosition(error, length) {
  const message = error instanceof Error ? error.message : "";
  const position = /position (\d+)/.exec(message)?.[1];
  return position === void 0 ? length : Math.min(Number(position), length);
}
function parseDefinitionJson(text2) {
  try {
    return { ok: true, value: JSON.parse(text2) };
  } catch (error) {
    const position = errorPosition(error, text2.length);
    const readable = text2.slice(0, position).trimEnd();
    const lines = readable.split("\n");
    const atEnd = text2.slice(position).trim() === "";
    return {
      ok: false,
      line: lines.length,
      after: (lines.at(-1) ?? "").trim(),
      missing: atEnd ? missingSymbols(readable) : ""
    };
  }
}

// src/extensions.ts
var extensions = /* @__PURE__ */ new Map();
function extensionFor(directive) {
  return extensions.get(directive);
}

// src/features.ts
function resolveFeatures(options) {
  const features = { ...options.defaults };
  for (const arg of options.args) {
    const sign = arg.slice(0, 1);
    const name = arg.slice(1);
    if ((sign === "+" || sign === "-") && Object.hasOwn(features, name)) {
      features[name] = sign === "+";
    }
  }
  return features;
}

// src/parts/escape.ts
function escapeHtml2(text2) {
  return text2.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// src/parts/embed.ts
var LOADING_TEXT = "\u56F3\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059";
function renderEmbed(options) {
  const { name, args = [], definition } = options;
  const index = definition === void 0 ? "" : ` data-mdmark-definition="${definition}"`;
  return `<div class="mdmark-embed" data-mdmark-slot="${escapeHtml2(name)}" data-mdmark-args="${escapeHtml2(args.join(" "))}"${index} role="status">${LOADING_TEXT}</div>`;
}

// src/parts/own.ts
function markOwn(html, nonce) {
  return html.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)/g,
    `<$1 data-mdmark-own="${nonce}"`
  );
}

// src/parts/syntax-warning.ts
var WARNING_TITLE = "\u66F8\u304D\u65B9\u306E\u8B66\u544A";
function renderInline(text2) {
  return text2.split("`").map(
    (part, index) => index % 2 === 1 ? `<code>${escapeHtml2(part)}</code>` : escapeHtml2(part)
  ).join("");
}
function renderSyntaxWarning(options) {
  const { mark = "", message, items = [] } = options;
  const markHtml = mark ? `<code>${escapeHtml2(mark)}</code>` : "";
  const list2 = items.length ? `<ul>${items.map(
    (item) => `<li>${item.label ? `<code>${escapeHtml2(item.label)}</code>: ` : ""}${renderInline(item.message)}</li>`
  ).join("")}</ul>` : "";
  return `<div class="mdmark-syntax-warning" role="note"><p class="mdmark-syntax-warning-title">${WARNING_TITLE}</p><p>${markHtml}${renderInline(message)}</p>${list2}</div>`;
}

// src/render/marks.ts
var MARK_PATTERN = /<!--\s*(\/)?([a-z][a-z0-9-]*)(?::\s*(.*?))?\s*-->/gs;
var FEATURES_MARK = "features";
var SYNTAX_MARKS = {
  table: "table",
  tabs: "tabs",
  steps: "steps",
  section: "sections",
  "row-detail": "row-details",
  fig: "figures",
  toc: "toc",
  glossary: "glossary",
  flow: "diagrams",
  sequence: "diagrams",
  chart: "diagrams",
  param: "diagrams"
};
var DIAGRAM_MARKS = ["flow", "sequence", "chart", "param"];
var MARK_TOKEN = "mdmark_mark";
function parseMarkArgs(text2) {
  const value = { args: [], keys: {} };
  for (const part of text2.split(/\s+/).filter(Boolean)) {
    const pair = /^([^\s=]+)=(.*)$/.exec(part);
    if (pair?.[1] !== void 0) {
      value.keys[pair[1]] = pair[2] ?? "";
    } else {
      value.args.push(part);
    }
  }
  return value;
}
function toMark(raw, closing, name, rest) {
  return {
    name,
    args: parseMarkArgs(rest ?? ""),
    raw,
    closing: closing === "/",
    rest: rest ?? ""
  };
}
function replaceMarks(html, env) {
  return html.replace(
    MARK_PATTERN,
    (raw, closing, name, rest) => {
      const mark = toMark(raw, closing, name, rest);
      if (mark.closing) {
        return "";
      }
      if (mark.name === FEATURES_MARK) {
        env.featureArgs.push(...mark.args.args);
        return "";
      }
      if (extensionFor(mark.name) || Object.hasOwn(env.libraries, mark.name)) {
        const args = (rest ?? "").split(/\s+/).filter(Boolean);
        return markOwn(renderEmbed({ name: mark.name, args }), env.nonce);
      }
      return "";
    }
  );
}
function soleMark(content) {
  const matches = [...content.matchAll(MARK_PATTERN)];
  const [only] = matches;
  if (matches.length !== 1 || !only || content.replace(MARK_PATTERN, "").trim()) {
    return void 0;
  }
  return toMark(only[0], only[1], only[2] ?? "", only[3]);
}
function soleSyntaxMark(content, env) {
  const mark = soleMark(content);
  if (!mark || !Object.hasOwn(SYNTAX_MARKS, mark.name)) {
    return void 0;
  }
  const overridden = DIAGRAM_MARKS.includes(mark.name) && (extensionFor(mark.name) || Object.hasOwn(env.libraries, mark.name));
  return overridden ? void 0 : mark;
}
function isJsonFence(token) {
  return token.type === "fence" && token.info.trim().split(/\s+/)[0] === "json";
}
function closeOf(tokens, index, mark) {
  const level = tokens[index]?.level;
  return tokens.findIndex((token, position) => {
    if (position <= index || token.type !== "html_block") {
      return false;
    }
    const other = soleMark(token.content);
    return token.level === level && other?.closing === true && other.name === mark.name;
  });
}
function isHandledMark(name, env) {
  return name === FEATURES_MARK || Object.hasOwn(SYNTAX_MARKS, name) || Object.hasOwn(env.libraries, name);
}
function ownHtmlBlock(state, html) {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  token.content = markOwn(html, state.env.nonce);
  return token;
}
function extensionSlot(options) {
  const { state, mark, fences, extensionName } = options;
  const env = state.env;
  const [fence2] = fences;
  if (!fence2 || fences.length > 1) {
    return ownHtmlBlock(
      state,
      renderSyntaxWarning({
        mark: mark.raw,
        message: `\u306E\u7BC4\u56F2\u306B json \u306E\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u304C ${fences.length} \u3064\u3042\u308A\u307E\u3059\u3002\u90E8\u54C1\u306E\u5B9A\u7FA9\u306F 1 \u3064\u3060\u3051\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u62E1\u5F35 \`${extensionName}\` \u306E\u90E8\u54C1\u306F\u63CF\u3044\u3066\u3044\u307E\u305B\u3093\u3002`
      })
    );
  }
  const parsed = parseDefinitionJson(fence2.content);
  if (!parsed.ok) {
    const after = parsed.after.replaceAll("`", "'");
    const where = `${parsed.line} \u884C\u76EE\u306E ${after} \u306E\u5F8C`;
    const detail = parsed.missing === "" ? `${where}\u304C\u8AAD\u3081\u307E\u305B\u3093` : `${where}\u306B ${parsed.missing} \u304C\u3042\u308A\u307E\u305B\u3093`;
    return ownHtmlBlock(
      state,
      renderSyntaxWarning({
        mark: mark.raw,
        message: `\u306E\u90E8\u54C1\u306E\u5B9A\u7FA9\u3092 JSON \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08${detail}\uFF09\u3002\u62E1\u5F35 \`${extensionName}\` \u306E\u90E8\u54C1\u306F\u63CF\u3044\u3066\u3044\u307E\u305B\u3093\u3002`
      })
    );
  }
  env.extensionDefinitions ??= [];
  const definition = env.extensionDefinitions.push(parsed.value) - 1;
  const args = (mark.rest ?? "").split(/\s+/).filter(Boolean);
  return ownHtmlBlock(
    state,
    renderEmbed({ name: mark.name, args, definition })
  );
}
function takeDefinitionRanges(state) {
  const env = state.env;
  const tokens = state.tokens;
  const out = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const mark = token.type === "html_block" ? soleMark(token.content) : void 0;
    const extension = mark ? extensionFor(mark.name) : void 0;
    if (!mark || mark.closing || !extension && isHandledMark(mark.name, env)) {
      out.push(token);
      continue;
    }
    const closeIndex = closeOf(tokens, index, mark);
    const inner = closeIndex < 0 ? [] : tokens.slice(index + 1, closeIndex);
    const fences = inner.filter(isJsonFence);
    if (extension && fences.length > 0) {
      out.push(
        extensionSlot({ state, mark, fences, extensionName: extension.name })
      );
      index = closeIndex;
    } else if (!extension && inner.length > 0 && fences.length === inner.length) {
      index = closeIndex;
    } else {
      out.push(token);
    }
  }
  state.tokens = out;
}
function takeMarks(state) {
  const env = state.env;
  takeDefinitionRanges(state);
  for (const token of state.tokens) {
    if (token.type === "html_block") {
      const mark = soleSyntaxMark(token.content, env);
      if (mark) {
        token.type = MARK_TOKEN;
        token.meta = mark;
        token.content = "";
        continue;
      }
      token.content = replaceMarks(token.content, env);
    }
    for (const child of token.children ?? []) {
      if (child.type === "html_inline") {
        child.content = replaceMarks(child.content, env);
      }
    }
  }
}
function resolveDocumentFeatures(state) {
  const env = state.env;
  env.features = resolveFeatures({
    defaults: env.defaults,
    args: env.featureArgs
  });
}

// src/cli/embed.ts
var BROWSER_TARGETS = ["chrome99", "firefox98", "safari16.4"];
var URL_NAMESPACE = "http-url";
var IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};
var EXTERNAL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
var HTTP_PATTERN = /^https?:\/\//i;
var fetchByUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} \u306F ${response.status} \u3092\u8FD4\u3057\u307E\u3057\u305F`);
  }
  return response.text();
};
function usedLibraryMarks(markdowns, libraries) {
  const marks = /* @__PURE__ */ new Set();
  for (const markdown of markdowns) {
    for (const match of markdown.matchAll(MARK_PATTERN)) {
      const [, closing, name] = match;
      if (closing !== "/" && name && Object.hasOwn(libraries, name)) {
        marks.add(name);
      }
    }
  }
  return marks;
}
function urlPlugin(fetchText) {
  return {
    name: "http-url",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /^https?:\/\// }, (args) => ({
        path: args.path,
        namespace: URL_NAMESPACE
      }));
      pluginBuild.onResolve(
        { filter: /.*/, namespace: URL_NAMESPACE },
        (args) => ({
          path: new URL(args.path, args.importer).href,
          namespace: URL_NAMESPACE
        })
      );
      pluginBuild.onLoad(
        { filter: /.*/, namespace: URL_NAMESPACE },
        async (args) => ({
          contents: await fetchText(args.path),
          loader: "js"
        })
      );
    }
  };
}
async function bundleModule(entry, baseDir, fetchText = fetchByUrl) {
  try {
    const result = await build({
      absWorkingDir: baseDir,
      entryPoints: [HTTP_PATTERN.test(entry) ? entry : resolve3(baseDir, entry)],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: BROWSER_TARGETS,
      minify: true,
      write: false,
      outfile: "bundle.js",
      plugins: [urlPlugin(fetchText)],
      logLevel: "silent"
    });
    const code2 = result.outputFiles[0]?.text;
    if (code2 === void 0) {
      return { error: `${entry}: \u675F\u306D\u305F\u7D50\u679C\u304C\u3042\u308A\u307E\u305B\u3093` };
    }
    return { code: code2 };
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { error: `${entry}: ${reason}` };
  }
}
function findImageSources(markdown) {
  const tokens = new MarkdownItCallable({ html: true }).parse(markdown, {});
  const found = [];
  for (const token of tokens) {
    if (!token.map) {
      continue;
    }
    const [start, end] = token.map;
    const sources = [];
    for (const child of token.children ?? []) {
      if (child.type === "image") {
        const src = child.attrGet("src");
        sources.push(typeof src === "string" ? src : "");
      } else if (child.type === "html_inline") {
        sources.push(...imgSources(child.content));
      }
    }
    if (token.type === "html_block") {
      sources.push(...imgSources(token.content));
    }
    for (const src of sources) {
      if (src !== "") {
        found.push({ start, end, src });
      }
    }
  }
  return found;
}
function imgSources(html) {
  return [
    ...html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)
  ].map((match) => match[1] ?? match[2] ?? "");
}
async function inlineImages(markdown, docFile) {
  const lines = markdown.split("\n");
  const warnings = [];
  const dataUrls = /* @__PURE__ */ new Map();
  for (const { start, end, src } of findImageSources(markdown)) {
    if (src.startsWith("data:")) {
      continue;
    }
    if (!dataUrls.has(src)) {
      dataUrls.set(src, await readImage(src, docFile, warnings));
    }
    const dataUrl = dataUrls.get(src);
    if (dataUrl === void 0) {
      continue;
    }
    for (let line = start; line < end; line += 1) {
      lines[line] = (lines[line] ?? "").replaceAll(src, dataUrl);
    }
  }
  return { markdown: lines.join("\n"), warnings };
}
async function readImage(src, docFile, warnings) {
  if (EXTERNAL_PATTERN.test(src) || src.startsWith("/")) {
    warnings.push(
      `\u753B\u50CF \`${src}\` \u306F\u7D76\u5BFE URL \u306E\u305F\u3081\u57CB\u3081\u307E\u305B\u3093\u3002\u958B\u3044\u305F\u3068\u304D\u306B\u5916\u3078\u8981\u6C42\u3057\u307E\u3059\u3002`
    );
    return void 0;
  }
  const mime = IMAGE_MIME[extname2(src.split(/[?#]/)[0] ?? "").toLowerCase()];
  if (mime === void 0) {
    warnings.push(
      `\u753B\u50CF \`${src}\` \u306F\u57CB\u3081\u3089\u308C\u306A\u3044\u5F62\u5F0F\u3067\u3059\u3002png\u30FBjpg\u30FBjpeg\u30FBgif\u30FBwebp\u30FBsvg \u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    );
    return void 0;
  }
  let decoded = src;
  try {
    decoded = decodeURI(src);
  } catch {
  }
  try {
    const bytes = await readFile3(resolve3(dirname3(docFile), decoded));
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    warnings.push(
      `\u753B\u50CF \`${src}\` \u3092\u8AAD\u3081\u307E\u305B\u3093\u3002\u30D1\u30B9\u3092\u76F4\u3059\u304B\u753B\u50CF\u3092\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
    );
    return void 0;
  }
}
function decodeHref(href) {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}
function findOutsideLinks(markdown, docPath, paths) {
  const tokens = new MarkdownItCallable({ html: true }).parse(markdown, {});
  const outside = [];
  for (const token of tokens) {
    for (const child of token.children ?? []) {
      const href = child.type === "link_open" ? child.attrGet("href") : null;
      if (typeof href !== "string" || href.startsWith("#")) {
        continue;
      }
      const target = resolveLink(docPath, href);
      const written = decodeHref(href);
      if (target !== void 0 && extname2(target) === ".md" && !paths.has(target) && !outside.includes(written)) {
        outside.push(written);
      }
    }
  }
  return outside;
}

// src/cli/export.ts
import { mkdir, readFile as readFile4, writeFile } from "node:fs/promises";
import {
  basename as basename3,
  dirname as dirname4,
  extname as extname3,
  join as join3,
  relative as relative2,
  resolve as resolve4,
  sep as sep2
} from "node:path";

// src/knowledge/index-shape.ts
var INDEX_SHAPE = {
  root: {
    schema: { type: "integer", required: true },
    docs: { type: "array", required: true },
    terms: { type: "array", required: false }
  },
  doc: {
    id: { type: "string", required: true },
    path: { type: "string", required: true },
    title: { type: "string", required: true },
    description: { type: "string", required: false },
    aliases: { type: "string[]", required: false },
    tags: { type: "string[]", required: false },
    related: { type: "string[]", required: false }
  },
  term: {
    id: { type: "string", required: true },
    term: { type: "string", required: true },
    meaning: { type: "string", required: true },
    aliases: { type: "string[]", required: false }
  }
};
var EMPTY_ALLOWED = /* @__PURE__ */ new Set(["description"]);
var CURRENT_SCHEMA = 1;
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkType(key, value, shape) {
  if (shape.type === "integer") {
    return Number.isInteger(value) ? void 0 : `${key} \u306F\u6574\u6570\u306B\u3057\u307E\u3059`;
  }
  if (shape.type === "array") {
    return Array.isArray(value) ? void 0 : `${key} \u306F\u4E26\u3073\u306B\u3057\u307E\u3059`;
  }
  if (shape.type === "string") {
    if (typeof value !== "string") {
      return `${key} \u306F\u6587\u5B57\u5217\u306B\u3057\u307E\u3059`;
    }
    return value === "" && !EMPTY_ALLOWED.has(key) ? `${key} \u306F\u7A7A\u306B\u3067\u304D\u307E\u305B\u3093` : void 0;
  }
  const ok = Array.isArray(value) && value.every((item) => typeof item === "string" && item !== "");
  return ok ? void 0 : `${key} \u306F\u7A7A\u3067\u306A\u3044\u6587\u5B57\u5217\u306E\u4E26\u3073\u306B\u3057\u307E\u3059`;
}
function checkItem(options) {
  const { item, shape, where, problems } = options;
  if (!isRecord2(item)) {
    problems.push({ where, message: `${where} \u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059` });
    return false;
  }
  let valid = true;
  for (const [key, keyShape] of Object.entries(shape)) {
    const value = item[key];
    if (value === void 0) {
      if (keyShape.required) {
        problems.push({
          where: `${where}.${key}`,
          message: `${key} \u304C\u3042\u308A\u307E\u305B\u3093`
        });
        valid = false;
      }
      continue;
    }
    const message = checkType(key, value, keyShape);
    if (message) {
      problems.push({ where: `${where}.${key}`, message });
      valid = false;
    }
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key)) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} \u306F\u7D22\u5F15\u306B\u66F8\u3051\u306A\u3044\u30AD\u30FC\u3067\u3059`
      });
      valid = false;
    }
  }
  return valid;
}
function checkList(options) {
  const { list: list2, name, shape, unique, problems } = options;
  const seen = new Map(
    unique.map((key) => [key, /* @__PURE__ */ new Set()])
  );
  const items = [];
  list2.forEach((item, position) => {
    const where = `${name}[${position}]`;
    if (!checkItem({ item, shape, where, problems })) {
      return;
    }
    const record = item;
    const duplicated = unique.filter((key) => seen.get(key)?.has(record[key]));
    for (const key of duplicated) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} \u304C\u5148\u306E\u8981\u7D20\u3068\u91CD\u306A\u3063\u3066\u3044\u307E\u3059`
      });
    }
    if (duplicated.length) {
      return;
    }
    for (const key of unique) {
      seen.get(key)?.add(record[key]);
    }
    items.push(item);
  });
  return items;
}
function normalizeIndex(value) {
  const problems = [];
  const index = { schema: CURRENT_SCHEMA, docs: [] };
  if (!isRecord2(value)) {
    problems.push({ where: "", message: "\u7D22\u5F15\u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059" });
    return { index, problems };
  }
  const root = [];
  checkItem({
    item: { ...value, docs: [], terms: [] },
    shape: INDEX_SHAPE.root,
    where: "",
    problems: root
  });
  for (const problem of root) {
    const key = problem.where.slice(1);
    if (key !== "docs" && key !== "terms") {
      problems.push({ where: key, message: problem.message });
    }
  }
  if (value.schema !== void 0 && value.schema !== CURRENT_SCHEMA) {
    if (Number.isInteger(value.schema)) {
      problems.push({
        where: "schema",
        message: `schema \u306F ${CURRENT_SCHEMA} \u306B\u3057\u307E\u3059`
      });
    }
  }
  index.docs = checkTop({
    list: value.docs,
    name: "docs",
    shape: INDEX_SHAPE.doc,
    unique: ["id", "path"],
    required: true,
    problems
  });
  if (value.terms !== void 0) {
    index.terms = checkTop({
      list: value.terms,
      name: "terms",
      shape: INDEX_SHAPE.term,
      unique: ["id"],
      required: false,
      problems
    });
  }
  return { index, problems };
}
function checkTop(options) {
  const { list: list2, name, required, problems } = options;
  if (list2 === void 0) {
    if (required) {
      problems.push({ where: name, message: `${name} \u304C\u3042\u308A\u307E\u305B\u3093` });
    }
    return [];
  }
  if (!Array.isArray(list2)) {
    problems.push({ where: name, message: `${name} \u306F\u4E26\u3073\u306B\u3057\u307E\u3059` });
    return [];
  }
  return checkList({ ...options, list: list2 });
}

// src/render/syntax/tokens.ts
function envOf(state) {
  return state.env;
}
function featureOn(state, name) {
  return envOf(state).features[name] === true;
}
function ownBlock(state, html) {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  token.content = markOwn(html, envOf(state).nonce);
  return token;
}
function markOf(token) {
  return token?.type === MARK_TOKEN ? token.meta : void 0;
}
function findClose(tokens, openIndex, name) {
  const level = tokens[openIndex]?.level;
  for (let index = openIndex + 1; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (mark?.closing && mark.name === name && token?.level === level) {
      return index;
    }
  }
  return -1;
}
function textOf(token) {
  return (token.children ?? []).filter((child) => child.type === "text" || child.type === "code_inline").map((child) => child.content).join("");
}

// src/render/syntax/warnings.ts
function warningBlock(state, warning) {
  return ownBlock(state, renderSyntaxWarning(warning));
}
function unclosedWarning(mark) {
  return {
    mark: mark.raw,
    message: `\u306E\u9589\u3058\u306E\u5370 \`<!-- /${mark.name} -->\` \u304C\u3042\u308A\u307E\u305B\u3093\u3002\u7BC4\u56F2\u306E\u7D42\u308F\u308A\u306B\u9589\u3058\u306E\u5370\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u5370\u304B\u3089\u6587\u66F8\u306E\u7D42\u308F\u308A\u307E\u3067\u3092\u7BC4\u56F2\u306B\u3057\u3066\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`
  };
}

// src/render/syntax/glossary.ts
var ALIAS_SEPARATOR = /[、,]/;
function readTables(tokens) {
  const tables = [];
  let table2;
  let inHead = false;
  let row;
  for (const [position, token] of tokens.entries()) {
    if (token.type === "table_open") {
      table2 = { columns: [], rows: [] };
      tables.push(table2);
    } else if (token.type === "thead_open") {
      inHead = true;
    } else if (token.type === "thead_close") {
      inHead = false;
    } else if (token.type === "tr_open" && !inHead) {
      row = { cells: [], line: (token.map?.[0] ?? 0) + 1 };
      table2?.rows.push(row);
    } else if (token.type === "th_open" || token.type === "td_open") {
      const inline2 = tokens[position + 1];
      const text2 = inline2 ? textOf(inline2).trim() : "";
      if (token.type === "th_open") {
        table2?.columns.push(text2);
      } else {
        row?.cells.push(text2);
      }
    }
  }
  return tables;
}
function unknownColumnMessage(argName, name, columns) {
  const list2 = columns.map((column) => `\`${column}\``).join("\u30FB");
  return `\u306E \`${argName}=\` \u306E\u5217 \`${name}\` \u304C\u8868\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u8868\u306E\u5217\u306F ${list2} \u3067\u3059\u3002\u5217\u540D\u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u3053\u306E\u8868\u304B\u3089\u306F\u7528\u8A9E\u3092\u5165\u308C\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
}
function missingArgMessage(argName) {
  const column = argName === "term" ? "\u7528\u8A9E" : "\u610F\u5473";
  return `\u306B \`${argName}=\` \u304C\u3042\u308A\u307E\u305B\u3093\u3002${column}\u306E\u5217\u3092 \`${argName}=\u5217\u540D\` \u3067\u6307\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u3053\u306E\u8868\u304B\u3089\u306F\u7528\u8A9E\u3092\u5165\u308C\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
}
function readGlossaryRows(options) {
  const { args, tokens, docId } = options;
  const rows = [];
  let warning;
  for (const table2 of readTables(tokens)) {
    const positions = {};
    let problem;
    for (const [argName, required] of [
      ["term", true],
      ["meaning", true],
      ["aliases", false]
    ]) {
      const name = args.keys[argName];
      if (name === void 0 || name === "") {
        if (required && problem === void 0) {
          problem = missingArgMessage(argName);
        }
        continue;
      }
      const position = table2.columns.indexOf(name);
      if (position === -1) {
        problem ??= unknownColumnMessage(argName, name, table2.columns);
      } else {
        positions[argName] = position;
      }
    }
    if (problem !== void 0) {
      warning ??= problem;
      continue;
    }
    for (const row of table2.rows) {
      const term = row.cells[positions.term ?? -1] ?? "";
      const meaning = row.cells[positions.meaning ?? -1] ?? "";
      if (term === "" || meaning === "") {
        continue;
      }
      const aliases = (row.cells[positions.aliases ?? -1] ?? "").split(ALIAS_SEPARATOR).map((alias) => alias.trim()).filter(Boolean);
      rows.push({ entry: { term, aliases, meaning, docId }, line: row.line });
    }
  }
  return warning === void 0 ? { rows } : { rows, warning };
}
function glossaryRule(state) {
  const env = envOf(state);
  const enabled = featureOn(state, "glossary");
  const tokens = state.tokens;
  const out = [];
  for (let position = 0; position < tokens.length; position++) {
    const token = tokens[position];
    const mark = markOf(token);
    if (!token || mark?.name !== "glossary") {
      if (token) {
        out.push(token);
      }
      continue;
    }
    if (mark.closing) {
      continue;
    }
    const close = findClose(tokens, position, "glossary");
    const end = close === -1 ? tokens.length : close;
    const range = tokens.slice(position + 1, end);
    if (enabled) {
      const { rows, warning } = readGlossaryRows({
        args: mark.args,
        tokens: range,
        docId: env.docId ?? ""
      });
      if (close === -1) {
        out.push(warningBlock(state, unclosedWarning(mark)));
      }
      if (warning !== void 0) {
        out.push(warningBlock(state, { mark: mark.raw, message: warning }));
      }
      for (const row of rows) {
        env.ownGlossary.push(row.entry);
        env.glossaryLines?.push(row.line);
      }
      for (const inline2 of range) {
        for (const child of inline2.children ?? []) {
          child.meta = { ...child.meta, mdmarkNoTerms: true };
        }
      }
    }
    out.push(...range);
    position = end;
  }
  state.tokens = out;
}

// src/knowledge/dictionary.ts
var SEGMENTER = new Intl.Segmenter("ja", { granularity: "word" });
function findWords(text2, words) {
  const longestFirst = [...words].sort((a, b) => b.length - a.length);
  const starts = [...SEGMENTER.segment(text2)].map((segment) => segment.index);
  const boundaries = /* @__PURE__ */ new Set([...starts, text2.length]);
  const found = [];
  let skipTo = 0;
  for (const start of starts) {
    if (start < skipTo) {
      continue;
    }
    const word = longestFirst.find(
      (candidate) => text2.startsWith(candidate, start) && boundaries.has(start + candidate.length)
    );
    if (word !== void 0) {
      found.push({ start, end: start + word.length, word });
      skipTo = start + word.length;
    }
  }
  return found;
}
function forEachInline(tokens, callback) {
  let section = 0;
  let inHeading = false;
  for (const token of tokens) {
    if (token.type === "heading_open") {
      inHeading = true;
      if (/^h[234]$/.test(token.tag)) {
        section += 1;
      }
    } else if (token.type === "heading_close") {
      inHeading = false;
    } else if (token.type === "inline" && !inHeading) {
      callback(token, section);
    }
  }
}
function matchableChildren(inline2) {
  const positions = [];
  let linkDepth = 0;
  (inline2.children ?? []).forEach((child, position) => {
    if (child.type === "link_open") {
      linkDepth += 1;
    } else if (child.type === "link_close") {
      linkDepth -= 1;
    } else if (child.type === "text" && linkDepth === 0 && child.meta?.mdmarkNoTerms !== true) {
      positions.push(position);
    }
  });
  return positions;
}

// src/knowledge/references.ts
var parser;
function parseDocument(options) {
  if (!parser) {
    parser = new MarkdownItCallable({ html: true });
    parser.core.ruler.push("mdmark_take_marks", takeMarks);
    parser.core.ruler.push("mdmark_resolve_features", resolveDocumentFeatures);
    parser.core.ruler.push("mdmark_glossary", glossaryRule);
  }
  const env = {
    libraries: {},
    defaults: options.defaults,
    featureArgs: [],
    features: {},
    headings: [],
    nonce: "",
    docId: options.docId,
    ownGlossary: [],
    glossaryLines: []
  };
  const tokens = parser.parse(options.body, env);
  const glossary = env.ownGlossary.map((entry, position) => ({
    entry,
    line: env.glossaryLines?.[position] ?? 0
  }));
  return { tokens, features: env.features, glossary };
}
function linkedPaths(doc, tokens) {
  const paths = /* @__PURE__ */ new Set();
  for (const token of tokens) {
    for (const child of token.children ?? []) {
      const href = child.type === "link_open" ? child.attrGet("href") : null;
      const path = typeof href === "string" ? resolveLink(doc.path, href) : void 0;
      if (path !== void 0) {
        paths.add(path);
      }
    }
  }
  return paths;
}
function matchedAliases(tokens, aliases) {
  const matched = /* @__PURE__ */ new Set();
  if (aliases.length === 0) {
    return matched;
  }
  forEachInline(tokens, (inline2) => {
    for (const position of matchableChildren(inline2)) {
      const content = inline2.children?.[position]?.content ?? "";
      for (const found of findWords(content, aliases)) {
        matched.add(found.word);
      }
    }
  });
  return matched;
}
function collectReferences(input) {
  const { index } = normalizeIndex(input.index);
  const defaults = resolveConfig({ config: input.config }).features;
  const bodies = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      body
    ])
  );
  const scanned = index.docs.map((doc) => {
    const body = bodies.get(normalizePath(doc.path));
    return {
      doc,
      parsed: body === void 0 ? void 0 : parseDocument({ body, docId: doc.id, defaults })
    };
  });
  const featureOn2 = (item, name) => (item.parsed?.features ?? defaults)[name] !== false;
  const aliasOwners = /* @__PURE__ */ new Map();
  for (const { doc } of scanned) {
    for (const alias of doc.aliases ?? []) {
      aliasOwners.set(alias, [...aliasOwners.get(alias) ?? [], doc]);
    }
  }
  const aliases = [...aliasOwners.keys()];
  const byPath = new Map(
    index.docs.map((doc) => [normalizePath(doc.path), doc])
  );
  const byId = new Map(index.docs.map((doc) => [doc.id, doc]));
  const referenced = new Map(
    index.docs.map((doc) => [doc.id, /* @__PURE__ */ new Set()])
  );
  for (const source of scanned) {
    if (!featureOn2(source, "backlinks")) {
      continue;
    }
    const targets = /* @__PURE__ */ new Set();
    for (const id of source.doc.related ?? []) {
      const target = byId.get(id);
      if (target) {
        targets.add(target);
      }
    }
    const tokens = source.parsed?.tokens ?? [];
    for (const path of linkedPaths(source.doc, tokens)) {
      const target = byPath.get(path);
      if (target) {
        targets.add(target);
      }
    }
    for (const word of matchedAliases(tokens, aliases)) {
      for (const target of aliasOwners.get(word) ?? []) {
        targets.add(target);
      }
    }
    for (const target of targets) {
      const targetItem = scanned.find((item) => item.doc === target);
      if (target !== source.doc && targetItem && featureOn2(targetItem, "backlinks")) {
        referenced.get(target.id)?.add(source.doc.id);
      }
    }
  }
  const backlinks = {};
  for (const [id, sources] of referenced) {
    backlinks[id] = [...sources];
  }
  const glossary = scanned.flatMap(
    (item) => (item.parsed?.glossary ?? []).map((row) => row.entry)
  );
  return { backlinks, glossary };
}

// src/cli/html.ts
var PAYLOAD_ID = "mdmark-payload";
var MENU_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.75 4h10.5"/><path d="M2.75 8h10.5"/><path d="M2.75 12h10.5"/></svg>';
var CLOSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8"/><path d="M12 4l-8 8"/></svg>';
var BUNDLE_BODY = [
  '<div class="mdmark-bundle">',
  '<aside class="mdmark-bundle-side"></aside>',
  '<main class="mdmark-bundle-main">',
  '<div class="mdmark-bundle-bar">',
  `<button class="mdmark-bundle-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="mdmark-doc-list-panel" data-panel-open>${MENU_ICON}\u6587\u66F8\u306E\u4E00\u89A7</button>`,
  '<span class="mdmark-bundle-bar-title" data-bar-title></span>',
  "</div>",
  '<article class="mdmark" data-doc-view></article>',
  "</main>",
  "</div>",
  '<dialog class="mdmark-bundle-panel" id="mdmark-doc-list-panel" closedby="any" aria-labelledby="mdmark-doc-list-panel-title">',
  '<div class="mdmark-bundle-panel-head">',
  '<p class="mdmark-bundle-panel-title" id="mdmark-doc-list-panel-title">\u6587\u66F8\u306E\u4E00\u89A7</p>',
  `<button class="mdmark-bundle-button is-icon" type="button" aria-label="\u6587\u66F8\u306E\u4E00\u89A7\u3092\u9589\u3058\u308B" data-panel-close>${CLOSE_ICON}</button>`,
  "</div>",
  "<div data-panel-body></div>",
  "</dialog>"
].join("");
var DOCUMENT_BODY = '<article class="mdmark"></article>';
function escapeStyle(css) {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}
function encodePayload(payload) {
  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}
function assembleHtml(parts) {
  const { payload, distCss, themeCss, viewer } = parts;
  const entry = payload.docs.find((doc) => doc.path === payload.entry);
  const title = escapeHtml2(entry?.title ?? payload.entry);
  const body = payload.kind === "bundle" ? BUNDLE_BODY : DOCUMENT_BODY;
  const styles = [distCss, themeCss ?? ""].filter((css) => css !== "").map((css) => `<style>${escapeStyle(css)}</style>`).join("");
  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${title}</title>`,
    styles,
    "</head>",
    "<body>",
    body,
    `<script type="application/json" id="${PAYLOAD_ID}">${encodePayload(payload)}</script>`,
    `<script type="module">${viewer}</script>`,
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

// src/cli/export.ts
var GLOSSARY_ID_PREFIX = "mdmark-glossary-";
function toPosix2(path) {
  return path.split(sep2).join("/");
}
function reasonOf(error) {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
}
async function prepareReferences(options) {
  const { loaded, kind, markdowns } = options;
  const info = await readIndexWithDocuments(loaded);
  const index = info ? normalizeIndex(info.raw).index : void 0;
  const baseDir = info ? info.indexDir : loaded.dir;
  const indexPathOf = (path) => toPosix2(relative2(baseDir, join3(loaded.dir, path)));
  const byPath = (path) => index?.docs.find((doc) => normalizePath(doc.path) === indexPathOf(path));
  const glossaryPaths = kind === "bundle" ? loaded.config.build?.glossary ?? [] : [];
  const referenceDocs = [...index?.docs ?? []];
  const documents = { ...info?.documents };
  glossaryPaths.forEach((glossaryPath, position) => {
    const path = normalizePath(glossaryPath);
    const markdown = markdowns.get(path);
    if (markdown === void 0) {
      return;
    }
    const key = indexPathOf(path);
    documents[key] = markdown;
    if (!referenceDocs.some((doc) => normalizePath(doc.path) === key)) {
      referenceDocs.push({
        id: `${GLOSSARY_ID_PREFIX}${position}`,
        path: key,
        title: documentTitle({ path, markdown })
      });
    }
  });
  const references = referenceDocs.length === 0 ? void 0 : collectReferences({
    index: { schema: 1, docs: referenceDocs, terms: index?.terms ?? [] },
    documents,
    config: { features: loaded.config.features ?? {} }
  });
  return {
    index,
    references,
    docIdOf: (path) => byPath(path)?.id,
    titleOf: (path) => byPath(path)?.title
  };
}
async function prepareEmbeds(options) {
  const { loaded, docs, kind, entry } = options;
  const warnings = [];
  const configName = basename3(loaded.path);
  const originals = /* @__PURE__ */ new Map();
  const inlined = /* @__PURE__ */ new Map();
  for (const doc of docs) {
    const original = await readFile4(doc.file, "utf8");
    const result = await inlineImages(original, doc.file);
    originals.set(doc.path, original);
    inlined.set(doc.path, result.markdown);
    warnings.push(...result.warnings.map((text2) => `${doc.path}: ${text2}`));
  }
  const libraries = resolveConfig({ config: loaded.config }).libraries;
  const urls = Object.fromEntries(
    Object.entries(libraries).map(([name, library]) => [name, library.url])
  );
  const marks = usedLibraryMarks([...originals.values()], urls);
  const bundled = /* @__PURE__ */ new Map();
  const modules = {};
  for (const mark of marks) {
    const url = urls[mark] ?? "";
    let pending = bundled.get(url);
    if (!pending) {
      pending = bundleModule(url, loaded.dir);
      bundled.set(url, pending);
    }
    const result = await pending;
    if ("code" in result) {
      modules[mark] = result.code;
    } else {
      warnings.push(
        `${configName}: \u5916\u90E8\u30E9\u30A4\u30D6\u30E9\u30EA \`${mark}\` \u3092\u675F\u306D\u3089\u308C\u307E\u305B\u3093\uFF08${result.error}\uFF09\u3002URL \u304B\u30D1\u30B9\u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
  }
  const extensions2 = [];
  for (const path of loaded.config.extensions ?? []) {
    const result = await bundleModule(path, loaded.dir);
    if ("code" in result) {
      extensions2.push(result.code);
    } else {
      warnings.push(
        `${configName}: \u62E1\u5F35 \`${path}\` \u3092\u675F\u306D\u3089\u308C\u307E\u305B\u3093\uFF08${result.error}\uFF09\u3002\u30D1\u30B9\u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
  }
  let themeCss;
  const theme = loaded.config.theme;
  if (theme !== void 0) {
    try {
      themeCss = await readFile4(resolve4(loaded.dir, theme), "utf8");
    } catch (error) {
      warnings.push(
        `${configName}: \u4F7F\u3046\u5074\u306E CSS \`${theme}\` \u3092\u8AAD\u3081\u307E\u305B\u3093\uFF08${reasonOf(error)}\uFF09\u3002\u30D1\u30B9\u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
  }
  const refs = await prepareReferences({ ...options, markdowns: originals });
  const payload = {
    kind,
    config: {
      ...loaded.config.features ? { features: loaded.config.features } : {},
      // 埋めたモジュールは開いたときに URL に替えるため、値は印の名前にする（埋められなかった印が外へ要求しない）
      libraries: Object.fromEntries(
        Object.keys(libraries).map((name) => [name, name])
      )
    },
    index: refs.index,
    references: refs.references,
    docs: docs.map((doc) => {
      const markdown = inlined.get(doc.path) ?? "";
      return {
        path: doc.path,
        title: documentTitle({
          path: doc.path,
          markdown,
          indexTitle: refs.titleOf(doc.path)
        }),
        markdown,
        docId: refs.docIdOf(doc.path)
      };
    }),
    entry,
    modules,
    extensions: extensions2
  };
  return { payload, themeCss, warnings };
}
async function readDistAssets(options) {
  const { distDir, kind } = options;
  let distCss;
  let viewer;
  try {
    distCss = await readFile4(join3(distDir, "index.css"), "utf8");
    viewer = await readFile4(join3(distDir, "viewer.js"), "utf8");
  } catch (error) {
    throw new CliError(
      `\u914D\u5E03\u7269\u3092\u8AAD\u3081\u307E\u305B\u3093\uFF08${reasonOf(error)}\uFF09\u3002mdmark \u3092\u5165\u308C\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  if (kind === "bundle") {
    try {
      distCss += `
${await readFile4(join3(distDir, "viewer.css"), "utf8")}`;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
  return { distCss, viewer };
}
async function writeHtml(options) {
  const { file, display, html } = options;
  try {
    await mkdir(dirname4(file), { recursive: true });
    await writeFile(file, html);
  } catch (error) {
    throw new CliError(
      `\u66F8\u3051\u306A\u3044: ${display} \u306B\u66F8\u3051\u307E\u305B\u3093\uFF08${reasonOf(error)}\uFF09\u3002\u51FA\u529B\u5148\u306E\u30D5\u30A9\u30EB\u30C0\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
}
async function runExport(options, io) {
  const loaded = await requireConfig(io.cwd, options.config);
  const docFile = resolve4(io.cwd, options.file);
  try {
    await readFile4(docFile);
  } catch {
    throw new CliError(
      `\u6587\u66F8\u304C\u7121\u3044: ${options.file} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u6587\u66F8\u306E\u30D1\u30B9\u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  const path = normalizePath(toPosix2(relative2(loaded.dir, docFile)));
  const outFile = options.out ? resolve4(io.cwd, options.out) : join3(dirname4(docFile), `${basename3(docFile, extname3(docFile))}.html`);
  const display = options.out ?? toPosix2(relative2(io.cwd, outFile));
  const { payload, themeCss, warnings } = await prepareEmbeds({
    loaded,
    docs: [{ path, file: docFile }],
    kind: "document",
    entry: path
  });
  const { distCss, viewer } = await readDistAssets({
    distDir: options.distDir,
    kind: "document"
  });
  await writeHtml({
    file: outFile,
    display,
    html: assembleHtml({ payload, distCss, themeCss, viewer })
  });
  for (const warning of warnings) {
    io.stderr(`\u8B66\u544A: ${warning}`);
  }
  io.stdout(`\u66F8\u304D\u51FA\u3057\u305F: ${display}`);
  return 0;
}

// src/cli/build.ts
async function runBuild(options, io) {
  const loaded = await requireConfig(io.cwd, options.config);
  const build2 = loaded.config.build;
  if (!build2) {
    throw new CliError(
      "build \u304C\u7121\u3044: \u8A2D\u5B9A\u306B build \u304C\u3042\u308A\u307E\u305B\u3093\u3002build.include \u3068 build.out \u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
    );
  }
  const paths = await collectBuildDocuments(loaded.dir, build2);
  const first = paths[0];
  if (first === void 0) {
    throw new CliError(
      "0 \u4EF6: build.include \u306B\u5F53\u305F\u308B\u6587\u66F8\u304C\u3042\u308A\u307E\u305B\u3093\u3002build.include \u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    );
  }
  const included = new Set(paths);
  const warnings = [];
  const wantedEntry = build2.entry === void 0 ? void 0 : normalizePath(build2.entry);
  let entry = first;
  if (wantedEntry !== void 0) {
    if (included.has(wantedEntry)) {
      entry = wantedEntry;
    } else {
      warnings.push(
        `${build2.entry}: build.entry \u304C\u307E\u3068\u3081\u308B\u6587\u66F8\u306B\u5F53\u305F\u308A\u307E\u305B\u3093\u3002\u307E\u3068\u3081\u308B\u6587\u66F8\u306E\u6700\u521D\u306E 1 \u3064\uFF08${first}\uFF09\u3092\u958B\u304D\u307E\u3059\u3002`
      );
    }
  }
  for (const glossary of build2.glossary ?? []) {
    if (!included.has(normalizePath(glossary))) {
      warnings.push(
        `${glossary}: build.glossary \u304C\u307E\u3068\u3081\u308B\u6587\u66F8\u306B\u5F53\u305F\u308A\u307E\u305B\u3093\u3002\u7528\u8A9E\u96C6\u306E\u8868\u3092\u98DB\u3070\u3057\u307E\u3059\u3002`
      );
    }
  }
  const {
    payload,
    themeCss,
    warnings: embedWarnings
  } = await prepareEmbeds({
    loaded,
    docs: paths.map((path) => ({ path, file: join4(loaded.dir, path) })),
    kind: "bundle",
    entry
  });
  warnings.unshift(...embedWarnings);
  for (const doc of payload.docs) {
    for (const href of findOutsideLinks(doc.markdown, doc.path, included)) {
      warnings.push(
        `${doc.path}: \`${href}\` \u3078\u306E\u30EA\u30F3\u30AF\u306F\u307E\u3068\u3081\u305F HTML \u306B\u542B\u307E\u308C\u307E\u305B\u3093\u3002\u66F8\u3044\u305F\u307E\u307E\u306E\u30EA\u30F3\u30AF\u3067\u6B8B\u3057\u307E\u3059\u3002\u307E\u3068\u3081\u308B\u306A\u3089 \`build.include\` \u306B\u8DB3\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
  }
  const { distCss, viewer } = await readDistAssets({
    distDir: options.distDir,
    kind: "bundle"
  });
  await writeHtml({
    file: resolve5(loaded.dir, build2.out),
    display: build2.out,
    html: assembleHtml({ payload, distCss, themeCss, viewer })
  });
  for (const warning of warnings) {
    io.stderr(`\u8B66\u544A: ${warning}`);
  }
  io.stdout(`\u66F8\u304D\u51FA\u3057\u305F: ${build2.out}\uFF08\u6587\u66F8 ${paths.length} \u4EF6\uFF09`);
  return 0;
}

// src/cli/check.ts
import { stat as stat2 } from "node:fs/promises";
import { basename as basename4, join as join5, relative as relative3, resolve as resolve6, sep as sep3 } from "node:path";

// src/knowledge/check.ts
var DEFAULT_INDEX_FILE = "index.yaml";
function describeSite(site, word) {
  const position = Math.max(site.words.indexOf(word), 0);
  return `\`${site.file}\` \u306E \`${site.wheres[position]}\``;
}
function duplicateTerms(sites) {
  const issues = [];
  sites.forEach((site, position) => {
    for (const word of site.words) {
      const earlier = sites.slice(0, position).find((candidate) => candidate.words.includes(word));
      if (!earlier) {
        continue;
      }
      const where = site.wheres[site.words.indexOf(word)] ?? "";
      issues.push({
        file: site.file,
        where,
        kind: "duplicate_term",
        message: `\u7528\u8A9E \`${word}\` \u304C ${describeSite(earlier, word)} \u3068\u91CD\u306A\u3063\u3066\u3044\u307E\u3059\u3002\u3069\u3061\u3089\u304B\u3092\u6D88\u3059\u304B\u3001\u8A9E\u3092\u5909\u3048\u3066\u304F\u3060\u3055\u3044\u3002`
      });
      break;
    }
  });
  return issues;
}
function checkIndex(input) {
  const indexFile = input.indexFile ?? DEFAULT_INDEX_FILE;
  const { index, problems } = normalizeIndex(input.index);
  const schema = problems.map((problem) => ({
    file: indexFile,
    where: problem.where,
    kind: "schema",
    message: `\u7D22\u5F15\u306E ${problem.where === "" ? "\u5168\u4F53" : `\`${problem.where}\``} \u304C\u5F62\u306B\u5408\u3044\u307E\u305B\u3093: ${problem.message}\u3002\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
  }));
  if (problems.some((problem) => problem.where === "")) {
    return schema;
  }
  const rawDocs = input.index.docs;
  const positionOf = (doc) => Array.isArray(rawDocs) ? rawDocs.indexOf(doc) : -1;
  const documents = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath(path),
      { path, body }
    ])
  );
  const indexedPaths = new Set(
    index.docs.map((doc) => normalizePath(doc.path))
  );
  const ids = new Set(index.docs.map((doc) => doc.id));
  const missing = [];
  const broken = [];
  for (const doc of index.docs) {
    const position = positionOf(doc);
    if (!documents.has(normalizePath(doc.path))) {
      missing.push({
        file: indexFile,
        where: `docs[${position}].path`,
        kind: "missing_doc",
        message: `\`${doc.path}\` \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u6587\u66F8\u3092\u623B\u3059\u304B\u3001\u7D22\u5F15\u306E \`docs[${position}]\` \u3092\u6D88\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      });
    }
    (doc.related ?? []).forEach((id, relatedPosition) => {
      if (!ids.has(id)) {
        broken.push({
          file: indexFile,
          where: `docs[${position}].related[${relatedPosition}]`,
          kind: "broken_ref",
          message: `\`related\` \u306E \`${id}\` \u304C\u7D22\u5F15\u306E\u6587\u66F8\u306B\u3042\u308A\u307E\u305B\u3093\u3002\`docs[${position}].related[${relatedPosition}]\` \u3092\u76F4\u3059\u304B\u6D88\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
        });
      }
    });
  }
  const orphan = [...documents.entries()].filter(([normalized]) => !indexedPaths.has(normalized)).map(([, { path }]) => path).sort().map((path) => ({
    file: path,
    where: "",
    kind: "orphan_doc",
    message: `\`${path}\` \u304C\u7D22\u5F15\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u7D22\u5F15\u306E \`docs\` \u306B\u8DB3\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
  }));
  const sites = (index.terms ?? []).map((term) => {
    const position = (input.index.terms ?? []).indexOf(term);
    const aliases = term.aliases ?? [];
    return {
      file: indexFile,
      words: [term.term, ...aliases],
      wheres: [
        `terms[${position}].term`,
        ...aliases.map((_, alias) => `terms[${position}].aliases[${alias}]`)
      ]
    };
  });
  for (const doc of index.docs) {
    const entry = documents.get(normalizePath(doc.path));
    if (!entry) {
      continue;
    }
    const parsed = parseDocument({
      body: entry.body,
      docId: doc.id,
      defaults: { ...DEFAULT_FEATURES }
    });
    for (const { entry: term, line } of parsed.glossary) {
      sites.push({
        file: entry.path,
        words: [term.term, ...term.aliases],
        wheres: [term.term, ...term.aliases].map(() => `${line} \u884C\u76EE`)
      });
    }
  }
  return [
    ...schema,
    ...missing,
    ...orphan,
    ...broken,
    ...duplicateTerms(sites)
  ];
}

// src/cli/check.ts
async function exists(path) {
  try {
    await stat2(path);
    return true;
  } catch {
    return false;
  }
}
function toPosix3(path) {
  return path.split(sep3).join("/");
}
async function checkReferencedFiles(loaded, file) {
  const issues = [];
  const { theme, extensions: extensions2 } = loaded.config;
  if (theme !== void 0 && !await exists(resolve6(loaded.dir, theme))) {
    issues.push({
      file,
      where: "theme",
      kind: "schema",
      message: `\`theme\` \u306E \`${theme}\` \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u30D1\u30B9\u3092\u76F4\u3059\u304B CSS \u3092\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
    });
  }
  for (const [position, path] of (extensions2 ?? []).entries()) {
    if (!await exists(resolve6(loaded.dir, path))) {
      issues.push({
        file,
        where: `extensions[${position}]`,
        kind: "schema",
        message: `\`extensions[${position}]\` \u306E \`${path}\` \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u30D1\u30B9\u3092\u76F4\u3059\u304B\u62E1\u5F35\u3092\u7F6E\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
      });
    }
  }
  return issues;
}
async function checkBuild(loaded, file) {
  const build2 = loaded.config.build;
  if (!build2) {
    return { schema: [], noDocuments: [] };
  }
  const paths = await collectBuildDocuments(loaded.dir, build2);
  const included = new Set(paths);
  const schema = [];
  for (const [position, path] of (build2.glossary ?? []).entries()) {
    if (!included.has(normalizePath(path))) {
      schema.push({
        file,
        where: `build.glossary[${position}]`,
        kind: "schema",
        message: `\`build.glossary[${position}]\` \u306E \`${path}\` \u304C\u307E\u3068\u3081\u308B\u6587\u66F8\u306B\u5F53\u305F\u308A\u307E\u305B\u3093\u3002\`build.include\` \u306B\u5F53\u305F\u308B\u6587\u66F8\u306E\u30D1\u30B9\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      });
    }
  }
  if (build2.entry !== void 0 && !included.has(normalizePath(build2.entry))) {
    schema.push({
      file,
      where: "build.entry",
      kind: "schema",
      message: `\`build.entry\` \u306E \`${build2.entry}\` \u304C\u307E\u3068\u3081\u308B\u6587\u66F8\u306B\u5F53\u305F\u308A\u307E\u305B\u3093\u3002\`build.include\` \u306B\u5F53\u305F\u308B\u6587\u66F8\u306E\u30D1\u30B9\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    });
  }
  const noDocuments = paths.length === 0 ? [
    {
      file,
      where: "build.include",
      kind: "no_documents",
      message: "`build.include` \u306B\u5F53\u305F\u308B\u6587\u66F8\u304C\u3042\u308A\u307E\u305B\u3093\u3002`build.include` \u3092\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    }
  ] : [];
  return { schema, noDocuments };
}
async function checkIndexFile(loaded) {
  if (loaded.config.index === void 0) {
    return [];
  }
  let read;
  try {
    read = await readIndexWithDocuments(loaded);
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
    return [
      {
        file: toPosix3(loaded.config.index),
        where: "",
        kind: "schema",
        message: error.message
      }
    ];
  }
  if (!read) {
    return [];
  }
  const indexDirFromConfig = toPosix3(relative3(loaded.dir, read.indexDir));
  return checkIndex({
    index: read.raw,
    documents: read.documents,
    indexFile: read.indexFile
  }).map((issue) => ({
    ...issue,
    // 索引のずれは設定ファイルのフォルダからの相対パスで出ているので、文書のずれだけ索引のフォルダの分を足す
    file: issue.file === read.indexFile || indexDirFromConfig === "" ? issue.file : join5(indexDirFromConfig, issue.file).split(sep3).join("/")
  }));
}
async function collectCheckIssues(path) {
  const read = await loadConfig(path);
  const file = basename4(path);
  const { config: config2, issues: shapeIssues } = validateConfig(read.raw, file);
  const loaded = { path, dir: read.dir, config: config2 };
  const referenced = await checkReferencedFiles(loaded, file);
  const build2 = await checkBuild(loaded, file);
  const indexIssues = await checkIndexFile(loaded);
  return [
    ...shapeIssues,
    ...referenced,
    ...build2.schema,
    ...build2.noDocuments,
    ...indexIssues
  ];
}
async function runCheck(options, io) {
  const path = await findConfigFile(io.cwd, options.config);
  const issues = await collectCheckIssues(path);
  for (const issue of issues) {
    const place = issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
    io.stdout(`${place}: ${issue.kind}: ${issue.message}`);
  }
  io.stdout(`\u305A\u308C ${issues.length} \u4EF6`);
  return issues.length === 0 ? 0 : 1;
}

// src/cli/init.ts
import { mkdir as mkdir2, readFile as readFile5, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname5, join as join6 } from "node:path";
var TEMPLATE_FILES = [
  { path: "mdmark.config.yaml", source: "mdmark.config.yaml" },
  { path: "theme.css", source: "theme.css" },
  { path: "index.yaml", source: "index.yaml" },
  {
    path: "extensions/example.ts",
    source: "extensions/example.ts",
    language: "ts"
  },
  {
    path: "extensions/example.js",
    source: "extensions/example.js",
    language: "js"
  },
  { path: "tsconfig.json", source: "tsconfig.json", language: "ts" },
  { path: "tsconfig.json", source: "js/tsconfig.json", language: "js" },
  { path: "package.json", source: "package.json", language: "ts" }
];
var CONFIG_TEMPLATE = "mdmark.config.yaml";
var VERSION_LINE_PATTERN = /^version: .*$/m;
function reasonOf2(error) {
  return error instanceof Error ? error.message : String(error);
}
async function runInit(options, io) {
  const { dir, js, templatesDir, version } = options;
  const wanted = js ? "js" : "ts";
  for (const template of TEMPLATE_FILES) {
    if (template.language !== void 0 && template.language !== wanted) {
      continue;
    }
    const target = join6(dir, template.path);
    const source = await readFile5(join6(templatesDir, template.source), "utf8");
    const content = template.path === CONFIG_TEMPLATE ? source.replace(VERSION_LINE_PATTERN, `version: ${version}`) : source;
    try {
      await mkdir2(dirname5(target), { recursive: true });
    } catch (error) {
      throw new CliError(
        `${template.path} \u306B\u66F8\u3051\u307E\u305B\u3093\uFF08${reasonOf2(error)}\uFF09\u3002\u7F6E\u304F\u5148\u306E\u30D5\u30A9\u30EB\u30C0\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
    try {
      await writeFile2(target, content, { flag: "wx" });
      io.stdout(`\u7F6E\u3044\u305F: ${template.path}`);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        io.stdout(`\u7F6E\u304B\u306A\u304B\u3063\u305F\uFF08\u65E2\u306B\u3042\u308B\uFF09: ${template.path}`);
        continue;
      }
      throw new CliError(
        `${template.path} \u306B\u66F8\u3051\u307E\u305B\u3093\uFF08${reasonOf2(error)}\uFF09\u3002\u7F6E\u304F\u5148\u306E\u30D5\u30A9\u30EB\u30C0\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
  }
  return 0;
}

// src/cli/prompt.ts
import { createInterface } from "node:readline";
function createLinePrompter(options) {
  let reader;
  let lines;
  let closed = false;
  return async (question) => {
    options.write(question);
    if (!reader || !lines) {
      reader = createInterface({ input: options.input });
      reader.on("close", () => {
        closed = true;
      });
      lines = reader[Symbol.asyncIterator]();
    }
    if (!closed) {
      reader.resume();
    }
    const next = await lines.next();
    if (!closed) {
      reader.pause();
    }
    return next.done ? void 0 : next.value.trim();
  };
}

// src/cli/upgrade.ts
import { readFile as readFile7, stat as stat5, writeFile as writeFile5 } from "node:fs/promises";
import { basename as basename5, dirname as dirname8, join as join9, relative as relative6, resolve as resolve8, sep as sep4 } from "node:path";
import { isMap as isMap2, parse as parse4, parseDocument as parseDocument3 } from "yaml";

// src/cli/backup.ts
import { copyFile, mkdir as mkdir3, readdir, stat as stat3, writeFile as writeFile3 } from "node:fs/promises";
import { dirname as dirname6, isAbsolute, join as join7, relative as relative4 } from "node:path";
var BACKUP_DIR = {
  root: ".mdmark",
  backups: ".mdmark/backup"
};
var IGNORE_FILE = ".gitignore";
var IGNORE_CONTENT = "*\n";
function reasonOf3(error) {
  return error instanceof Error ? error.message : String(error);
}
function stamp(now) {
  const pad = (value, length = 2) => String(value).padStart(length, "0");
  return [
    pad(now.getFullYear(), 4),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}
async function exists2(path) {
  try {
    await stat3(path);
    return true;
  } catch {
    return false;
  }
}
async function takeBackup(options) {
  const { dir, files, now } = options;
  for (const file of files) {
    const path = relative4(dir, file);
    if (path.startsWith("..") || isAbsolute(path)) {
      throw new CliError(
        `${file} \u306E\u5199\u3057\u3092\u53D6\u308C\u307E\u305B\u3093\uFF08\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB\u306E\u30D5\u30A9\u30EB\u30C0\u306E\u5916\u306B\u3042\u308A\u307E\u3059\uFF09\u3002\u4F55\u3082\u66F8\u304D\u63DB\u3048\u3066\u3044\u307E\u305B\u3093\u3002`
      );
    }
  }
  try {
    const backups = join7(dir, BACKUP_DIR.backups);
    await mkdir3(backups, { recursive: true });
    await writeFile3(join7(dir, BACKUP_DIR.root, IGNORE_FILE), IGNORE_CONTENT);
    let backupDir = join7(backups, stamp(now));
    for (let count = 2; await exists2(backupDir); count += 1) {
      backupDir = join7(backups, `${stamp(now)}-${count}`);
    }
    await mkdir3(backupDir);
    for (const file of files) {
      const target = join7(backupDir, relative4(dir, file));
      await mkdir3(dirname6(target), { recursive: true });
      await copyFile(file, target);
    }
    return backupDir;
  } catch (error) {
    throw new CliError(
      `${dir} \u306E\u5199\u3057\u3092\u53D6\u308C\u307E\u305B\u3093\uFF08${reasonOf3(error)}\uFF09\u3002\u4F55\u3082\u66F8\u304D\u63DB\u3048\u3066\u3044\u307E\u305B\u3093\u3002`
    );
  }
}
async function restoreBackup(options) {
  const entries = await readdir(options.backupDir, {
    recursive: true,
    withFileTypes: true
  });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const source = join7(entry.parentPath, entry.name);
    const target = join7(options.dir, relative4(options.backupDir, source));
    await mkdir3(dirname6(target), { recursive: true });
    await copyFile(source, target);
  }
}

// src/cli/changelog.ts
var CHANGELOG_FILE = "docs/\u306F\u3058\u3081\u306B/\u5909\u66F4\u5C65\u6B74.md";
var HEADER_PATTERN = /^\|\s*バージョン\s*\|\s*PR\s*\|\s*変更\s*\|\s*$/;
var LINK_TEXT_PATTERN = /^\[([^\]]*)\]/;
function splitCells(line) {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/(?<!\\)\|/).map((cell) => cell.trim());
}
function changelogRows(options) {
  const lines = options.text.split("\n");
  const header = lines.findIndex((line) => HEADER_PATTERN.test(line.trim()));
  if (header < 0) {
    return [];
  }
  const rows = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.trim().startsWith("|")) {
      break;
    }
    const [version = "", pr = "", change = ""] = splitCells(line);
    if (parseVersion(version) === void 0) {
      continue;
    }
    if (compareVersions(version, options.from) > 0 && compareVersions(version, options.to) <= 0) {
      rows.push({
        version,
        pr: LINK_TEXT_PATTERN.exec(pr)?.[1] ?? pr,
        change
      });
    }
  }
  return rows;
}

// src/cli/migrations.ts
import { execFile } from "node:child_process";
import { readdir as readdir2, readFile as readFile6, stat as stat4, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname7, isAbsolute as isAbsolute2, join as join8, relative as relative5, resolve as resolve7 } from "node:path";
import { promisify } from "node:util";
import {
  isMap,
  isScalar,
  isSeq,
  parse as parse3,
  parseDocument as parseDocument2
} from "yaml";
var MIGRATIONS_DIR = {
  root: "migrations",
  next: "next",
  steps: "steps.yaml",
  noSteps: "no-steps.yaml"
};
var SCRIPT_EXTENSIONS = [".js", ".mjs"];
var execFileAsync = promisify(execFile);
var STEP_KEYS = {
  rename_key: ["file", "from", "to"],
  set_default: ["file", "key", "value", "ask"],
  map_values: ["file", "key", "mapping"],
  replace_mark: ["from", "to"],
  call: ["script", "files"]
};
var COMMON_KEYS = ["op", "description", "destructive"];
var STEP_FILES = ["config", "index"];
var CALL_FILES = ["config", "index", "documents"];
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function reasonOf4(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? "";
}
function isFilled(value) {
  return typeof value === "string" && value !== "";
}
function validateStep(item, where, problem) {
  if (!isRecord3(item)) {
    problem(where, "\u624B\u9806\u306F\u30AD\u30FC\u3068\u5024\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
    return;
  }
  const op = item.op;
  if (typeof op !== "string" || !(op in STEP_KEYS)) {
    problem(
      `${where}.op`,
      "op \u306F rename_key\u30FBset_default\u30FBmap_values\u30FBreplace_mark\u30FBcall \u306E\u3069\u308C\u304B\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
    );
    return;
  }
  const kind = op;
  if (!isFilled(item.description)) {
    problem(
      `${where}.description`,
      "description \u306F\u7A7A\u3067\u306A\u3044\u6587\u5B57\u5217\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
    );
  }
  if (item.destructive !== void 0 && typeof item.destructive !== "boolean") {
    problem(
      `${where}.destructive`,
      "destructive \u306F true \u304B false \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
    );
  }
  const allowed = [...COMMON_KEYS, ...STEP_KEYS[kind]];
  for (const key of Object.keys(item)) {
    if (!allowed.includes(key)) {
      problem(`${where}.${key}`, `${op} \u304C\u6301\u305F\u306A\u3044\u30AD\u30FC\u3067\u3059\u3002\u6D88\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
    }
  }
  const requireString = (key) => {
    if (!isFilled(item[key])) {
      problem(`${where}.${key}`, `${key} \u306F\u7A7A\u3067\u306A\u3044\u6587\u5B57\u5217\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`);
    }
  };
  const requireStepFile = () => {
    if (typeof item.file !== "string" || !STEP_FILES.includes(item.file)) {
      problem(`${where}.file`, "file \u306F config \u304B index \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
    }
  };
  switch (kind) {
    case "rename_key":
      requireStepFile();
      requireString("from");
      requireString("to");
      break;
    case "set_default": {
      requireStepFile();
      requireString("key");
      const hasValue = "value" in item;
      const hasAsk = item.ask !== void 0;
      if (hasValue === hasAsk) {
        problem(
          `${where}.value`,
          "value \u304B ask \u306E\u3069\u3061\u3089\u304B 1 \u3064\u3060\u3051\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
        );
      }
      if (hasAsk) {
        requireString("ask");
      }
      break;
    }
    case "map_values": {
      requireStepFile();
      requireString("key");
      const mapping = item.mapping;
      if (!isRecord3(mapping)) {
        problem(
          `${where}.mapping`,
          "mapping \u306F\u5143\u306E\u5024\u3068\u65B0\u3057\u3044\u5024\u306E\u8868\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
        );
        break;
      }
      for (const [from, to] of Object.entries(mapping)) {
        if (typeof to === "string" && Object.hasOwn(mapping, to)) {
          problem(
            `${where}.mapping`,
            `${from} \u306E\u65B0\u3057\u3044\u5024 ${to} \u304C\u5143\u306E\u5024\u306B\u3082\u3042\u308A\u307E\u3059\u3002\u5F53\u3066\u76F4\u3057\u3066\u3082\u5909\u308F\u3089\u306A\u3044\u3088\u3046\u3001\u65B0\u3057\u3044\u5024\u306F\u5143\u306E\u5024\u306B\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002`
          );
        }
      }
      break;
    }
    case "replace_mark":
      requireString("from");
      requireString("to");
      if (isFilled(item.from) && isFilled(item.to) && item.to.includes(item.from)) {
        problem(
          `${where}.to`,
          "to \u304C from \u3092\u542B\u307F\u307E\u3059\u3002\u5F53\u3066\u76F4\u3057\u3066\u3082\u5909\u308F\u3089\u306A\u3044\u3088\u3046\u3001to \u306F from \u3092\u542B\u307E\u306A\u3044\u3088\u3046\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        );
      }
      break;
    case "call": {
      requireString("script");
      if (isFilled(item.script) && !SCRIPT_EXTENSIONS.some(
        (extension) => item.script.endsWith(extension)
      )) {
        problem(
          `${where}.script`,
          `script \u306E\u62E1\u5F35\u5B50\u306F ${SCRIPT_EXTENSIONS.join(" \u304B ")} \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002TypeScript \u306F JavaScript \u306B\u3057\u305F\u3082\u306E\u3092\u7F6E\u304D\u307E\u3059\u3002`
        );
      }
      const files = item.files;
      if (!Array.isArray(files) || files.length === 0 || !files.every(
        (file) => typeof file === "string" && CALL_FILES.includes(file)
      )) {
        problem(
          `${where}.files`,
          "files \u306F config\u30FBindex\u30FBdocuments \u306E\u3046\u3061 1 \u3064\u4EE5\u4E0A\u306E\u4E26\u3073\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002"
        );
      }
      break;
    }
  }
}
function validateSteps(raw, file) {
  const problems = [];
  const problem = (where, message) => {
    problems.push(`${file}: ${where}: ${message}`);
  };
  if (!isRecord3(raw)) {
    problem("steps", "steps \u306E\u4E26\u3073\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
    return { steps: [], problems };
  }
  for (const key of Object.keys(raw)) {
    if (key !== "steps") {
      problem(key, "steps \u4EE5\u5916\u306E\u30AD\u30FC\u306F\u66F8\u3051\u307E\u305B\u3093\u3002\u6D88\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
  }
  const steps = raw.steps;
  if (!Array.isArray(steps)) {
    problem("steps", "steps \u306F\u624B\u9806\u306E\u4E26\u3073\u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002");
    return { steps: [], problems };
  }
  for (const [index, item] of steps.entries()) {
    validateStep(item, `steps[${index}]`, problem);
  }
  return {
    steps: problems.length === 0 ? steps : [],
    problems
  };
}
async function isFile2(path) {
  try {
    return (await stat4(path)).isFile();
  } catch {
    return false;
  }
}
async function readStepsFile(dir, label) {
  let raw;
  try {
    raw = parse3(await readFile6(join8(dir, MIGRATIONS_DIR.steps), "utf8"));
  } catch (error) {
    return {
      steps: [],
      problems: [`${label}: \u8AAD\u3081\u307E\u305B\u3093\uFF08${reasonOf4(error)}\uFF09`]
    };
  }
  const result = validateSteps(raw, label);
  if (result.problems.length > 0) {
    return result;
  }
  for (const [index, step] of result.steps.entries()) {
    if (step.op !== "call") {
      continue;
    }
    const script = resolve7(dir, step.script);
    const path = relative5(dir, script);
    if (path.startsWith("..") || isAbsolute2(path)) {
      result.problems.push(
        `${label}: steps[${index}].script: \u7248\u306E\u30D5\u30A9\u30EB\u30C0\u306E\u5916\u3092\u6307\u3057\u3066\u3044\u307E\u3059\u3002`
      );
    } else if (!await isFile2(script)) {
      result.problems.push(
        `${label}: steps[${index}].script: ${step.script} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002`
      );
    }
  }
  return result;
}
async function loadMigrationVersions(options) {
  const root = join8(options.packageDir, MIGRATIONS_DIR.root);
  let names;
  try {
    names = (await readdir2(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
  const versions = names.filter(
    (name) => VERSION_PATTERN.test(name) && compareVersions(name, options.from) > 0 && compareVersions(name, options.to) <= 0
  ).sort(compareVersions);
  const loaded = [];
  const problems = [];
  for (const version of versions) {
    const dir = join8(root, version);
    const result = await readStepsFile(
      dir,
      `${MIGRATIONS_DIR.root}/${version}/${MIGRATIONS_DIR.steps}`
    );
    problems.push(...result.problems);
    loaded.push({ version, dir, steps: result.steps });
  }
  if (problems.length > 0) {
    throw new CliError(
      `\u79FB\u884C\u306E\u624B\u9806\u306B\u8AA4\u308A\u304C\u3042\u308A\u307E\u3059\uFF08${problems.join("\u3001")}\uFF09\u3002mdmark \u3092\u5165\u308C\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  return loaded;
}
function renameKey(doc, from, to) {
  const fromPath = from.split(".");
  const toPath = to.split(".");
  if (!doc.hasIn(fromPath) || doc.hasIn(toPath)) {
    return false;
  }
  const fromParent = fromPath.slice(0, -1);
  const toParent = toPath.slice(0, -1);
  const oldName = fromPath[fromPath.length - 1];
  const newName = toPath[toPath.length - 1] ?? "";
  if (fromParent.join(".") === toParent.join(".")) {
    const parent = fromParent.length === 0 ? doc.contents : doc.getIn(fromParent, true);
    if (isMap(parent)) {
      const pair = parent.items.find(
        (item) => isScalar(item.key) && item.key.value === oldName
      );
      if (pair && isScalar(pair.key)) {
        pair.key.value = newName;
        return true;
      }
    }
  }
  const node = doc.getIn(fromPath, true);
  doc.deleteIn(fromPath);
  doc.setIn(toPath, node);
  return true;
}
function setDefault(doc, key, value) {
  const path = key.split(".");
  if (doc.hasIn(path)) {
    return false;
  }
  doc.setIn(path, value);
  return true;
}
function mapScalar(node, mapping) {
  if (!isScalar(node)) {
    return false;
  }
  const value = node.value;
  const key = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : void 0;
  if (key === void 0 || !Object.hasOwn(mapping, key)) {
    return false;
  }
  node.value = mapping[key];
  return true;
}
function mapValues(doc, key, mapping) {
  const node = doc.getIn(key.split("."), true);
  if (isSeq(node)) {
    let changed = false;
    for (const item of node.items) {
      changed = mapScalar(item, mapping) || changed;
    }
    return changed;
  }
  return mapScalar(node, mapping);
}
function replaceMark(text2, from, to) {
  return text2.split(from).join(to);
}
function stepFiles(versions, target) {
  const files = /* @__PURE__ */ new Set([target.configPath]);
  const addIndex = () => {
    if (target.indexPath !== void 0) {
      files.add(target.indexPath);
    }
  };
  const addDocuments = () => {
    for (const document of target.documents) {
      files.add(document);
    }
  };
  for (const { steps } of versions) {
    for (const step of steps) {
      switch (step.op) {
        case "replace_mark":
          addDocuments();
          break;
        case "call":
          if (step.files.includes("index")) {
            addIndex();
          }
          if (step.files.includes("documents")) {
            addDocuments();
          }
          break;
        default:
          if (step.file === "index") {
            addIndex();
          }
      }
    }
  }
  return [...files];
}
async function editYaml(path, edit) {
  const doc = parseDocument2(await readFile6(path, "utf8"));
  const [first] = doc.errors;
  if (first) {
    throw new Error(`${path} \u3092 YAML \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08${reasonOf4(first)}\uFF09`);
  }
  if (edit(doc)) {
    await writeFile4(path, doc.toString({ flowCollectionPadding: false }));
  }
}
async function applyStep(options) {
  const { step, version, target } = options;
  try {
    switch (step.op) {
      case "replace_mark":
        for (const path of target.documents) {
          const text2 = await readFile6(path, "utf8");
          const replaced = replaceMark(text2, step.from, step.to);
          if (replaced !== text2) {
            await writeFile4(path, replaced);
          }
        }
        return;
      case "call": {
        const script = resolve7(version.dir, step.script);
        try {
          await execFileAsync(
            process.execPath,
            [script, "--config", target.configPath],
            { cwd: dirname7(target.configPath) }
          );
        } catch (error) {
          const code2 = isRecord3(error) && typeof error.code === "number" ? `\u7D42\u4E86\u30B3\u30FC\u30C9 ${error.code} \u3067\u7D42\u308F\u308A\u307E\u3057\u305F` : reasonOf4(error);
          throw new Error(`\u30B9\u30AF\u30EA\u30D7\u30C8 ${step.script} \u304C${code2}`);
        }
        return;
      }
      default: {
        const path = step.file === "config" ? target.configPath : target.indexPath;
        if (path === void 0) {
          return;
        }
        await editYaml(path, (doc) => {
          switch (step.op) {
            case "rename_key":
              return renameKey(doc, step.from, step.to);
            case "map_values":
              return mapValues(doc, step.key, step.mapping);
            case "set_default": {
              if (step.ask === void 0) {
                return setDefault(doc, step.key, step.value);
              }
              const answer = target.answers.get(step);
              return answer === void 0 ? false : setDefault(doc, step.key, parse3(answer));
            }
          }
        });
      }
    }
  } catch (error) {
    throw new CliError(
      `${version.version} \u306E\u624B\u9806\u300C${step.description}\u300D\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08${reasonOf4(error)}\uFF09\u3002`
    );
  }
}

// src/cli/upgrade.ts
var CONFIRM_ANSWER = "y";
var VERSION_QUESTION = "\u624B\u5143\u306E\u7248\uFF08v{MAJOR}.{MINOR}.{PATCH}\uFF09\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044:";
var CONFIRM_QUESTION = `\u58CA\u3059\u624B\u9806\u3092\u5F53\u3066\u3066\u3088\u3044\u3067\u3059\u304B\uFF08${CONFIRM_ANSWER} \u3067\u5F53\u3066\u308B\uFF09:`;
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toPosix4(path) {
  return path.split(sep4).join("/");
}
async function isFile3(path) {
  try {
    return (await stat5(path)).isFile();
  } catch {
    return false;
  }
}
function assertVersion(value) {
  if (typeof value !== "string" || parseVersion(value) === void 0) {
    throw new CliError(
      `\u624B\u5143\u306E\u7248 ${String(value)} \u306E\u66F8\u5F0F\u304C\u9055\u3044\u307E\u3059\u3002v{MAJOR}.{MINOR}.{PATCH} \u3067\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  return value;
}
async function askRequired(ask, question) {
  const answer = await ask(question);
  if (answer === void 0) {
    throw new CliError(
      `\u300C${question}\u300D\u306B\u7B54\u3048\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u4F55\u3082\u66F8\u304D\u63DB\u3048\u3066\u3044\u307E\u305B\u3093\u3002`
    );
  }
  return answer;
}
async function writeConfigVersion(configPath, version) {
  const doc = parseDocument3(await readFile7(configPath, "utf8"));
  if (doc.contents === null || doc.has("version")) {
    doc.set("version", version);
  } else if (isMap2(doc.contents)) {
    doc.contents.items.unshift(doc.createPair("version", version));
  } else {
    throw new CliError(
      `${basename5(configPath)} \u304C\u30AD\u30FC\u3068\u5024\u306E\u5F62\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u306E\u30AD\u30FC\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  await writeFile5(configPath, doc.toString({ flowCollectionPadding: false }));
}
async function createTarget(options) {
  const { configPath, raw } = options;
  const dir = dirname8(configPath);
  const file = basename5(configPath);
  const { config: config2 } = validateConfig(raw, file);
  const loaded = { path: configPath, dir, config: config2 };
  const documents = /* @__PURE__ */ new Set();
  if (config2.build) {
    for (const path of await collectBuildDocuments(dir, config2.build)) {
      documents.add(resolve8(dir, path));
    }
  }
  try {
    const read = await readIndexWithDocuments(loaded);
    for (const path of Object.keys(read?.documents ?? {})) {
      documents.add(resolve8(read?.indexDir ?? dir, path));
    }
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
  }
  const indexPath = config2.index === void 0 ? void 0 : resolve8(dir, config2.index);
  return {
    configPath,
    indexPath: indexPath !== void 0 && await isFile3(indexPath) ? indexPath : void 0,
    documents: [...documents],
    answers: /* @__PURE__ */ new Map()
  };
}
async function printPlan(options) {
  const { versions, packageDir, from, to, io } = options;
  for (const version of versions) {
    if (version.steps.length === 0) {
      continue;
    }
    io.stdout(`${version.version}:`);
    for (const step of version.steps) {
      const mark = step.destructive === true ? "\uFF08\u58CA\u3059\u624B\u9806\uFF09" : "";
      io.stdout(`  ${step.op}${mark}: ${step.description}`);
    }
  }
  let text2;
  try {
    text2 = await readFile7(join9(packageDir, CHANGELOG_FILE), "utf8");
  } catch (error) {
    throw new CliError(
      `\u5909\u66F4\u5C65\u6B74\u3092\u8AAD\u3081\u307E\u305B\u3093\uFF08${error instanceof Error ? error.message : String(error)}\uFF09\u3002mdmark \u3092\u5165\u308C\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    );
  }
  const rows = changelogRows({ text: text2, from, to });
  if (rows.length > 0) {
    io.stdout("\u5909\u66F4\u5C65\u6B74:");
    for (const row of rows) {
      io.stdout(`  ${row.version} ${row.pr} ${row.change}`);
    }
  }
}
async function askValues(options) {
  const { versions, target, ask } = options;
  for (const { steps } of versions) {
    for (const step of steps) {
      if (step.op !== "set_default" || step.ask === void 0) {
        continue;
      }
      const path = step.file === "config" ? target.configPath : target.indexPath;
      if (path === void 0) {
        continue;
      }
      const doc = parseDocument3(await readFile7(path, "utf8"));
      if (doc.hasIn(step.key.split("."))) {
        continue;
      }
      const answer = await askRequired(ask, step.ask);
      try {
        parse4(answer);
      } catch {
        throw new CliError(
          `\u300C${step.ask}\u300D\u306E\u7B54\u3048 ${answer} \u3092 YAML \u306E\u5024\u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\u3002\u4F55\u3082\u66F8\u304D\u63DB\u3048\u3066\u3044\u307E\u305B\u3093\u3002`
        );
      }
      target.answers.set(step, answer);
    }
  }
}
async function runUpgrade(options, io, ask) {
  const configPath = await findConfigFile(io.cwd, options.config);
  const loaded = await loadConfig(configPath);
  const dir = loaded.dir;
  const local = assertVersion(
    isRecord4(loaded.raw) && loaded.raw.version !== void 0 ? loaded.raw.version : await askRequired(ask, VERSION_QUESTION)
  );
  const target = options.cliVersion;
  io.stdout(`\u624B\u5143\u306E\u7248: ${local}`);
  io.stdout(`\u76EE\u6A19\u306E\u7248: ${target}`);
  const order = compareVersions(local, target);
  if (order > 0) {
    throw new CliError(
      `\u624B\u5143\u306E\u7248 ${local} \u306F\u3053\u306E mdmark\uFF08${target}\uFF09\u3088\u308A\u65B0\u3057\u3044\u3067\u3059\u3002npx github:shuhei1101/mdmark#${local} upgrade \u306E\u3088\u3046\u306B\u3001\u624B\u5143\u306E\u7248\u4EE5\u4E0A\u306E mdmark \u3067\u547C\u3093\u3067\u304F\u3060\u3055\u3044\u3002`
    );
  }
  if (order === 0) {
    io.stdout("\u624B\u5143\u306E\u7248\u304C\u76EE\u6A19\u306E\u7248\u3068\u540C\u3058\u3067\u3059\u3002\u5F53\u3066\u308B\u624B\u9806\u306F\u3042\u308A\u307E\u305B\u3093");
    return 0;
  }
  const versions = await loadMigrationVersions({
    packageDir: options.packageDir,
    from: local,
    to: target
  });
  const migrationTarget = await createTarget({ configPath, raw: loaded.raw });
  await printPlan({
    versions,
    packageDir: options.packageDir,
    from: local,
    to: target,
    io
  });
  if (options.plan) {
    io.stdout("--plan \u306E\u305F\u3081\u66F8\u304D\u63DB\u3048\u3066\u3044\u307E\u305B\u3093");
    return 0;
  }
  await askValues({ versions, target: migrationTarget, ask });
  const steps = versions.flatMap((version) => version.steps);
  if (!options.yes && steps.some((step) => step.destructive === true)) {
    const answer = await askRequired(ask, CONFIRM_QUESTION);
    if (answer !== CONFIRM_ANSWER) {
      throw new CliError(
        "\u4F55\u3082\u5F53\u3066\u3066\u3044\u307E\u305B\u3093\u3002\u78BA\u304B\u3081\u305A\u306B\u5F53\u3066\u308B\u3068\u304D\u306F --yes \u3092\u4ED8\u3051\u3066\u304F\u3060\u3055\u3044\u3002"
      );
    }
  }
  const backupDir = await takeBackup({
    dir,
    files: stepFiles(versions, migrationTarget),
    now: options.now
  });
  try {
    for (const version of versions) {
      for (const step of version.steps) {
        await applyStep({ step, version, target: migrationTarget });
      }
    }
    const issues = await collectCheckIssues(configPath);
    if (issues.length > 0) {
      await restoreBackup({ dir, backupDir });
      for (const issue of issues) {
        const place = issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
        io.stderr(`${place}: ${issue.kind}: ${issue.message}`);
      }
      io.stderr(
        `\u70B9\u691C\u306E\u305A\u308C\u304C ${issues.length} \u4EF6\u3042\u308B\u305F\u3081\u3001\u5199\u3057\u304B\u3089\u623B\u3057\u307E\u3057\u305F\u3002\u7248\u306F\u66F8\u304D\u63DB\u3048\u3066\u3044\u307E\u305B\u3093\u3002`
      );
      return 1;
    }
  } catch (error) {
    await restoreBackup({ dir, backupDir });
    throw error;
  }
  await writeConfigVersion(configPath, target);
  io.stdout(`\u5199\u3057: ${toPosix4(relative6(dir, backupDir))}`);
  io.stdout(`\u7248\u3092 ${target} \u306B\u3057\u307E\u3057\u305F`);
  return 0;
}

// src/cli/main.ts
var CliError = class extends Error {
};
var USAGE = [
  "\u4F7F\u3048\u308B\u30B3\u30DE\u30F3\u30C9:",
  "  init [{\u7F6E\u304F\u5148\u306E\u30D5\u30A9\u30EB\u30C0}] [--js]",
  "  check [--config {\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB}]",
  "  export {\u6587\u66F8} [--out {\u51FA\u529B}] [--config {\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB}]",
  "  build [--config {\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB}]",
  "  upgrade [--plan] [--yes] [--config {\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB}]"
];
var PACKAGE_FILE = "package.json";
function isParseArgsError(error) {
  return error instanceof TypeError && "code" in error && typeof error.code === "string" && error.code.startsWith("ERR_PARSE_ARGS");
}
function findPackageRoot(from) {
  let dir = from;
  while (!existsSync(join10(dir, PACKAGE_FILE))) {
    const parent = dirname9(dir);
    if (parent === dir) {
      throw new CliError(
        `\u30D1\u30C3\u30B1\u30FC\u30B8\u306E\u5834\u6240\u3092\u898B\u3064\u3051\u3089\u308C\u307E\u305B\u3093\uFF08${from} \u304B\u3089\u4E0A\u3092\u63A2\u3057\u307E\u3057\u305F\uFF09\u3002mdmark \u3092\u5165\u308C\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      );
    }
    dir = parent;
  }
  return dir;
}
async function main(argv, io, ask) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: {
        out: { type: "string" },
        config: { type: "string" },
        js: { type: "boolean" },
        plan: { type: "boolean" },
        yes: { type: "boolean" }
      },
      allowPositionals: true
    });
    const [command, ...rest] = positionals;
    const root = findPackageRoot(import.meta.dirname);
    switch (command) {
      case "init":
        return await runInit(
          {
            dir: resolve9(io.cwd, rest[0] ?? "."),
            js: values.js === true,
            templatesDir: join10(root, "templates"),
            version: cliVersion()
          },
          io
        );
      case "check":
        return await runCheck({ config: values.config }, io);
      case "export": {
        const file = rest[0];
        if (file === void 0) {
          throw new CliError("export \u306B\u306F\u66F8\u304D\u51FA\u3059\u6587\u66F8\u306E\u30D1\u30B9\u304C\u8981\u308A\u307E\u3059\u3002");
        }
        return await runExport(
          {
            file,
            out: values.out,
            config: values.config,
            distDir: join10(root, "dist")
          },
          io
        );
      }
      case "build":
        return await runBuild(
          { config: values.config, distDir: join10(root, "dist") },
          io
        );
      case "upgrade":
        return await runUpgrade(
          {
            config: values.config,
            plan: values.plan === true,
            yes: values.yes === true,
            packageDir: root,
            cliVersion: cliVersion(),
            now: /* @__PURE__ */ new Date()
          },
          io,
          ask
        );
      default:
        throw new CliError(
          `\u77E5\u3089\u306A\u3044\u30B3\u30DE\u30F3\u30C9\u3067\u3059: ${command ?? "\uFF08\u306A\u3057\uFF09"}
${USAGE.join("\n")}`
        );
    }
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(error.message);
    } else if (isParseArgsError(error)) {
      io.stderr(`${error.message}
${USAGE.join("\n")}`);
    } else {
      throw error;
    }
    return 1;
  }
}
if (import.meta.main) {
  process.exitCode = await main(
    process.argv.slice(2),
    {
      cwd: process.cwd(),
      stdout: (line) => console.log(line),
      stderr: (line) => console.error(line)
    },
    createLinePrompter({
      input: process.stdin,
      write: (line) => console.error(line)
    })
  );
}
export {
  CliError,
  main
};
/*! Bundled license information:

markdown-it/dist/markdown-it.mjs:
  (*! markdown-it 15.0.2 https://github.com/markdown-it/markdown-it @license MIT *)
*/
