// --- PocketBase SDK import (CDN-ről) ---
import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase@0.21.1/dist/pocketbase.es.mjs';

// --- PocketBase inicializálás ---
const pb = new PocketBase('http://192.168.1.122:8090');

// Automatikus token frissítés bekapcsolása
pb.autoCancellation(false);

// konzolhoz (diagnosztika)
window.pb = pb;

// állapotlog
console.log("PocketBase initialized:", pb.baseUrl);

// --- DOM elemek ---
const $form = document.getElementById('entry-form');
const $list = document.getElementById('entries-list');
const $empty = document.getElementById('empty-state');

// AI generátor elemek
const $aiForm = document.getElementById('ai-form');
const $aiResult = document.getElementById('ai-result');
const $aiOutput = document.getElementById('ai-output');
const $generateBtn = document.getElementById('generate-btn');
const $generateText = document.getElementById('generate-text');
const $generateLoading = document.getElementById('generate-loading');
const $saveGenerated = document.getElementById('save-generated');
const $discardGenerated = document.getElementById('discard-generated');

let generatedData = null; // Tárolja a generált szöveget

// --- Segédfüggvény DOM-hoz ---
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined) node.setAttribute(k, v);
  });
  children.forEach(ch => typeof ch === 'string'
    ? node.appendChild(document.createTextNode(ch))
    : ch && node.appendChild(ch));
  return node;
}

// --- PocketBase adattár ---
const COL = "entries";

const storage = {
  async list() {
    // Lekérjük az összes bejegyzést
    const records = await pb.collection(COL).getFullList({
      sort: '-created'
    });

    return records.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      content: r.content,
      createdAt: r.created
    }));
  },

  async add(entry) {
    const safeType = ['novella', 'vers'].includes(entry.type) ? entry.type : 'novella';

    const record = await pb.collection(COL).create({
      title: entry.title,
      type: safeType,
      content: entry.content
    });

    return {
      id: record.id,
      title: record.title,
      type: record.type,
      content: record.content,
      createdAt: record.created
    };
  },

  async remove(id) {
    await pb.collection(COL).delete(id);
  }
};

// --- Render ---
async function render() {
  const items = await storage.list();
  $list.innerHTML = '';
  if (!items.length) { $empty.hidden = false; return; }
  $empty.hidden = true;

  for (const it of items) {
    const li = el('li', { class: 'item' });

    const title = el('h3', { class: 'title' }, it.title);
    const badge = el('span', { class: 'badge' }, it.type);
    const meta = el('div', { class: 'meta' }, badge);

    const del = el('button', { class: 'delete-btn', title: 'Törlés' });
    del.addEventListener('click', (ev) => { ev.stopPropagation(); onDelete(it.id); });

    const head = el('div', { class: 'head' }, el('div', {}, title, meta), del);
    head.addEventListener('click', () => li.classList.toggle('expanded'));

    const text = el('p', { class: 'content' }, it.content);

    li.appendChild(head);
    li.appendChild(text);
    $list.appendChild(li);
  }
}

// --- Törlés ---
async function onDelete(id) {
  await storage.remove(id);
  await render();
}

// --- Form submit ---
$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData($form);
  const title = (fd.get('title') || '').toString().trim();
  const type  = (fd.get('type')  || 'novella').toString();
  const content = (fd.get('content') || '').toString().trim();
  if (!title || !content) return;

  await storage.add({ title, type, content });
  $form.reset();
  await render();
});

// --- AI Generálás ---
$aiForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fd = new FormData($aiForm);
  const title = fd.get('title').toString().trim();
  const type = fd.get('type').toString();
  const theme = fd.get('theme').toString().trim();
  const pages = parseInt(fd.get('pages')) || 2;

  if (!title || !theme) {
    alert('Kérlek töltsd ki az összes mezőt!');
    return;
  }

  // UI frissítés - loading állapot
  $generateBtn.disabled = true;
  $generateText.hidden = true;
  $generateLoading.hidden = false;
  $aiResult.hidden = true;

  try {
    // API hívás a PocketBase custom endpointhoz
    const response = await fetch(`${pb.baseUrl}/generate-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        type: type,
        theme: theme,
        pages: pages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Hiba történt a generálás során');
    }

    // Generált szöveg megjelenítése
    generatedData = {
      title: title,
      type: type,
      content: data.text
    };

    $aiOutput.textContent = data.text;
    $aiResult.hidden = false;

    // Scroll a generált szöveghez
    $aiResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (error) {
    console.error('Generálási hiba:', error);
    alert(`Hiba történt: ${error.message}`);
  } finally {
    // UI visszaállítás
    $generateBtn.disabled = false;
    $generateText.hidden = false;
    $generateLoading.hidden = true;
  }
});

// Generált szöveg mentése
$saveGenerated.addEventListener('click', async () => {
  if (!generatedData) return;

  try {
    await storage.add(generatedData);

    // Sikeres mentés után
    alert('Sikeresen elmentve a gyűjteménybe!');

    // Form reset és eredmény elrejtése
    $aiForm.reset();
    $aiResult.hidden = true;
    generatedData = null;

    // Lista frissítése
    await render();

    // Scroll a listához
    document.getElementById('entries-list').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Mentési hiba:', error);
    alert('Hiba történt a mentés során!');
  }
});

// Generált szöveg elvetése
$discardGenerated.addEventListener('click', () => {
  if (confirm('Biztosan elveted a generált szöveget?')) {
    $aiForm.reset();
    $aiResult.hidden = true;
    generatedData = null;
  }
});

// --- Indítás ---
await render();
