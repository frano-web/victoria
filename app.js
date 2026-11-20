import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {SUPABASE_URL, SUPABASE_KEY} from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');
const TYPES = {trening:'Trening', zgrupowanie:'Zgrupowanie', wyscig:'Wyścig'};
const PLUR = {trening:'Treningi', zgrupowanie:'Zgrupowania', wyscig:'Wyścigi'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt = iso => new Date(iso).toLocaleString('pl-PL', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
const toInput = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const name = id => profiles[id]?.name || 'Ktoś';
const isCoach = () => me?.role === 'trener';

let me, profiles = {}, events = [], rsvps = [], msgs = [], players = [], kits = [], tab = 'events', filter = 'all', channel;

/* ---------- logowanie ---------- */
function authView(mode = 'in') {
  const up = mode === 'up';
  app.innerHTML = `<main class="auth"><h1>Moja drużyna</h1><form id="af">
    ${up ? '<input name="name" placeholder="Imię i nazwisko" required>' : ''}
    <input name="email" type="email" placeholder="E-mail" required>
    <input name="password" type="password" placeholder="Hasło (min. 6 znaków)" minlength="6" required>
    <button class="btn">${up ? 'Załóż konto' : 'Zaloguj się'}</button><p class="err" id="err"></p></form>
    <button class="link" id="sw">${up ? 'Mam już konto' : 'Nie mam konta'}</button></main>`;
  document.getElementById('sw').onclick = () => authView(up ? 'in' : 'up');
  document.getElementById('af').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), err = document.getElementById('err');
    const r = up ? await sb.auth.signUp({email:f.email, password:f.password, options:{data:{name:f.name}}})
                 : await sb.auth.signInWithPassword({email:f.email, password:f.password});
    if (r.error) err.textContent = r.error.message;
    else if (up && !r.data.session) err.textContent = 'Sprawdź skrzynkę e-mail i potwierdź konto.';
  };
}
sb.auth.onAuthStateChange((ev, s) => {
  if (ev === 'SIGNED_OUT' || !s) { channel?.unsubscribe(); authView(); }
  else if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') boot(s.user);
});

/* ---------- dane ---------- */
const loadProfiles = async () => { const {data} = await sb.from('profiles').select('*'); profiles = Object.fromEntries((data || []).map(p => [p.id, p])); };
const loadEvents = async () => { events = (await sb.from('events').select('*').order('start_at')).data || []; };
const loadRsvps = async () => { rsvps = (await sb.from('rsvps').select('*')).data || []; };
const loadPlayers = async () => { players = (await sb.from('event_players').select('*')).data || []; };
const loadKits = async () => { kits = (await sb.from('kits').select('*').order('created_at')).data || []; };
const inc = (e, u) => { const s = players.find(p => p.event_id === e.id && p.user_id === u)?.state; return e.type === 'trening' ? s !== 'out' : s === 'in'; };
const loadMsgs = async () => { msgs = ((await sb.from('messages').select('*').order('created_at', {ascending:false}).limit(200)).data || []).reverse(); };

async function boot(user) {
  await Promise.all([loadProfiles(), loadEvents(), loadRsvps(), loadMsgs(), loadPlayers(), loadKits()]);
  me = profiles[user.id];
  shell();
  channel?.unsubscribe();
  channel = sb.channel('live')
    .on('postgres_changes', {event:'*', schema:'public', table:'events'}, async p => {
      await loadEvents();
      if (p.eventType === 'INSERT') notify('Nowe: ' + p.new.title, dt(p.new.start_at));
      refresh();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'rsvps'}, async () => { await loadRsvps(); refresh(); })
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'messages'}, async p => {
      if (!profiles[p.new.user_id]) await loadProfiles();
      msgs.push(p.new);
      if (p.new.user_id !== me.id) notify(name(p.new.user_id), p.new.body);
      refresh();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'event_players'}, async p => {
      await Promise.all([loadPlayers(), loadEvents(), loadRsvps()]);
      if (p.eventType === 'INSERT' && p.new.user_id === me.id && p.new.state === 'in') {
        const e = events.find(x => x.id === p.new.event_id); if (e) notify('Jedziesz: ' + e.title, dt(e.start_at));
      }
      refresh();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'kits'}, async () => { await loadKits(); refresh(); })
    .subscribe();
}

/* ---------- powiadomienia (działają, gdy aplikacja jest otwarta w tle) ---------- */
function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, {body});
}

/* ---------- układ ---------- */
function shell() {
  app.innerHTML = `<main id="view"></main>
    <nav>${[['events','Wydarzenia'],['kits','Stroje'],['chat','Czat'],['me','Profil']].map(([k,n]) => `<button data-tab="${k}">${n}</button>`).join('')}</nav>
    ${isCoach() ? '<button class="fab" id="add" aria-label="Dodaj wydarzenie">+</button>' : ''}`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; show(); });
  const add = document.getElementById('add'); if (add) add.onclick = () => eventForm();
  show();
}
function show() {
  app.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const add = document.getElementById('add'); if (add) add.style.display = tab === 'events' ? '' : 'none';
  const v = document.getElementById('view');
  if (tab === 'events') { v.innerHTML = eventsHtml(); bindEvents(v); }
  else if (tab === 'kits') kitsView(v);
  else if (tab === 'chat') chatView(v);
  else profileView(v);
}
function refresh() {
  if (tab === 'events') show();
  else if (tab === 'kits') show();
  else if (tab === 'chat') paintMsgs();
}

/* ---------- wydarzenia ---------- */
const rs = e => rsvps.filter(r => r.event_id === e.id);
function card(e) {
  const mine = rs(e).find(r => r.user_id === me.id)?.status, yes = rs(e).filter(r => r.status === 'yes').length;
  return `<button class="ev ${e.type}" data-id="${e.id}"><div><b>${esc(e.title)}</b><span class="tag">${TYPES[e.type]}</span>
    <div class="m">${dt(e.start_at)}${e.type !== 'trening' ? ' – ' + dt(e.end_at) : ''}${e.place ? ' · ' + esc(e.place) : ''}${e.extra ? ' · ' + esc(e.extra) : ''}</div>
    <div class="ok">Zgłoszeni: ${yes}${mine ? ' · Ty: ' + (mine === 'yes' ? 'będę' : 'nie będzie mnie') : ''}</div></div></button>`;
}
function eventsHtml() {
  const now = new Date().toISOString(), l = events.filter(e => filter === 'all' || e.type === filter);
  const up = l.filter(e => e.end_at >= now), past = l.filter(e => e.end_at < now).reverse().slice(0, 10);
  return `<h1>Wydarzenia</h1><div class="chips">${[['all','Wszystko'], ...Object.entries(PLUR)].map(([k,n]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
    ${up.map(card).join('') || '<div class="empty">Brak nadchodzących wydarzeń.</div>'}
    ${past.length ? '<h2>Minione</h2>' + past.map(card).join('') : ''}`;
}
function bindEvents(v) {
  v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; show(); });
  v.querySelectorAll('[data-id]').forEach(b => b.onclick = () => eventDetail(b.dataset.id));
}
function dlg(html) {
  const d = document.createElement('dialog'); d.innerHTML = html; document.body.append(d); d.showModal();
  d.onclose = () => d.remove(); d.onclick = e => { if (e.target === d) d.close(); }; return d;
}
function eventDetail(id) {
  const e = events.find(x => x.id === id); if (!e) return;
  const st = u => rs(e).find(r => r.user_id === u)?.status, who = s => Object.values(profiles).filter(p => st(p.id) === s).map(p => `<div>${esc(p.name)}</div>`).join('') || '<div class="m">nikt</div>';
  const none = Object.values(profiles).filter(p => !st(p.id) && p.role === 'zawodnik' && inc(e, p.id)).map(p => `<div>${esc(p.name)}</div>`).join('') || '<div class="m">nikt</div>';
  const d = dlg(`<div class="${e.type}"><h1 style="padding:0">${esc(e.title)}</h1><span class="tag" style="margin:0">${TYPES[e.type]}</span></div>
    <p style="margin-top:10px">${dt(e.start_at)} – ${dt(e.end_at)}</p>${e.place ? `<p>📍 ${esc(e.place)}</p>` : ''}${e.extra ? `<p>${esc(e.extra)}</p>` : ''}${e.descr ? `<p class="m" style="margin-top:8px">${esc(e.descr)}</p>` : ''}
    <div class="acts">${['yes','no'].map(s => `<button class="btn g ${s} ${st(me.id) === s ? 'on' : ''}" data-s="${s}">${s === 'yes' ? 'Będę' : 'Nie będzie mnie'}</button>`).join('')}</div>
    <h2>Będą</h2><div class="list">${who('yes')}</div><h2>Nie będzie</h2><div class="list">${who('no')}</div>${isCoach() ? `<h2>Bez odpowiedzi</h2><div class="list">${none}</div>${roster(e)}` : ''}
    ${isCoach() ? '<div class="acts"><button class="btn g" id="ed">Edytuj</button><button class="btn d" id="rm">Usuń</button></div>' : ''}`);
  d.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
    const s = b.dataset.s;
    const r = st(me.id) === s ? await sb.from('rsvps').delete().match({event_id:id, user_id:me.id})
                              : await sb.from('rsvps').upsert({event_id:id, user_id:me.id, status:s});
    if (r.error) return alert(r.error.message);
    await loadRsvps(); d.close(); show(); eventDetail(id);
  });
  d.querySelectorAll('[data-pl]').forEach(c => c.onchange = async () => {
    const row = {event_id:id, user_id:c.dataset.pl}, mark = e.type === 'trening' ? !c.checked : c.checked;
    const r = mark ? await sb.from('event_players').upsert({...row, state: e.type === 'trening' ? 'out' : 'in'}) : await sb.from('event_players').delete().match(row);
    if (r.error) { c.checked = !c.checked; return alert(r.error.message); }
    await loadPlayers();
  });
  if (isCoach()) {
    d.querySelector('#ed').onclick = () => { d.close(); eventForm(e); };
    d.querySelector('#rm').onclick = async () => { if (!confirm('Usunąć to wydarzenie?')) return; const r = await sb.from('events').delete().eq('id', id); if (r.error) return alert(r.error.message); d.close(); await loadEvents(); show(); };
  }
}
const roster = e => `<h2>${e.type === 'trening' ? 'Trening dla (odznacz, aby ukryć przed kimś)' : 'Kto jedzie'}</h2>
  ${e.type === 'trening' ? '' : '<div class="hint">Zawodnik zobaczy to wydarzenie dopiero po zaznaczeniu.</div>'}
  <div class="list">${Object.values(profiles).filter(p => p.role === 'zawodnik').map(p => `<label class="chk"><input type="checkbox" data-pl="${p.id}" ${inc(e, p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('') || '<div class="m">Brak zawodników</div>'}</div>`;
function eventForm(e) {
  const v = e || {type:'trening', title:'', start_at:new Date(Date.now() + 864e5).toISOString(), end_at:new Date(Date.now() + 864e5 + 36e5).toISOString(), place:'', extra:'', descr:''};
  const d = dlg(`<h1 style="padding:0">${e ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</h1><form id="ef">
    <label>Rodzaj</label><select name="type">${Object.entries(TYPES).map(([k,n]) => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label>Nazwa</label><input name="title" required value="${esc(v.title)}">
    <div class="row"><div><label>Początek</label><input type="datetime-local" name="start_at" required value="${toInput(v.start_at)}"></div>
    <div><label>Koniec</label><input type="datetime-local" name="end_at" required value="${toInput(v.end_at)}"></div></div>
    <label>Miejsce</label><input name="place" value="${esc(v.place)}">
    <label id="xl">Kategoria / dystans</label><input name="extra" value="${esc(v.extra)}" placeholder="np. Elita 40 km">
    <label>Opis</label><textarea name="descr" rows="3">${esc(v.descr)}</textarea>
    <div class="acts"><button type="button" class="btn g" id="cx">Anuluj</button><button class="btn">Zapisz</button></div></form>`);
  const f = d.querySelector('#ef'), sync = () => { const w = f.type.value === 'wyscig'; d.querySelector('#xl').hidden = f.extra.hidden = !w; };
  f.type.onchange = sync; sync(); d.querySelector('#cx').onclick = () => d.close();
  f.onsubmit = async ev => {
    ev.preventDefault();
    const o = Object.fromEntries(new FormData(f));
    o.start_at = new Date(o.start_at).toISOString(); o.end_at = new Date(o.end_at).toISOString();
    if (o.end_at < o.start_at) return alert('Koniec nie może być przed początkiem.');
    if (o.type !== 'wyscig') o.extra = '';
    const r = e ? await sb.from('events').update(o).eq('id', e.id) : await sb.from('events').insert(o).select().single();
    if (r.error) return alert(r.error.message);
    d.close(); await loadEvents(); show();
    if (!e && o.type !== 'trening') eventDetail(r.data.id);
  };
}

/* ---------- czat ---------- */
function chatView(v) {
  v.innerHTML = `<h1>Czat drużyny</h1><div class="chat"><div id="msgs"></div>
    <form class="send" id="sf"><input name="body" placeholder="Napisz wiadomość…" autocomplete="off" maxlength="2000" required><button class="btn">Wyślij</button></form></div>`;
  paintMsgs(true);
  document.getElementById('sf').onsubmit = async e => {
    e.preventDefault(); const i = e.target.body, body = i.value.trim(); if (!body) return;
    i.value = ''; const r = await sb.from('messages').insert({body}); if (r.error) { i.value = body; alert(r.error.message); }
  };
}
function paintMsgs(force) {
  const el = document.getElementById('msgs'); if (!el) return;
  const bottom = force || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = msgs.map(m => `<div class="b ${m.user_id === me.id ? 'me' : ''}"><small>${esc(name(m.user_id))} · ${dt(m.created_at)}</small><p>${esc(m.body)}</p></div>`).join('') || '<div class="empty">Napisz pierwszą wiadomość.</div>';
  if (bottom) el.scrollTop = el.scrollHeight;
}

/* ---------- profil ---------- */
function profileView(v) {
  const perm = 'Notification' in window ? Notification.permission : 'denied';
  v.innerHTML = `<h1>Profil</h1><div class="pl"><div><b>${esc(me.name)}</b><div class="m">${me.role}</div></div><button class="btn g" id="lo">Wyloguj</button></div>
    ${perm !== 'granted' && perm !== 'denied' ? '<button class="btn" id="np" style="width:100%">Włącz powiadomienia</button>' : `<p class="m">Powiadomienia: ${perm === 'granted' ? 'włączone' : 'zablokowane w ustawieniach przeglądarki'}</p>`}
    ${isCoach() ? `<h2>Osoby w drużynie</h2>${Object.values(profiles).map(p => `<div class="pl"><span>${esc(p.name)}</span>
      <select data-u="${p.id}" ${p.id === me.id ? 'disabled' : ''}><option value="zawodnik" ${p.role === 'zawodnik' ? 'selected' : ''}>zawodnik</option><option value="trener" ${p.role === 'trener' ? 'selected' : ''}>trener</option></select></div>`).join('')}` : ''}`;
  document.getElementById('lo').onclick = () => sb.auth.signOut();
  const np = document.getElementById('np'); if (np) np.onclick = async () => { await Notification.requestPermission(); show(); };
  v.querySelectorAll('[data-u]').forEach(s => s.onchange = async () => {
    const r = await sb.rpc('set_role', {uid:s.dataset.u, r:s.value}); if (r.error) alert(r.error.message);
    await loadProfiles(); show();
  });
}

/* ---------- stroje ---------- */
const ITEMS = ['Kombinezon krótki', 'Kombinezon długi', 'Spodenki', 'Koszulka', 'Bluza', 'Kurtka'];
function kitsView(v) {
  const ppl = Object.values(profiles).filter(p => p.role === 'zawodnik').sort((a, b) => a.name.localeCompare(b.name, 'pl')), c = isCoach();
  v.innerHTML = `<h1>Stroje</h1>${c ? '' : '<p class="m" style="margin-bottom:10px">Tylko do wglądu.</p>'}` + (ppl.map(p => {
    const k = kits.filter(x => x.user_id === p.id);
    return `<div class="kit"><b>${esc(p.name)}</b>${k.map(x => `<div class="kr ${c ? 'c' : ''}" data-k="${x.id}"><span class="k ${x.given ? 'on' : ''}">${x.given ? '✓' : '○'}</span>
      <span>${esc(x.item)}${x.size ? ' · <b>' + esc(x.size) + '</b>' : ''}${x.note ? `<div class="m">${esc(x.note)}</div>` : ''}</span></div>`).join('') || '<div class="m">Brak przypisanych strojów</div>'}
      ${c ? `<button class="link" data-addk="${p.id}">+ Dodaj strój</button>` : ''}</div>`;
  }).join('') || '<div class="empty">Brak zawodników.</div>');
  if (!c) return;
  v.querySelectorAll('[data-k]').forEach(b => b.onclick = () => kitForm(null, kits.find(x => x.id === b.dataset.k)));
  v.querySelectorAll('[data-addk]').forEach(b => b.onclick = () => kitForm(b.dataset.addk));
}
function kitForm(uid, k) {
  const v = k || {item:'', size:'', note:'', given:true};
  const d = dlg(`<h1 style="padding:0">${k ? 'Edytuj strój' : 'Nowy strój'}</h1><p class="m">${esc(name(k ? k.user_id : uid))}</p><form id="kf">
    <label>Strój</label><input name="item" list="items" required value="${esc(v.item)}"><datalist id="items">${ITEMS.map(i => `<option value="${i}">`).join('')}</datalist>
    <label>Rozmiar</label><input name="size" value="${esc(v.size)}" placeholder="np. M / 164">
    <label>Notatka</label><input name="note" value="${esc(v.note)}" placeholder="np. do wymiany, zwrot po sezonie">
    <label class="chk"><input type="checkbox" name="given" ${v.given ? 'checked' : ''}> Wydany zawodnikowi</label>
    <div class="acts"><button type="button" class="btn g" id="cx">Anuluj</button>${k ? '<button type="button" class="btn d" id="rm">Usuń</button>' : ''}<button class="btn">Zapisz</button></div></form>`);
  const done = async r => { if (r.error) return alert(r.error.message); d.close(); await loadKits(); show(); };
  d.querySelector('#cx').onclick = () => d.close();
  if (k) d.querySelector('#rm').onclick = async () => { if (confirm('Usunąć ten wiersz?')) done(await sb.from('kits').delete().eq('id', k.id)); };
  d.querySelector('#kf').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target);
    const o = {item:f.get('item').trim(), size:f.get('size').trim(), note:f.get('note').trim(), given:f.has('given')};
    done(k ? await sb.from('kits').update(o).eq('id', k.id) : await sb.from('kits').insert({user_id:uid, ...o}));
  };
}
