import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import {
getFirestore, collection, addDoc, deleteDoc, doc,
query, orderBy, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAbgXMPfEIxciIdCVVKCrltBdU-fJuBOt4",
  authDomain: "novella-b7894.firebaseapp.com",
  projectId: "novella-b7894",
  storageBucket: "novella-b7894.firebasestorage.app",
  messagingSenderId: "883815996721",
  appId: "1:883815996721:web:98fc58a858672fbe94a410"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const entriesCol = collection(db, 'entries');

const storage = {
async list() {
const q = query(entriesCol, orderBy('createdAt', 'desc'));
const snap = await getDocs(q);
return snap.docs.map(d => ({ id: d.id, ...d.data() }));
},
async add(entry) {
const ref = await addDoc(entriesCol, {
title: entry.title,
type: entry.type,
content: entry.content,
createdAt: serverTimestamp()
});
return { id: ref.id, ...entry };
},
async remove(id) {
await deleteDoc(doc(db, 'entries', id));
}
};

const $form = document.getElementById('entry-form');
const $list = document.getElementById('entries-list');
const $empty = document.getElementById('empty-state');

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

async function render() {
const items = await storage.list();
$list.innerHTML = '';
if (!items.length) { $empty.hidden = false; return; }
$empty.hidden = true;

for (const it of items) {
const title = el('h3', { class: 'title' }, it.title);
const badge = el('span', { class: 'badge' }, it.type);
const meta = el('div', { class: 'meta' }, badge);
const del = el('button', { class: 'delete-btn', title: 'Törlés', onClick: () => onDelete(it.id) });
const head = el('div', { class: 'item' }, el('div', {}, title, meta), del);
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

await storage.add({ title, type, content });
$form.reset();
await render();
});

render();