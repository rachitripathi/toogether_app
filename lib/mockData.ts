import type { CategoryTheme, Event, JoinRequest, Message, Rating, User } from './types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Aryan Shah',
    email: 'aryan@example.com',
    username: 'aryanshah',
    avatarColors: ['#8B5CF6', '#6366F1'],
    gender: 'man',
    bio: 'Living for spontaneous plans.',
  },
  {
    id: 'u2',
    name: 'Priya Kapoor',
    email: 'priya@example.com',
    username: 'priyak',
    avatarColors: ['#F472B6', '#FB7185'],
    gender: 'woman',
    bio: 'Film nerd and chai addict.',
  },
  {
    id: 'u3',
    name: 'Rohan Mehta',
    email: 'rohan@example.com',
    username: 'rohanm',
    avatarColors: ['#38BDF8', '#0EA5E9'],
    gender: 'man',
    bio: 'Coffee shop philosopher.',
  },
  {
    id: 'u4',
    name: 'Sneha Tiwari',
    email: 'sneha@example.com',
    username: 'snehat',
    avatarColors: ['#34D399', '#14B8A6'],
    gender: 'woman',
    bio: 'Musician and wanderer.',
  },
  {
    id: 'u5',
    name: 'Kabir Singh',
    email: 'kabir@example.com',
    username: 'kabirsingh',
    avatarColors: ['#FB923C', '#F59E0B'],
    gender: 'man',
    bio: 'Early bird and badminton pro.',
  },
];

export const MOCK_EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Dune: Part 3 Screening Night',
    description:
      "Catching the IMAX premiere at PVR. Grab your tickets, we'll meet in the lobby and do chai after.",
    dateTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    location: 'PVR City Center, Mumbai',
    creatorId: 'u2',
    maxPeople: 6,
    approvedUserIds: ['u3'],
    requestUserIds: ['u1'],
    category: 'movies',
    emoji: '🎬',
    womenOnly: false,
  },
  {
    id: 'e2',
    title: 'Chai & Conversations',
    description:
      'Random topics. Real talk. No agenda. Perfect for meeting new people without awkward networking.',
    dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'Chaayos, Connaught Place, Delhi',
    creatorId: 'u3',
    maxPeople: 8,
    approvedUserIds: ['u1', 'u4'],
    requestUserIds: [],
    category: 'chill',
    emoji: '☕',
    womenOnly: false,
  },
  {
    id: 'e3',
    title: 'Midnight Drive to Marine Lines',
    description:
      'Windows down, playlist on shuffle, city lights all the way. Bring your good vibes.',
    dateTime: new Date(
      Date.now() + 4 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000
    ).toISOString(),
    location: 'Start: Bandra Station, Mumbai',
    creatorId: 'u1',
    maxPeople: 4,
    approvedUserIds: ['u2'],
    requestUserIds: ['u3', 'u5'],
    category: 'travel',
    emoji: '🚗',
    womenOnly: false,
  },
  {
    id: 'e4',
    title: 'Rooftop Jam Session',
    description:
      'Calling all musicians, freestylers, or just good listeners. Bring your instruments or just your ears.',
    dateTime: new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000
    ).toISOString(),
    location: 'Bandra West, Mumbai',
    creatorId: 'u4',
    maxPeople: 10,
    approvedUserIds: [],
    requestUserIds: [],
    category: 'music',
    emoji: '🎸',
    womenOnly: false,
  },
  {
    id: 'e5',
    title: 'Spontaneous Badminton at Dawn',
    description:
      '6 AM badminton before the day gets too loud. Bring your racket. Chai after.',
    dateTime: new Date(
      Date.now() + 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000
    ).toISOString(),
    location: 'Nehru Park, New Delhi',
    creatorId: 'u5',
    maxPeople: 4,
    approvedUserIds: [],
    requestUserIds: [],
    category: 'sports',
    emoji: '🏸',
    womenOnly: false,
  },
];

export const MOCK_REQUESTS: JoinRequest[] = [
  {
    id: 'r1',
    userId: 'u1',
    eventId: 'e1',
    status: 'pending',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'r2',
    userId: 'u1',
    eventId: 'e2',
    status: 'approved',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'r3',
    userId: 'u3',
    eventId: 'e3',
    status: 'pending',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'r4',
    userId: 'u5',
    eventId: 'e3',
    status: 'pending',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'r5',
    userId: 'u2',
    eventId: 'e3',
    status: 'approved',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  e2: [
    {
      id: 'm1',
      eventId: 'e2',
      userId: 'u3',
      text: "Hey everyone! Can't wait for this.",
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'm2',
      eventId: 'e2',
      userId: 'u4',
      text: 'Same. What time should we all arrive?',
      createdAt: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    },
    {
      id: 'm3',
      eventId: 'e2',
      userId: 'u1',
      text: '4:30 sharp at the entrance works for me.',
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    },
  ],
  e3: [
    {
      id: 'm4',
      eventId: 'e3',
      userId: 'u1',
      text: 'Drive is locked in.',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'm5',
      eventId: 'e3',
      userId: 'u2',
      text: 'Making the playlist right now. Any requests?',
      createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

export const MOCK_RATINGS: Rating[] = [
  {
    id: 'rt1',
    fromUserId: 'u1',
    toUserId: 'u3',
    eventId: 'e2',
    stars: 5,
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'rt2',
    fromUserId: 'u2',
    toUserId: 'u1',
    eventId: 'e3',
    stars: 4,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

export const CATEGORY_CONFIG: Record<string, CategoryTheme> = {
  movies: {
    label: 'Movies',
    chipBackground: '#F3E8FF',
    chipText: '#7E22CE',
    iconBackground: '#E9D5FF',
  },
  chill: {
    label: 'Chill',
    chipBackground: '#FFF1D6',
    chipText: '#B45309',
    iconBackground: '#FDE68A',
  },
  music: {
    label: 'Music',
    chipBackground: '#E0E7FF',
    chipText: '#4338CA',
    iconBackground: '#C7D2FE',
  },
  sports: {
    label: 'Sports',
    chipBackground: '#DCFCE7',
    chipText: '#15803D',
    iconBackground: '#BBF7D0',
  },
  food: {
    label: 'Food',
    chipBackground: '#FEE2E2',
    chipText: '#B91C1C',
    iconBackground: '#FECACA',
  },
  travel: {
    label: 'Travel',
    chipBackground: '#DBEAFE',
    chipText: '#1D4ED8',
    iconBackground: '#BFDBFE',
  },
  gaming: {
    label: 'Gaming',
    chipBackground: '#FAE8FF',
    chipText: '#A21CAF',
    iconBackground: '#F5D0FE',
  },
  other: {
    label: 'Other',
    chipBackground: '#E5E7EB',
    chipText: '#374151',
    iconBackground: '#D1D5DB',
  },
};
