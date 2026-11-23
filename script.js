// Grainframe Part 2 — key-free, CORS-enabled Wikimedia Commons image search.
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const results = document.getElementById("results");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");

let activeRequest = null;

function renderImages(pages, query) {
  // Clear any previous search before rendering the new result set.
  results.innerHTML = "";

  const images = pages
    .filter((page) => {
      const info = page.imageinfo?.[0];
      return info?.url && info?.mime?.startsWith("image/") && !info.mime.includes("svg");
    })
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  images.forEach((page) => {
    const info = page.imageinfo[0];
    const card = document.createElement("article");
    card.className = "image-card";

    const link = document.createElement("a");
    link.className = "image-link";
    link.href = info.descriptionurl || info.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "View " + page.title.replace(/^File:/i, ""));

    const image = document.createElement("img");
    image.src = info.thumburl || info.url;
    image.alt = page.title.replace(/^File:/i, "").replace(/_/g, " ");
    image.loading = "lazy";
    image.decoding = "async";
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

  resultCount.textContent = images.length + " IMAGES · " + query.toUpperCase();
  emptyState.hidden = images.length > 0;
  if (images.length === 0) {
    emptyState.querySelector("h3").textContent = "No images found.";
    emptyState.querySelector("p").textContent =
      'Nothing matched "' + query + '". Try another topic.';
  }
}

async function searchImages(event) {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  // A later search always takes precedence over an older slow request.
  if (activeRequest) activeRequest.abort();
  const controller = new AbortController();
  activeRequest = controller;

  const url =
    "https://commons.wikimedia.org/w/api.php" +
    "?action=query&generator=search&gsrnamespace=6&gsrlimit=20" +
    "&gsrsearch=" + encodeURIComponent(query) +
    "&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=520" +
    "&format=json&origin=*";

  searchButton.disabled = true;
  results.innerHTML = "";
  emptyState.hidden = true;
  resultCount.textContent = "SEARCHING · " + query.toUpperCase();

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Image search returned HTTP " + response.status);

    const data = await response.json();
    if (data.error) throw new Error(data.error.info || "Wikimedia Commons API error");

    const pages = Object.values(data.query?.pages || {});
    renderImages(pages, query);
  } catch (error) {
    if (error.name === "AbortError") return;
    results.innerHTML = "";
    resultCount.textContent = "SEARCH UNAVAILABLE";
    emptyState.hidden = false;
    emptyState.querySelector("h3").textContent = "Search could not finish.";
    emptyState.querySelector("p").textContent =
      "Please check your connection and try searching again.";
    console.error("Grainframe image search failed:", error);
  } finally {
    if (activeRequest === controller) {
      activeRequest = null;
      searchButton.disabled = false;
    }
  }
}

searchForm.addEventListener("submit", searchImages);

// Original enhancement: quick-pick chips initiate real searches.
document.querySelectorAll(".chips [data-query]").forEach((chip) => {
  chip.addEventListener("click", () => {
    searchInput.value = chip.dataset.query;
    searchForm.requestSubmit();
  });
});
