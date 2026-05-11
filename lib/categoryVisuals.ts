import { Platform, type ImageSourcePropType } from 'react-native';
import type { EventCategory } from '@/lib/types';

export type CategoryVisualTheme = {
  background: ImageSourcePropType;
  title: string;
  meta: string;
  chipBackground: string;
  chipText: string;
  buttonBackground: string;
  buttonText: string;
  buttonShadow: string;
};

export const categoryFontFamily = Platform.select({
  ios: 'AvenirNext-DemiBold',
  android: 'sans-serif-medium',
  default: 'System',
});

export const categoryVisuals: Record<EventCategory, CategoryVisualTheme> = {
  movies: {
    background: require('@/assets/card-backgrounds/movies.png'),
    title: '#4C2444',
    meta: '#7F4E72',
    chipBackground: 'rgba(255, 237, 248, 0.88)',
    chipText: '#B83280',
    buttonBackground: '#FF4FA3',
    buttonText: '#FFFFFF',
    buttonShadow: '#C72F78',
  },
  chill: {
    background: require('@/assets/card-backgrounds/chill.png'),
    title: '#32245D',
    meta: '#665A92',
    chipBackground: 'rgba(244, 239, 255, 0.9)',
    chipText: '#6D4CC2',
    buttonBackground: '#7C5CFF',
    buttonText: '#FFFFFF',
    buttonShadow: '#5A3FCE',
  },
  music: {
    background: require('@/assets/card-backgrounds/music.png'),
    title: '#612837',
    meta: '#9A5261',
    chipBackground: 'rgba(255, 238, 238, 0.9)',
    chipText: '#CF3D57',
    buttonBackground: '#FF5C6F',
    buttonText: '#FFFFFF',
    buttonShadow: '#D33B4E',
  },
  sports: {
    background: require('@/assets/card-backgrounds/sports.png'),
    title: '#275634',
    meta: '#5E7B38',
    chipBackground: 'rgba(238, 255, 230, 0.9)',
    chipText: '#3B8B3E',
    buttonBackground: '#46C95A',
    buttonText: '#FFFFFF',
    buttonShadow: '#2B9A3A',
  },
  food: {
    background: require('@/assets/card-backgrounds/food.png'),
    title: '#683818',
    meta: '#9A6831',
    chipBackground: 'rgba(255, 244, 221, 0.92)',
    chipText: '#D66B12',
    buttonBackground: '#FF9F2E',
    buttonText: '#FFFFFF',
    buttonShadow: '#D36E11',
  },
  travel: {
    background: require('@/assets/card-backgrounds/travel.png'),
    title: '#383265',
    meta: '#78649A',
    chipBackground: 'rgba(243, 238, 255, 0.9)',
    chipText: '#7A4FC7',
    buttonBackground: '#FF5F91',
    buttonText: '#FFFFFF',
    buttonShadow: '#C83B6E',
  },
  gaming: {
    background: require('@/assets/card-backgrounds/gaming.png'),
    title: '#422660',
    meta: '#73559A',
    chipBackground: 'rgba(247, 238, 255, 0.9)',
    chipText: '#7C3DBA',
    buttonBackground: '#8E5BFF',
    buttonText: '#FFFFFF',
    buttonShadow: '#6538CE',
  },
  other: {
    background: require('@/assets/card-backgrounds/other.png'),
    title: '#4A3364',
    meta: '#7B629A',
    chipBackground: 'rgba(247, 238, 255, 0.9)',
    chipText: '#8B4BC1',
    buttonBackground: '#B75CFF',
    buttonText: '#FFFFFF',
    buttonShadow: '#8437C7',
  },
};
