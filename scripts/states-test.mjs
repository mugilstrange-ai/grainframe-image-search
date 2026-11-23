// Part 3: checks the loading, empty and error states in a real browser,
// with a stand-in for the Wikimedia Commons API so every state can be forced.
import { mkdirSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const APP = process.env.APP_URL || "http://127.0.0.1:8000/";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4+/AhAAWBAs8LPvBhAAAAAElFTkSuQmCC", "base64");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
let mode = "ok";
let delay = 0;

const photos = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [100 + i, {
  pageid: 100 + i, index: i + 1, title: `File:Misty forest ${i + 1}.jpg`,
  imageinfo: [{ url: `https://upload.wikimedia.org/forest-${i}.jpg`, thumburl: `https://upload.wikimedia.org/forest-${i}-520.jpg`,
    descriptionurl: `https://commons.wikimedia.org/wiki/File:Misty_forest_${i + 1}.jpg`, mime: "image/jpeg", width: 1600, height: 1067 }],
}]));

await context.route("https://upload.wikimedia.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
await context.route("https://commons.wikimedia.org/w/api.php?**", async (route) => {
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  if (mode === "offline") return route.abort("internetdisconnected");
  if (mode === "500") return route.fulfill({ status: 500, body: "Server error" });
  const body = mode === "empty" ? { batchcomplete: "" } : { query: { pages: photos(12) } };
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
});

const text = (selector) => page.locator(selector).innerText();
function check(truth, message) { if (!truth) throw new Error("FAIL " + message); console.log("PASS " + message); }
async function search(word) {
  await page.locator("#search-input").fill(word);
  await page.locator("#search-input").press("Enter");
}

try {
  mkdirSync("evidence", { recursive: true });
  await page.goto(APP, { waitUntil: "domcontentloaded" });

  // 1. Loading: shown before the answer arrives, then cleared.
  delay = 1500;
  await search("forest");
  await page.waitForSelector("#results .skeleton-card");
  check(await page.locator("#results .skeleton-card").count() === 8, "Loading: skeleton cards appear while fetching");
  check((await text("#result-count")).includes("SEARCHING FOR “FOREST”"), "Loading: 'Searching for …' message");
  check(await page.locator("#search-button").isDisabled(), "Loading: button disabled while fetching");
  await page.waitForTimeout(700); // let the page scroll down to the loading cards
  await page.screenshot({ path: "evidence/p3-01-loading.png" });
  await page.waitForFunction(() => document.querySelectorAll("#results .image-card").length === 12);
  check(await page.locator("#results .skeleton-card").count() === 0, "Loading cleared when results arrive");
  check((await text("#result-count")) === "SHOWING 12 IMAGES FOR “FOREST”", "Polish: result count");
  check(new URL(page.url()).searchParams.get("q") === "forest", "Polish: shareable ?q= link");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "evidence/p3-02-results.png" });

  // 2. Empty: a clear message, never a blank grid.
  delay = 200; mode = "empty";
  await search("zxqwlk");
  await page.waitForFunction(() => !document.getElementById("empty-state").hidden && !document.getElementById("results").hasAttribute("aria-busy"));
  check((await text("#empty-state")).includes("No results for “zxqwlk”.") && (await text("#empty-state")).includes("Try another search"), "Empty: 'No results … Try another search' message");
  check(await page.locator("#results > *").count() === 0, "Empty: no blank grid left behind");
  await page.screenshot({ path: "evidence/p3-03-empty.png" });

  // 3. Error: a server failure shows a friendly message and Try again works.
  mode = "500";
  await search("mountains");
  await page.waitForSelector(".state-action");
  check((await text("#empty-state")).includes("Something went wrong.") && (await text("#empty-state")).includes("Please try again"), "Error: friendly message on HTTP 500");
  await page.screenshot({ path: "evidence/p3-04-error.png" });
  mode = "ok";
  await page.locator(".state-action").click();
  await page.waitForFunction(() => document.querySelectorAll("#results .image-card").length === 12);
  check(true, "Error: Try again runs the search again");

  // 3b. Error: offline.
  mode = "offline";
  await context.setOffline(true);
  await search("ocean");
  await page.waitForSelector(".state-action");
  check((await text("#empty-state")).includes("You seem to be offline"), "Error: offline message instead of a blank screen");
  await context.setOffline(false);

  // Phone layout.
  mode = "ok";
  await page.setViewportSize({ width: 390, height: 844 });
  await search("forest");
  await page.waitForFunction(() => document.querySelectorAll("#results .image-card").length === 12);
  const columns = await page.evaluate(() => getComputedStyle(document.getElementById("results")).gridTemplateColumns.split(" ").length);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(columns === 2 && !sideways, "Polish: two columns on a phone, no sideways scroll");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "evidence/p3-05-phone.png" });

  writeFileSync("evidence/p3-states.txt", "PASS loading, empty, error (HTTP 500 and offline), Try again, result count, share link and phone layout.\n");
  console.log("ALL PART 3 STATE CHECKS PASSED");
} finally {
  await browser.close();
}
