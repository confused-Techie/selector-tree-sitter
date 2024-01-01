const { describe, it } = require("node:test");
const assert = require("node:assert");

const Parser = require("tree-sitter");
const language = require("tree-sitter-javascript");

const SelectorTreeSitter = require("../src/index.js");

const fs = require("fs");

describe("integration tests", () => {
  it("returns the correct required module", () => {
    const code = fs.readFileSync("./test/fixtures/mini-valid-require.js", { encoding: "utf8" });

    const parser = new Parser();
    parser.setLanguage(language);

    const tree = parser.parse(code);

    const selector = ".call_expression > .identifier[text=require][childCount=0]#nextSibling#firstNamedChild::text";

    const selectorTS = new SelectorTreeSitter(tree, selector);

    const nodes = selectorTS.execute();

    assert.strictEqual(nodes[0], '"path"');
    assert.strictEqual(nodes.length, 1);
  });

  it("returns the correct imported module", () => {
    const code = fs.readFileSync("./test/fixtures/mini-valid-import.mjs", { encoding: "utf8" });

    const parser = new Parser();
    parser.setLanguage(language);

    const tree = parser.parse(code);

    const selector = ".import_statement > .import[text=import]#parent:child(3)#firstNamedChild::text";

    const selectorTS = new SelectorTreeSitter(tree, selector);

    const nodes = selectorTS.execute();

    assert.strictEqual(nodes[0], 'path');
    assert.strictEqual(nodes.length, 1);
  });

  it("returns the correct text", () => {
    const code = fs.readFileSync("./test/fixtures/mini-valid-comment.js", { encoding: "utf8" });

    const parser = new Parser();
    parser.setLanguage(language);

    const tree = parser.parse(code);

    const selector = ".comment[text*=todo]::text";

    const selectorTS = new SelectorTreeSitter(tree, selector);

    const nodes = selectorTS.execute();

    assert.strictEqual(nodes[0], "// todo: Write some code");
    assert.strictEqual(nodes.length, 1);
  });
});
