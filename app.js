/* Jedi Order Mission Terminal
 * Front-end: static HTML/CSS/JS + Supabase.
 * The app intentionally falls back to a local demo mode until Supabase is configured.
 */
(() => {
  'use strict';

  const CFG = window.MISSION_BOARD_CONFIG || {};
  const LIVE = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const db = LIVE ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

  const WARFRONT_TYPES = ['Assault','Defense','Recon','Sabotage','Intelligence','Supply','Aid','Escort','Search & Rescue','Elimination','Special Operations'];
  const JEDI_TYPES = ['Artifact Recovery','Diplomacy','Research','Recon','Temple Operations','Support','Investigation','Exploration','Judicial','Special Operations'];
  const THREATS = ['LOW','MODERATE','HIGH','CRITICAL'];
  const STATUS = ['OPEN','IN_PROGRESS','COMPLETED','CANCELLED'];

  const demoUser = {
    id: 'demo-user', discord_user: 'Jedi_Commander', roblox_user: 'JediCommander', character_name: 'Jedi Knight Tatsu',
    rank: 'Jedi Knight', pathway: 'Guardian', class: 'Battlemaster', role: 'owner'
  };

  const demoMissions = [
    {id:'m1', code:'JO-071', name:'Operation Silent Meridian', main_category:'JEDI', type:'Investigation', threat_level:'CRITICAL', required_personnel:8, location:'Balmorra — Sobrik Sector', jedi_lead:'Master Kael Varyn', date:'2026-09-17T19:00:00', briefing:'Intelligence reports indicate that a Sith-aligned cell has infiltrated a Republic industrial district. Jedi personnel are to identify the cell, recover any captured Republic intelligence, and prevent the extraction of sensitive assets. Maintain discretion until the scope of the threat is confirmed.', status:'OPEN', result_summary:''},
    {id:'m2', code:'JO-068', name:'Operation Ashen Gate', main_category:'WARFRONT', type:'Assault', threat_level:'HIGH', required_personnel:12, location:'Balmorra — Sundari Front', jedi_lead:'Battlemaster Serin Holt', date:'2026-09-18T20:00:00', briefing:'Republic forces require Jedi support at a contested defensive line. The objective is to break the hostile advance, protect Republic infantry, and secure the approach to the forward command post.', status:'OPEN', result_summary:''},
    {id:'m3', code:'JO-073', name:'The Veiled Reliquary', main_category:'JEDI', type:'Artifact Recovery', threat_level:'HIGH', required_personnel:6, location:'Tython — Deep Ruins', jedi_lead:'Master Aven Daal', date:'2026-09-19T17:30:00', briefing:'A sealed chamber has been discovered beneath an abandoned temple complex. Recover the artifact without disturbing surrounding structures or activating unknown Force phenomena.', status:'OPEN', result_summary:''},
    {id:'m4', code:'JO-064', name:'Operation Glass Shield', main_category:'WARFRONT', type:'Defense', threat_level:'MODERATE', required_personnel:10, location:'Ord Mantell — Fort Garnik', jedi_lead:'Jedi Knight Nira Sol', date:'2026-09-20T18:00:00', briefing:'Reinforce Republic positions and hold the outer defensive ring while engineers complete critical repairs.', status:'OPEN', result_summary:''},
    {id:'m5', code:'JO-066', name:'Whispers in the Archive', main_category:'JEDI', type:'Research', threat_level:'MODERATE', required_personnel:5, location:'Coruscant — Jedi Temple Archives', jedi_lead:'Archivist Teral Venn', date:'2026-09-21T16:00:00', briefing:'Several archive entries have been altered without authorization. Trace the changes, determine their origin, and preserve the integrity of the affected records.', status:'OPEN', result_summary:''},
    {id:'m6', code:'JO-070', name:'Operation Long Watch', main_category:'WARFRONT', type:'Recon', threat_level:'LOW', required_personnel:4, location:'Taris — Upper Wastes', jedi_lead:'Jedi Sentinel Ryn Kess', date:'2026-09-22T18:30:00', briefing:'Conduct a forward reconnaissance sweep and report hostile movement patterns without engaging unless extraction is compromised.', status:'OPEN', result_summary:''}
  ];

  const state = {
    user: null,
    missions: [],
    applications: [],
    notifications: [],
    profiles: [],
    announcements: [],
    settings: {terminal_name:'MISSION TERMINAL', command_name:'JEDI ORDER // OPERATIONS COMMAND', footer_text:'SECURE • AUTHORIZED PERSONNEL ONLY', system_status:'SECURE CHANNEL'},
    currentMission: null,
    currentView: 'dashboard',
    category: 'ALL',
    adminTab: 'missions',
    demo: !LIVE,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const dateFmt = (value) => value ? new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'}).format(new Date(value)) : 'TBD';
  const initials = (value) => String(value || 'J').split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
  const threatClass = (t) => String(t || '').toLowerCase();
  const isCommand = () => ['command_staff','super_admin','owner'].includes(state.user?.role);
  const isSuper = () => state.user?.role === 'super_admin';
  const isOwner = () => state.user?.role === 'owner';
  const roleLabel = (r) => ({player:'PLAYER', command_staff:'COMMAND STAFF', super_admin:'SUPER ADMIN', owner:'OWNER'}[r] || 'PLAYER');

  function toast(message, kind='info') {
    const el = document.createElement('div'); el.className='toast'; el.textContent=message;
    if(kind==='error') el.style.borderColor='rgba(255,101,124,.6)';
    if(kind==='success') el.style.borderColor='rgba(101,230,174,.55)';
    document.body.appendChild(el); setTimeout(()=>el.remove(), 3000);
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'UTC'});
    const el = $('#gstdClock'); if(el) el.textContent = `GSTD ${time}`;
  }
  setInterval(updateClock,1000); updateClock();

  function setUser(user) {
    state.user = user;
    $('#topUserName').textContent = user ? (user.character_name || user.discord_user || 'JEDI') : 'UNAUTHENTICATED';
    $('#topUserRole').textContent = user ? roleLabel(user.role) : 'VIEWER';
    $('.avatar').textContent = user ? initials(user.character_name || user.discord_user) : 'J';
    if(user && isCommand()) {
      if(!$('#adminNavBtn')) {
        const btn = document.createElement('button'); btn.id='adminNavBtn'; btn.className='ghost-btn'; btn.dataset.view='admin'; btn.textContent='COMMAND';
        $('.top-status').insertBefore(btn, $('#notificationBtn'));
      }
    } else $('#adminNavBtn')?.remove();
  }

  function showView(view) {
    state.currentView = view;
    $$('.page-view, #authView').forEach(x => x.classList.add('hidden'));
    const target = view === 'auth' ? $('#authView') : $(`#${view}View`);
    if(target) target.classList.remove('hidden');
    if(view === 'dashboard') renderDashboard();
    if(view === 'operations') renderOperations();
    if(view === 'mission') renderMissionDetail();
    if(view === 'profile') renderProfile();
    if(view === 'admin') renderAdmin();
  }

  function sortMissions(list) {
    const order = {CRITICAL:0,HIGH:1,MODERATE:2,LOW:3};
    return [...list].sort((a,b) => (order[a.threat_level]??9)-(order[b.threat_level]??9) || new Date(a.date||0)-new Date(b.date||0));
  }

  function missionCard(m) {
    const apps = state.applications.filter(a => a.mission_id === m.id && ['pending','approved'].includes(a.status));
    const approved = apps.filter(a => a.status === 'approved').length;
    const pct = Math.min(100, Math.round((approved / Math.max(1,m.required_personnel))*100));
    const full = approved >= m.required_personnel;
    return `<article class="mission-card ${['HIGH','CRITICAL'].includes(m.threat_level)?'high':''}" data-mission-id="${esc(m.id)}">
      <div class="card-top"><span class="code">${esc(m.code || 'JO-NEW')}</span><span class="threat ${threatClass(m.threat_level)}">${esc(m.threat_level)} THREAT</span></div>
      <h3>${esc(m.name)}</h3>
      <div class="location">${esc(m.location)}</div>
      <div class="briefing-preview">${esc(m.briefing)}</div>
      <div class="card-footer">
        <div class="metric"><label>TYPE</label><strong>${esc(m.type)}</strong></div>
        <div class="metric"><label>DATE</label><strong>${esc(dateFmt(m.date))}</strong></div>
        <div class="metric"><label>PERSONNEL</label><strong>${approved}/${esc(m.required_personnel)}</strong><div class="slots-bar"><div class="slots-fill" style="width:${pct}%"></div></div></div>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:11px"><span>${esc(m.main_category)} // ${esc(m.type)}</span><span>${full?'FULL':'VIEW BRIEFING →'}</span></div>
    </article>`;
  }

  function renderDashboard() {
    const active = state.missions.filter(m=>!['COMPLETED','CANCELLED'].includes(m.status));
    const high = sortMissions(active.filter(m=>['HIGH','CRITICAL'].includes(m.threat_level))).slice(0,6);
    const standard = sortMissions(active.filter(m=>!['HIGH','CRITICAL'].includes(m.threat_level))).slice(0,6);
    $('#highRiskGrid').innerHTML = high.length ? high.map(missionCard).join('') : `<div class="empty"><strong>NO HIGH-RISK OPERATIONS</strong>Command has not posted any immediate priority missions.</div>`;
    $('#standardGrid').innerHTML = standard.length ? standard.map(missionCard).join('') : `<div class="empty"><strong>NO STANDARD OPERATIONS</strong>No active operations are currently posted.</div>`;
    $('#highRiskCounter').textContent = `${high.length} LISTED`; $('#standardCounter').textContent=`${standard.length} LISTED`;
    $('#activeMissionCount').textContent = `${active.length} ACTIVE OPERATIONS`;
    const critical = active.filter(m=>m.threat_level==='CRITICAL').length, highCount=active.filter(m=>m.threat_level==='HIGH').length;
    $('#threatIndex').textContent = critical ? 'CRITICAL' : highCount ? 'ELEVATED' : 'STABLE';
    $('#threatIndex').style.color = critical ? 'var(--danger)' : highCount ? 'var(--warn)' : 'var(--success)';
  }

  function renderOperations() {
    const base = state.category==='ARCHIVE' ? state.missions.filter(m=>['COMPLETED','CANCELLED'].includes(m.status)) : state.missions.filter(m=>!['COMPLETED','CANCELLED'].includes(m.status));
    const list = sortMissions(base).filter(m=>['ALL','ARCHIVE'].includes(state.category) || m.main_category===state.category);
    $('#operationsGrid').innerHTML = list.length ? list.map(missionCard).join('') : `<div class="empty"><strong>${state.category==='ARCHIVE'?'NO ARCHIVED MISSIONS':'NO OPERATIONS FOUND'}</strong>${state.category==='ARCHIVE'?'Completed and cancelled operations will remain here as a permanent command archive.':'There are no active postings in this channel.'}</div>`;
    $$('#categoryTabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.category===state.category));
  }

  function renderMissionDetail() {
    const m = state.currentMission;
    if(!m) { showView('operations'); return; }
    const apps = state.applications.filter(a=>a.mission_id===m.id && ['pending','approved'].includes(a.status));
    const approved = apps.filter(a=>a.status==='approved');
    const mine = apps.find(a=>a.user_id===state.user?.id);
    const canJoin = !mine && m.status==='OPEN' && approved.length < m.required_personnel;
    const action = canJoin ? `<button class="primary-btn" id="applyBtn">REQUEST ASSIGNMENT</button>` : mine ? `<button class="ghost-btn" id="withdrawBtn">WITHDRAW REQUEST</button>` : approved.length>=m.required_personnel ? `<button class="ghost-btn" disabled>MISSION FULL</button>` : '';
    const adminActions = isCommand() ? `<button class="ghost-btn" id="editMissionBtn">EDIT</button><button class="danger-btn" id="deleteMissionBtn">DELETE</button>` : '';
    $('#missionDetail').innerHTML = `<div class="detail-panel">
      <div class="detail-head"><div><span class="code">${esc(m.code || 'JO-NEW')} // ${esc(m.main_category)}</span><h1>${esc(m.name)}</h1><div class="location">${esc(m.location)}</div></div><div class="detail-actions">${action}${adminActions}</div></div>
      <div class="detail-meta"><div><label>MISSION TYPE</label><strong>${esc(m.type)}</strong></div><div><label>THREAT LEVEL</label><strong style="color:${m.threat_level==='CRITICAL'?'var(--danger)':m.threat_level==='HIGH'?'var(--warn)':'var(--cyan)'}">${esc(m.threat_level)}</strong></div><div><label>REQUIRED</label><strong>${esc(m.required_personnel)} PERSONNEL</strong></div><div><label>JEDI LEAD</label><strong>${esc(m.jedi_lead)}</strong></div><div><label>DATE</label><strong>${esc(dateFmt(m.date))}</strong></div></div>
      <div class="briefing"><h3>MISSION BRIEFING</h3><p>${esc(m.briefing)}</p>${m.result_summary?`<h3 style="margin-top:24px">OFFICIAL RESULT</h3><p>${esc(m.result_summary)}</p>`:''}</div>
      <div class="roster"><h3>PERSONNEL ROSTER — ${approved.length}/${esc(m.required_personnel)}</h3><div class="roster-list">${approved.length ? approved.map(a=>`<div class="roster-item"><span>${esc(a.character_name || a.profile?.character_name || 'Jedi')}</span><small>${esc(a.rank || a.profile?.rank || '')}</small></div>`).join('') : `<div class="empty" style="grid-column:1/-1">No approved personnel assigned.</div>`}</div></div>
      ${mine ? `<div class="auth-note" style="margin-top:20px">YOUR REQUEST STATUS: <strong style="color:${mine.status==='approved'?'var(--success)':mine.status==='pending'?'var(--warn)':'var(--danger)'}">${esc(mine.status.toUpperCase())}</strong></div>`:''}
    </div>`;
    $('#applyBtn')?.addEventListener('click', ()=>applyToMission(m.id));
    $('#withdrawBtn')?.addEventListener('click', ()=>withdrawApplication(mine.id));
    $('#editMissionBtn')?.addEventListener('click', ()=>openMissionModal(m));
    $('#deleteMissionBtn')?.addEventListener('click', ()=>deleteMission(m.id));
  }

  function renderProfile() {
    const u = state.user;
    if(!u) return showView('auth');
    const history = state.applications.filter(a=>a.user_id===u.id && a.status==='approved').map(a=>({a,m:state.missions.find(m=>m.id===a.mission_id)})).filter(x=>x.m);
    $('#profilePanel').innerHTML = `<div class="profile-card">
      <div class="profile-head"><div class="profile-avatar">${esc(initials(u.character_name||u.discord_user))}</div><div><h2>${esc(u.character_name||'Jedi Personnel')}</h2><p>${esc(u.discord_user||'Discord identity not recorded')}</p></div><div class="role-pill">${esc(roleLabel(u.role))}</div></div><div style="display:flex;gap:8px;margin:15px 0 0"><button class="ghost-btn" id="editOwnProfileBtn">EDIT PERSONNEL RECORD</button><button class="danger-btn" id="signOutBtn">END SESSION</button></div>
      <div class="profile-grid"><div><label>ROBLOX USER</label><strong>${esc(u.roblox_user||'—')}</strong></div><div><label>RANK</label><strong>${esc(u.rank||'—')}</strong></div><div><label>PATHWAY</label><strong>${esc(u.pathway||'—')}</strong></div><div><label>CLASS</label><strong>${esc(u.class||'—')}</strong></div><div><label>MISSIONS</label><strong>${history.length}</strong></div></div>
      <h3 style="font:700 13px Orbitron;color:var(--cyan);letter-spacing:.1em;margin:25px 0 12px">OPERATIONAL HISTORY</h3>
      ${history.length ? `<table class="history-table"><thead><tr><th>MISSION</th><th>TYPE</th><th>LOCATION</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>${history.map(x=>`<tr><td>${esc(x.m.name)}</td><td>${esc(x.m.type)}</td><td>${esc(x.m.location)}</td><td>${esc(dateFmt(x.m.date))}</td><td style="color:var(--success)">ASSIGNED</td></tr>`).join('')}</tbody></table>` : `<div class="empty"><strong>NO COMPLETED ASSIGNMENTS</strong>Your approved mission history will appear here.</div>`}
    </div>`;
    bindProfileActions();
  }

  async function loadSettings() {
    if(state.demo) return;
    const {data,error}=await db.from('site_settings').select('*').eq('id',1).single();
    if(!error && data) state.settings=data;
  }
  function applySettings() {
    document.title=state.settings.terminal_name || 'Jedi Order Mission Terminal';
    $('.brand-title').textContent=state.settings.terminal_name || 'MISSION TERMINAL';
    $('.brand .eyebrow').textContent=state.settings.command_name || 'JEDI ORDER // OPERATIONS COMMAND';
    $('.system-status').innerHTML=`<span class="status-dot"></span> ${esc(state.settings.system_status || 'SECURE CHANNEL')}`;
    const spans=$$('.footer span'); if(spans[1]) spans[1].textContent=state.settings.footer_text || 'SECURE • AUTHORIZED PERSONNEL ONLY';
  }

  async function ensureProfileComplete() {
    if(state.demo || !state.user) return;
    const required=['roblox_user','character_name','rank','pathway','class'];
    if(required.every(k=>state.user[k])) return;
    openProfileModal(state.user, true);
  }

  function openProfileModal(p, required=false) {
    $('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><span class="eyebrow">JEDI PERSONNEL RECORD</span><h2>${required?'COMPLETE PERSONNEL RECORD':'EDIT PERSONNEL RECORD'}</h2></div>${required?'':'<button class="close-btn" id="closeModal">×</button>'}</div>
      <form id="profileForm"><div class="form-grid">
      <div class="field"><label>DISCORD USER</label><input value="${esc(p.discord_user||'')}" disabled></div>
      <div class="field"><label>ROBLOX USER</label><input name="roblox_user" required value="${esc(p.roblox_user||'')}"></div>
      <div class="field"><label>CHARACTER NAME</label><input name="character_name" required value="${esc(p.character_name||'')}"></div>
      <div class="field"><label>RANK</label><input name="rank" required value="${esc(p.rank||'')}"></div>
      <div class="field"><label>PATHWAY</label><input name="pathway" required value="${esc(p.pathway||'')}"></div>
      <div class="field"><label>CLASS</label><input name="class" required value="${esc(p.class||'')}"></div>
      </div><div class="modal-actions">${required?'':'<button type="button" class="ghost-btn" id="cancelModal">CANCEL</button>'}<button class="primary-btn">${required?'SAVE PERSONNEL RECORD':'SAVE CHANGES'}</button></div></form></div></div>`;
    $('#closeModal')?.addEventListener('click',()=>$('#modalRoot').innerHTML=''); $('#cancelModal')?.addEventListener('click',()=>$('#modalRoot').innerHTML='');
    $('#profileForm').onsubmit=async e=>{e.preventDefault();const patch=Object.fromEntries(new FormData(e.currentTarget).entries());if(state.demo){Object.assign(state.user,patch);$('#modalRoot').innerHTML='';setUser(state.user);renderProfile();toast('Personnel record updated.','success');return;}const {error}=await db.from('profiles').update(patch).eq('id',p.id);if(error)return toast(error.message,'error');Object.assign(state.user,patch);$('#modalRoot').innerHTML='';setUser(state.user);renderProfile();toast('Personnel record updated.','success');};
  }

  function bindProfileActions() { $('#editOwnProfileBtn')?.addEventListener('click',()=>openProfileModal(state.user,false)); $('#signOutBtn')?.addEventListener('click',signOut); }

  async function fetchAll() {
    if(state.demo) {
      state.missions = [...demoMissions];
      state.applications = [
        {id:'a1',mission_id:'m1',user_id:'demo-user',status:'pending',character_name:demoUser.character_name,rank:demoUser.rank},
        {id:'a2',mission_id:'m2',user_id:'other-user',status:'approved',character_name:'Jedi Knight Varek',rank:'Jedi Knight'},
        {id:'a3',mission_id:'m2',user_id:'other-user2',status:'approved',character_name:'Jedi Guardian Sera',rank:'Jedi Guardian'},
        {id:'a4',mission_id:'m3',user_id:'other-user3',status:'approved',character_name:'Jedi Consular Aryn',rank:'Jedi Consular'}
      ];
      state.notifications = [{id:'n1',title:'MISSION TERMINAL ONLINE',body:'Demo mode is active. Connect Supabase to enable live personnel records.',read:false,created_at:new Date().toISOString()}];
      setUser({...demoUser});
      $('#demoNote')?.classList.remove('hidden');
      $('#discordLoginBtn').textContent='◆ ENTER DEMO TERMINAL';
      updateNotificationBadge();
      return;
    }
    const {data:{user},error} = await db.auth.getUser();
    if(error) throw error;
    if(!user) { setUser(null); showView('auth'); return; }
    const profile = await getProfile(user.id);
    setUser(profile);
    await Promise.all([loadMissions(), loadApplications(), loadNotifications()]);
    await loadAnnouncements();
    await loadSettings();
    applySettings();
    await ensureProfileComplete();
  }

  async function getProfile(userId) {
    const {data,error}=await db.from('profiles').select('*').eq('id',userId).single();
    if(error) throw error; return data;
  }
  async function loadMissions() { const {data,error}=await db.from('missions').select('*').order('date',{ascending:true}); if(error) throw error; state.missions=data||[]; }
  async function loadApplications() {
    const {data,error}=await db.from('mission_applications').select('*, profiles(character_name,rank)').order('created_at',{ascending:true}); if(error) throw error;
    state.applications=(data||[]).map(a=>({...a,character_name:a.character_name||a.profiles?.character_name,rank:a.rank||a.profiles?.rank}));
  }
  async function loadNotifications() { const {data,error}=await db.from('notifications').select('*').order('created_at',{ascending:false}).limit(30); if(error) throw error; state.notifications=data||[]; updateNotificationBadge(); }
  async function loadAnnouncements() { const {data}=await db.from('announcements').select('*').order('created_at',{ascending:false}); state.announcements=data||[]; }

  function updateNotificationBadge() { const n=state.notifications.filter(x=>!x.read).length; $('#notifCount').textContent=n; $('#notifCount').classList.toggle('hidden',!n); }
  function renderNotifications() {
    $('#notificationList').innerHTML = state.notifications.length ? state.notifications.map(n=>`<div class="notification ${n.read?'':'unread'}"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><time>${esc(dateFmt(n.created_at))}</time></div>`).join('') : `<div class="empty">No secure messages.</div>`;
  }

  async function markNotificationsRead() {
    state.notifications.forEach(n=>n.read=true); updateNotificationBadge();
    if(!state.demo && state.user) await db.from('notifications').update({read:true}).eq('user_id',state.user.id).eq('read',false);
  }

  async function signIn() {
    if(state.demo) { setUser({...demoUser}); showView('dashboard'); toast('Demo terminal authenticated.','success'); return; }
    const {error}=await db.auth.signInWithOAuth({provider:'discord',options:{redirectTo:window.location.href}});
    if(error) toast(error.message,'error');
  }

  async function signOut() {
    if(state.demo) { setUser(null); showView('auth'); return; }
    await db.auth.signOut(); setUser(null); showView('auth');
  }

  async function applyToMission(missionId) {
    if(state.demo) {
      state.applications.push({id:`demo-${Date.now()}`,mission_id:missionId,user_id:state.user.id,status:'pending',character_name:state.user.character_name,rank:state.user.rank});
      toast('Assignment request transmitted to Command Staff.','success'); renderMissionDetail(); return;
    }
    const {error}=await db.from('mission_applications').insert({mission_id:missionId,user_id:state.user.id,status:'pending'});
    if(error) return toast(error.message,'error');
    await loadApplications(); toast('Assignment request transmitted.','success'); renderMissionDetail();
  }

  async function withdrawApplication(appId) {
    if(state.demo) { const a=state.applications.find(x=>x.id===appId); if(a) a.status='withdrawn'; toast('Assignment request withdrawn.'); renderMissionDetail(); return; }
    const {error}=await db.from('mission_applications').update({status:'withdrawn'}).eq('id',appId).eq('user_id',state.user.id);
    if(error) return toast(error.message,'error'); await loadApplications(); toast('Assignment request withdrawn.'); renderMissionDetail();
  }

  function openMissionModal(m=null) {
    const isEdit=Boolean(m);
    $('#modalRoot').innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><div class="modal"><div class="modal-head"><div><span class="eyebrow">COMMAND AUTHORITY</span><h2>${isEdit?'EDIT MISSION':'POST NEW MISSION'}</h2></div><button class="close-btn" id="closeModal">×</button></div>
      <form id="missionForm"><div class="form-grid">
      <div class="field"><label>MISSION NAME</label><input name="name" required value="${esc(m?.name||'')}"></div>
      <div class="field"><label>MISSION CODE</label><input name="code" required value="${esc(m?.code||'JO-')}" placeholder="JO-001"></div>
      <div class="field"><label>MAIN CATEGORY</label><select name="main_category"><option value="WARFRONT" ${m?.main_category==='WARFRONT'?'selected':''}>WARFRONT OPERATIONS</option><option value="JEDI" ${m?.main_category==='JEDI'?'selected':''}>JEDI OPERATIONS</option></select></div>
      <div class="field"><label>MISSION TYPE</label><select name="type" id="missionType"></select></div>
      <div class="field"><label>LOCATION</label><input name="location" required value="${esc(m?.location||'')}"></div>
      <div class="field"><label>THREAT LEVEL</label><select name="threat_level">${THREATS.map(t=>`<option ${m?.threat_level===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>REQUIRED PERSONNEL</label><input name="required_personnel" type="number" min="1" required value="${esc(m?.required_personnel||6)}"></div>
      <div class="field"><label>JEDI LEAD</label><input name="jedi_lead" required value="${esc(m?.jedi_lead||state.user?.character_name||'')}"></div>
      <div class="field"><label>DATE / TIME</label><input name="date" type="datetime-local" required value="${m?.date ? new Date(m.date).toISOString().slice(0,16) : ''}"></div>
      <div class="field"><label>STATUS</label><select name="status">${STATUS.map(s=>`<option ${m?.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field full"><label>MISSION BRIEFING</label><textarea name="briefing" required>${esc(m?.briefing||'')}</textarea></div>
      <div class="field full"><label>RESULT / ARCHIVE SUMMARY</label><textarea name="result_summary" placeholder="Optional. Complete missions can retain an official result summary.">${esc(m?.result_summary||'')}</textarea></div>
      </div><div class="modal-actions"><button type="button" class="ghost-btn" id="cancelModal">CANCEL</button><button class="primary-btn" type="submit">${isEdit?'SAVE CHANGES':'POST MISSION'}</button></div></form></div></div>`;
    const category=$('[name="main_category"]'); const type=$('#missionType');
    const fillTypes=()=>{const arr=category.value==='WARFRONT'?WARFRONT_TYPES:JEDI_TYPES; type.innerHTML=arr.map(x=>`<option ${m?.type===x?'selected':''}>${esc(x)}</option>`).join('');};
    category.addEventListener('change',fillTypes); fillTypes();
    $('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modalRoot').innerHTML='';
    $('#missionForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const payload=Object.fromEntries(fd.entries());payload.required_personnel=Number(payload.required_personnel);payload.date=new Date(payload.date).toISOString();await saveMission(payload,m?.id);});
  }

  async function saveMission(payload,id) {
    if(state.demo) {
      if(id){const idx=state.missions.findIndex(m=>m.id===id);state.missions[idx]={...state.missions[idx],...payload};}
      else state.missions.unshift({id:`m-${Date.now()}`,...payload});
      $('#modalRoot').innerHTML=''; if(id){state.currentMission=state.missions.find(m=>m.id===id);showView('mission');}else{showView('admin');} toast(id?'Mission updated.':'Mission posted.','success'); return;
    }
    const q=id ? db.from('missions').update(payload).eq('id',id) : db.from('missions').insert({...payload,created_by:state.user.id});
    const {error}=await q; if(error)return toast(error.message,'error'); $('#modalRoot').innerHTML=''; await loadMissions(); showView(id?'mission':'admin'); if(id) renderMissionDetail(); toast(id?'Mission updated.':'Mission posted.','success');
  }

  async function deleteMission(id) {
    if(!confirm('Delete this mission posting? This cannot be undone.')) return;
    if(state.demo){state.missions=state.missions.filter(m=>m.id!==id);showView('admin');toast('Mission deleted.');return;}
    const {error}=await db.from('missions').delete().eq('id',id);if(error)return toast(error.message,'error');await loadMissions();showView('admin');toast('Mission deleted.');
  }

  async function setApplicationStatus(id,status) {
    const app=state.applications.find(a=>a.id===id); if(!app) return;
    if(state.demo){app.status=status;toast(`Request ${status}.`,'success');renderAdmin();renderMissionDetail();return;}
    const {error}=await db.from('mission_applications').update({status}).eq('id',id);if(error)return toast(error.message,'error');await loadApplications();toast(`Request ${status}.`,'success');renderAdmin();
  }

  function renderAdmin() {
    if(!isCommand()){showView('dashboard');return;}
    $$('.admin-tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===state.adminTab));
    if(state.adminTab==='missions') renderAdminMissions();
    if(state.adminTab==='applications') renderAdminApplications();
    if(state.adminTab==='personnel') renderAdminPersonnel();
    if(state.adminTab==='announcements') renderAdminAnnouncements();
    if(state.adminTab==='settings') renderAdminSettings();
  }
  function renderAdminMissions(){
    $('#adminContent').innerHTML=`<div class="admin-card"><table class="admin-table"><thead><tr><th>CODE</th><th>MISSION</th><th>CATEGORY</th><th>THREAT</th><th>DATE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${state.missions.map(m=>`<tr><td>${esc(m.code)}</td><td>${esc(m.name)}</td><td>${esc(m.main_category)}</td><td>${esc(m.threat_level)}</td><td>${esc(dateFmt(m.date))}</td><td>${esc(m.status)}</td><td><div class="admin-actions"><button class="mini-btn" data-edit="${esc(m.id)}">EDIT</button><button class="mini-btn" data-open="${esc(m.id)}">VIEW</button><button class="mini-btn danger" data-delete="${esc(m.id)}">DELETE</button></div></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-edit]').forEach(b=>b.onclick=()=>openMissionModal(state.missions.find(m=>m.id===b.dataset.edit)));$$('[data-open]').forEach(b=>b.onclick=()=>{state.currentMission=state.missions.find(m=>m.id===b.dataset.open);showView('mission')});$$('[data-delete]').forEach(b=>b.onclick=()=>deleteMission(b.dataset.delete));
  }
  function renderAdminApplications(){
    const apps=[...state.applications].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    $('#adminContent').innerHTML=`<div class="admin-card"><table class="admin-table"><thead><tr><th>PERSONNEL</th><th>MISSION</th><th>RANK</th><th>REQUESTED</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${apps.length?apps.map(a=>{const m=state.missions.find(x=>x.id===a.mission_id); const actions=a.status==='pending'?`<button class="mini-btn approve" data-approve="${esc(a.id)}">APPROVE</button><button class="mini-btn danger" data-decline="${esc(a.id)}">DECLINE</button>`:a.status==='approved'?`<button class="mini-btn danger" data-remove="${esc(a.id)}">REMOVE</button>`:'—'; return `<tr><td>${esc(a.character_name||'Jedi Personnel')}</td><td>${esc(m?.name||'Unknown')}</td><td>${esc(a.rank||'—')}</td><td>${esc(dateFmt(a.created_at||new Date().toISOString()))}</td><td>${esc(a.status.toUpperCase())}</td><td><div class="admin-actions">${actions}</div></td></tr>`}).join(''):`<tr><td colspan="6"><div class="empty">No assignment requests.</div></td></tr>`}</tbody></table></div>`;
    $$('[data-approve]').forEach(b=>b.onclick=()=>setApplicationStatus(b.dataset.approve,'approved'));$$('[data-decline]').forEach(b=>b.onclick=()=>setApplicationStatus(b.dataset.decline,'declined'));$$('[data-remove]').forEach(b=>b.onclick=()=>setApplicationStatus(b.dataset.remove,'removed'));
  }
  function renderAdminPersonnel(){
    const profiles=state.profiles.length?state.profiles:[state.user].filter(Boolean);
    $('#adminContent').innerHTML=`<div class="admin-card"><table class="admin-table"><thead><tr><th>CHARACTER</th><th>ROBLOX</th><th>RANK</th><th>PATHWAY</th><th>CLASS</th><th>ROLE</th><th>ACTIONS</th></tr></thead><tbody>${profiles.map(p=>`<tr><td>${esc(p.character_name)}</td><td>${esc(p.roblox_user)}</td><td>${esc(p.rank)}</td><td>${esc(p.pathway)}</td><td>${esc(p.class)}</td><td>${esc(roleLabel(p.role))}</td><td><div class="admin-actions"><button class="mini-btn" data-profile-edit="${esc(p.id)}">EDIT</button>${isOwner()?`<button class="mini-btn" data-role="${esc(p.id)}">CHANGE ROLE</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-role]').forEach(b=>b.onclick=()=>changeRole(b.dataset.role));
    $$('[data-profile-edit]').forEach(b=>b.onclick=()=>openProfileModal(profiles.find(p=>p.id===b.dataset.profileEdit), false));
    if(!state.demo && isSuper()) db.from('profiles').select('*').order('character_name').then(({data})=>{state.profiles=data||[];renderAdminPersonnel();});
  }
  function renderAdminAnnouncements(){
    $('#adminContent').innerHTML=`<div class="admin-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px"><div><span class="eyebrow">COMMAND BULLETINS</span><h3 style="font:700 16px Orbitron;margin:6px 0">ANNOUNCEMENTS</h3></div><button class="primary-btn" id="newAnnouncementBtn">+ NEW BULLETIN</button></div>${state.announcements.length?state.announcements.map(a=>`<div class="notification"><strong>${esc(a.title)}</strong><p>${esc(a.body)}</p><time>${esc(dateFmt(a.created_at))}</time></div>`).join(''):`<div class="empty">No command bulletins have been posted.</div>`}</div>`;
    $('#newAnnouncementBtn').onclick=openAnnouncementModal;
  }
  function renderAdminSettings(){
    const s=state.settings;
    $('#adminContent').innerHTML=`<div class="admin-card"><div class="eyebrow">TERMINAL CONFIGURATION</div><h3 style="font:700 16px Orbitron;margin:6px 0 18px">WEBSITE SETTINGS</h3><form id="settingsForm"><div class="form-grid"><div class="field"><label>TERMINAL NAME</label><input name="terminal_name" value="${esc(s.terminal_name||'MISSION TERMINAL')}"></div><div class="field"><label>COMMAND DESIGNATION</label><input name="command_name" value="${esc(s.command_name||'JEDI ORDER // OPERATIONS COMMAND')}"></div><div class="field"><label>SYSTEM STATUS LABEL</label><input name="system_status" value="${esc(s.system_status||'SECURE CHANNEL')}"></div><div class="field"><label>FOOTER NOTICE</label><input name="footer_text" value="${esc(s.footer_text||'SECURE • AUTHORIZED PERSONNEL ONLY')}"></div></div><div class="modal-actions"><button class="primary-btn">SAVE TERMINAL SETTINGS</button></div></form></div>`;
    $('#settingsForm').onsubmit=async e=>{e.preventDefault();const patch=Object.fromEntries(new FormData(e.currentTarget).entries());if(state.demo){Object.assign(state.settings,patch);applySettings();toast('Terminal settings updated.','success');return;}const {error}=await db.from('site_settings').update(patch).eq('id',1);if(error)return toast(error.message,'error');Object.assign(state.settings,patch);applySettings();toast('Terminal settings updated.','success');};
  }

  async function changeRole(id){
    const role=prompt('Enter role: player, command_staff, super_admin, or owner');if(!['player','command_staff','super_admin','owner'].includes(role))return;
    if(state.demo){toast('Role changes require live Supabase mode.');return;}
    const {error}=await db.from('profiles').update({role}).eq('id',id);if(error)return toast(error.message,'error');toast('Personnel role updated.','success');renderAdminPersonnel();
  }
  function openAnnouncementModal(){
    $('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><span class="eyebrow">COMMAND BULLETIN</span><h2>POST ANNOUNCEMENT</h2></div><button class="close-btn" id="closeModal">×</button></div><form id="announcementForm"><div class="form-grid"><div class="field full"><label>TITLE</label><input name="title" required></div><div class="field full"><label>MESSAGE</label><textarea name="body" required></textarea></div></div><div class="modal-actions"><button type="button" class="ghost-btn" id="cancelModal">CANCEL</button><button class="primary-btn">PUBLISH</button></div></form></div></div>`;
    $('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modalRoot').innerHTML='';
    $('#announcementForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());if(state.demo){state.announcements.unshift({id:`a-${Date.now()}`,...data,created_at:new Date().toISOString()});$('#modalRoot').innerHTML='';renderAdmin();toast('Bulletin published.','success');return;}const {error}=await db.from('announcements').insert({...data,created_by:state.user.id});if(error)return toast(error.message,'error');await loadAnnouncements();$('#modalRoot').innerHTML='';renderAdmin();toast('Bulletin published.','success');};
  }

  function bindEvents() {
    document.addEventListener('click', e=>{
      const nav=e.target.closest('[data-view]'); if(nav){e.preventDefault();showView(nav.dataset.view);return;}
      const card=e.target.closest('[data-mission-id]'); if(card){state.currentMission=state.missions.find(m=>m.id===card.dataset.missionId);showView('mission');return;}
    });
    $('#discordLoginBtn').onclick=signIn;
    $('#notificationBtn').onclick=()=>{$('#notificationPanel').classList.remove('hidden');renderNotifications();markNotificationsRead();};
    $('#closeNotifications').onclick=()=>$('#notificationPanel').classList.add('hidden');
    $('#userChip').onclick=()=>state.user&&showView('profile');
    $('#backToOperations').onclick=()=>showView('operations');
    $$('#categoryTabs .tab').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;renderOperations();});
    $$('.admin-tabs .tab').forEach(b=>b.onclick=()=>{state.adminTab=b.dataset.adminTab;renderAdmin();});
    $('#newMissionBtn').onclick=()=>openMissionModal();
  }

  async function init() {
    bindEvents();
    if(!LIVE) {
      await fetchAll(); showView('dashboard');
      return;
    }
    try {
      db.auth.onAuthStateChange(async (_event,session)=>{
        if(session?.user){try{await fetchAll();showView('dashboard');}catch(e){console.error(e);toast(e.message,'error');}}
        else {setUser(null);showView('auth');}
      });
      await fetchAll();
      if(state.user) showView('dashboard');
    } catch(e) {
      console.error(e); toast('Terminal database connection failed. Check Supabase configuration.','error'); showView('auth');
    }
  }
  init();
})();
