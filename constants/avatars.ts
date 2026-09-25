export interface AvatarOption {
  id: string;
  name: string;
  category: 'mascot' | 'cyber' | 'minimal' | 'abstract';
  bgColor: string;
  accentColor: string;
  secondaryColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'avatar_solaris',
    name: 'Solaris',
    category: 'abstract',
    bgColor: '#241812',
    accentColor: '#FF9D66',
    secondaryColor: '#FF6B35',
  },
  {
    id: 'avatar_aegis',
    name: 'Aegis',
    category: 'cyber',
    bgColor: '#12201D',
    accentColor: '#4ADE80',
    secondaryColor: '#10B981',
  },
  {
    id: 'avatar_falcon',
    name: 'Aero Falcon',
    category: 'mascot',
    bgColor: '#131D28',
    accentColor: '#60A5FA',
    secondaryColor: '#3B82F6',
  },
  {
    id: 'avatar_zenith',
    name: 'Zen Lotus',
    category: 'minimal',
    bgColor: '#16221D',
    accentColor: '#34D399',
    secondaryColor: '#059669',
  },
  {
    id: 'avatar_prism',
    name: 'Prism Core',
    category: 'abstract',
    bgColor: '#201A2B',
    accentColor: '#C084FC',
    secondaryColor: '#A855F7',
  },
  {
    id: 'avatar_orbit',
    name: 'Orbital',
    category: 'abstract',
    bgColor: '#17222C',
    accentColor: '#38BDF8',
    secondaryColor: '#0284C7',
  },
  {
    id: 'avatar_kitsune',
    name: 'Kitsune',
    category: 'mascot',
    bgColor: '#261814',
    accentColor: '#F59E0B',
    secondaryColor: '#D97706',
  },
  {
    id: 'avatar_monarch',
    name: 'Monarch',
    category: 'minimal',
    bgColor: '#242013',
    accentColor: '#FBBF24',
    secondaryColor: '#EAB308',
  },
  {
    id: 'avatar_cipher',
    name: 'Cipher',
    category: 'cyber',
    bgColor: '#13221E',
    accentColor: '#2DD4BF',
    secondaryColor: '#14B8A6',
  },
  {
    id: 'avatar_nebula',
    name: 'Nebula',
    category: 'abstract',
    bgColor: '#21182A',
    accentColor: '#A78BFA',
    secondaryColor: '#8B5CF6',
  },
  {
    id: 'avatar_vault',
    name: 'Neo Vault',
    category: 'cyber',
    bgColor: '#171B26',
    accentColor: '#70D6BC',
    secondaryColor: '#2DD4BF',
  },
  {
    id: 'avatar_quasar',
    name: 'Quasar',
    category: 'abstract',
    bgColor: '#281720',
    accentColor: '#FB7185',
    secondaryColor: '#F43F5E',
  },
  {
    id: 'avatar_chronos',
    name: 'Chronos',
    category: 'minimal',
    bgColor: '#1C1F28',
    accentColor: '#94A3B8',
    secondaryColor: '#64748B',
  },
  {
    id: 'avatar_abyss',
    name: 'Abyss Waves',
    category: 'minimal',
    bgColor: '#12222B',
    accentColor: '#0EA5E9',
    secondaryColor: '#0284C7',
  },
  {
    id: 'avatar_titan',
    name: 'Titan Core',
    category: 'cyber',
    bgColor: '#261922',
    accentColor: '#E879F9',
    secondaryColor: '#D946EF',
  },
  {
    id: 'avatar_continuum',
    name: 'Continuum',
    category: 'minimal',
    bgColor: '#1E1D2B',
    accentColor: '#818CF8',
    secondaryColor: '#6366F1',
  },
];
