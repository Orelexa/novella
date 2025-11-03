const LS_KEY = 'novella_entries_v1';

const storage = {
  async list() {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  },
  async add(entry) {
    const items = await this.list();
    items.unshift(entry);
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    return entry;
  },
  async remove(id) {
    const items = await this.list();
    const next = items.filter(e => e.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }
};

const $form = document.getElementById('entry-form');
const $list = document.getElementById('entries-list');
const $empty = document.getElementById('empty-state');

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined) node.setAttribute(k, v);
  });
  children.forEach(ch => {
    if (typeof ch === 'string') node.appendChild(document.createTextNode(ch));
    else if (ch) node.appendChild(ch);
  });
  return node;
}

async function render() {
  const items = await storage.list();
  $list.innerHTML = '';
  if (!items.length) {
    $empty.hidden = false;
    return;
  }
  $empty.hidden = true;
  for (const it of items) {
    const title = el('h3', { class: 'title' }, it.title);
    const badge = el('span', { class: 'badge' }, it.type);
    const meta = el('div', { class: 'meta' }, badge);
    const del = el('button', { class: 'delete-btn', title: 'Törlés', onClick: () => onDelete(it.id) });
    const head = el('div', { class: 'item' },
      el('div', {}, title, meta),
      del
    );
    const text = el('p', { class: 'content' }, it.content);
    const li = el('li', {}, head, text);
    li.className = 'item';
    $list.appendChild(li);
  }
}

async function onDelete(id) {
  await storage.remove(id);
  await render();
}

$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData($form);
  const title = (formData.get('title') || '').toString().trim();
  const type = (formData.get('type') || 'novella').toString();
  const content = (formData.get('content') || '').toString().trim();
  if (!title || !content) return;

  const entry = { id: uid(), title, type, content, createdAt: Date.now() };
  await storage.add(entry);
  $form.reset();
  await render();
});

render();