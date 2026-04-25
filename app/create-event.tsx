import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import type { EventCategory } from '@/lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const categories: { id: EventCategory; label: string; emoji: string }[] = [
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'chill', label: 'Chill', emoji: '☕' },
  { id: 'music', label: 'Music', emoji: '🎸' },
  { id: 'sports', label: 'Sports', emoji: '🏸' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'travel', label: 'Travel', emoji: '🚗' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export default function CreateEventScreen() {
  const { createEvent, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night'>('Evening');
  const [area, setArea] = useState('');
  const [exactTime, setExactTime] = useState('');
  const [exactLocation, setExactLocation] = useState('');
  const [maxPeople, setMaxPeople] = useState('');
  const [category, setCategory] = useState<EventCategory>('chill');
  const [womenOnly, setWomenOnly] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!title || !date || !area || !exactTime || !exactLocation) {
      setError('Add title, area, date, exact time, and exact location.');
      return;
    }

    const parsedDate = new Date(`${date}T12:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      setError('Use a valid date in YYYY-MM-DD format.');
      return;
    }

    const parsedMaxPeople = maxPeople ? Number(maxPeople) : undefined;
    if (
      parsedMaxPeople !== undefined &&
      (!Number.isInteger(parsedMaxPeople) || parsedMaxPeople < 2 || parsedMaxPeople > 10)
    ) {
      setError('Max people should be a whole number between 2 and 10.');
      return;
    }

    setError('');

    const selectedCategory = categories.find((item) => item.id === category);
    const event = createEvent({
      title,
      description: description.slice(0, 200),
      dateTime: parsedDate.toISOString(),
      area,
      timeSlot,
      exactTime,
      exactLocation,
      location: exactLocation,
      maxPeople: parsedMaxPeople,
      category,
      emoji: selectedCategory?.emoji ?? '✨',
      womenOnly,
    });

    router.replace(`/event/${event.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.page,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>Create a Plan</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
      >
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>What&apos;s the vibe?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {categories.map((item) => {
              const active = item.id === category;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  style={{
                    width: '22%',
                    backgroundColor: active ? '#EEF2FF' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: active ? '#C7D2FE' : colors.border,
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                  <Text style={{ color: active ? colors.primary : colors.muted, fontSize: 11, fontWeight: '700' }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Movie night at City Centre" />
        <FormField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What is the hangout vibe?"
          multiline
        />
        <FormField
          label="Neighbourhood / Area"
          value={area}
          onChangeText={setArea}
          placeholder="Zoo Road / Ganeshguri / Uzan Bazar"
        />
        <FormField label="Date" value={date} onChangeText={setDate} placeholder="2026-04-26" />
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Time of day</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map((item) => {
              const active = item === timeSlot;
              return (
                <Pressable
                  key={item}
                  onPress={() => setTimeSlot(item)}
                  style={{
                    backgroundColor: active ? '#FFF1D6' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: active ? '#B45309' : colors.text, fontWeight: '700' }}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <FormField
          label="Max People"
          value={maxPeople}
          onChangeText={setMaxPeople}
          keyboardType="numeric"
          placeholder="2 to 10"
        />
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Private details</Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Only approved members should see these.
          </Text>
        </View>
        <FormField label="Exact meeting time" value={exactTime} onChangeText={setExactTime} placeholder="7:30 PM" />
        <FormField
          label="Exact address"
          value={exactLocation}
          onChangeText={setExactLocation}
          placeholder="PVR City Centre lobby, Christian Basti"
        />

        {currentUser?.gender === 'woman' ? (
          <Pressable
            onPress={() => setWomenOnly((value) => !value)}
            style={{
              backgroundColor: womenOnly ? '#FCE7F3' : '#FFFFFF',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: womenOnly ? '#F9A8D4' : colors.border,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Women only</Text>
              <Text style={{ color: colors.muted }}>
                Only women should be able to view and request this plan.
              </Text>
            </View>
            <Ionicons
              name={womenOnly ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={womenOnly ? '#DB2777' : '#98A2B3'}
            />
          </Pressable>
        ) : null}

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        <GradientButton label="Drop the Plan" onPress={handleCreate} fullWidth />
      </ScrollView>
    </View>
  );
}
