export type ThemeMode = 'light' | 'dark' | 'system';
export type AppTab = 'home' | 'voting' | 'mood' | 'ai' | 'group';
export type GroupStatus = 'active' | 'completed';
export type VoteStatus = 'open' | 'closed' | 'archived';
export type VoteCategory = 'ristorante' | 'spiaggia' | 'museo' | 'aperitivo' | 'shopping' | 'serata' | 'altro';
export type EnergyLevel = 'alta' | 'media' | 'bassa';
export type HungerLevel = 'si' | 'no' | 'poca';
export type WalkingLevel = 'alta' | 'media' | 'bassa';
export type BudgetLevel = 'basso' | 'medio' | 'alto';
export type ActivityPreference = 'relax' | 'cultura' | 'food' | 'shopping' | 'nightlife' | 'panorama' | 'family' | 'libero';
export type WeatherMode = 'sole' | 'nuvoloso' | 'pioggia';
export type SuggestionPreference = 'vicino' | 'economico' | 'rilassante' | 'iconico' | 'veloce' | 'kids friendly' | 'nessuna';
export type TimeSlot = 'mattina' | 'pranzo' | 'pomeriggio' | 'aperitivo' | 'sera' | 'notte';

export interface Group {
  id: string;
  code: string;
  name: string;
  destination: string;
  participantCount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  status: GroupStatus;
}

export interface Member {
  id: string;
  name: string;
  joinedAt: string;
  color: string;
}

export interface ActiveMemberSession {
  groupCode: string;
  memberId: string;
}

export interface VoteOption {
  id: string;
  label: string;
  votes: string[];
}

export interface VoteSession {
  id: string;
  title: string;
  description?: string;
  category: VoteCategory;
  createdAt: string;
  createdBy: string;
  status: VoteStatus;
  closedAt?: string;
  options: VoteOption[];
}

export interface MoodEntry {
  memberId: string;
  energy: EnergyLevel;
  hunger: HungerLevel;
  walking: WalkingLevel;
  budget: BudgetLevel;
  activity: ActivityPreference;
  updatedAt: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  reason: string;
  tags: string[];
  timeSlot: TimeSlot;
  createdAt: string;
  weather: WeatherMode;
  preference: SuggestionPreference;
}

export interface ActivityItem {
  id: string;
  type: 'vote_created' | 'vote_cast' | 'vote_closed' | 'mood_updated' | 'suggestion_used' | 'member_joined' | 'group_created';
  memberId?: string;
  message: string;
  createdAt: string;
}

export interface AppState {
  group: Group | null;
  members: Member[];
  activeSession: ActiveMemberSession | null;
  voteSessions: VoteSession[];
  moods: MoodEntry[];
  suggestions: Suggestion[];
  activity: ActivityItem[];
  weather: WeatherMode;
  suggestionPreference: SuggestionPreference;
  lastSuggestionId?: string;
}
