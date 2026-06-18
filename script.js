/**
 * PaletteBlend — script.js
 * Firebase Firestore + ImgBB
 * Keys are split/obfuscated to avoid plaintext exposure in source
 */

// ── Obfuscated credentials ──────────────────────────────────────────────────
// Keys are split into chunks and reassembled at runtime to avoid
// plaintext secrets being instantly visible in source view.
const _k = (p) => p.join('');

const _fbCfg = () => ({
    apiKey:            _k(['AIzaSyBQrlu9','-wS9uHoHP','UIJ19nWJDd','dDFRFpgo']),
    authDomain:        _k(['paletteblend','-96304.fire','baseapp.com']),
    projectId:         _k(['palette','blend','-96304']),
    storageBucket:     _k(['paletteblend-96304','.firebasestorage','.app']),
    messagingSenderId: _k(['772','447','621','076']),
    appId:             _k(['1:772447621076:web',':9a5ee219d07c63','127c1041']),
    measurementId:     _k(['G-K53','MCG','EY4F'])
});

const _imgKey = () => _k(['902a1a0f','07cd8874','f08fdb53','84ce6e9b']);

// ── Constants ───────────────────────────────────────────────────────────────
const DISCORD        = 'https://discord.gg/dfWsz2rrPP';
const ADMIN_PASS     = _k(['Adm','in1','23']);
const LOGO_CLICKS    = 5;
const LOGO_TIMEOUT   = 2000;
const OWN_KEY        = 'pb_own';
const ADMIN_KEY      = 'pb_adm';

// ── Firebase init ────────────────────────────────────────────────────────────
firebase.initializeApp(_fbCfg());
const db          = firebase.firestore();
const postsCol    = db.collection('showcase_posts');
const reviewsCol  = db.collection('reviews');

// ── State ────────────────────────────────────────────────────────────────────
let userIP    = null;
let isAdmin   = localStorage.getItem(ADMIN_KEY) === '1';
let logoN     = 0;
let logoT     = null;
let busy      = false;
let starVal   = 5;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Utility ──────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
    const el = $('toast'); const span = $('toastMsg');
    span.textContent = msg;
    el.className = 'toast show ' + type;
    setTimeout(() => el.classList.remove('show'), 3000);
}

function timeAgo(ts) {
    if (!ts) return 'Just now';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = (Date.now() - d) / 1000;
    if (s < 60)  return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function stars(n) { return Array.from({length:5},(_,i) => i < n ? '★' : '☆').join(''); }
function trunc(t, n=150) { return t.length <= n ? t : t.slice(0, n-3) + '…'; }

const BAD = ['fuck','shit','bitch','bastard','asshole','nigger','nigga','motherfucker'];
function dirty(t) { return BAD.some(w => new RegExp('\\b'+w+'\\b','i').test(t||'')); }

// ── Own-post tracking ─────────────────────────────────────────────────────────
function getOwn()    { try { return JSON.parse(localStorage.getItem(OWN_KEY)||'[]'); } catch { return []; } }
function addOwn(id)  { const a=getOwn(); a.push(id); localStorage.setItem(OWN_KEY, JSON.stringify(a)); }
function dropOwn(id) { localStorage.setItem(OWN_KEY, JSON.stringify(getOwn().filter(x=>x!==id))); }

// ── Tab system ────────────────────────────────────────────────────────────────
function switchTab(name) {
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    const tc = $(name+'-tab'); if (tc) tc.classList.add('active');
    document.querySelector(`.nav-tabs .tab-btn[data-tab="${name}"]`)?.classList.add('active');
    document.querySelector(`.mobile-tab-btn[data-tab="${name}"]`)?.classList.add('active');
    history.replaceState(null, null, '#'+name);
    setTimeout(() => $$('.tab-content.active .reveal').forEach(e => obs.observe(e)), 80);
}

$$('.nav-tabs .tab-btn').forEach(b => b.addEventListener('click', e => { e.preventDefault(); switchTab(b.dataset.tab); }));
$$('.mobile-tab-btn').forEach(b => b.addEventListener('click', e => { e.preventDefault(); switchTab(b.dataset.tab); closeMobile(); }));
$$('[data-tab-link]').forEach(l => l.addEventListener('click', e => { e.preventDefault(); switchTab(l.dataset.tabLink); }));

const urlHash = location.hash.slice(1);
if (urlHash && $(urlHash+'-tab')) switchTab(urlHash);

// ── Reveal observer ────────────────────────────────────────────────────────────
const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
}, { threshold: 0.08, rootMargin: '-40px' });
function initReveal() { $$('.reveal').forEach(e => obs.observe(e)); }

// ── Mobile menu ────────────────────────────────────────────────────────────────
const mBtn    = document.querySelector('.mobile-menu-btn');
const mMenu   = document.querySelector('.mobile-menu');
const mClose  = document.querySelector('.mobile-close');

function openMobile()  { mBtn?.setAttribute('aria-expanded','true');  mMenu?.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeMobile() { mBtn?.setAttribute('aria-expanded','false'); mMenu?.setAttribute('aria-hidden','true');  document.body.style.overflow=''; }

mBtn?.addEventListener('click', openMobile);
mClose?.addEventListener('click', closeMobile);
mMenu?.addEventListener('click', e => { if (e.target===mMenu) closeMobile(); });
window.addEventListener('resize', () => { if (innerWidth>=800) closeMobile(); });
document.addEventListener('keydown', e => {
    if (e.key==='Escape') {
        if (mMenu?.getAttribute('aria-hidden')==='false') closeMobile();
        if (document.querySelector('.lightbox.open')) closeLightbox();
        if (document.querySelector('.modal-overlay.open')) cancelAdmin();
    }
});

// ── Copy invite ────────────────────────────────────────────────────────────────
['copyDiscord','copyDiscord2'].forEach(id => {
    const b = $(id); if (!b) return;
    b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(DISCORD); const old=b.innerHTML; b.innerHTML='<i class="fas fa-check"></i> Copied!'; setTimeout(()=>b.innerHTML=old,1400); }
        catch { prompt('Copy:', DISCORD); }
    });
});

const yr = $('year'); if (yr) yr.textContent = new Date().getFullYear();

// ── IP fetch ───────────────────────────────────────────────────────────────────
async function fetchIP() {
    try { const r=await fetch('https://api.ipify.org?format=json'); userIP=(await r.json()).ip; }
    catch { userIP='u_'+Date.now(); }
    return userIP;
}

// ── ImgBB upload ───────────────────────────────────────────────────────────────
async function imgBBUpload(file) {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch(`https://api.imgbb.com/1/upload?key=${_imgKey()}`, { method:'POST', body:fd });
    const d = await r.json();
    if (d.success) return d.data.url;
    throw new Error('ImgBB error');
}

// ── Firebase: Showcase ─────────────────────────────────────────────────────────
async function getPosts() {
    try { const s=await postsCol.orderBy('timestamp','desc').get(); return s.docs.map(d=>({id:d.id,...d.data()})); }
    catch { toast('Could not load posts','err'); return []; }
}
async function createPost(url, msg, ip) {
    return (await postsCol.add({ imageUrl:url, message:trunc(msg), ip, timestamp:firebase.firestore.FieldValue.serverTimestamp() })).id;
}
async function removePost(id) { await postsCol.doc(id).delete(); }

// ── Firebase: Reviews ──────────────────────────────────────────────────────────
async function getReviews() {
    try { const s=await reviewsCol.orderBy('created_at','desc').get(); return s.docs.map(d=>({id:d.id,...d.data()})); }
    catch { return []; }
}
async function createReview(name, rating, comment) {
    return (await reviewsCol.add({ name, rating, comment, ip:userIP, created_at:firebase.firestore.FieldValue.serverTimestamp() })).id;
}
async function removeReview(id) { await reviewsCol.doc(id).delete(); }

// ── Render: Portfolio ──────────────────────────────────────────────────────────
function renderPortfolio() {
    const grid = $('portfolioGrid'); if (!grid) return;
    const items = [
        { img:'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=800', t:'Neon Gaming Hub', c:'Server Design' },
        { img:'https://images.pexels.com/photos/2115217/pexels-photo-2115217.jpeg?auto=compress&cs=tinysrgb&w=800', t:'Crystal Community', c:'Visual Identity' },
        { img:'https://images.pexels.com/photos/2619074/pexels-photo-2619074.jpeg?auto=compress&cs=tinysrgb&w=800', t:'Aurora Gaming', c:'Bot Integration' },
        { img:'https://images.pexels.com/photos/235985/pexels-photo-235985.jpeg?auto=compress&cs=tinysrgb&w=800', t:'Nexus Network', c:'Full Setup' },
        { img:'https://images.pexels.com/photos/3160998/pexels-photo-3160998.jpeg?auto=compress&cs=tinysrgb&w=800', t:'Stellar Server', c:'Role Architecture' },
        { img:'https://images.pexels.com/photos/1547892/pexels-photo-1547892.jpeg?auto=compress&cs=tinysrgb&w=800', t:'Quantum Gaming', c:'Channel Design' }
    ];
    grid.innerHTML = items.map(i=>`
        <div class="portfolio-item reveal" onclick="openLightbox('${i.img}')">
            <img src="${i.img}" alt="${i.t}" loading="lazy">
            <div class="portfolio-overlay"><div><div class="p-title">${i.t}</div><div class="p-cat">${i.c}</div></div></div>
        </div>`).join('');
    grid.querySelectorAll('.reveal').forEach(e => obs.observe(e));
}

// ── Render: Showcase ───────────────────────────────────────────────────────────
function renderShowcase(posts) {
    const grid=$('showcaseGrid'), load=$('loadingState'), empty=$('emptyState');
    load.style.display='none';
    if (!posts.length) { grid.style.display='none'; empty.style.display='block'; return; }
    empty.style.display='none'; grid.style.display='grid';
    const own = getOwn();
    grid.innerHTML = posts.map(p => {
        // Admin can delete ALL posts; user can delete their own
        const canDel = isAdmin || (userIP && p.ip===userIP) || own.includes(p.id);
        return `<div class="showcase-item reveal" data-id="${p.id}">
            <div class="showcase-thumb" onclick="openLightbox('${p.imageUrl}')">
                <img src="${p.imageUrl}" alt="Project" loading="lazy">
            </div>
            <div class="showcase-body">
                <div style="flex:1;min-width:0">
                    <p class="showcase-msg">${esc(p.message)}</p>
                    <span class="showcase-time">${timeAgo(p.timestamp)}</span>
                </div>
                <div class="showcase-del${canDel?' show':''}">
                    <button class="btn btn-del" onclick="doDeletePost('${p.id}')"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    grid.querySelectorAll('.reveal').forEach(e => obs.observe(e));
}

// ── Render: Reviews ────────────────────────────────────────────────────────────
async function renderReviews() {
    const list = $('reviews-list'); if (!list) return;
    const revs = await getReviews();
    if (!revs.length) {
        list.innerHTML = '<p style="color:var(--muted);margin-top:14px;">No reviews yet — be the first!</p>';
        return;
    }
    const own = getOwn();
    list.innerHTML = revs.map(r => {
        // Admin can delete ALL reviews; user can delete their own
        const canDel = isAdmin || (userIP && r.ip===userIP) || own.includes(r.id);
        const d = r.created_at ? (r.created_at.toDate ? r.created_at.toDate() : new Date(r.created_at)) : new Date();
        return `<article class="review-card">
            <div class="review-meta">
                <span class="review-name">${esc(r.name||'Anonymous')}</span>
                <span class="review-date">${d.toLocaleDateString()}</span>
            </div>
            <div class="review-stars">${stars(r.rating||0)}</div>
            <div class="review-body">${esc(r.comment||'')}</div>
            ${canDel ? `<button class="review-del-btn" onclick="doDeleteReview('${r.id}')"><i class="fas fa-trash-alt"></i></button>` : ''}
        </article>`;
    }).join('');
}

// ── Load showcase ──────────────────────────────────────────────────────────────
async function loadShowcase() {
    if (busy) return; busy=true;
    $('loadingState').style.display='flex';
    $('showcaseGrid').style.display='none';
    $('emptyState').style.display='none';
    if (!userIP) await fetchIP();
    const posts = await getPosts();
    renderShowcase(posts); busy=false;
}

// ── Delete handlers ────────────────────────────────────────────────────────────
async function doDeletePost(id) {
    if (!confirm('Delete this post?')) return;
    try {
        await removePost(id);
        dropOwn(id);
        toast('Post deleted');
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) { el.style.opacity='0'; el.style.transform='scale(.9)'; setTimeout(()=>el.remove(),280); }
        if (!$('showcaseGrid').children.length) { $('emptyState').style.display='block'; $('showcaseGrid').style.display='none'; }
    } catch { toast('Could not delete','err'); }
}

async function doDeleteReview(id) {
    if (!confirm('Delete this review?')) return;
    try { await removeReview(id); dropOwn(id); toast('Review deleted'); await renderReviews(); }
    catch { toast('Could not delete','err'); }
}

// ── Upload form ────────────────────────────────────────────────────────────────
async function handleUpload(e) {
    e.preventDefault();
    const file = $('imageInput').files[0];
    const msg  = $('messageInput').value.trim();
    if (!file) { toast('Select an image','err'); return; }
    if (!msg)  { toast('Add a description','err'); return; }

    const btn = $('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:15px;height:15px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div>Uploading...';

    try {
        const ip  = await fetchIP();
        const url = await imgBBUpload(file);
        const pid = await createPost(url, msg, ip);
        addOwn(pid);

        $('uploadForm').reset();
        resetPreview();
        $('charCount').textContent = '0';
        toast('Project shared!');
        await loadShowcase();
    } catch { toast('Upload failed','err'); }
    finally { btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Share Project'; }
}

// ── Image preview ──────────────────────────────────────────────────────────────
function showPreview(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
        $('imgPreview').src = ev.target.result;
        $('dropPlaceholder').style.display = 'none';
        $('imgPreviewWrap').style.display  = 'block';
    };
    reader.readAsDataURL(file);
}

function resetPreview() {
    $('imgPreview').src = '';
    $('dropPlaceholder').style.display = '';
    $('imgPreviewWrap').style.display  = 'none';
    $('imageInput').value = '';
    const lbl = document.getElementById('fileLabel');
    if (lbl) lbl.textContent = 'Click or drag an image here';
}

// ── Lightbox ───────────────────────────────────────────────────────────────────
function openLightbox(src) { $('lightboxImg').src=src; $('lightbox').classList.add('open'); }
function closeLightbox()   { $('lightbox').classList.remove('open'); }

// ── Star rating ────────────────────────────────────────────────────────────────
function initStars() {
    const row = $('starRating'); if (!row) return;
    const btns = row.querySelectorAll('.star');
    function mark(n) { btns.forEach(b => b.classList.toggle('sel', +b.dataset.value<=n)); }
    btns.forEach(b => {
        const v = +b.dataset.value;
        b.addEventListener('mouseenter', () => mark(v));
        b.addEventListener('mouseleave', () => mark(starVal));
        b.addEventListener('click', () => { starVal=v; mark(v); });
    });
    mark(starVal);
}

// ── Review form ────────────────────────────────────────────────────────────────
async function handleReview(e) {
    e.preventDefault();
    const name    = ($('review-name')?.value||'Anonymous').trim();
    const comment = ($('review-text')?.value||'').trim();
    const errEl   = $('reviewErr');

    if (!comment) { toast('Write a review','err'); return; }
    if (dirty(name)||dirty(comment)) { if(errEl) errEl.textContent='Inappropriate language detected.'; return; }
    if (errEl) errEl.textContent='';

    try {
        await fetchIP();
        const rid = await createReview(name, starVal, comment);
        addOwn(rid);
        $('review-name').value=''; $('review-text').value='';
        starVal=5; initStars();
        toast('Review submitted!');
        await renderReviews();
    } catch { toast('Submit failed','err'); }
}

// ── Admin system ───────────────────────────────────────────────────────────────
function logoClick() {
    logoN++;
    if (logoT) clearTimeout(logoT);
    logoT = setTimeout(() => logoN=0, LOGO_TIMEOUT);
    if (logoN >= LOGO_CLICKS) {
        logoN=0; clearTimeout(logoT);
        if (isAdmin) {
            isAdmin=false; localStorage.removeItem(ADMIN_KEY);
            toast('Admin disabled'); loadShowcase(); renderReviews(); return;
        }
        const modal = $('adminModal'); modal.classList.add('open'); $('adminPassword').value=''; $('adminPassword').focus();
    }
}

function confirmAdmin() {
    const pw = $('adminPassword').value;
    if (pw === ADMIN_PASS) {
        isAdmin=true; localStorage.setItem(ADMIN_KEY,'1');
        $('adminModal').classList.remove('open');
        toast('Admin enabled'); loadShowcase(); renderReviews();
    } else { toast('Wrong password','err'); $('adminPassword').value=''; $('adminPassword').focus(); }
}

function cancelAdmin() { $('adminModal').classList.remove('open'); $('adminPassword').value=''; }

// ── Init ───────────────────────────────────────────────────────────────────────
function init() {
    renderPortfolio();
    loadShowcase();
    renderReviews();
    initReveal();
    initStars();

    $('logo')?.addEventListener('click', e => { e.preventDefault(); logoClick(); });

    $('uploadForm')?.addEventListener('submit', handleUpload);

    $('imageInput')?.addEventListener('change', e => { if (e.target.files[0]) showPreview(e.target.files[0]); });
    $('removePreview')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); resetPreview(); });

    $('messageInput')?.addEventListener('input', e => { $('charCount').textContent = e.target.value.length; });

    // Drag & drop
    const dz = $('dropZone');
    if (dz) {
        ['dragenter','dragover','dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
        ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, () => dz.classList.add('over')));
        ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('over')));
        dz.addEventListener('drop', e => {
            const f = e.dataTransfer.files;
            if (f.length && f[0].type.startsWith('image/')) { $('imageInput').files=f; showPreview(f[0]); }
        });
    }

    $('confirmAdmin')?.addEventListener('click', confirmAdmin);
    $('cancelAdmin')?.addEventListener('click', cancelAdmin);
    $('adminPassword')?.addEventListener('keypress', e => { if(e.key==='Enter') confirmAdmin(); });
    $('adminModal')?.addEventListener('click', e => { if(e.target===$('adminModal')) cancelAdmin(); });

    $('lightboxClose')?.addEventListener('click', closeLightbox);
    $('lightbox')?.addEventListener('click', e => { if(e.target===$('lightbox')) closeLightbox(); });

    $('review-form')?.addEventListener('submit', handleReview);
}

// Globals for inline onclick handlers
window.openLightbox    = openLightbox;
window.doDeletePost    = doDeletePost;
window.doDeleteReview  = doDeleteReview;

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
