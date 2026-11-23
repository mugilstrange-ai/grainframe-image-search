# Grainframe — Image Search App

**Live app:** https://mugilstrange-ai.github.io/grainframe-image-search/
**Repository:** https://github.com/mugilstrange-ai/grainframe-image-search

## Part 3 — from working demo to shipped app

| State | What the user sees |
| --- | --- |
| **Loading** | The moment a search starts (before `fetch`), 8 grey skeleton cards shimmer, the count reads "Searching for …" and the button shows "Searching…". All of it clears when results arrive. |
| **Empty** | After parsing the response, an empty list shows **"No results for “…”. Try another search"** — never a blank grid. |
| **Error** | `fetch` is wrapped in `try…catch` and `response.ok` is checked. Any failure shows **"Something went wrong."** with a friendly line and a **Try again** button. Being offline, or a service that takes longer than 12 s, gets its own message. |

**Polish:** a result count ("Showing 12 images for “forest”"), cards that fade up one after another, photos that fade in once loaded, a two-column phone layout with sideways-scrolling suggestion chips, shareable links (`?q=forest` opens that search), and reduced-motion support.

**Deployed** with GitHub Pages (`.nojekyll` makes Pages serve the files as they are).

### Test every state

- **Loading:** DevTools → Network → throttle to "Slow 3G", then search: the skeleton cards stay while it fetches.
- **Empty:** search `zxqwlk`.
- **Error:** DevTools → Network → Offline (or break the API URL in `script.js`), then search.
- Automated: `scripts/states-test.mjs` forces each state in a real browser and runs in GitHub Actions with `scripts/browser-test.mjs`.

## About Grainframe (Parts 1 and 2)

Grainframe is an original, responsive image-discovery app with an editorial terracotta-and-sage theme. Users can type a search term and press Enter or click Search to fetch real matching images from the public, key-free Wikimedia Commons API and render them as responsive photo cards. I retained the Part 1 hero, sticky header, empty-state area and quick-pick category chips, and made the chips initiate searches while showing a result count and dimensions for each photo. The CSS Grid reflows from small screens to wide layouts and the interface remains plain HTML, CSS and JavaScript, without any packages.

## Try it

Run a local server (recommended, though the app is static):

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 and search for **cats**, **ocean**, or **new york**, or click a quick-pick category. The app uses a client-side API request, not preloaded or hard-coded images. Allow internet access to Wikimedia Commons.

## Part 2 review checklist

- `#search-form` has a `submit` handler with `event.preventDefault()`; clicking Search and pressing Enter behave the same.
- `#search-input`, `#search-button`, and `#results` IDs are preserved.
- Empty/whitespace-only queries never fetch.
- Query is URL-encoded with `encodeURIComponent(query)`, including multi-word topics.
- `await fetch(url)`, `response.ok` validation, and `await response.json()`.
- Each API image becomes an `article` built with `document.createElement` and inserted with `results.appendChild(card)`.
- `results.innerHTML = ""` ensures the old results disappear on each new search.
- Original enhancements: working category chips, result count, image dimensions, external Commons image links.
- No frameworks, API keys, libraries, or build tools.

Wikimedia Commons API: https://commons.wikimedia.org/w/api.php
