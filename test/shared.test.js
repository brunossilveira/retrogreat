"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { frontFace, cardKey, MESSAGE_TYPE } = require("../shared.js");

test("frontFace returns the name unchanged for single-faced cards", () => {
  assert.equal(frontFace("Llanowar Elves"), "Llanowar Elves");
});

test("frontFace takes the front of split / double-faced / adventure names", () => {
  assert.equal(frontFace("Fire // Ice"), "Fire");
  assert.equal(frontFace("Bala Ged Recovery // Bala Ged Sanctuary"), "Bala Ged Recovery");
  assert.equal(frontFace("Brazen Borrower // Petty Theft"), "Brazen Borrower");
});

test("cardKey lowercases the front face", () => {
  assert.equal(cardKey("PRIEST OF TITANIA"), "priest of titania");
  assert.equal(cardKey("Fire // Ice"), "fire");
});

test("the deck's front face and Scryfall's full name reduce to the same key", () => {
  // Moxfield's table view shows only the front face; Scryfall returns the pair.
  assert.equal(cardKey("Bala Ged Recovery"), cardKey("Bala Ged Recovery // Bala Ged Sanctuary"));
});

test("MESSAGE_TYPE is the agreed channel name", () => {
  assert.equal(MESSAGE_TYPE, "FIND_RETRO_FRAMES");
});
