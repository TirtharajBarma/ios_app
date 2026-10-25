export interface AvatarOption {
  id: string;
  name: string;
  category: 'persona' | 'mascot' | 'cosmic' | 'fortune' | 'cyber' | 'minimal' | 'abstract';
  bgColor: string;
  accentColor: string;
  secondaryColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'avatar_rebel',
    name: 'The Rebel',
    category: 'persona',
    bgColor: '#241812',
    accentColor: '#FF9D66',
    secondaryColor: '#FF6B35',
  },
  {
    id: 'avatar_fox',
    name: 'Golden Fox',
    category: 'mascot',
    bgColor: '#261814',
    accentColor: '#F59E0B',
    secondaryColor: '#D97706',
  },
  {
    id: 'avatar_cat',
    name: 'Cyber Cat',
    category: 'mascot',
    bgColor: '#12201D',
    accentColor: '#10B981',
    secondaryColor: '#059669',
  },
  {
    id: 'avatar_astro',
    name: 'Cosmo Astro',
    category: 'cosmic',
    bgColor: '#281720',
    accentColor: '#FBBF24',
    secondaryColor: '#F59E0B',
  },
  {
    id: 'avatar_panda',
    name: 'Zen Panda',
    category: 'mascot',
    bgColor: '#1A202C',
    accentColor: '#60A5FA',
    secondaryColor: '#3B82F6',
  },
  {
    id: 'avatar_bullion',
    name: 'Bullion Stack',
    category: 'fortune',
    bgColor: '#242013',
    accentColor: '#FCD34D',
    secondaryColor: '#F59E0B',
  },
  {
    id: 'avatar_visionary',
    name: 'The Visionary',
    category: 'persona',
    bgColor: '#21182A',
    accentColor: '#C084FC',
    secondaryColor: '#A855F7',
  },
  {
    id: 'avatar_vault',
    name: 'Neo Vault',
    category: 'fortune',
    bgColor: '#171B26',
    accentColor: '#2DD4BF',
    secondaryColor: '#14B8A6',
  },
  {
    id: 'avatar_shiba',
    name: 'Royal Shiba',
    category: 'mascot',
    bgColor: '#261922',
    accentColor: '#FB923C',
    secondaryColor: '#EA580C',
  },
  {
    id: 'avatar_rocket',
    name: 'Moon Rocket',
    category: 'cosmic',
    bgColor: '#1E1D2B',
    accentColor: '#F43F5E',
    secondaryColor: '#E11D48',
  },
  {
    id: 'avatar_dreamer',
    name: 'The Dreamer',
    category: 'persona',
    bgColor: '#241D12',
    accentColor: '#FBBF24',
    secondaryColor: '#D97706',
  },
  {
    id: 'avatar_minimalist',
    name: 'The Minimalist',
    category: 'persona',
    bgColor: '#171D28',
    accentColor: '#818CF8',
    secondaryColor: '#6366F1',
  },
];

const LEGACY_ID_MAP: Record<string, string> = {
  avatar_solaris: 'avatar_rebel',
  avatar_kitsune: 'avatar_fox',
  avatar_aegis: 'avatar_cat',
  avatar_quasar: 'avatar_astro',
  avatar_nebula: 'avatar_panda',
  avatar_falcon: 'avatar_bullion',
  avatar_zenith: 'avatar_visionary',
  avatar_titan: 'avatar_shiba',
  avatar_continuum: 'avatar_rocket',
  avatar_orbit: 'avatar_rocket',
  avatar_monarch: 'avatar_dreamer',
  avatar_prism: 'avatar_minimalist',
  avatar_cipher: 'avatar_rebel',
  avatar_chronos: 'avatar_astro',
  avatar_abyss: 'avatar_cat',
};

export function resolveAvatar(id?: string | null): AvatarOption {
  if (!id) return AVATAR_OPTIONS[0];
  const direct = AVATAR_OPTIONS.find((a) => a.id === id);
  if (direct) return direct;
  const remappedId = LEGACY_ID_MAP[id];
  if (remappedId) {
    const remapped = AVATAR_OPTIONS.find((a) => a.id === remappedId);
    if (remapped) return remapped;
  }
  return AVATAR_OPTIONS[0];
}
