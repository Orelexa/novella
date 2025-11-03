// --- Firebase importok (v11, moduláris API) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDocs, deleteDoc,
  query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// --- A TE projekted konfigurációja ---
const firebaseConfig = {
  apiKey: "AIzaSyAbgXMPfEIxciIdCVVKCrltBdU-fJuBOt4",
  authDomain: "novella-b7894.firebaseapp.com",
  projectId: "novella-b7894",
  storageBucket: "novella-b7894.appspot.com",
  messagingSenderId: "883815996721",
  appId: "1:883815996721:web:98fc58a858672fbe94a410"
};

// --- Inicializálás (EGYSZER) ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// konzolhoz (diagnosztika / migráció)
window.auth = auth;
window.db = db;

// állapotlog
onAuthStateChanged(auth, (user) => {
  console.log("Auth user:", user ? user.uid : null);
});

// --- Gyors bejelentkezés prompttal (fejlesztéshez) ---
async function ensureLogin() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) return resolve(user);

      const email = window.prompt("Bejelentkezés e-maillel (fejlesztéshez):");
      if (!email) return reject(new Error("Nincs e-mail"));

      while (true) {
        const password = window.prompt("Jelszó (min. 6 karakter):");
        if (!password) return reject(new Error("Nincs jelszó"));
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          return resolve(cred.user);
        } catch (e) {
          if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") {
            const again = window.confirm("Hibás jelszó ehhez az e-mailhez. Próbálsz másikat?");
            if (again) continue;
            return reject(e);
          }
          if (e.code === "auth/user-not-found") {
            const create = window.confirm("Nincs ilyen felhasználó. Létrehozzuk most?");
            if (!create) return reject(e);
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            return resolve(cred.user);
          }
          return reject(e);
        }
      }
    });
  });
}

// --- DOM elemek ---
const $form = document.getElementById('entry-form');
const $list = document.getElementById('entries-list');
const $empty = document.getElementById('empty-state');

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

// --- Firestore adattár (Rules szerint uid-et írunk, és sajátokat listázunk) ---
const COL = "entries";

const storage = {
  async list() {
    const user = await ensureLogin();
    const q = query(
      collection(db, COL),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async add(entry) {
    const user = await ensureLogin();
    const safeType = ['novella', 'vers'].includes(entry.type) ? entry.type : 'novella';
    const ref = await addDoc(collection(db, COL), {
      title: entry.title,
      type: safeType,
      content: entry.content,
      createdAt: serverTimestamp(),
      uid: user.uid
    });
    return { id: ref.id, ...entry, type: safeType, uid: user.uid };
  },

  async remove(id) {
    await deleteDoc(doc(db, COL, id));
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

// --- Indítás ---
await ensureLogin();
await render();

// (opcionális) kijelentkezés konzolból:
// window.logout = () => signOut(auth);
