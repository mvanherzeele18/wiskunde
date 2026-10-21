(() => {
  const BOOKS = ["Goniometrie en Meetkunde", "Grafen", "Telproblemen", "Functies"];
  const config = window.WISKUNDE_CONFIG;
  const $ = id => document.getElementById(id);
  let client = null, session = null, chapters = [];
  function configured() {
    return config && config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
      !config.SUPABASE_URL.includes("JOUW-PROJECT") &&
      !config.SUPABASE_ANON_KEY.includes("JOUW-PUBLISHABLE");
  }
  function message(id, text, error=false) {
    const el = $(id); el.textContent = text; el.classList.toggle("error", error);
  }
  function safeName(value) { return /^[a-z0-9-]{1,70}$/.test(value); }
  function slugify(value) {
    return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
  }
  function metadata(chapter) {
    return `<!--\nbook: ${chapter.book}\ntitle: ${chapter.title.replace(/[\r\n]/g," ").trim()}\nsummary: ${chapter.summary.replace(/[\r\n]/g," ").trim()}\n-->\n\n${chapter.markdown.trim()}\n`;
  }
  async function loadChapters() {
    const {data,error}=await client.storage.from(config.BUCKET).list("",{limit:200,sortBy:{column:"name",order:"asc"}});
    if(error) throw error;
    const md=(data||[]).filter(f=>f.name.toLowerCase().endsWith(".md"));
    chapters=await Promise.all(md.map(async f=>{
      const {data:blob,error}=await client.storage.from(config.BUCKET).download(f.name);
      if(error) throw error;
      const raw=await blob.text();
      const match=raw.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
      const meta={}; if(match) match[1].split("\n").forEach(line=>{const i=line.indexOf(":");if(i>-1)meta[line.slice(0,i).trim().toLowerCase()]=line.slice(i+1).trim();});
      return {path:f.name,book:BOOKS.includes(meta.book)?meta.book:"Functies",title:meta.title||f.name.replace(/\.md$/,"").replace(/-/g," "),summary:meta.summary||"",markdown:match?raw.slice(match[0].length):raw};
    }));
    chapters.sort((a,b)=>a.book.localeCompare(b.book,"nl")||a.title.localeCompare(b.title,"nl"));
    renderList();
  }
  function renderList() {
    const host=$("admin-topic-list"); host.replaceChildren();
    if(!chapters.length){const p=document.createElement("p");p.className="muted";p.textContent="Nog geen hoofdstukken. Voeg links je eerste hoofdstuk toe.";host.append(p);return;}
    chapters.forEach(c=>{
      const row=document.createElement("div");row.className="admin-topic";
      const info=document.createElement("div");info.className="admin-topic-info";
      const title=document.createElement("strong");title.textContent=c.title;
      const sub=document.createElement("small");sub.textContent=`${c.book} · ${c.path}`;
      info.append(title,sub);
      const edit=document.createElement("button");edit.className="mini-button";edit.textContent="Wijzig";edit.addEventListener("click",()=>editChapter(c));
      const del=document.createElement("button");del.className="mini-button danger";del.textContent="Wis";del.addEventListener("click",()=>deleteChapter(c));
      row.append(info,edit,del);host.append(row);
    });
  }
  function editChapter(c) {
    $("original-path").value=c.path;$("book").value=c.book;$("chapter-title").value=c.title;
    $("chapter-summary").value=c.summary;$("slug").value=c.path.replace(/\.md$/i,"");$("markdown").value=c.markdown;
    $("form-title").textContent="Hoofdstuk wijzigen";$("save-button").innerHTML='Wijzigingen opslaan <span>→</span>';
    $("cancel-edit").hidden=false;message("save-message","");
    $("chapter-form").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function resetForm() {
    $("chapter-form").reset();$("original-path").value="";$("form-title").textContent="Nieuw hoofdstuk";
    $("save-button").innerHTML='Hoofdstuk opslaan <span>→</span>';$("cancel-edit").hidden=true;
  }
  async function deleteChapter(c) {
    if(!confirm(`Weet je zeker dat je “${c.title}” wilt verwijderen?`))return;
    const {error}=await client.storage.from(config.BUCKET).remove([c.path]);
    if(error){message("save-message","Verwijderen mislukt: "+error.message,true);return;}
    message("save-message","Hoofdstuk verwijderd.");await loadChapters();
    if($("original-path").value===c.path)resetForm();
  }
  async function handleSave(e) {
    e.preventDefault();message("save-message","");
    const book=$("book").value,title=$("chapter-title").value.trim(),summary=$("chapter-summary").value.trim();
    const slug=$("slug").value.trim(),markdown=$("markdown").value,oldPath=$("original-path").value;
    if(!safeName(slug)){message("save-message","Gebruik alleen kleine letters, cijfers en streepjes in de bestandsnaam.",true);return;}
    if(!title||!markdown.trim()){message("save-message","Vul minstens een titel en de leerstof in.",true);return;}
    const path=slug+".md";
    if(path!==oldPath&&chapters.some(c=>c.path===path)){message("save-message","Die bestandsnaam bestaat al. Kies een andere.",true);return;}
    const chapter={book,title,summary,markdown};
    $("save-button").disabled=true;
    try {
      if(oldPath&&oldPath!==path) {
        const {error:uploadError}=await client.storage.from(config.BUCKET).upload(path,new Blob([metadata(chapter)],{type:"text/markdown;charset=utf-8"}),{upsert:false,contentType:"text/markdown"});
        if(uploadError)throw uploadError;
        const {error:removeError}=await client.storage.from(config.BUCKET).remove([oldPath]);
        if(removeError)throw removeError;
      } else {
        const {error}=await client.storage.from(config.BUCKET).upload(path,new Blob([metadata(chapter)],{type:"text/markdown;charset=utf-8"}),{upsert:!!oldPath,contentType:"text/markdown"});
        if(error)throw error;
      }
      message("save-message","Opgeslagen! De leerstof is nu beschikbaar voor je klas.");
      resetForm();await loadChapters();
    } catch(err) {
      message("save-message","Opslaan mislukt: "+(err.message||"controleer de Supabase-regels."),true);
    } finally {$("save-button").disabled=false;}
  }
  async function init() {
    if(!configured()) {
      message("login-message","Stel eerst config.js in met de URL en publishable/anon key van je Supabase-project.",true);
      $("login-form").addEventListener("submit",e=>{e.preventDefault();message("login-message","Vul eerst config.js in.",true);});
      return;
    }
    client=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
    client.auth.onAuthStateChange((_event,newSession)=>{session=newSession;updateAuthView();});
    const {data}=await client.auth.getSession();session=data.session;updateAuthView();
    $("login-form").addEventListener("submit",async e=>{
      e.preventDefault();message("login-message","Bezig met inloggen…");
      const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
      if(error)message("login-message","Inloggen mislukt. Controleer je gegevens.",true);
    });
    $("logout-button").addEventListener("click",async()=>{await client.auth.signOut();});
    $("chapter-form").addEventListener("submit",handleSave);
    $("cancel-edit").addEventListener("click",resetForm);
    document.querySelectorAll("[data-insert]").forEach(button=>button.addEventListener("click",()=>insertAtCursor(button.dataset.insert)));
    document.querySelectorAll("[data-wrap]").forEach(button=>button.addEventListener("click",()=>wrapSelection(button.dataset.wrap)));
    $("markdown").addEventListener("input",renderPreview);
    $("chapter-title").addEventListener("input",renderPreview);
    $("chapter-summary").addEventListener("input",renderPreview);
    $("toggle-preview").addEventListener("click",()=>{const panel=$("markdown-preview"),show=panel.hidden;panel.hidden=!show;$("toggle-preview").textContent=show?"Voorbeeld verbergen":"Voorbeeld tonen";$("toggle-preview").setAttribute("aria-expanded",String(show));if(show)renderPreview();});
    $("upload-image").addEventListener("click",uploadImage);
    $("chapter-title").addEventListener("input",()=>{if(!$("original-path").value||$("slug").dataset.autofill==="true"){$("slug").value=slugify($("chapter-title").value);$("slug").dataset.autofill="true";}});
    $("slug").addEventListener("input",()=>{$("slug").dataset.autofill="false";});
  }
  function insertAtCursor(text) {
    const field=$("markdown"),start=field.selectionStart,end=field.selectionEnd;
    field.setRangeText(text,start,end,"end");field.focus();renderPreview();
  }
  function wrapSelection(wrapper) {
    const field=$("markdown"),start=field.selectionStart,end=field.selectionEnd;
    const selected=field.value.slice(start,end)||"tekst";
    field.setRangeText(wrapper+selected+wrapper,start,end,"select");field.focus();renderPreview();
  }
  function renderPreview() {
    const host=$("markdown-preview");if(!host||host.hidden)return;
    const source=$("markdown").value||"Schrijf links je leerstof om hier een voorbeeld te zien.";
    const html=window.marked?window.marked.parse(source):`<pre>${source.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`;
    host.innerHTML=window.DOMPurify?window.DOMPurify.sanitize(html,{USE_PROFILES:{html:true}}):html;
    host.querySelectorAll("img").forEach(img=>{img.loading="lazy";img.alt=img.alt||"Afbeelding bij de leerstof";});
  }
  async function uploadImage() {
    const file=$("image-file").files[0],alt=$("image-alt").value.trim();
    message("image-message","");
    if(!file){message("image-message","Kies eerst een afbeelding.",true);return;}
    if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){message("image-message","Gebruik een JPG-, PNG-, WebP- of GIF-afbeelding.",true);return;}
    if(file.size>8*1024*1024){message("image-message","Deze afbeelding is groter dan 8 MB. Verklein ze eerst.",true);return;}
    const button=$("upload-image");button.disabled=true;button.textContent="Uploaden…";
    try {
      const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"})[file.type];
      const clean=(file.name.replace(/\.[^.]+$/," ").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,45)||"afbeelding");
      const path=`afbeeldingen/${Date.now()}-${clean}.${ext}`;
      const {error}=await client.storage.from(config.BUCKET).upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
      if(error)throw error;
      const {data}=client.storage.from(config.BUCKET).getPublicUrl(path);
      const safeAlt=alt||file.name.replace(/\.[^.]+$/," ").trim()||"Afbeelding bij de leerstof";
      const markdown=`![${safeAlt.replace(/]/g,"\\]")}](${data.publicUrl})`;
      insertAtCursor(`\n\n${markdown}\n\n`);
      const preview=$("image-preview");preview.replaceChildren();const img=document.createElement("img");img.src=data.publicUrl;img.alt=safeAlt;const caption=document.createElement("p");caption.textContent="Geüpload. De Markdown-verwijzing is in je leerstof geplaatst.";preview.append(img,caption);preview.hidden=false;
      message("image-message","Afbeelding geüpload en ingevoegd.");$("image-file").value="";renderPreview();
    } catch(err) {message("image-message","Uploaden mislukt: "+(err.message||"controleer de Supabase Storage-regels."),true);}
    finally {button.disabled=false;button.textContent="Uploaden en invoegen";}
  }

  async function updateAuthView() {
    $("login-panel").hidden=!!session;$("editor-panel").hidden=!session;
    if(session){message("login-message","");try{await loadChapters();}catch(err){message("save-message","Le bestanden konden niet geladen worden. Controleer de Storage-regels.",true);}}
  }
  document.addEventListener("DOMContentLoaded",init);
})();
