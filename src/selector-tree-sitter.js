// This module accepts a tree-sitter tree, and a CSS selector like syntax
// and will execute that syntax onto the tree provided, eventually returning
// a list of nodes that match the given syntax
const parselJS = require("parsel-js");

module.exports =
class SelectorTreeSitter {
  constructor(tree, selector) {
    this.tree = tree;
    this.selector = selector;
    this.selectorTokens = parselJS.tokenize(selector);

    this.possibleMatches = [];
    this.matches = [];

    this.verbose = false;
  }

  combinePossibleArray(arr, val) {
    if (Array.isArray(val)) {
      arr = arr.concat(val);
    } else {
      arr.push(val);
    }

    return arr;
  }

  execute() {
    if (!Array.isArray(this.selectorTokens) || this.selectorTokens.length == 0) {
      throw new Error(`Provided Selector: '${this.selector}' was unable to be parsed!`);
    }

    if (typeof this.tree !== "object") {
      throw new Error(`The provided Tree-Sitter Tree MUST be an object. Got ${typeof this.tree}`);
    }

    // We need to setup the first matches for the first item of the selector
    // which must be a class so that we can actually selector something
    //
    // Initially we will want as many matches as possible, which will then all
    // be tested on the remaining selectors
    let token = this.selectorTokens[0];

    if (token.type !== "class") {
      throw new Error(`Provided Selector: '${this.selector}' must begin with a class!`);
    }

    this.possibleMatches = this.descendNode(this.tree.rootNode, (node) => {
      if (token.type === "class" && (node.type !== token.name)) {
        return false;
      }

      // We return true by default, only failing on a bad match
      return true;
    });

    this.traverseSelector();

    return this.matches;
  }

  traverseSelector() {
    // This method can only be called after the initial setup done by `this.execute()`
    // which prepares a list of all possible starting nodes (`this.possibleMatches`)
    // From here, we will iterate through all matches checking then if the entire
    // selector still works.
    // If not, that possible match will be removed from the list, if it does then
    // it's moved to the `this.matches` array as a proper match

    while (this.possibleMatches.length > 0) {
      let node = this.possibleMatches[0];

      // Now we will call `this.walkSelector` to walk the selectors
      // Skipping selector of index `0` since that was called during the setup
      // within `this.execute()`

      let matchingNode = this.walkSelector(node, 1);

      if (!matchingNode) {
        // If the returned node is false, the match failed, and this `possibleMatch`
        // can be removed
        this.possibleMatches.shift();
      } else {
        // The node is truthy, and is a full match
        // But this may also be triggered by an empty array
        if (this.verbose) {
          console.log("A walk of all selectors came back truthy!");
        }
        this.matches = this.combinePossibleArray(this.matches, matchingNode);
        this.possibleMatches.shift();
      }
    }
  }

  walkSelector(node, idx) {
    if (this.verbose) {
      console.log(`Walking selectors - idx: ${idx}`);
      console.log(`Token: ${this.selectorTokens[idx]?.type}`);
    }
    // This method takes a node from Tree-Sitter, and an index, which corresponds
    // to a location of `this.selectorTokens` and will attempt to match the current
    // selector against the current node or children nodes.
    // Which if successful, then calls itself with a higher index to check if the
    // next value can match. Eventually returning a node if successfully matching
    // all selectors, or will return `null` if one selector does not match

    let token = this.selectorTokens[idx];

    // Lets sanity check
    if (idx > this.selectorTokens.length - 1) {
      // We have checked every selector, and knowing the last node successfully
      // returned, we can return this node, to finish our walk
      if (this.verbose) {
        console.log("Index is larger than selector token count. Returning current node...");
      }
      return node;
    }

    if (token.type === "class") {

      if (node.type === token.name) {
        return this.walkSelector(node, idx + 1);
      } else {
        // We failed this match
        return false;
      }

    } else if (token.type === "attribute") {
      // Any attribute matches, actually operate on the node we have already been
      // provided

      // Before all this logic, lets check for the possibility that no operator
      // has been specified. Which doesn't make sense in this context, but
      // it could still happen
      if (typeof token.operator !== "string") {
        // There is no operator, we simply want to ensure this attribute exists
        if (node[token.name]) {
          return this.walkSelector(node, idx + 1);

        } else {
          return false;
        }
      }

      // Lets make sure that this attribute exists before doing any big logic
      if (typeof node[token.name] !== "string" && typeof node[token.name] !== "number") {
        // The attribute doesn't exist at all
        return false;
      }

      let valueToCheck = node[token.name];
      let valueToMatch = token.value;
      let doesMatch = false;

      if (token.caseSensitive === "i" || token.caseSensitive === "I") {
        // Since this match doesn't care about case, we will lowercase everything
        if (typeof valueToCheck === "string") {
          valueToCheck = valueToCheck.toLowerCase();
          valueToMatch = valueToMatch.toLowerCase();
        } else if (typeof valueToCheck === "number") {
          valueToMatch = parseInt(valueToMatch);
        }
      }
      if (token.caseSensitive === "s" || token.caseSensitive === "S") {
        // This match requires case sensitivity, which is already true without further action
      }
      if (typeof token.caseSensitive !== "string") {
        // No caseSensitivity has been defined.
        // According to the spec, these comparisons are case-insensitive by default

        if (typeof valueToCheck === "string") {
          valueToCheck = valueToCheck.toLowerCase();
          valueToMatch = valueToMatch.toLowerCase();
        } else if (typeof valueToCheck === "number") {
          valueToMatch = parseInt(valueToMatch);
        }
      }

      switch(token.operator) {
        case "=":
          doesMatch = valueToCheck === valueToMatch;
          break;
        case "~=":
          // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#attrvalue_2
          let attribArray = valueToCheck.split(" ");
          doesMatch = attribArray.includes(valueToMatch);
          break;
        case "|=":
          // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#attrvalue_3
          doesMatch = valueToCheck == valueToMatch || valueToCheck.split("-")[0] == valueToMatch;
          break;
        case "^=":
          // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#attrvalue_4
          doesMatch = valueToCheck.startsWith(valueToMatch);
          break;
        case "$=":
          // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#attrvalue_5
          doesMatch = valueToCheck.endsWith(valueToMatch);
          break;
        case "*=":
          // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#attrvalue_6
          doesMatch = valueToCheck.includes(valueToMatch);
          break;
        default:
          console.warning(`Unrecognized CSS Selector Attribute Operator: ${token.operator}`);
          break;
      }

      if (doesMatch) {
        if (this.verbose) {
          console.log("Attribute does match");
        }
        // We can now continue to attempt to match
        return this.walkSelector(node, idx + 1);

      } else {
        if (this.verbose) {
          console.log("Attribute no match");
        }
        // We failed to match our selector, and this match has failed
        return false;
      }
    } else if (token.type === "combinator") {
      // We now know we are working with a combinator, that we will have to compare
      // against our current `node`

      let nextToken = idx + 1;

      if (token.content === ">") {
        // Child Combinator
        return this.descendChildren(node, (cbNode) => {
          return this.walkSelector(cbNode, nextToken);
        });

      } else if (token.content === "+") {
        // Next-sibling combinator
        return this.walkSelector(node.nextNamedSibling, nextToken);
      } else if (token.content === " ") {
        // Descendant Combinator
        let possibleNodes = [];

        this.descendNode(node, (cbNode) => {
          let doesThisNodeMatch = this.walkSelector(cbNode, nextToken);
          if (doesThisNodeMatch) {
            possibleNodes = this.combinePossibleArray(possibleNodes, doesThisNodeMatch);
          }
        });

        if (possibleNodes.length > 0) {
          return possibleNodes;
        } else {
          return false;
        }

      } else if (token.content === "~") {
        // Subsequent-sibling combinator
        return this.walkSelector(node.previousNamedSibling, nextToken);
      } else {
        console.warning(`Unsupported combinator: ${token.content}!`);
        return false;
      }

    } else if (token.type === "pseudo-class") {
      // Pseudo-classes are able to execute any generic function on the node
      let nextNode = false;
      let arg = null; // May be needed in some cases, and since a switch statement
      // doesn't have it's own scope to avoid redeclaring, we define here

      switch(token.name) {
        case "child":
          arg = parseInt(token.argument);
          nextNode = node.child(arg);
          break;
        case "namedChild":
          arg = parseInt(token.argument);
          nextNode = node.namedChild(arg);
          break;
        case "firstChildForIndex":
          arg = parseInt(token.argument);
          nextNode = node.firstChildForIndex(arg);
          break;
        case "firstNamedChildForIndex":
          arg = parseInt(token.argument);
          nextNode = node.firstNamedChildForIndex(arg);
          break;
      }

      if (nextNode) {
        return this.walkSelector(nextNode, idx + 1);
      } else {
        return false;
      }
    } else if (token.type === "pseudo-element") {
      // Pseudo-Elements are able to return properties of a node
      let value = node[token.name];

      if (value) {
        return this.walkSelector(value, idx + 1);
      } else {
        return false;
      }

    } else if (token.type === "id") {
      // ID Selector
      let nextNode = node[token.name];

      if (nextNode) {
        return this.walkSelector(nextNode, idx + 1);
      } else {
        return false;
      }
    } else {
      console.warning(`The token type '${token.type}' didn't match any known type!`);
      console.warning("Aborting this branch!");
      return false;
    }

  }

  descendNode(node, callback) {
    // Descend all nodes until a match from the current node,
    // callback is invoked on every possible node, to determine if it should
    // be considered a match
    let otherNodes = [];
    // First we check if we can descend on this node
    if (node.childCount > 0) {
      for (let i = 0; i < node.childCount; i++) {
        otherNodes = otherNodes.concat(this.descendNode(node.child(i), callback));
      }
    }
    if (callback(node)) {
      otherNodes = otherNodes.concat(node);
    }

    return otherNodes;
  }

  descendChildren(node, callback) {
    // Descends only the immediate children of the provided node
    // invoking the callback on each node, to determine if it's considered a match
    let otherNodes = [];

    if (node.childCount > 0) {
      for (let i = 0; i < node.childCount; i++) {
        let returnedNode = callback(node.child(i));
        if (returnedNode) {
          otherNodes.push(returnedNode);
        }
      }
    }

    return otherNodes;
  }
}
