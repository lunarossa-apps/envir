const { createContext, useContext, useEffect, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const STORAGE_KEY = 'gruppo-vacanze::app-state';
const THEME_KEY = 'gruppo-vacanze::theme';
const categories = ['ristorante', 'spiaggia', 'museo', 'aperitivo', 'shopping', 'serata', 'altro'];
const moodOptions = {
  energy: ['alta', 'media', 'bassa'],
  hunger: ['si', 'poca', 'no'],
  walking: ['alta', 'media', 'bassa'],
  budget: ['basso', 'medio', 'alto'],
  activity: ['relax', 'cultura', 'food', 'shopping', 'nightlife', 'panorama', 'family', 'libero'],
};
const weatherOptions = ['sole', 'nuvoloso', 'pioggia'];
const prefOptions = ['nessuna', 'vicino', 'economico', 'rilassante', 'iconico', 'veloce', 'kids friendly'];
const tabs = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'voting', label: 'Voting', icon: '✓' },
  { key: 'mood', label: 'Mood', icon: '☺' },
  { key: 'ai', label: 'AI', icon: '✦' },
  { key: 'group', label: 'Gruppo', icon: '☰' },
];
const memberPalette = ['#ff6aa2', '#8b5cf6', '#38bdf8', '#22d3ee', '#34d399', '#f59e0b', '#fb7185'];
const defaultMood = { energy: 'media', hunger: 'poca', walking: 'media', budget: 'medio', activity: 'libero' };

function uid(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`; }
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function clearState() { localStorage.removeItem(STORAGE_KEY); }
function loadTheme() { return localStorage.getItem(THEME_KEY) || 'system'; }
function saveTheme(theme) { localStorage.setItem(THEME_KEY, theme); }
function getSystemResolvedTheme() { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(value)) : '—'; }
function formatDateTime(value) { return value ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'; }
function getInitials(name) { return (name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function relativeTime(value) {
  if (!value) return 'adesso';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  return `${Math.round(hours / 24)} g fa`;
}
function countBy(items) { return items.reduce((acc, item) => ({ ...acc, [item]: (acc[item] || 0) + 1 }), {}); }
function topEntry(items, fallback) { return Object.entries(countBy(items)).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback; }
function averageBudget(moods) {
  const values = { basso: 1, medio: 2, alto: 3 };
  const total = moods.reduce((sum, mood) => sum + values[mood.budget], 0);
  const avg = total / Math.max(moods.length, 1);
  if (avg <= 1.5) return 'basso';
  if (avg <= 2.4) return 'medio';
  return 'alto';
}
function getCurrentTimeSlot(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 11) return 'mattina';
  if (hour >= 11 && hour < 14) return 'pranzo';
  if (hour >= 14 && hour < 18) return 'pomeriggio';
  if (hour >= 18 && hour < 20) return 'aperitivo';
  if (hour >= 20 && hour < 23) return 'sera';
  return 'notte';
}
function buildGroupNarrative(moods, totalMembers) {
  if (!moods.length) return 'Il gruppo non ha ancora aggiornato il mood. Inizia con un check-in veloce per ottenere suggerimenti migliori.';
  const tired = moods.filter((m) => m.energy === 'bassa').length;
  const hungry = moods.filter((m) => m.hunger === 'si').length;
  const relax = moods.filter((m) => m.activity === 'relax').length;
  const walkingLow = moods.filter((m) => m.walking === 'bassa').length;
  const budget = averageBudget(moods);
  const intro = tired >= Math.ceil(totalMembers / 2) ? 'Il gruppo sembra un po\' stanco' : 'Il gruppo sembra in buona forma';
  const appetite = hungry >= Math.ceil(totalMembers / 2) ? 'con voglia di mangiare qualcosa presto' : 'e aperto a diverse attività';
  const pace = walkingLow >= Math.ceil(totalMembers / 2) || relax >= Math.ceil(totalMembers / 3) ? 'Meglio privilegiare qualcosa di tranquillo' : 'Si può considerare anche un\'attività dinamica';
  return `${intro}, ${appetite}. ${pace} con un budget medio percepito ${budget}.`;
}
function generateGroupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}
function getEmptyState() {
  return { group: null, members: [], activeSession: null, voteSessions: [], moods: [], suggestions: [], activity: [], weather: 'sole', suggestionPreference: 'nessuna' };
}
function generateSuggestions(state, weather, preference) {
  const group = state.group;
  if (!group) return [];
  const moods = state.moods;
  const timeSlot = getCurrentTimeSlot();
  const hungry = moods.filter((m) => m.hunger === 'si').length;
  const lowEnergy = moods.filter((m) => m.energy === 'bassa').length;
  const highEnergy = moods.filter((m) => m.energy === 'alta').length;
  const highWalking = moods.filter((m) => m.walking === 'alta').length;
  const activity = topEntry(moods.map((m) => m.activity), 'libero');
  const budget = averageBudget(moods);
  const people = state.members.length || group.participantCount;
  const pool = [
    {
      key: 'food-break',
      when: hungry > 0 || timeSlot === 'pranzo' || timeSlot === 'aperitivo',
      title: weather === 'pioggia' ? 'Bistrot o brunch coperto' : 'Pausa food vicina',
      description: `Una scelta pratica a ${group.destination} per fermarsi insieme senza complicazioni logistiche.`,
      reason: 'Molti segnali indicano fame o bisogno di una pausa rapida prima della prossima attività.',
      tags: ['easy', budget === 'basso' ? 'low budget' : 'conviviale', people > 5 ? 'gruppi' : 'smart'],
    },
    {
      key: 'panoramic-walk',
      when: highEnergy >= Math.ceil(Math.max(moods.length, 1) / 2) && highWalking > 0 && weather !== 'pioggia',
      title: 'Passeggiata panoramica con tappa iconica',
      description: `Un percorso semplice per vedere il meglio di ${group.destination} e decidere poi la prossima tappa.`,
      reason: 'Il gruppo ha energia e voglia di camminare: è il momento giusto per un\'esperienza outdoor.',
      tags: ['panorama', 'outdoor', 'gruppi'],
    },
    {
      key: 'museum-culture',
      when: activity === 'cultura' || weather === 'pioggia',
      title: 'Museo o experience indoor',
      description: 'Un\'attività culturale coperta e facile da gestire anche con meteo incerto.',
      reason: weather === 'pioggia' ? 'Con la pioggia conviene tenersi su esperienze indoor.' : 'La preferenza del gruppo punta su cultura e ritmo tranquillo.',
      tags: ['indoor', 'cultura', people > 6 ? 'facile' : 'iconico'],
    },
    {
      key: 'relax-stop',
      when: lowEnergy >= Math.ceil(Math.max(moods.length, 1) / 2) || activity === 'relax',
      title: 'Relax spot con vista o lounge',
      description: 'Una pausa comoda per ricaricarsi, bere qualcosa e riallineare il gruppo.',
      reason: 'L\'energia è bassa o il gruppo preferisce un\'attività soft e con poco movimento.',
      tags: ['rilassante', 'poco movimento', budget === 'alto' ? 'premium' : 'easy'],
    },
    {
      key: 'shopping-central',
      when: activity === 'shopping' && weather !== 'pioggia',
      title: 'Shopping street o mercato locale',
      description: 'Un\'area centrale con più opzioni vicine, perfetta per muoversi in libertà senza disperdersi.',
      reason: 'Il gruppo vuole qualcosa di leggero, libero e facilmente modulabile.',
      tags: ['shopping', 'centrale', 'flessibile'],
    },
    {
      key: 'nightlife',
      when: (timeSlot === 'sera' || timeSlot === 'notte') && activity === 'nightlife',
      title: 'Cocktail bar o zona nightlife easy',
      description: 'Una zona viva ma semplice da raggiungere, ideale per stare insieme senza perdere tempo.',
      reason: 'È la fascia serale e il gruppo ha espresso voglia di socialità e nightlife.',
      tags: ['nightlife', 'gruppi', 'social'],
    },
    {
      key: 'family-easy',
      when: activity === 'family' || preference === 'kids friendly',
      title: 'Attività kids friendly e zero stress',
      description: 'Uno spazio facile da gestire per famiglie, con tempi flessibili e comfort.',
      reason: 'La priorità è mantenere il gruppo compatto e comodo anche con esigenze familiari.',
      tags: ['kids friendly', 'easy', 'relax'],
    },
  ];
  const preferredTag = preference !== 'nessuna' ? preference : null;
  const selected = pool.filter((item) => item.when).map((item, index) => ({
    id: `${item.key}-${Date.now()}-${index}`,
    title: item.title,
    description: item.description,
    reason: `${item.reason}${preferredTag ? ` La preferenza attuale è ${preferredTag}.` : ''}`,
    tags: preferredTag && !item.tags.includes(preferredTag) ? [...item.tags, preferredTag] : item.tags,
    timeSlot,
    createdAt: new Date().toISOString(),
    weather,
    preference,
  })).sort((a, b) => (Number(b.tags.includes('gruppi')) + Number(b.tags.includes('easy'))) - (Number(a.tags.includes('gruppi')) + Number(a.tags.includes('easy')))).slice(0, 3);
  return selected.length ? selected : [{ id: `fallback-${Date.now()}`, title: 'Zona centrale con opzioni flessibili', description: `Una base semplice a ${group.destination} per decidere insieme sul posto senza attriti.`, reason: 'Quando il gruppo è eterogeneo conviene scegliere un punto comodo con alternative vicine.', tags: ['easy', 'gruppi', budget === 'basso' ? 'economico' : 'flessibile'], timeSlot, createdAt: new Date().toISOString(), weather, preference }];
}

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

function AppProvider({ children }) {
  const [state, setState] = useState(() => loadState() || getEmptyState());
  const [theme, setTheme] = useState(() => loadTheme());
  const [resolvedTheme, setResolvedTheme] = useState(() => getSystemResolvedTheme());
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => {
    saveTheme(theme);
    const next = theme === 'system' ? getSystemResolvedTheme() : theme;
    setResolvedTheme(next);
    document.documentElement.dataset.theme = next;
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => theme === 'system' && setResolvedTheme(getSystemResolvedTheme());
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    media.addEventListener('change', onChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.documentElement.dataset.theme = theme === 'system' ? getSystemResolvedTheme() : theme;
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [theme]);

  const activeMember = useMemo(() => state.members.find((member) => member.id === state.activeSession?.memberId) || null, [state.members, state.activeSession]);
  const addActivity = (item) => setState((current) => ({ ...current, activity: [{ id: uid('act'), createdAt: new Date().toISOString(), ...item }, ...current.activity].slice(0, 18) }));

  const value = {
    state,
    theme,
    resolvedTheme,
    activeMember,
    isOffline,
    createGroup(payload) {
      const createdAt = new Date().toISOString();
      const member = { id: uid('member'), name: 'Christian', joinedAt: createdAt, color: memberPalette[0] };
      const group = { id: uid('group'), code: generateGroupCode(), name: payload.name.trim(), destination: payload.destination.trim(), participantCount: payload.participantCount, startDate: payload.startDate, endDate: payload.endDate, createdAt, status: 'active' };
      setState({ group, members: [member], activeSession: { groupCode: group.code, memberId: member.id }, voteSessions: [], moods: [], suggestions: [], activity: [{ id: uid('act'), type: 'group_created', message: `Hai creato il gruppo ${group.name}.`, createdAt }, { id: uid('act'), type: 'member_joined', memberId: member.id, message: `${member.name} è entrato nel gruppo.`, createdAt }], weather: 'sole', suggestionPreference: 'nessuna' });
    },
    joinMember(name, code) {
      const group = state.group;
      const cleanName = name.trim();
      if (!group) return { ok: false, message: 'Nessun gruppo attivo su questo dispositivo.' };
      if (code.trim().toUpperCase() !== group.code) return { ok: false, message: 'Codice gruppo non valido.' };
      if (!cleanName) return { ok: false, message: 'Inserisci il tuo nome.' };
      const existing = state.members.find((member) => member.name.toLowerCase() === cleanName.toLowerCase());
      if (existing) {
        setState((current) => ({ ...current, activeSession: { groupCode: group.code, memberId: existing.id } }));
        addActivity({ type: 'member_joined', memberId: existing.id, message: `${existing.name} è rientrato nel gruppo.` });
        return { ok: true, message: `${existing.name}, bentornato!` };
      }
      const newMember = { id: uid('member'), name: cleanName, joinedAt: new Date().toISOString(), color: memberPalette[state.members.length % memberPalette.length] };
      setState((current) => ({ ...current, members: [...current.members, newMember], activeSession: { groupCode: group.code, memberId: newMember.id } }));
      addActivity({ type: 'member_joined', memberId: newMember.id, message: `${newMember.name} è entrato nel gruppo.` });
      return { ok: true, message: `${newMember.name}, accesso completato.` };
    },
    resetActiveMember() { setState((current) => ({ ...current, activeSession: null })); },
    dissolveGroup() { clearState(); setState(getEmptyState()); },
    createVote(payload) {
      if (!activeMember) return;
      const vote = { id: uid('vote'), title: payload.title.trim(), description: payload.description?.trim(), category: payload.category, createdAt: new Date().toISOString(), createdBy: activeMember.id, status: 'open', options: payload.options.filter(Boolean).map((option) => ({ id: uid('opt'), label: option.trim(), votes: [] })) };
      setState((current) => ({ ...current, voteSessions: [vote, ...current.voteSessions] }));
      addActivity({ type: 'vote_created', memberId: activeMember.id, message: `${activeMember.name} ha creato la votazione “${vote.title}”.` });
    },
    toggleVote(sessionId, optionId) {
      if (!activeMember) return;
      setState((current) => ({ ...current, voteSessions: current.voteSessions.map((session) => session.id !== sessionId || session.status !== 'open' ? session : ({ ...session, options: session.options.map((option) => option.id !== optionId ? option : ({ ...option, votes: option.votes.includes(activeMember.id) ? option.votes.filter((id) => id !== activeMember.id) : [...option.votes, activeMember.id] })) })) }));
      addActivity({ type: 'vote_cast', memberId: activeMember.id, message: `${activeMember.name} ha aggiornato un voto.` });
    },
    closeVote(sessionId) { setState((current) => ({ ...current, voteSessions: current.voteSessions.map((session) => session.id === sessionId ? { ...session, status: 'closed', closedAt: new Date().toISOString() } : session) })); addActivity({ type: 'vote_closed', memberId: activeMember?.id, message: 'Una votazione è stata chiusa.' }); },
    archiveVote(sessionId) { setState((current) => ({ ...current, voteSessions: current.voteSessions.map((session) => session.id === sessionId ? { ...session, status: 'archived' } : session) })); },
    deleteVote(sessionId) { setState((current) => ({ ...current, voteSessions: current.voteSessions.filter((session) => session.id !== sessionId) })); },
    updateMood(payload) {
      if (!activeMember) return;
      const mood = { memberId: activeMember.id, updatedAt: new Date().toISOString(), ...payload };
      setState((current) => ({ ...current, moods: [...current.moods.filter((entry) => entry.memberId !== activeMember.id), mood] }));
      addActivity({ type: 'mood_updated', memberId: activeMember.id, message: `${activeMember.name} ha aggiornato il mood.` });
    },
    generateAiSuggestions() { setState((current) => ({ ...current, suggestions: generateSuggestions(current, current.weather, current.suggestionPreference) })); },
    useSuggestionForVote(suggestion) {
      value.createVote({ title: suggestion.title, description: suggestion.description, category: 'altro', options: ['Sì, facciamolo', 'Valutiamo alternativa', 'Più tardi'] });
      addActivity({ type: 'suggestion_used', memberId: activeMember?.id, message: `Suggerimento trasformato in votazione: ${suggestion.title}.` });
    },
    setWeather(weather) { setState((current) => ({ ...current, weather })); },
    setSuggestionPreference(suggestionPreference) { setState((current) => ({ ...current, suggestionPreference })); },
    setThemeMode: setTheme,
    exportJson() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.group?.code || 'gruppo-vacanze'}-riepilogo.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    resetMood() { setState((current) => ({ ...current, moods: [] })); },
    resetVotes() { setState((current) => ({ ...current, voteSessions: [] })); },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function App() {
  const { state, activeMember } = useApp();
  const [tab, setTab] = useState('home');
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2400); return () => clearTimeout(timer); }, [toast]);
  if (!state.group) return <Onboarding onToast={setToast} />;
  if (!activeMember) return <JoinScreen onToast={setToast} />;
  return (
    <div className="app-shell">
      <TopBar onToast={setToast} />
      <main className="main-content">
        {tab === 'home' && <HomeScreen setTab={setTab} />}
        {tab === 'voting' && <VotingScreen onToast={setToast} />}
        {tab === 'mood' && <MoodScreen onToast={setToast} />}
        {tab === 'ai' && <AiScreen onToast={setToast} />}
        {tab === 'group' && <GroupScreen onToast={setToast} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
      <div className={`toast ${toast ? 'visible' : ''}`}>{toast}</div>
    </div>
  );
}

function TopBar({ onToast }) {
  const { state, activeMember, theme, setThemeMode, isOffline } = useApp();
  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setThemeMode(next);
    onToast(`Tema impostato su ${next === 'system' ? 'sistema' : next}.`);
  };
  return <header className="topbar"><div><p className="eyebrow">Gruppo Vacanze</p><h1>{state.group?.name}</h1></div><div className="topbar-actions">{isOffline && <span className="status-pill offline">Offline friendly</span>}<button className="icon-button" onClick={cycleTheme} aria-label="Cambia tema">◐</button><div className="member-badge"><span className="avatar" style={{ background: activeMember?.color }}>{getInitials(activeMember?.name)}</span><div><strong>{activeMember?.name}</strong><small>Membro attivo</small></div></div></div></header>;
}

function Onboarding({ onToast }) {
  const { createGroup } = useApp();
  const [form, setForm] = useState({ name: '', destination: '', participantCount: 6, startDate: '', endDate: '' });
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.destination.trim() || !form.startDate || !form.endDate) return setError('Compila tutti i campi per creare il gruppo.');
    if (form.endDate < form.startDate) return setError('La data di fine deve essere successiva o uguale alla data di inizio.');
    createGroup(form);
    onToast('Gruppo creato con successo.');
  };
  return <div className="auth-layout"><section className="hero-panel"><span className="hero-chip">Mobile first · Local first</span><h1>Organizza il viaggio in gruppo senza attriti.</h1><p>Crea il tuo gruppo, raccogli il mood, lancia votazioni rapide e usa suggerimenti intelligenti per decidere cosa fare adesso.</p><ul className="feature-list"><li>Voting multi-opzione pensato per smartphone</li><li>Mood dashboard con sintesi automatica</li><li>Suggerimenti “AI powered” completamente locali</li></ul></section><section className="auth-card"><div className="section-head compact"><div><p className="eyebrow">Onboarding</p><h2>Crea il gruppo</h2></div></div><form className="stack" onSubmit={submit}><Input label="Nome gruppo" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Weekend a Lisbona" /><Input label="Destinazione" value={form.destination} onChange={(value) => setForm({ ...form, destination: value })} placeholder="Lisbona" /><Input label="Numero totale partecipanti" type="number" value={String(form.participantCount)} onChange={(value) => setForm({ ...form, participantCount: Math.max(2, Number(value)) })} /><div className="form-grid"><Input label="Data inizio viaggio" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} /><Input label="Data fine viaggio" type="date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} /></div>{error && <p className="error-text">{error}</p>}<button className="primary-button" type="submit">Crea e inizia</button></form></section></div>;
}

function JoinScreen({ onToast }) {
  const { state, joinMember } = useApp();
  const [name, setName] = useState('');
  const [code, setCode] = useState(state.group?.code || '');
  const [message, setMessage] = useState('Questo dispositivo non è ancora associato a un partecipante.');
  const submit = (event) => {
    event.preventDefault();
    const result = joinMember(name, code);
    setMessage(result.message);
    if (result.ok) onToast(result.message);
  };
  return <div className="auth-layout compact-layout"><section className="auth-card"><div className="section-head compact"><div><p className="eyebrow">Accesso membri</p><h2>Entra in {state.group?.name}</h2></div><span className="status-pill">Codice {state.group?.code}</span></div><p className="muted">Inserisci codice gruppo e nome. Se il nome esiste già, rientri come quel membro.</p><form className="stack" onSubmit={submit}><Input label="Codice gruppo" value={code} onChange={(value) => setCode(value.toUpperCase())} maxLength={6} /><Input label="Il tuo nome" value={name} onChange={setName} placeholder="Chiara" /><button className="primary-button" type="submit">Entra nel gruppo</button><p className="helper-text">{message}</p></form></section></div>;
}

function HomeScreen({ setTab }) {
  const { state, activeMember } = useApp();
  const openVotes = state.voteSessions.filter((vote) => vote.status === 'open').length;
  const moodUpdated = state.moods.length;
  const upcoming = state.voteSessions.find((vote) => vote.status === 'open');
  return <div className="screen stack-xl"><section className="hero-card"><div className="hero-copy"><p className="eyebrow">Ciao {activeMember?.name} 👋</p><h2>Organizza il vostro viaggio insieme</h2><p className="muted">Tutto il gruppo, un solo spazio semplice: votazioni rapide, mood live e suggerimenti locali.</p></div><div className="hero-orbs" aria-hidden="true" /></section><section className="trip-card premium-card"><div className="trip-main"><div><p className="eyebrow">Viaggio attivo</p><h3>{state.group?.destination}</h3><p className="muted">{formatDate(state.group?.startDate)} — {formatDate(state.group?.endDate)}</p></div><span className="group-code">{state.group?.code}</span></div><div className="trip-stats"><Metric label="Partecipanti" value={`${state.members.length}/${state.group?.participantCount}`} /><Metric label="Mood aggiornati" value={String(moodUpdated)} /><Metric label="Voting aperte" value={String(openVotes)} /></div><div className="inline-actions"><button className="secondary-button" onClick={() => navigator.share?.({ title: state.group?.name, text: `Unisciti a ${state.group?.name} con il codice ${state.group?.code}` })}>Condividi</button><button className="secondary-button" onClick={() => navigator.clipboard.writeText(state.group?.code || '')}>Copia codice</button><button className="secondary-button" onClick={() => setTab('group')}>Gestisci</button></div></section><section><div className="section-head"><div><p className="eyebrow">Quick actions</p><h3>Vai subito dove serve</h3></div></div><div className="quick-grid"><QuickCard icon="✓" title="Votazioni" subtitle={`${openVotes} aperte`} onClick={() => setTab('voting')} /><QuickCard icon="☺" title="Mood" subtitle={`${moodUpdated} check-in`} onClick={() => setTab('mood')} /><QuickCard icon="✦" title="Suggerimenti" subtitle="AI locale" onClick={() => setTab('ai')} /><QuickCard icon="☰" title="Statistiche" subtitle="Riepilogo gruppo" onClick={() => setTab('group')} /></div></section><section className="split-grid"><Panel title="Attività recenti" subtitle="Timeline del gruppo"><div className="activity-feed">{state.activity.length ? state.activity.slice(0, 6).map((item) => <div key={item.id} className="activity-item"><span className="activity-dot" /><div><strong>{item.message}</strong><small>{relativeTime(item.createdAt)}</small></div></div>) : <EmptyState title="Nessuna attività" text="Quando il gruppo inizierà a votare e aggiornare il mood, la timeline apparirà qui." />}</div></Panel><Panel title="Partecipanti" subtitle="Chi c'è nel gruppo"><div className="member-stack">{state.members.map((member) => <div key={member.id} className="member-row"><span className="avatar" style={{ background: member.color }}>{getInitials(member.name)}</span><div><strong>{member.name}</strong><small>{member.id === activeMember?.id ? 'Attivo su questo dispositivo' : `Entrato ${relativeTime(member.joinedAt)}`}</small></div></div>)}</div></Panel></section>{upcoming && <section className="premium-card compact-card"><div className="section-head compact"><div><p className="eyebrow">Focus del momento</p><h3>{upcoming.title}</h3></div><button className="secondary-button" onClick={() => setTab('voting')}>Apri voting</button></div><p className="muted">{upcoming.description || 'Votazione pronta per raccogliere il consenso del gruppo.'}</p></section>}</div>;
}

function VotingScreen({ onToast }) {
  const { state, activeMember, createVote, toggleVote, closeVote, archiveVote, deleteVote } = useApp();
  const [form, setForm] = useState({ title: '', description: '', category: 'ristorante', options: [''] });
  const openVotes = state.voteSessions.filter((vote) => vote.status === 'open');
  const closedVotes = state.voteSessions.filter((vote) => vote.status !== 'open');
  const submit = (event) => {
    event.preventDefault();
    const cleanOptions = form.options.map((item) => item.trim()).filter(Boolean);
    if (!form.title.trim() || cleanOptions.length < 2) return onToast('Inserisci un titolo e almeno due opzioni.');
    createVote({ ...form, options: cleanOptions });
    setForm({ title: '', description: '', category: 'ristorante', options: [''] });
    onToast('Nuova votazione creata.');
  };
  return <div className="screen stack-xl"><Panel title="Nuova votazione" subtitle="Rapida da creare, perfetta da usare in mobilità"><form className="stack" onSubmit={submit}><Input label="Titolo" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="Dove andiamo a cena?" /><Input label="Descrizione opzionale" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Vicino all'hotel, max 30€" /><label className="input-field"><span>Categoria</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><div className="stack-sm"><div className="section-head compact"><h4>Opzioni</h4></div>{form.options.map((option, index) => <div className="option-row" key={index}><Input label={`Opzione ${index + 1}`} value={option} onChange={(value) => setForm({ ...form, options: form.options.map((item, itemIndex) => itemIndex === index ? value : item) })} placeholder="Trattoria locale" />{form.options.length > 1 && <button type="button" className="ghost-button" onClick={() => setForm({ ...form, options: form.options.filter((_, itemIndex) => itemIndex !== index) })}>Rimuovi</button>}</div>)}<button type="button" className="secondary-button" onClick={() => setForm({ ...form, options: [...form.options, ''] })}>Aggiungi opzione</button></div><button className="primary-button" type="submit">Pubblica votazione</button></form></Panel><Panel title="Votazioni aperte" subtitle={`${openVotes.length} live`} badge={String(openVotes.length)}>{openVotes.length ? openVotes.map((session) => { const leaderVotes = Math.max(...session.options.map((option) => option.votes.length), 0); const leaderIds = session.options.filter((option) => option.votes.length === leaderVotes && leaderVotes > 0).map((option) => option.id); const votedMembers = new Set(session.options.flatMap((option) => option.votes)); return <article className="vote-card" key={session.id}><div className="section-head compact"><div><p className="eyebrow">{session.category}</p><h3>{session.title}</h3><p className="muted">{session.description || 'Nessuna descrizione aggiuntiva.'}</p></div><div className="vote-actions"><button className="ghost-button" onClick={() => { closeVote(session.id); onToast('Votazione chiusa.'); }}>Chiudi</button></div></div><div className="stack-sm">{session.options.map((option) => { const hasVoted = option.votes.includes(activeMember?.id || ''); const pct = leaderVotes ? Math.max((option.votes.length / leaderVotes) * 100, 8) : 8; return <button key={option.id} type="button" className={`vote-option ${hasVoted ? 'active' : ''}`} onClick={() => toggleVote(session.id, option.id)}><div className="vote-option-top"><strong>{option.label}</strong><span>{option.votes.length} voti</span></div><div className="progress-track"><div className={`progress-bar ${leaderIds.includes(option.id) ? 'leader' : ''}`} style={{ width: `${pct}%` }} /></div>{leaderIds.includes(option.id) && <small className="badge-inline">Leader{leaderIds.length > 1 ? ' ex aequo' : ''}</small>}</button>; })}</div><div className="vote-meta-grid"><StatusList title="Hanno votato" names={state.members.filter((member) => votedMembers.has(member.id)).map((member) => member.name)} emptyText="Nessuno ancora" /><StatusList title="Mancano" names={state.members.filter((member) => !votedMembers.has(member.id)).map((member) => member.name)} emptyText="Tutti presenti" /></div></article>; }) : <EmptyState title="Nessuna votazione aperta" text="Crea una votazione qui sopra o trasforma un suggerimento AI in una voting session." />}</Panel><Panel title="Storico e archivio" subtitle={`${closedVotes.length} chiuse o archiviate`}>{closedVotes.length ? closedVotes.map((session) => <div key={session.id} className="history-row"><div><strong>{session.title}</strong><small>{session.status === 'archived' ? 'Archiviata' : `Chiusa ${relativeTime(session.closedAt)}`}</small></div><div className="inline-actions">{session.status !== 'archived' && <button className="ghost-button" onClick={() => { archiveVote(session.id); onToast('Votazione archiviata.'); }}>Archivia</button>}<button className="ghost-button danger" onClick={() => { if (window.confirm('Eliminare definitivamente questa votazione?')) { deleteVote(session.id); onToast('Votazione eliminata.'); } }}>Elimina</button></div></div>) : <EmptyState title="Storico vuoto" text="Le votazioni chiuse appariranno qui per consultazioni rapide." />}</Panel></div>;
}

function MoodScreen({ onToast }) {
  const { state, activeMember, updateMood } = useApp();
  const existingMood = state.moods.find((mood) => mood.memberId === activeMember?.id);
  const [form, setForm] = useState(existingMood || defaultMood);
  useEffect(() => { if (existingMood) setForm(existingMood); }, [existingMood?.updatedAt]);
  const hungryCount = state.moods.filter((mood) => mood.hunger === 'si').length;
  const relaxCount = state.moods.filter((mood) => mood.activity === 'relax').length;
  const updatedMembers = new Set(state.moods.map((mood) => mood.memberId));
  return <div className="screen stack-xl"><Panel title="Il tuo mood adesso" subtitle="Aggiornalo in meno di 10 secondi" badge={`${state.moods.length}/${state.members.length}`}><form className="stack" onSubmit={(event) => { event.preventDefault(); updateMood({ energy: form.energy, hunger: form.hunger, walking: form.walking, budget: form.budget, activity: form.activity }); onToast('Mood aggiornato.'); }}><MoodSelector label="Energia" options={moodOptions.energy} value={form.energy} onChange={(value) => setForm({ ...form, energy: value })} /><MoodSelector label="Fame" options={moodOptions.hunger} value={form.hunger} onChange={(value) => setForm({ ...form, hunger: value })} /><MoodSelector label="Voglia di camminare" options={moodOptions.walking} value={form.walking} onChange={(value) => setForm({ ...form, walking: value })} /><MoodSelector label="Budget mood" options={moodOptions.budget} value={form.budget} onChange={(value) => setForm({ ...form, budget: value })} /><MoodSelector label="Preferenza attività" options={moodOptions.activity} value={form.activity} onChange={(value) => setForm({ ...form, activity: value })} /><button className="primary-button" type="submit">Salva mood</button></form></Panel><section className="split-grid"><Panel title="Dashboard gruppo" subtitle="Lettura aggregata del momento"><div className="stats-grid"><Metric label="Hanno fame" value={`${hungryCount} su ${state.members.length}`} /><Metric label="Vogliono relax" value={`${relaxCount} su ${state.members.length}`} /><Metric label="Fascia oraria" value={getCurrentTimeSlot()} /></div><div className="insight-card"><p className="eyebrow">Lettura del gruppo adesso</p><p>{buildGroupNarrative(state.moods, state.members.length)}</p></div></Panel><Panel title="Chi ha aggiornato" subtitle="Con timestamp e membri mancanti"><div className="stack-sm">{state.members.map((member) => { const mood = state.moods.find((entry) => entry.memberId === member.id); return <div className="member-row" key={member.id}><span className="avatar" style={{ background: member.color }}>{getInitials(member.name)}</span><div><strong>{member.name}</strong><small>{mood ? `Aggiornato ${formatDateTime(mood.updatedAt)}` : 'Non ha ancora aggiornato il mood'}</small></div><span className={`status-pill ${mood ? '' : 'muted-pill'}`}>{mood ? 'ok' : 'pending'}</span></div>; })}</div>{updatedMembers.size !== state.members.length && <p className="helper-text">Mancano {state.members.length - updatedMembers.size} check-in per una lettura completa.</p>}</Panel></section></div>;
}

function AiScreen({ onToast }) {
  const { state, generateAiSuggestions, setWeather, setSuggestionPreference, useSuggestionForVote } = useApp();
  return <div className="screen stack-xl"><Panel title="AI Suggestion" subtitle="Motore locale, credibile e immediato"><div className="stack"><div className="form-grid"><label className="input-field"><span>Meteo simulato</span><select value={state.weather} onChange={(event) => setWeather(event.target.value)}>{weatherOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="input-field"><span>Preferenza opzionale</span><select value={state.suggestionPreference} onChange={(event) => setSuggestionPreference(event.target.value)}>{prefOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><button className="primary-button" onClick={() => { generateAiSuggestions(); onToast('Suggerimenti generati.'); }}>Genera 3 suggerimenti</button></div></Panel><Panel title="Suggerimenti prioritari" subtitle={`Per ${state.group?.destination}, ${state.members.length} persone`}>{state.suggestions.length ? <div className="stack">{state.suggestions.map((suggestion, index) => <article className="suggestion-card" key={suggestion.id}><div className="section-head compact"><div><p className="eyebrow">Priorità #{index + 1}</p><h3>{suggestion.title}</h3></div><span className="status-pill">{suggestion.timeSlot}</span></div><p>{suggestion.description}</p><div className="insight-card subtle"><strong>Perché questo suggerimento</strong><p>{suggestion.reason}</p></div><div className="tag-row">{suggestion.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div><button className="secondary-button" onClick={() => { useSuggestionForVote(suggestion); onToast('Suggerimento inviato in Voting.'); }}>Usa questo suggerimento per una votazione</button></article>)}</div> : <EmptyState title="Nessun suggerimento ancora" text="Usa il mood del gruppo, il meteo e l'orario attuale per ottenere tre idee concrete." />}</Panel></div>;
}

function GroupScreen({ onToast }) {
  const { state, activeMember, exportJson, resetActiveMember, dissolveGroup, resetMood, resetVotes } = useApp();
  const lastVote = state.voteSessions[0];
  const lastSuggestion = state.suggestions[0];
  return <div className="screen stack-xl"><Panel title="Dettagli gruppo" subtitle="Overview generale e gestione viaggio"><div className="stats-grid"><Metric label="Nome gruppo" value={state.group?.name || '—'} /><Metric label="Destinazione" value={state.group?.destination || '—'} /><Metric label="Date" value={`${formatDate(state.group?.startDate)} — ${formatDate(state.group?.endDate)}`} /><Metric label="Codice" value={state.group?.code || '—'} /><Metric label="Partecipanti previsti" value={String(state.group?.participantCount || 0)} /><Metric label="Entrati" value={String(state.members.length)} /><Metric label="Stato" value={state.group?.status === 'active' ? 'Attivo' : 'Concluso'} /><Metric label="Membro attivo" value={activeMember?.name || '—'} /></div><div className="inline-actions wrap"><button className="secondary-button" onClick={() => { navigator.clipboard.writeText(state.group?.code || ''); onToast('Codice gruppo copiato.'); }}>Copia codice gruppo</button><button className="secondary-button" onClick={() => { exportJson(); onToast('Riepilogo JSON esportato.'); }}>Esporta JSON</button><button className="secondary-button" onClick={() => { resetActiveMember(); onToast('Associazione membro rimossa su questo dispositivo.'); }}>Reimposta membro attivo</button></div></Panel><Panel title="Riepilogo veloce" subtitle="Ultimo stato utile"><div className="stack-sm"><SummaryRow label="Ultima votazione attiva" value={lastVote?.title || 'Nessuna votazione disponibile'} /><SummaryRow label="Ultimo mood aggregato" value={buildGroupNarrative(state.moods, state.members.length)} /><SummaryRow label="Ultimo suggerimento" value={lastSuggestion?.title || 'Nessun suggerimento generato'} /></div></Panel><Panel title="Membri" subtitle="Gestione visuale del gruppo"><div className="member-grid">{state.members.map((member) => <div key={member.id} className="member-card"><span className="avatar large" style={{ background: member.color }}>{getInitials(member.name)}</span><strong>{member.name}</strong><small>{member.id === activeMember?.id ? 'Attivo ora' : `Entrato ${relativeTime(member.joinedAt)}`}</small></div>)}</div></Panel><Panel title="Azioni di gestione" subtitle="Conferma richiesta solo per operazioni distruttive"><div className="stack-sm"><button className="ghost-button" onClick={() => { if (window.confirm('Resettare tutti i mood del gruppo?')) { resetMood(); onToast('Mood resettati.'); } }}>Reset parziale mood</button><button className="ghost-button" onClick={() => { if (window.confirm('Eliminare tutte le votazioni?')) { resetVotes(); onToast('Votazioni resettate.'); } }}>Reset parziale votazioni</button><button className="ghost-button danger" onClick={() => { if (window.confirm('Sciogliere il gruppo? Tutti i dati locali del viaggio verranno eliminati.')) { dissolveGroup(); } }}>Sciogli gruppo</button></div></Panel></div>;
}

function BottomNav({ tab, setTab }) {
  const { state } = useApp();
  const openVotes = state.voteSessions.filter((vote) => vote.status === 'open').length;
  const moodCount = state.moods.length;
  return <nav className="bottom-nav" aria-label="Navigazione principale">{tabs.map((item) => { const badge = item.key === 'voting' ? openVotes : item.key === 'mood' ? moodCount : 0; return <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}><span className="nav-icon">{item.icon}</span><span>{item.label}</span>{badge > 0 && <small className="nav-badge">{badge}</small>}</button>; })}</nav>;
}

function QuickCard({ icon, title, subtitle, onClick }) { return <button className="quick-card" onClick={onClick}><span className="quick-icon">{icon}</span><strong>{title}</strong><small>{subtitle}</small></button>; }
function Panel({ title, subtitle, badge, children }) { return <section className="panel premium-card"><div className="section-head"><div><h3>{title}</h3>{subtitle && <p className="muted">{subtitle}</p>}</div>{badge && <span className="status-pill">{badge}</span>}</div>{children}</section>; }
function Input({ label, value, onChange, type = 'text', placeholder, maxLength }) { return <label className="input-field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} /></label>; }
function MoodSelector({ label, options, value, onChange }) { return <div className="stack-sm"><div className="section-head compact"><h4>{label}</h4></div><div className="chip-row">{options.map((option) => <button key={option} type="button" className={`chip ${value === option ? 'active' : ''}`} onClick={() => onChange(option)}>{option}</button>)}</div></div>; }
function Metric({ label, value }) { return <div className="metric-card"><small>{label}</small><strong>{value}</strong></div>; }
function EmptyState({ title, text }) { return <div className="empty-state"><strong>{title}</strong><p>{text}</p></div>; }
function StatusList({ title, names, emptyText }) { return <div className="status-list"><strong>{title}</strong><p>{names.length ? names.join(', ') : emptyText}</p></div>; }
function SummaryRow({ label, value }) { return <div className="summary-row"><small>{label}</small><strong>{value}</strong></div>; }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AppProvider><App /></AppProvider></React.StrictMode>);
