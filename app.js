(() => {
  const BOOKS = ["Goniometrie en Meetkunde", "Grafen", "Telproblemen", "Functies"];
  const config = window.WISKUNDE_CONFIG;
  const $ = (id) => document.getElementById(id);
  const message = $("site-message");
  let client = null, chapters = [], activeBook = null;

  function say(text, error=false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }
  function configured() {
    return config && config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
      !config.SUPABASE_URL.includes("JOUW-PROJECT") &&
      !config.SUPABASE_ANON_KEY.includes("JOUW-PUBLISHABLE");
  }
  function safeSlug(path) {
    return path.replace(/\.md$/i, "").replace(/[^a-z0-9-]/g, "");
  }
  function titleFromSlug(slug) {
    return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  function parseMetadata(text, path) {
    const match = text.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
    let meta = {};
    if (match) {
      for (const line of match[1].split("\n")) {
        const ix = line.indexOf(":");
        if (ix > -1) meta[line.slice(0, ix).trim().toLowerCase()] = line.slice(ix+1).trim();
      }
      text = text.slice(match[0].length);
    }
    const book = BOOKS.includes(meta.book) ? meta.book : "Functies";
    const title = meta.title || titleFromSlug(safeSlug(path));
    return { path, book, title, summary: meta.summary || "", markdown: text };
  }
  async function loadChapters() {
    const { data, error } = await client.storage.from(config.BUCKET).list("", {
      limit: 200, sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    const mdFiles = (data || []).filter(x => x.name.toLowerCase().endsWith(".md"));
    const results = await Promise.all(mdFiles.map(async file => {
      const path = file.name;
      const { data: blob, error: downloadError } = await client.storage.from(config.BUCKET).download(path);
      if (downloadError) throw downloadError;
      return parseMetadata(await blob.text(), path);
    }));
    return results.sort((a,b) => a.book.localeCompare(b.book, "nl") || a.title.localeCompare(b.title, "nl"));
  }
  function renderCounts() {
    document.querySelectorAll(".book-card").forEach(card => {
      const book = card.dataset.book;
      const count = chapters.filter(c => c.book === book).length;
      card.querySelector(".count").textContent = `${count} ${count === 1 ? "hoofdstuk" : "hoofdstukken"}`;
    });
  }
  function showBook(book, filtered = null) {
    activeBook = book;
    $("reader").hidden = true;
    $("content-section").hidden = false;
    $("selected-title").textContent = book;
    $("selected-eyebrow").textContent = "LEERSTOF / " + String(BOOKS.indexOf(book)+1).padStart(2,"0");
    $("selected-desc").textContent = book === "Goniometrie en Meetkunde" ? "Hoeken, driehoeken en meetkundige verbanden." :
      book === "Grafen" ? "Verbindingen, routes en netwerken." :
      book === "Telproblemen" ? "Mogelijkheden systematisch tellen." : "Grafieken, formules en eigenschappen.";
    $("book-grid").hidden = true;
    $("topic-list").replaceChildren();
    const items = filtered || chapters.filter(c => c.book === book);
    $("empty-topics").hidden = items.length > 0;
    items.forEach((chapter, i) => {
      const btn = document.createElement("button");
      btn.className = "topic-row";
      const number = document.createElement("span"); number.className = "topic-number"; number.textContent = String(i+1).padStart(2,"0");
      const text = document.createElement("span"); text.className = "topic-text";
      const strong = document.createElement("strong"); strong.textContent = chapter.title;
      const small = document.createElement("small"); small.textContent = chapter.summary || "Open om de leerstof te bekijken.";
      text.append(strong, small);
      const arrow = document.createElement("span"); arrow.className = "topic-chevron"; arrow.textContent = "↗";
      btn.append(number, text, arrow);
      btn.addEventListener("click", () => openChapter(chapter));
      $("topic-list").append(btn);
    });
    say(`${chapters.length} hoofdstukken beschikbaar.`);
  }
  function openChapter(chapter) {
    $("content-section").hidden = true;
    $("reader").hidden = false;
    const html = window.marked ? marked.parse(chapter.markdown) : `<pre>${chapter.markdown}</pre>`;
    $("reader-content").innerHTML = window.DOMPurify ? DOMPurify.sanitize(html) : html;
    $("reader-content").scrollIntoView({behavior:"smooth", block:"start"});
  }
  function showSearchResults(query) {
    const q = query.trim().toLocaleLowerCase("nl");
    if (!q) {
      $("content-section").hidden = true;
      $("reader").hidden = true;
      $("book-grid").hidden = false;
      renderCounts();
      say(`${chapters.length} hoofdstukken beschikbaar.`);
      return;
    }
    const matches = chapters.filter(c => [c.title,c.summary,c.book,c.markdown].join(" ").toLocaleLowerCase("nl").includes(q));
    activeBook = null;
    $("reader").hidden = true;
    $("content-section").hidden = false;
    $("book-grid").hidden = true;
    $("selected-eyebrow").textContent = "ZOEKRESULTATEN";
    $("selected-title").textContent = `Resultaten voor “${query.trim()}”`;
    $("selected-desc").textContent = `${matches.length} gevonden`;
    $("topic-list").replaceChildren();
    $("empty-topics").hidden = matches.length > 0;
    matches.forEach((chapter,i) => {
      const btn = document.createElement("button"); btn.className = "topic-row";
      const n = document.createElement("span"); n.className="topic-number"; n.textContent=String(i+1).padStart(2,"0");
      const t = document.createElement("span"); t.className="topic-text";
      const s = document.createElement("strong"); s.textContent=chapter.title;
      const sm = document.createElement("small"); sm.textContent=`${chapter.book} · ${chapter.summary || "Open om te lezen"}`;
      t.append(s,sm); const a=document.createElement("span");a.className="topic-chevron";a.textContent="↗";
      btn.append(n,t,a);btn.addEventListener("click",()=>openChapter(chapter));$("topic-list").append(btn);
    });
    say(`${matches.length} zoekresultaten.`);
  }
  async function init() {
    if (!configured()) {
      say("De website is bijna klaar. Kopieer config.example.js naar config.js en vul je Supabase-gegevens in.", true);
      document.querySelectorAll(".book-card .count").forEach(x => x.textContent = "Nog instellen");
      return;
    }
    try {
      client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      chapters = await loadChapters();
      renderCounts();
      say(`${chapters.length} hoofdstukken beschikbaar.`);
    } catch (err) {
      say("De leerstof kon niet geladen worden. Controleer de Supabase-configuratie en Storage-regels.", true);
      console.error(err);
    }
    document.querySelectorAll(".book-card").forEach(card => card.addEventListener("click", () => showBook(card.dataset.book)));
    $("back-button").addEventListener("click", () => {
      $("content-section").hidden = true; $("book-grid").hidden = false; $("reader").hidden = true; $("search").value=""; renderCounts();
    });
    $("reader-back").addEventListener("click", () => {
      $("reader").hidden = true;
      if (activeBook) showBook(activeBook); else showSearchResults($("search").value);
    });
    $("search").addEventListener("input", e => showSearchResults(e.target.value));
  }
  document.addEventListener("DOMContentLoaded", init);
})();