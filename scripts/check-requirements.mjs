import { readFileSync } from "node:fs";
const html=readFileSync("index.html","utf8");
const js=readFileSync("script.js","utf8");
const css=readFileSync("styles.css","utf8");
const tests=[
 ["search form",html.includes('id="search-form"')],
 ["search input",html.includes('id="search-input"')],
 ["search button",html.includes('id="search-button"')],
 ["results element",html.includes('id="results"')],
 ["empty results target",/id="results"[^>]*><\/div>/.test(html)],
 ["responsive grid",/repeat\(auto-fill,\s*minmax\(/.test(css)],
 ["submit listener",js.includes('addEventListener("submit"')],
 ["prevent form reload",js.includes("event.preventDefault()")],
 ["early return blank",js.includes("if (!query) return")],
 ["encode multiword query",js.includes("encodeURIComponent(query)")],
 ["await public API",js.includes("await fetch(url")],
 ["check HTTP success",js.includes("response.ok")],
 ["parse JSON",js.includes("await response.json()")],
 ["create cards",js.includes('document.createElement("article")')],
 ["append cards",js.includes("results.appendChild(card)")],
 ["clear results",js.includes('results.innerHTML = ""')],
 ["chips search",js.includes("searchForm.requestSubmit()")],
 ["original branding",html.includes("grainframe") && !html.includes("PixelPulse")]
];
for (const [name,pass] of tests){if(!pass)throw Error("FAIL: "+name);console.log("PASS: "+name);}
console.log(tests.length+" source checks passed");
