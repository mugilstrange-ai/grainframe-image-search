// Grainframe — key-free, CORS-enabled Wikimedia Commons image search.
// Part 3: every search moves through clear states: loading → results | empty | error.
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const results = document.getElementById("results");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const collection = document.querySelector(".collection");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const TIMEOUT_MS = 12000; // a search that hangs longer than this becomes an error
const SKELETON_CARDS = 8;

let activeRequest = null;

/* ---------- the message panel (welcome, empty and error) ---------- */

function showMessage({ icon, title, text, note, retryQuery, isError }) {
  results.innerHTML = "";
  results.removeAttribute("aria-busy");
  emptyState.replaceChildren();
  emptyState.classList.toggle("is-error", Boolean(isError));

  const iconEl = document.createElement("span");
  iconEl.setAttribute("aria-hidden", "true");
  iconEl.textContent = icon;
  const titleEl = document.createElement("h3");
  titleEl.textContent = title;
  const textEl = document.createElement("p");
  textEl.textContent = text;
  emptyState.append(iconEl, titleEl, textEl);

  if (retryQuery) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "state-action";
    retry.textContent = "Try again ↻";
    retry.addEventListener("click", () => runSearch(retryQuery, { scroll: false }));
    emptyState.append(retry);
  }
  if (note) {
    const noteEl = document.createElement("small");
    noteEl.textContent = note;
    emptyState.append(noteEl);
  }
  emptyState.hidden = false;
}

/* 1. Loading — shown the moment a search starts, before fetch. */
function showLoading(query) {
  emptyState.hidden = true;
  results.innerHTML = "";
  results.setAttribute("aria-busy", "true");
  for (let i = 0; i < SKELETON_CARDS; i += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = '<div class="skeleton-media"></div><div class="skeleton-lines"><i></i><i></i></div>';
    results.append(skeleton);
  }
  resultCount.textContent = "SEARCHING FOR “" + query.toUpperCase() + "”…";
  searchButton.disabled = true;
  searchButton.textContent = "Searching…";
}

function stopLoading() {
  results.removeAttribute("aria-busy");
  searchButton.disabled = false;
  searchButton.textContent = "Search images ↗";
}

/* 2. Empty — the request worked, but the list is empty. */
function showEmpty(query) {
  resultCount.textContent = "0 IMAGES FOR “" + query.toUpperCase() + "”";
  showMessage({
    icon: "◌",
    title: "No results for “" + query + "”.",
    text: "Try another search — a broader word often works best, like “forest” instead of a long phrase.",
    note: "TIP · TAP A SUGGESTION ABOVE",
  });
}

/* 3. Error — the network or the API failed. */
function showError(query, error) {
  let text = "We couldn’t reach the image library just now. Please try again.";
  if (!navigator.onLine) {
    text = "You seem to be offline. Check your internet connection and try again.";
  } else if (error && error.name === "TimeoutError") {
    text = "The image service is taking too long to answer. Please try again.";
  }
  resultCount.textContent = "SEARCH PAUSED · CONNECTION PROBLEM";
  showMessage({ icon: "!", title: "Something went wrong.", text, retryQuery: query, isError: true });
}

/* Results — one card per image, fading in one after another. */
function renderImages(pages, query) {
  // Clear any previous search (and the loading skeletons) before rendering.
  results.innerHTML = "";

  const images = pages
    .filter((page) => {
      const info = page.imageinfo?.[0];
      return info?.url && info?.mime?.startsWith("image/") && !info.mime.includes("svg");
    })
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  if (images.length === 0) {
    showEmpty(query);
    return;
  }

  images.forEach((page, position) => {
    const info = page.imageinfo[0];
    const card = document.createElement("article");
    card.className = "image-card";
    card.style.setProperty("--i", String(Math.min(position, 12)));

    const link = document.createElement("a");
    link.className = "image-link";
    link.href = info.descriptionurl || info.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "View " + page.title.replace(/^File:/i, ""));

    const image = document.createElement("img");
    image.src = info.thumburl || info.url;
    image.alt = page.title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => image.classList.add("is-loaded"));
    image.addEventListener("error", () => link.classList.add("is-broken"));
    link.appendChild(image);

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = image.alt;

    const detail = document.createElement("p");
    detail.className = "card-detail";
    detail.textContent = info.width && info.height
      ? info.width + " × " + info.height + " px · Wikimedia Commons"
      : "Wikimedia Commons";

    meta.appendChild(title);
    meta.appendChild(detail);
    card.appendChild(link);
    card.appendChild(meta);
    results.appendChild(card);
  });

  emptyState.hidden = true;
  const word = images.length === 1 ? "IMAGE" : "IMAGES";
  resultCount.textContent = "SHOWING " + images.length + " " + word + " FOR “" + query.toUpperCase() + "”";
}

/* Keep the search in the address bar (?q=forest) so a results page can be shared or reloaded. */
function rememberQuery(query) {
  const address = new URL(window.location.href);
  address.searchParams.set("q", query);
  window.history.replaceState(null, "", address);
}

async function runSearch(rawQuery, { scroll = true } = {}) {
  const query = rawQuery.trim();
  if (!query) return;

  // A later search always takes precedence over an older slow request.
  if (activeRequest) activeRequest.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), TIMEOUT_MS);

  const url =
    "https://commons.wikimedia.org/w/api.php" +
    "?action=query&generator=search&gsrnamespace=6&gsrlimit=20" +
    "&gsrsearch=" + encodeURIComponent(query) +
    "&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=520" +
    "&format=json&origin=*";

  showLoading(query); // 1. loading — before fetch starts
  rememberQuery(query);
  if (scroll) collection.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Image search returned HTTP " + response.status);

    const data = await response.json();
    if (data.error) throw new Error(data.error.info || "Wikimedia Commons API error");
    if (controller !== activeRequest) return; // a newer search has started

    const pages = Object.values(data.query?.pages || {});
    renderImages(pages, query); // results, or 2. empty
  } catch (error) {
    if (controller !== activeRequest) return; // replaced by a newer search — not a failure
    const reason = controller.signal.aborted ? controller.signal.reason : error;
    console.error("Grainframe image search failed:", reason);
    showError(query, reason); // 3. error
  } finally {
    clearTimeout(timer);
    if (activeRequest === controller) {
      activeRequest = null;
      stopLoading();
    }
  }
}

function searchImages(event) {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;
  runSearch(query);
}

searchForm.addEventListener("submit", searchImages);

// Original enhancement: quick-pick chips initiate real searches.
document.querySelectorAll(".chips [data-query]").forEach((chip) => {
  chip.addEventListener("click", () => {
    searchInput.value = chip.dataset.query;
    searchForm.requestSubmit();
  });
});

// Opening a shared link like ?q=forest runs that search straight away.
const sharedQuery = new URLSearchParams(window.location.search).get("q");
if (sharedQuery && sharedQuery.trim()) {
  searchInput.value = sharedQuery.trim();
  runSearch(sharedQuery, { scroll: false });
}
