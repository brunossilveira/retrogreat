"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { DeckUrl, cleanName, MoxfieldApiDeckSource } = require("../content.js");

test.describe("DeckUrl.publicId", () => {
  test("extracts the id from a deck URL", () => {
    assert.equal(DeckUrl.publicId("https://www.moxfield.com/decks/ABC123"), "ABC123");
  });

  test("handles the bare domain and trailing sub-paths", () => {
    assert.equal(DeckUrl.publicId("https://moxfield.com/decks/ABC123/primer"), "ABC123");
  });

  test("ignores the public listing and non-deck paths", () => {
    assert.equal(DeckUrl.publicId("https://www.moxfield.com/decks/public/commander"), null);
    assert.equal(DeckUrl.publicId("https://www.moxfield.com/decks/"), null);
    assert.equal(DeckUrl.publicId("https://www.moxfield.com/users/bruno"), null);
  });
});

test.describe("cleanName", () => {
  test("collapses whitespace from spans split across the name", () => {
    assert.equal(cleanName("Allosaurus   Shepherd"), "Allosaurus Shepherd");
    assert.equal(cleanName("  Priest of \n Titania  "), "Priest of Titania");
  });

  test("returns an empty string for nullish input", () => {
    assert.equal(cleanName(null), "");
    assert.equal(cleanName(undefined), "");
  });
});

test.describe("MoxfieldApiDeckSource extracts names from the deck JSON", () => {
  const source = new MoxfieldApiDeckSource("id");

  test("walks every board in the v3 boards shape", () => {
    const deck = {
      boards: {
        mainboard: { cards: { a: { card: { name: "Atogatog" } }, b: { card: { name: "Sol Ring" } } } },
        commanders: { cards: { c: { card: { name: "Seton, Krosan Protector" } } } },
        sideboard: { cards: {} },
      },
    };
    assert.deepEqual(source._extractNames(deck).sort(), [
      "Atogatog",
      "Seton, Krosan Protector",
      "Sol Ring",
    ]);
  });

  test("tolerates the older flat shape with boards at the top level", () => {
    const deck = { mainboard: { cards: { a: { card: { name: "Llanowar Elves" } } } } };
    assert.deepEqual(source._extractNames(deck), ["Llanowar Elves"]);
  });

  test("skips entries that have no card name", () => {
    const deck = { boards: { mainboard: { cards: { a: { card: {} }, b: { card: { name: "Fauna Shaman" } } } } } };
    assert.deepEqual(source._extractNames(deck), ["Fauna Shaman"]);
  });
});
