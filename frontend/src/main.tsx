import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { buildGroupNarrative, generateSuggestions, getCurrentTimeSlot } from './suggestions';
import { clearState, loadState, loadTheme, saveState, saveTheme } from './storage';
import type {
  ActivityItem,
  ActivityPreference,
  AppState,
  AppTab,
  BudgetLevel,
  Group,
  Member,
  MoodEntry,
  Suggestion,
  SuggestionPreference,
  ThemeMode,
  VoteCategory,
  VoteSession,
} from './types';

const categories: VoteCategory[] = ['ristorante', 'spiaggia', 'museo', 'aperitivo', 'shopping', 'serata', 'altro'];
const moodOptions = {
  energy: ['alta', 'media', 'bassa'],
  hunger: ['si', 'poca', 'no'],
  walking: ['alta', 'media', 'bassa'],
  budget: ['basso', 'medio', 'alto'],
  activity: ['relax', 'cultura', 'food', 'shopping', 'nightlife', 'panorama', 'family', 'libero'],
} as const;
const weatherOptions = ['sole', 'nuvoloso', 'pioggia'] as const;
const prefOptions = ['nessuna', 'vicino', 'economico', 'rilassante', 'iconico', 'veloce', 'kids friendly'] as const;
const tabs: { key: AppTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'voting', label: 'Voting', icon: '✓' },
  { key: 'mood', label: 'Mood', icon: '☺' },
  { key: 'ai', label: 'AI', icon: '✦' },
  { key: 'group', label: 'Gruppo', icon: '☰' },
];
const memberPalette = ['#ff6aa2', '#8b5cf6', '#38bdf8', '#22d3ee', '#34d399', '#f59e0b', '#fb7185'];

const defaultMood = {
  energy: 'media',
  hunger: 'poca',
  walking: 'media',
  budget: 'medio',
  activity: 'libero',
} as const;

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function generateGroupCode(existingCode?: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = existingCode;
  while (!code || code.length !== 6) {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }
  return code;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function relativeTime(value?: string) {
  if (!value) return 'ora';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  return `${Math.round(hours / 24)} g fa`;
}

function getInitials(name: string) {
  return name.split(' ').map((chunk) => chunk[0]).join('').slice(0, 2).toUpperCase();
}

function getSystemResolvedTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getEmptyState(): AppState {
  return {
    group: null,
    members: [],
    activeSession: null,
    voteSessions: [],
    moods: [],
    suggestions: [],
    activity: [],
    weather: 'sole',
    suggestionPreference: 'nessuna',
  };
}

interface AppContextValue {
  state: AppState;
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  activeMember: Member | null;
  isOffline: boolean;
  createGroup: (payload: { name: string; destination: string; participantCount: number; startDate: string; endDate: string }) => void;
  joinMember: (name: string, code: string) => { ok: boolean; message: string };
  resetActiveMember: () => void;
  dissolveGroup: () => void;
  createVote: (payload: { title: string; description?: string; category: VoteCategory; options: string[] }) => void;
  toggleVote: (sessionId: string, optionId: string) => void;
  closeVote: (sessionId: string) => void;
  archiveVote: (sessionId: string) => void;
  deleteVote: (sessionId: string) => void;
  updateMood: (payload: Omit<MoodEntry, 'memberId' | 'updatedAt'>) => void;
  generateAiSuggestions: () => void;
  useSuggestionForVote: (suggestion: Suggestion) => void;
  setWeather: (weather: AppState['weather']) => void;
  setSuggestionPreference: (value: SuggestionPreference) => void;
  setThemeMode: (theme: ThemeMode) => void;
  exportJson: () => void;
  resetMood: () => void;
  resetVotes: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('App context mancante');
  return ctx;
}

function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState() || getEmptyState());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getSystemResolvedTheme());
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    saveTheme(theme);
    const nextTheme = theme === 'system' ? getSystemResolvedTheme() : theme;
    setResolvedTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') {
        const next = getSystemResolvedTheme();
        setResolvedTheme(next);
        document.documentElement.dataset.theme = next;
      }
    };
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    media.addEventListener('change', onChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [theme]);

  const activeMember = useMemo(() => state.members.find((member) => member.id === state.activeSession?.memberId) || null, [state.members, state.activeSession]);

  const addActivity = (item: Omit<ActivityItem, 'id' | 'createdAt'>) => {
    setState((current) => ({
      ...current,
      activity: [{ id: uid('act'), createdAt: new Date().toISOString(), ...item }, ...current.activity].slice(0, 18),
    }));
  };

  const createGroup: AppContextValue['createGroup'] = (payload) => {
    const createdAt = new Date().toISOString();
    const member: Member = {
      id: uid('member'),
      name: 'Christian',
      joinedAt: createdAt,
      color: memberPalette[0],
    };
    const group: Group = {
      id: uid('group'),
      code: generateGroupCode(),
      name: payload.name.trim(),
      destination: payload.destination.trim(),
      participantCount: payload.participantCount,
      startDate: payload.startDate,
      endDate: payload.endDate,
      createdAt,
      status: 'active',
    };
    setState({
      group,
      members: [member],
      activeSession: { groupCode: group.code, memberId: member.id },
      voteSessions: [],
      moods: [],
      suggestions: [],
      activity: [
        { id: uid('act'), type: 'group_created', message: `Hai creato il gruppo ${group.name}.`, createdAt },
        { id: uid('act'), type: 'member_joined', memberId: member.id, message: `${member.name} è entrato nel gruppo.`, createdAt },
      ],
      weather: 'sole',
      suggestionPreference: 'nessuna',
    });
  };

  const joinMember: AppContextValue['joinMember'] = (name, code) => {
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
    const newMember: Member = {
      id: uid('member'),
      name: cleanName,
      joinedAt: new Date().toISOString(),
      color: memberPalette[state.members.length % memberPalette.length],
    };
    setState((current) => ({
      ...current,
      members: [...current.members, newMember],
      activeSession: { groupCode: group.code, memberId: newMember.id },
    }));
    addActivity({ type: 'member_joined', memberId: newMember.id, message: `${newMember.name} è entrato nel gruppo.` });
    return { ok: true, message: `${newMember.name}, accesso completato.` };
  };

  const createVote: AppContextValue['createVote'] = (payload) => {
    if (!activeMember) return;
    const vote: VoteSession = {
      id: uid('vote'),
      title: payload.title.trim(),
      description: payload.description?.trim(),
      category: payload.category,
      createdAt: new Date().toISOString(),
      createdBy: activeMember.id,
      status: 'open',
      options: payload.options.filter(Boolean).map((option) => ({ id: uid('opt'), label: option.trim(), votes: [] })),
    };
    setState((current) => ({ ...current, voteSessions: [vote, ...current.voteSessions] }));
    addActivity({ type: 'vote_created', memberId: activeMember.id, message: `${activeMember.name} ha creato la votazione “${vote.title}”.` });
  };

  const toggleVote: AppContextValue['toggleVote'] = (sessionId, optionId) => {
    if (!activeMember) return;
    setState((current) => ({
      ...current,
      voteSessions: current.voteSessions.map((session) => {
        if (session.id !== sessionId || session.status !== 'open') return session;
        return {
          ...session,
          options: session.options.map((option) => option.id !== optionId
            ? option
            : {
              ...option,
              votes: option.votes.includes(activeMember.id)
                ? option.votes.filter((id) => id !== activeMember.id)
                : [...option.votes, activeMember.id],
            }),
        };
      }),
    }));
    addActivity({ type: 'vote_cast', memberId: activeMember.id, message: `${activeMember.name} ha aggiornato un voto.` });
  };

  const closeVote = (sessionId: string) => {
    setState((current) => ({
      ...current,
      voteSessions: current.voteSessions.map((session) => session.id === sessionId ? { ...session, status: 'closed', closedAt: new Date().toISOString() } : session),
    }));
    addActivity({ type: 'vote_closed', memberId: activeMember?.id, message: 'Una votazione è stata chiusa.' });
  };

  const archiveVote = (sessionId: string) => {
    setState((current) => ({
      ...current,
      voteSessions: current.voteSessions.map((session) => session.id === sessionId ? { ...session, status: 'archived' } : session),
    }));
  };

  const deleteVote = (sessionId: string) => {
    setState((current) => ({ ...current, voteSessions: current.voteSessions.filter((session) => session.id !== sessionId) }));
  };

  const updateMood: AppContextValue['updateMood'] = (payload) => {
    if (!activeMember) return;
    const mood: MoodEntry = { memberId: activeMember.id, updatedAt: new Date().toISOString(), ...payload };
    setState((current) => ({
      ...current,
      moods: [...current.moods.filter((entry) => entry.memberId !== activeMember.id), mood],
    }));
    addActivity({ type: 'mood_updated', memberId: activeMember.id, message: `${activeMember.name} ha aggiornato il mood.` });
  };

  const generateAiSuggestionsAction = () => {
    setState((current) => {
      const items = generateSuggestions(current, current.weather, current.suggestionPreference);
      return { ...current, suggestions: items, lastSuggestionId: items[0]?.id };
    });
  };

  const useSuggestionForVote = (suggestion: Suggestion) => {
    createVote({ title: suggestion.title, description: suggestion.description, category: 'altro', options: ['Sì, facciamolo', 'Valutiamo alternativa', 'Più tardi'] });
    addActivity({ type: 'suggestion_used', memberId: activeMember?.id, message: `Suggerimento trasformato in votazione: ${suggestion.title}.` });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.group?.code || 'gruppo-vacanze'}-riepilogo.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetMood = () => setState((current) => ({ ...current, moods: [] }));
  const resetVotes = () => setState((current) => ({ ...current, voteSessions: [] }));
  const resetActiveMember = () => setState((current) => ({ ...current, activeSession: null }));
  const dissolveGroup = () => {
    clearState();
    setState(getEmptyState());
  };

  const value: AppContextValue = {
    state,
    theme,
    resolvedTheme,
    activeMember,
    isOffline,
    createGroup,
    joinMember,
    resetActiveMember,
    dissolveGroup,
    createVote,
    toggleVote,
    closeVote,
    archiveVote,
    deleteVote,
    updateMood,
    generateAiSuggestions: generateAiSuggestionsAction,
    useSuggestionForVote,
    setWeather: (weather) => setState((current) => ({ ...current, weather })),
    setSuggestionPreference: (suggestionPreference) => setState((current) => ({ ...current, suggestionPreference })),
    setThemeMode: setTheme,
    exportJson,
    resetMood,
    resetVotes,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function App() {
  const { state, activeMember } = useApp();
  const [tab, setTab] = useState<AppTab>('home');
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    if (!state.group) {
      setTab('home');
    }
  }, [state.group]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!state.group) {
    return <Onboarding onToast={setToast} />;
  }

  if (!activeMember) {
    return <JoinScreen onToast={setToast} />;
  }

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

function TopBar({ onToast }: { onToast: (message: string) => void }) {
  const { state, activeMember, theme, setThemeMode, isOffline } = useApp();
  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setThemeMode(next);
    onToast(`Tema impostato su ${next === 'system' ? 'sistema' : next}.`);
  };
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Gruppo Vacanze</p>
        <h1>{state.group?.name}</h1>
      </div>
      <div className="topbar-actions">
        {isOffline && <span className="status-pill offline">Offline friendly</span>}
        <button className="icon-button" onClick={cycleTheme} aria-label="Cambia tema">◐</button>
        <div className="member-badge">
          <span className="avatar" style={{ background: activeMember?.color }}>{getInitials(activeMember?.name || '?')}</span>
          <div>
            <strong>{activeMember?.name}</strong>
            <small>Membro attivo</small>
          </div>
        </div>
      </div>
    </header>
  );
}

function Onboarding({ onToast }: { onToast: (message: string) => void }) {
  const { createGroup } = useApp();
  const [form, setForm] = useState({ name: '', destination: '', participantCount: 6, startDate: '', endDate: '' });
  const [errors, setErrors] = useState<string>('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.destination.trim() || !form.startDate || !form.endDate) {
      setErrors('Compila tutti i campi per creare il gruppo.');
      return;
    }
    if (form.endDate < form.startDate) {
      setErrors('La data di fine deve essere successiva o uguale alla data di inizio.');
      return;
    }
    createGroup(form);
    onToast('Gruppo creato con successo.');
  };

  return (
    <div className="auth-layout">
      <section className="hero-panel">
        <span className="hero-chip">PWA ready · Local first</span>
        <h1>Organizza il viaggio in gruppo senza attriti.</h1>
        <p>
          Crea il tuo gruppo, raccogli il mood, lancia votazioni rapide e usa suggerimenti intelligenti per decidere cosa fare adesso.
        </p>
        <ul className="feature-list">
          <li>Voting multi-opzione pensato per smartphone</li>
          <li>Mood dashboard con sintesi automatica</li>
          <li>Suggerimenti “AI powered” completamente locali</li>
        </ul>
      </section>
      <section className="auth-card">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Onboarding</p>
            <h2>Crea il gruppo</h2>
          </div>
        </div>
        <form className="stack" onSubmit={submit}>
          <Input label="Nome gruppo" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Weekend a Lisbona" />
          <Input label="Destinazione" value={form.destination} onChange={(value) => setForm({ ...form, destination: value })} placeholder="Lisbona" />
          <Input label="Numero totale partecipanti" type="number" value={String(form.participantCount)} onChange={(value) => setForm({ ...form, participantCount: Math.max(2, Number(value)) })} />
          <div className="form-grid">
            <Input label="Data inizio viaggio" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
            <Input label="Data fine viaggio" type="date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} />
          </div>
          {errors && <p className="error-text">{errors}</p>}
          <button className="primary-button" type="submit">Crea e inizia</button>
        </form>
      </section>
      <div className={`toast ${onToast ? '' : ''}`}></div>
    </div>
  );
}

function JoinScreen({ onToast }: { onToast: (message: string) => void }) {
  const { state, joinMember } = useApp();
  const [name, setName] = useState('');
  const [code, setCode] = useState(state.group?.code || '');
  const [message, setMessage] = useState('Questo dispositivo non è ancora associato a un partecipante.');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = joinMember(name, code);
    setMessage(result.message);
    if (result.ok) onToast(result.message);
  };

  return (
    <div className="auth-layout compact-layout">
      <section className="auth-card">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Accesso membri</p>
            <h2>Entra in {state.group?.name}</h2>
          </div>
          <span className="status-pill">Codice {state.group?.code}</span>
        </div>
        <p className="muted">Inserisci il codice gruppo e il tuo nome. Se il nome esiste già, rientri come quel membro.</p>
        <form className="stack" onSubmit={submit}>
          <Input label="Codice gruppo" value={code} onChange={(value) => setCode(value.toUpperCase())} maxLength={6} />
          <Input label="Il tuo nome" value={name} onChange={setName} placeholder="Chiara" />
          <button className="primary-button" type="submit">Entra nel gruppo</button>
          <p className="helper-text">{message}</p>
        </form>
      </section>
    </div>
  );
}

function HomeScreen({ setTab }: { setTab: (tab: AppTab) => void }) {
  const { state, activeMember } = useApp();
  const openVotes = state.voteSessions.filter((vote) => vote.status === 'open').length;
  const moodUpdated = state.moods.length;
  const upcoming = state.voteSessions.find((vote) => vote.status === 'open');

  return (
    <div className="screen stack-xl">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Ciao {activeMember?.name} 👋</p>
          <h2>Organizza il vostro viaggio insieme</h2>
          <p className="muted">Tutto il gruppo, un solo spazio semplice: votazioni rapide, mood live e suggerimenti locali.</p>
        </div>
        <div className="hero-orbs" aria-hidden="true" />
      </section>

      <section className="trip-card premium-card">
        <div className="trip-main">
          <div>
            <p className="eyebrow">Viaggio attivo</p>
            <h3>{state.group?.destination}</h3>
            <p className="muted">{formatDate(state.group?.startDate)} — {formatDate(state.group?.endDate)}</p>
          </div>
          <span className="group-code">{state.group?.code}</span>
        </div>
        <div className="trip-stats">
          <Metric label="Partecipanti" value={`${state.members.length}/${state.group?.participantCount}`} />
          <Metric label="Mood aggiornati" value={String(moodUpdated)} />
          <Metric label="Voting aperte" value={String(openVotes)} />
        </div>
        <div className="inline-actions">
          <button className="secondary-button" onClick={() => navigator.share?.({ title: state.group?.name, text: `Unisciti a ${state.group?.name} con il codice ${state.group?.code}` })}>Condividi</button>
          <button className="secondary-button" onClick={() => navigator.clipboard.writeText(state.group?.code || '')}>Copia codice</button>
          <button className="secondary-button" onClick={() => setTab('group')}>Gestisci</button>
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Quick actions</p>
            <h3>Vai subito dove serve</h3>
          </div>
        </div>
        <div className="quick-grid">
          <QuickCard icon="✓" title="Votazioni" subtitle={`${openVotes} aperte`} onClick={() => setTab('voting')} />
          <QuickCard icon="☺" title="Mood" subtitle={`${moodUpdated} check-in`} onClick={() => setTab('mood')} />
          <QuickCard icon="✦" title="Suggerimenti" subtitle="AI locale" onClick={() => setTab('ai')} />
          <QuickCard icon="☰" title="Statistiche" subtitle="Riepilogo gruppo" onClick={() => setTab('group')} />
        </div>
      </section>

      <section className="split-grid">
        <Panel title="Attività recenti" subtitle="Timeline del gruppo">
          <div className="activity-feed">
            {state.activity.length ? state.activity.slice(0, 6).map((item) => (
              <div key={item.id} className="activity-item">
                <span className="activity-dot" />
                <div>
                  <strong>{item.message}</strong>
                  <small>{relativeTime(item.createdAt)}</small>
                </div>
              </div>
            )) : <EmptyState title="Nessuna attività" text="Quando il gruppo inizierà a votare e aggiornare il mood, la timeline apparirà qui." />}
          </div>
        </Panel>
        <Panel title="Partecipanti" subtitle="Chi c'è nel gruppo">
          <div className="member-stack">
            {state.members.map((member) => (
              <div key={member.id} className="member-row">
                <span className="avatar" style={{ background: member.color }}>{getInitials(member.name)}</span>
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.id === activeMember?.id ? 'Attivo su questo dispositivo' : `Entrato ${relativeTime(member.joinedAt)}`}</small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {upcoming && (
        <section className="premium-card compact-card">
          <div className="section-head compact">
            <div>
              <p className="eyebrow">Focus del momento</p>
              <h3>{upcoming.title}</h3>
            </div>
            <button className="secondary-button" onClick={() => setTab('voting')}>Apri voting</button>
          </div>
          <p className="muted">{upcoming.description || 'Votazione pronta per raccogliere il consenso del gruppo.'}</p>
        </section>
      )}
    </div>
  );
}

function VotingScreen({ onToast }: { onToast: (message: string) => void }) {
  const { state, activeMember, createVote, toggleVote, closeVote, archiveVote, deleteVote } = useApp();
  const [form, setForm] = useState({ title: '', description: '', category: 'ristorante' as VoteCategory, options: [''] });
  const openVotes = state.voteSessions.filter((vote) => vote.status === 'open');
  const closedVotes = state.voteSessions.filter((vote) => vote.status !== 'open');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOptions = form.options.map((item) => item.trim()).filter(Boolean);
    if (!form.title.trim() || cleanOptions.length < 2) {
      onToast('Inserisci un titolo e almeno due opzioni.');
      return;
    }
    createVote({ ...form, options: cleanOptions });
    setForm({ title: '', description: '', category: 'ristorante', options: [''] });
    onToast('Nuova votazione creata.');
  };

  return (
    <div className="screen stack-xl">
      <Panel title="Nuova votazione" subtitle="Rapida da creare, perfetta da usare in mobilità">
        <form className="stack" onSubmit={submit}>
          <Input label="Titolo" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="Dove andiamo a cena?" />
          <Input label="Descrizione opzionale" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Vicino all'hotel, max 30€" />
          <label className="input-field">
            <span>Categoria</span>
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as VoteCategory })}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <div className="stack-sm">
            <div className="section-head compact"><h4>Opzioni</h4></div>
            {form.options.map((option, index) => (
              <div className="option-row" key={index}>
                <Input label={`Opzione ${index + 1}`} value={option} onChange={(value) => setForm({ ...form, options: form.options.map((item, itemIndex) => itemIndex === index ? value : item) })} placeholder="Trattoria locale" />
                {form.options.length > 1 && <button type="button" className="ghost-button" onClick={() => setForm({ ...form, options: form.options.filter((_, itemIndex) => itemIndex !== index) })}>Rimuovi</button>}
              </div>
            ))}
            <button type="button" className="secondary-button" onClick={() => setForm({ ...form, options: [...form.options, ''] })}>Aggiungi opzione</button>
          </div>
          <button className="primary-button" type="submit">Pubblica votazione</button>
        </form>
      </Panel>

      <Panel title="Votazioni aperte" subtitle={`${openVotes.length} live`} badge={String(openVotes.length)}>
        {openVotes.length ? openVotes.map((session) => {
          const leaderVotes = Math.max(...session.options.map((option) => option.votes.length), 0);
          const leaderIds = session.options.filter((option) => option.votes.length === leaderVotes && leaderVotes > 0).map((option) => option.id);
          const votedMembers = new Set(session.options.flatMap((option) => option.votes));
          return (
            <article className="vote-card" key={session.id}>
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">{session.category}</p>
                  <h3>{session.title}</h3>
                  <p className="muted">{session.description || 'Nessuna descrizione aggiuntiva.'}</p>
                </div>
                <div className="vote-actions">
                  <button className="ghost-button" onClick={() => { closeVote(session.id); onToast('Votazione chiusa.'); }}>Chiudi</button>
                </div>
              </div>
              <div className="stack-sm">
                {session.options.map((option) => {
                  const hasVoted = option.votes.includes(activeMember?.id || '');
                  const pct = leaderVotes ? Math.max((option.votes.length / leaderVotes) * 100, 8) : 8;
                  return (
                    <button key={option.id} className={`vote-option ${hasVoted ? 'active' : ''}`} onClick={() => toggleVote(session.id, option.id)}>
                      <div className="vote-option-top">
                        <strong>{option.label}</strong>
                        <span>{option.votes.length} voti</span>
                      </div>
                      <div className="progress-track"><div className={`progress-bar ${leaderIds.includes(option.id) ? 'leader' : ''}`} style={{ width: `${pct}%` }} /></div>
                      {leaderIds.includes(option.id) && <small className="badge-inline">Leader{leaderIds.length > 1 ? ' ex aequo' : ''}</small>}
                    </button>
                  );
                })}
              </div>
              <div className="vote-meta-grid">
                <StatusList title="Hanno votato" names={state.members.filter((member) => votedMembers.has(member.id)).map((member) => member.name)} emptyText="Nessuno ancora" />
                <StatusList title="Mancano" names={state.members.filter((member) => !votedMembers.has(member.id)).map((member) => member.name)} emptyText="Tutti presenti" />
              </div>
            </article>
          );
        }) : <EmptyState title="Nessuna votazione aperta" text="Crea una votazione qui sopra o trasforma un suggerimento AI in una voting session." />}
      </Panel>

      <Panel title="Storico e archivio" subtitle={`${closedVotes.length} chiuse o archiviate`}>
        {closedVotes.length ? closedVotes.map((session) => (
          <div key={session.id} className="history-row">
            <div>
              <strong>{session.title}</strong>
              <small>{session.status === 'archived' ? 'Archiviata' : `Chiusa ${relativeTime(session.closedAt)}`}</small>
            </div>
            <div className="inline-actions">
              {session.status !== 'archived' && <button className="ghost-button" onClick={() => { archiveVote(session.id); onToast('Votazione archiviata.'); }}>Archivia</button>}
              <button className="ghost-button danger" onClick={() => { if (window.confirm('Eliminare definitivamente questa votazione?')) { deleteVote(session.id); onToast('Votazione eliminata.'); } }}>Elimina</button>
            </div>
          </div>
        )) : <EmptyState title="Storico vuoto" text="Le votazioni chiuse appariranno qui per consultazioni rapide." />}
      </Panel>
    </div>
  );
}

function MoodScreen({ onToast }: { onToast: (message: string) => void }) {
  const { state, activeMember, updateMood } = useApp();
  const existingMood = state.moods.find((mood) => mood.memberId === activeMember?.id);
  const [form, setForm] = useState({
    energy: existingMood?.energy || defaultMood.energy,
    hunger: existingMood?.hunger || defaultMood.hunger,
    walking: existingMood?.walking || defaultMood.walking,
    budget: existingMood?.budget || defaultMood.budget,
    activity: existingMood?.activity || defaultMood.activity,
  });

  useEffect(() => {
    if (!existingMood) return;
    setForm({
      energy: existingMood.energy,
      hunger: existingMood.hunger,
      walking: existingMood.walking,
      budget: existingMood.budget,
      activity: existingMood.activity,
    });
  }, [existingMood?.updatedAt]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    updateMood(form as any);
    onToast('Mood aggiornato.');
  };

  const groupNarrative = buildGroupNarrative(state.moods, state.members.length);
  const hungryCount = state.moods.filter((mood) => mood.hunger === 'si').length;
  const relaxCount = state.moods.filter((mood) => mood.activity === 'relax').length;
  const updatedMembers = new Set(state.moods.map((mood) => mood.memberId));

  return (
    <div className="screen stack-xl">
      <Panel title="Il tuo mood adesso" subtitle="Aggiornalo in meno di 10 secondi" badge={`${state.moods.length}/${state.members.length}`}>
        <form className="stack" onSubmit={submit}>
          <MoodSelector label="Energia" options={moodOptions.energy as readonly string[]} value={form.energy} onChange={(value) => setForm({ ...form, energy: value as typeof form.energy })} />
          <MoodSelector label="Fame" options={moodOptions.hunger as readonly string[]} value={form.hunger} onChange={(value) => setForm({ ...form, hunger: value as typeof form.hunger })} />
          <MoodSelector label="Voglia di camminare" options={moodOptions.walking as readonly string[]} value={form.walking} onChange={(value) => setForm({ ...form, walking: value as typeof form.walking })} />
          <MoodSelector label="Budget mood" options={moodOptions.budget as readonly string[]} value={form.budget} onChange={(value) => setForm({ ...form, budget: value as typeof form.budget })} />
          <MoodSelector label="Preferenza attività" options={moodOptions.activity as readonly string[]} value={form.activity} onChange={(value) => setForm({ ...form, activity: value as ActivityPreference })} />
          <button className="primary-button" type="submit">Salva mood</button>
        </form>
      </Panel>

      <section className="split-grid">
        <Panel title="Dashboard gruppo" subtitle="Lettura aggregata del momento">
          <div className="stats-grid">
            <Metric label="Hanno fame" value={`${hungryCount} su ${state.members.length}`} />
            <Metric label="Vogliono relax" value={`${relaxCount} su ${state.members.length}`} />
            <Metric label="Fascia oraria" value={getCurrentTimeSlot()} />
          </div>
          <div className="insight-card">
            <p className="eyebrow">Lettura del gruppo adesso</p>
            <p>{groupNarrative}</p>
          </div>
        </Panel>
        <Panel title="Chi ha aggiornato" subtitle="Con timestamp e membri mancanti">
          <div className="stack-sm">
            {state.members.map((member) => {
              const mood = state.moods.find((entry) => entry.memberId === member.id);
              return (
                <div className="member-row" key={member.id}>
                  <span className="avatar" style={{ background: member.color }}>{getInitials(member.name)}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{mood ? `Aggiornato ${formatDateTime(mood.updatedAt)}` : 'Non ha ancora aggiornato il mood'}</small>
                  </div>
                  <span className={`status-pill ${mood ? '' : 'muted-pill'}`}>{mood ? 'ok' : 'pending'}</span>
                </div>
              );
            })}
          </div>
          {updatedMembers.size !== state.members.length && <p className="helper-text">Mancano {state.members.length - updatedMembers.size} check-in per una lettura completa.</p>}
        </Panel>
      </section>
    </div>
  );
}

function AiScreen({ onToast }: { onToast: (message: string) => void }) {
  const { state, generateAiSuggestions, setWeather, setSuggestionPreference, useSuggestionForVote } = useApp();

  return (
    <div className="screen stack-xl">
      <Panel title="AI Suggestion" subtitle="Motore locale, credibile e immediato">
        <div className="stack">
          <div className="form-grid">
            <label className="input-field">
              <span>Meteo simulato</span>
              <select value={state.weather} onChange={(event) => setWeather(event.target.value as AppState['weather'])}>
                {weatherOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="input-field">
              <span>Preferenza opzionale</span>
              <select value={state.suggestionPreference} onChange={(event) => setSuggestionPreference(event.target.value as SuggestionPreference)}>
                {prefOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <button className="primary-button" onClick={() => { generateAiSuggestions(); onToast('Suggerimenti generati.'); }}>Genera 3 suggerimenti</button>
        </div>
      </Panel>

      <Panel title="Suggerimenti prioritari" subtitle={`Per ${state.group?.destination}, ${state.members.length} persone`}>
        {state.suggestions.length ? (
          <div className="stack">
            {state.suggestions.map((suggestion, index) => (
              <article className="suggestion-card" key={suggestion.id}>
                <div className="section-head compact">
                  <div>
                    <p className="eyebrow">Priorità #{index + 1}</p>
                    <h3>{suggestion.title}</h3>
                  </div>
                  <span className="status-pill">{suggestion.timeSlot}</span>
                </div>
                <p>{suggestion.description}</p>
                <div className="insight-card subtle">
                  <strong>Perché questo suggerimento</strong>
                  <p>{suggestion.reason}</p>
                </div>
                <div className="tag-row">
                  {suggestion.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                </div>
                <button className="secondary-button" onClick={() => { useSuggestionForVote(suggestion); onToast('Suggerimento inviato in Voting.'); }}>Usa questo suggerimento per una votazione</button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Nessun suggerimento ancora" text="Usa il mood del gruppo, il meteo e l'orario attuale per ottenere tre idee concrete." />}
      </Panel>
    </div>
  );
}

function GroupScreen({ onToast }: { onToast: (message: string) => void }) {
  const { state, activeMember, exportJson, resetActiveMember, dissolveGroup, resetMood, resetVotes } = useApp();
  const lastVote = state.voteSessions[0];
  const lastSuggestion = state.suggestions[0];
  const moodSummary = buildGroupNarrative(state.moods, state.members.length);

  return (
    <div className="screen stack-xl">
      <Panel title="Dettagli gruppo" subtitle="Overview generale e gestione viaggio">
        <div className="stats-grid">
          <Metric label="Nome gruppo" value={state.group?.name || '—'} />
          <Metric label="Destinazione" value={state.group?.destination || '—'} />
          <Metric label="Date" value={`${formatDate(state.group?.startDate)} — ${formatDate(state.group?.endDate)}`} />
          <Metric label="Codice" value={state.group?.code || '—'} />
          <Metric label="Partecipanti previsti" value={String(state.group?.participantCount || 0)} />
          <Metric label="Entrati" value={String(state.members.length)} />
          <Metric label="Stato" value={state.group?.status === 'active' ? 'Attivo' : 'Concluso'} />
          <Metric label="Membro attivo" value={activeMember?.name || '—'} />
        </div>
        <div className="inline-actions wrap">
          <button className="secondary-button" onClick={() => { navigator.clipboard.writeText(state.group?.code || ''); onToast('Codice gruppo copiato.'); }}>Copia codice gruppo</button>
          <button className="secondary-button" onClick={() => { exportJson(); onToast('Riepilogo JSON esportato.'); }}>Esporta JSON</button>
          <button className="secondary-button" onClick={() => { resetActiveMember(); onToast('Associazione membro rimossa su questo dispositivo.'); }}>Reimposta membro attivo</button>
        </div>
      </Panel>

      <Panel title="Riepilogo veloce" subtitle="Ultimo stato utile">
        <div className="stack-sm">
          <SummaryRow label="Ultima votazione attiva" value={lastVote?.title || 'Nessuna votazione disponibile'} />
          <SummaryRow label="Ultimo mood aggregato" value={moodSummary} />
          <SummaryRow label="Ultimo suggerimento" value={lastSuggestion?.title || 'Nessun suggerimento generato'} />
        </div>
      </Panel>

      <Panel title="Membri" subtitle="Gestione visuale del gruppo">
        <div className="member-grid">
          {state.members.map((member) => (
            <div key={member.id} className="member-card">
              <span className="avatar large" style={{ background: member.color }}>{getInitials(member.name)}</span>
              <strong>{member.name}</strong>
              <small>{member.id === activeMember?.id ? 'Attivo ora' : `Entrato ${relativeTime(member.joinedAt)}`}</small>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Azioni di gestione" subtitle="Conferma richiesta solo per operazioni distruttive">
        <div className="stack-sm">
          <button className="ghost-button" onClick={() => { if (window.confirm('Resettare tutti i mood del gruppo?')) { resetMood(); onToast('Mood resettati.'); } }}>Reset parziale mood</button>
          <button className="ghost-button" onClick={() => { if (window.confirm('Eliminare tutte le votazioni?')) { resetVotes(); onToast('Votazioni resettate.'); } }}>Reset parziale votazioni</button>
          <button className="ghost-button danger" onClick={() => { if (window.confirm('Sciogliere il gruppo? Tutti i dati locali del viaggio verranno eliminati.')) { dissolveGroup(); onToast('Gruppo sciolto.'); } }}>Sciogli gruppo</button>
        </div>
      </Panel>
    </div>
  );
}

function BottomNav({ tab, setTab }: { tab: AppTab; setTab: (tab: AppTab) => void }) {
  const { state } = useApp();
  const openVotes = state.voteSessions.filter((vote) => vote.status === 'open').length;
  const moodCount = state.moods.length;
  return (
    <nav className="bottom-nav" aria-label="Navigazione principale">
      {tabs.map((item) => {
        const badge = item.key === 'voting' ? openVotes : item.key === 'mood' ? moodCount : 0;
        return (
          <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {badge > 0 && <small className="nav-badge">{badge}</small>}
          </button>
        );
      })}
    </nav>
  );
}

function QuickCard({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button className="quick-card" onClick={onClick}>
      <span className="quick-icon">{icon}</span>
      <strong>{title}</strong>
      <small>{subtitle}</small>
    </button>
  );
}

function Panel({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="panel premium-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {badge && <span className="status-pill">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; maxLength?: number }) {
  return (
    <label className="input-field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function MoodSelector({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="stack-sm">
      <div className="section-head compact"><h4>{label}</h4></div>
      <div className="chip-row">
        {options.map((option) => (
          <button key={option} type="button" className={`chip ${value === option ? 'active' : ''}`} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function StatusList({ title, names, emptyText }: { title: string; names: string[]; emptyText: string }) {
  return (
    <div className="status-list">
      <strong>{title}</strong>
      <p>{names.length ? names.join(', ') : emptyText}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
