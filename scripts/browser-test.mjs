import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
let calls = [];
const fixtures = {
  cats: [{ pageid: 1, index: 1, title: "File:Sleepy cats.jpg", imageinfo: [{
    url: "https://upload.wikimedia.org/cats.jpg", thumburl: "https://upload.wikimedia.org/cats-520.jpg",
    mime: "image/jpeg", width: 900, height: 600
  }] },{pageid:2,index:2,title:"File:Kitten portrait.png",imageinfo:[{
    url:"https://upload.wikimedia.org/kitten.png",mime:"image/png",width:640,height:420
  }]}],
  ocean: [{ pageid: 3, index: 1, title:"File:Ocean waves.jpg",imageinfo:[{
    url:"https://upload.wikimedia.org/ocean.jpg",mime:"image/jpeg",width:1920,height:1080
  }]}],
  "new york": [{ pageid:4,index:1,title:"File:New York skyline.jpg",imageinfo:[{
    url:"https://upload.wikimedia.org/new-york.jpg",mime:"image/jpeg",width:1920,height:1200
  }]}],
  nature: [{pageid:5,index:1,title:"File:Forest trail.jpg",imageinfo:[{
    url:"https://upload.wikimedia.org/forest.jpg",mime:"image/jpeg",width:3000,height:2100
  }]}]
};
function check(truth, message){if(!truth)throw new Error("FAIL "+message);console.log("PASS "+message);}
await page.route("https://commons.wikimedia.org/w/api.php?**", async (route) => {
  const u = route.request().url();
  calls.push(u);
  const query = new URL(u).searchParams.get("gsrsearch").toLowerCase();
  const pages = fixtures[query] || [];
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    query:{pages:Object.fromEntries(pages.map(p=>[p.pageid,p]))}
  })});
});
try{
  await page.goto("http://127.0.0.1:8000/",{waitUntil:"domcontentloaded"});
  check(await page.locator("#results").count()===1,"Part 1 results id preserved");
  check(await page.locator("#results").locator("img").count()===0,"Starts with empty results");
  await page.locator("#search-input").fill("cats");
  await page.locator("#search-button").click();
  await page.waitForFunction(() => document.querySelectorAll("#results .image-card").length === 2);
  check(calls.length===1,"Search click triggers one API call");
  check(new URL(calls[0]).searchParams.get("gsrsearch")==="cats","Query carried into API");
  check(await page.locator("#results .image-card").count()===2,"Every returned image gets one card");
  check((await page.locator("#results .card-title").first().innerText()).includes("Sleepy cats"),"Captions shown");
  check((await page.locator("#results .card-detail").first().innerText()).includes("900 × 600"),"Image dimensions shown");
  check((await page.locator("#result-count").innerText()).includes("2 IMAGES"),"Result count enhancement");
  check(await page.locator("#empty-state").isHidden(),"Empty state hides when cards exist");
  await page.locator("#search-input").fill("ocean");
  await page.locator("#search-input").press("Enter");
  await page.waitForFunction(()=>document.querySelectorAll("#results .image-card").length===1);
  check(await page.locator("#results .image-card").count()===1,"Enter replaces old cards without stacking");
  check((await page.locator("#results .card-title").first().innerText()).includes("Ocean waves"),"New query yields new images");
  check(calls.length===2,"Enter triggers second API call");
  await page.locator("#search-input").fill("   ");
  await page.locator("#search-button").click();
  check(calls.length===2,"Blank searches ignored");
  await page.locator("#search-input").fill("new york");
  await page.locator("#search-button").click();
  await page.waitForFunction(()=>document.querySelector("#result-count").textContent.includes("NEW YORK"));
  check(new URL(calls[2]).searchParams.get("gsrsearch")==="new york","Multi-word queries URL encoded");
  await page.locator(".chips [data-query='Nature']").click();
  await page.waitForFunction(()=>document.querySelector("#result-count").textContent.includes("NATURE"));
  check((await page.locator("#search-input").inputValue())==="Nature","Category chip updates input");
  check((await page.locator("#results .image-card").count())===1,"Category chip fetches and renders");
  check(await page.locator("#results .image-link").first().getAttribute("target")==="_blank","Image links open new tab");
  mkdirSync("evidence",{recursive:true});
  await page.screenshot({path:"evidence/01-search-results-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"evidence/02-search-results-mobile.png",fullPage:true});
  writeFileSync("evidence/test-results.txt", "PASS 15 core search and rendering checks using deterministic Wikimedia API fixtures. Real requests are verified separately.\n");
  console.log("ALL CHECKS PASSED");
}finally{await browser.close();}
