"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { ScryfallClient, RetroFrameFinder, exactName, FRAME_FILTER } = require("../background.js");

test("exactName wraps a name and strips embedded double quotes", () => {
  assert.equal(exactName("Llanowar Elves"), '!"Llanowar Elves"');
  assert.equal(exactName('He said "hi"'), '!"He said hi"');
});

test("the frame filter constant is the authoritative definition", () => {
  assert.equal(FRAME_FILTER, "frame:1997 year>=2019");
});

test.describe("ScryfallClient.search", () => {
  const realFetch = global.fetch;
  test.afterEach(() => {
    global.fetch = realFetch;
  });

  test("encodes the query into the search URL", async () => {
    let requested;
    global.fetch = async (url) => {
      requested = url;
      return { status: 200, ok: true, json: async () => ({ data: [] }) };
    };
    await new ScryfallClient().search('(!"A") frame:1997 year>=2019');
    assert.equal(
      requested,
      "https://api.scryfall.com/cards/search?q=" +
        encodeURIComponent('(!"A") frame:1997 year>=2019'),
    );
  });

  test("treats 404 as zero matches, not an error", async () => {
    global.fetch = async () => ({ status: 404, ok: false });
    assert.deepEqual(await new ScryfallClient().search("anything"), []);
  });

  test("returns the data array on success", async () => {
    global.fetch = async () => ({ status: 200, ok: true, json: async () => ({ data: [{ name: "X" }] }) });
    assert.deepEqual(await new ScryfallClient().search("q"), [{ name: "X" }]);
  });

  test("throws on other error statuses", async () => {
    global.fetch = async () => ({ status: 500, ok: false });
    await assert.rejects(() => new ScryfallClient().search("q"), /Scryfall responded 500/);
  });
});

// Captures the queries it is asked and replays a fixed set of matching cards.
function fakeClient(matchingCards = []) {
  return {
    queries: [],
    async search(query) {
      this.queries.push(query);
      return matchingCards;
    },
  };
}

test.describe("RetroFrameFinder.matchingKeys", () => {
  test("builds an OR-joined exact-name query with the frame filter", async () => {
    const client = fakeClient();
    await new RetroFrameFinder(client, { delayMs: 0 }).matchingKeys(["A", "B"]);
    assert.equal(client.queries.length, 1);
    assert.equal(client.queries[0], '(!"A" or !"B") frame:1997 year>=2019');
  });

  test("de-duplicates names by canonical key before querying", async () => {
    const client = fakeClient();
    await new RetroFrameFinder(client, { delayMs: 0 }).matchingKeys([
      "Llanowar Elves",
      "llanowar elves",
      "Fire // Ice",
    ]);
    assert.equal(client.queries[0], '(!"Llanowar Elves" or !"Fire") frame:1997 year>=2019');
  });

  test("chunks names ~15 per request", async () => {
    const client = fakeClient();
    const names = Array.from({ length: 32 }, (_, i) => `Card ${i}`);
    await new RetroFrameFinder(client, { chunkSize: 15, delayMs: 0 }).matchingKeys(names);
    assert.equal(client.queries.length, 3); // 15 + 15 + 2
  });

  test("returns front-face keys for the cards Scryfall matched", async () => {
    const client = fakeClient([{ name: "Priest of Titania" }, { name: "Fire // Ice" }]);
    const keys = await new RetroFrameFinder(client, { delayMs: 0 }).matchingKeys([
      "Priest of Titania",
      "Wirewood Symbiote",
      "Fire // Ice",
    ]);
    assert.deepEqual([...keys].sort(), ["fire", "priest of titania"]);
  });

  test("returns nothing when Scryfall matches nothing", async () => {
    const keys = await new RetroFrameFinder(fakeClient([]), { delayMs: 0 }).matchingKeys(["A", "B"]);
    assert.deepEqual(keys, []);
  });
});
