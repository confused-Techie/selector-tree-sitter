# Selector Tree Sitter

> Query Tree-Sitter Grammar trees with CSS-like Selectors.

This module facilitates easy collection of information from a Tree-Sitter grammar.

When needing to extract select information from a code file, using Selector-Tree-Sitter is the way to do so without having to write custom code to walk the syntax tree.

## Example Usage

Let's say you want to collect the module names of imported modules in a JavaScript file.

Given the file contains text like so:

```javascript
const path = require("node:path");
```

After parsing said file with Tree-Sitter, you'd be able to hand this tree off to Selector-Tree-Sitter with a syntax selector of:

```
.call_expression > .identifier[text=require][childCount=0]#nextSibling#firstNamedChild::text
```

Which would then return:

```json
[
  "node:path"
]
```

Using Selector-Tree-Sitter lets you grab the information you care about, while ignoring the rest.

## Usage

You'll need to first of course get your Tree-Sitter parsed grammar first.
Let's assume the file we are wanting to inspect is `code.js` and is a JavaScript file.

```javascript
const fs = require("fs");

const Parser = require("tree-sitter");
const language = require("tree-sitter-javascript");

const parser = new Parser();
parser.setLanguage(language);

const code = fs.readFileSync("code.js", { encoding: "utf8" });

const tree = parser.parse(code);
```

We would then want to pass `tree` from TreeSitter to SelectorTreeSitter along with our Selector String.

```javascript
const SelectorTreeSitter = require("selector-tree-sitter");

const selector = '.comment[text*=todo]::text';

const selectorTS = new SelectorTreeSitter(tree, selector);

const nodes = selectorTS.execute();
```

In this example `nodes` would then be an array of text from every node on the Tree-Sitter tree whose text includes `todo` (case insensitive).

## Selector Syntax

The Selector Syntax itself should always be fully valid and parse-able CSS Selectors, the full spec couldn't be supported exactly for this context, especially considering things like `element`s or `class`s don't have a like-for-like translation.
So below is the definition of what CSS Selector means in the context of a Tree-Sitter grammar.

### Basic Selectors

#### Class Selector

`.value`

This selector will match with the `node.type` of a Tree-Sitter node.

#### Type Selector

`value`

Unsupported.

#### ID Selector

`#value`

This will switch our current working node.

Such as: `#parent` => `return node.parent;`

### Combinators

All combinators that are valid in CSS are supported, and have an intuitive translation, with these just effecting nodes on the Tree, rather than nodes in the DOM.

* ` `: Descendent Combinator - Supported
* `>`: Child Combinator - Supported
* `~`: Subsequent-Sibling Combinator - Supported
* `+`: Next-Sibling Combinator - Supported
* `|`: Column Combinator - Unsupported

### Attribute Selectors

All attribute selectors are fully supported:

* `attr`: Ensures the attr is present. As each node of a Tree-Sitter node is nearly identical, this isn't very helpful. But is still supported.
* `attr=value`: Ensures the attr matches the value exactly.
* `attr~=value`: Represents elements with an attribute name of attr whose value is a whitespace-separated list of words, one of which is exactly value.
* `attr|=value`: The value of attr matches value exactly, or starts with value separated by a hyphen.
* `attr^=value`: The value of attr is prefixed with value.
* `attr$=value`: The value of attr is suffixed by value.
* `attr*=value`: The value of attr includes an occurrence of value.

These definitions are all fully compliant, so the [CSS Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) will be helpful. This includes support for case sensitivity, as well as all matches being case insenstive by default.

### Pseudo-Classes

Pseudo-Classes allow you to execute a function on the node, in order to switch to that node.

Such as: `:child(2)` => `return node.child(2);`

Currently the list of supported Pseudo-Classes isn't comprehensive to what's available on each Tree-Sitter node. With the list of supported functions to call being below:

* `child`
* `namedChild`
* `firstChildForIndex`
* `firstNamedChildForIndex`

### Pseudo-Element

Pseudo-Elements allow you to return to that property of a node, rather than returning the node itself. This should always be placed as the last item in the selector, otherwise the next pass of the selector handling will fail without a node to work with.

Such as: `::text` => `return node.text;`
