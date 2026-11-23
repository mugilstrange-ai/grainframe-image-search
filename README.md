# Grainframe — Image Search App (Part 2)

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
