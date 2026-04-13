import assert from "node:assert/strict";

import { EditorSelectionController } from "../src/editor.js";

const controller = new EditorSelectionController();

const directImage = {
  nodeType: 1,
  tagName: "IMG",
};
assert.equal(controller.getImageElementFromTarget(directImage), directImage);

let selectorUsed = "";
const textParagraph = {
  nodeType: 1,
  tagName: "P",
  closest(selector) {
    selectorUsed = selector;
    return null;
  },
};
assert.equal(controller.getImageElementFromTarget(textParagraph), null);
assert.equal(selectorUsed.includes("#write"), false);

const imageInContainer = { nodeType: 1, tagName: "IMG" };
const imageContainer = {
  querySelector(selector) {
    if (selector === "img") {
      return imageInContainer;
    }
    return null;
  },
};

const nestedNode = {
  nodeType: 1,
  tagName: "SPAN",
  closest() {
    return imageContainer;
  },
};
assert.equal(controller.getImageElementFromTarget(nestedNode), imageInContainer);

const textNode = {
  nodeType: 3,
  parentElement: textParagraph,
};
assert.equal(controller.getImageElementFromTarget(textNode), null);

console.log("editor image target tests passed");
