import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '@/components/Icon';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { useLocationPickerStore, type MapCoordinate, type MapRegion } from '@/store/locationPickerStore';
import { useTheme } from '@/providers/ThemeProvider';
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
  { id: 'other', label: 'Other', emoji: '🎲' },
];

const defaultRegion: MapRegion = {
  latitude: 26.1445,
  longitude: 91.7362,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Select date';
}

function formatTime(value: Date | null) {
  return value ? value.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'Select time';
}

function combineDateAndTime(date: Date, time: Date) {
  const next = new Date(date);
  next.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return next;
}

function deriveTimeSlot(time: Date): 'Morning' | 'Afternoon' | 'Evening' | 'Night' {
  const hour = time.getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export default function CreateEventScreen() {
  const { createEvent, currentUser, getUsageSummary, shouldShowPaywallForCreate } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventTime, setEventTime] = useState<Date | null>(null);
  const [area, setArea] = useState('');
  const [exactLocation, setExactLocation] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [coordinate, setCoordinate] = useState<MapCoordinate | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxPeople, setMaxPeople] = useState('');
  const [category, setCategory] = useState<EventCategory>('chill');
  const [womenOnly, setWomenOnly] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usage = getUsageSummary();
  const openLocationPicker = useLocationPickerStore((state) => state.open);
  const consumeLocationResult = useLocationPickerStore((state) => state.consumeResult);

  const isFormValid = Boolean(
    title.trim() && eventDate && eventTime && area.trim() && exactLocation.trim()
  );

  const applyCoordinate = async (nextCoordinate: MapCoordinate) => {
    setCoordinate(nextCoordinate);

    try {
      const [place] = await Location.reverseGeocodeAsync(nextCoordinate);
      const locality = place?.district || place?.subregion || place?.city || place?.region || '';
      const exactParts = [
        place?.name,
        place?.street,
        place?.district,
        place?.city,
        place?.region,
      ].filter(Boolean);
      const exactAddress = [...new Set(exactParts)].join(', ');

      if (locality) {
        setArea(locality);
      }
      if (exactAddress) {
        setExactLocation(exactAddress);
      }
    } catch {
      setExactLocation(`Pinned location: ${nextCoordinate.latitude.toFixed(5)}, ${nextCoordinate.longitude.toFixed(5)}`);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const nextCoordinate = consumeLocationResult('create-event');
      if (nextCoordinate) {
        applyCoordinate(nextCoordinate);
      }
    }, [consumeLocationResult])
  );

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: eventDate ?? new Date(),
        mode: 'date',
        minimumDate: new Date(),
        onChange: (_event, selectedDate) => {
          if (selectedDate) setEventDate(selectedDate);
        },
      });
      return;
    }
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: eventTime ?? new Date(),
        mode: 'time',
        onChange: (_event, selectedTime) => {
          if (selectedTime) setEventTime(selectedTime);
        },
      });
      return;
    }
    setShowTimePicker(true);
  };

  const handleCreate = async () => {
    if (isSubmitting) {
      return;
    }

    if (shouldShowPaywallForCreate()) {
      router.push('/paywall');
      return;
    }

    if (!isFormValid) {
      setError('Add title, locality, date, exact time, and exact location.');
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
    setIsSubmitting(true);

    const selectedCategory = categories.find((item) => item.id === category);
    const dateTime = combineDateAndTime(eventDate!, eventTime!);

    try {
      const event = await createEvent({
        title,
        description: description.slice(0, 200),
        dateTime: dateTime.toISOString(),
        area,
        timeSlot: deriveTimeSlot(eventTime!),
        exactTime: formatTime(eventTime),
        exactLocation,
        locationNote: locationNote.slice(0, 90),
        latitude: coordinate?.latitude,
        longitude: coordinate?.longitude,
        mapUrl: coordinate ? googleMapsUrl(coordinate.latitude, coordinate.longitude) : undefined,
        location: exactLocation,
        maxPeople: parsedMaxPeople,
        category,
        emoji: selectedCategory?.emoji ?? '✨',
        womenOnly,
      });
      router.replace(`/event/${event.id}`);
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof Error && err.message === 'Plan creation limit reached') {
        router.push('/paywall');
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not create the plan. Try again.');
    }
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
          backgroundColor: colors.card,
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
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>Create a Plan</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
      >
        {usage.monetisationEnabled ? (
          <Pressable
            onPress={usage.createLimitReached ? () => router.push('/paywall') : undefined}
            style={{
              backgroundColor: usage.createLimitReached ? colors.status.warning.bg : colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: usage.createLimitReached ? colors.status.warning.border : colors.border,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="calendar-outline" size={18} color={usage.createLimitReached ? colors.status.warning.text : colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>
                {usage.createUsed}/{usage.createLimit} plans created this month
              </Text>
              <Text style={{ color: colors.muted, fontWeight: '800' }}>{usage.credits} credits</Text>
            </View>
            {usage.createLimitReached ? (
              <Text style={{ color: colors.status.warning.text, fontSize: 12, fontWeight: '700' }}>
                Limit reached. Tap here to get more credits and keep creating plans.
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>What is the vibe?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {categories.map((item) => {
              const active = item.id === category;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  style={{
                    width: '22%',
                    backgroundColor: active ? colors.status.info.bg : colors.surface,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
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

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Date and time</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={openDatePicker}
              style={{
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon name="calendar-outline" size={18} color={colors.primary} />
              <Text numberOfLines={1} style={{ flexShrink: 1, color: eventDate ? colors.text : colors.muted, fontWeight: '700' }}>
                {formatDate(eventDate)}
              </Text>
            </Pressable>
            <Pressable
              onPress={openTimePicker}
              style={{
                flex: 1,
                minHeight: 54,
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Icon name="time-outline" size={18} color={colors.primary} />
              <Text numberOfLines={1} style={{ flexShrink: 1, color: eventTime ? colors.text : colors.muted, fontWeight: '700' }}>
                {formatTime(eventTime)}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Location</Text>
          <Pressable
            onPress={() => {
              openLocationPicker('create-event', {
                coordinate,
                region: coordinate ? { ...defaultRegion, ...coordinate } : defaultRegion,
              });
              router.push('/location-picker');
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: colors.status.info.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="map-outline" size={20} color={colors.skyDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {coordinate ? 'Map pin selected' : 'Pin exact location on map'}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {area ? `${area} shown publicly` : 'Only locality is visible before approval'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
        </View>

        <FormField
          label="Locality shown publicly"
          value={area}
          onChangeText={setArea}
          placeholder="Zoo Road / Ganeshguri / Uzan Bazar"
        />
        <FormField
          label="One line about the location"
          value={locationNote}
          onChangeText={setLocationNote}
          placeholder="Near the main entrance, easy parking"
        />
        <FormField
          label="Private exact address"
          value={exactLocation}
          onChangeText={setExactLocation}
          placeholder="PVR City Centre lobby, Christian Basti"
        />
        <FormField
          label="Max People"
          value={maxPeople}
          onChangeText={setMaxPeople}
          keyboardType="numeric"
          placeholder="2 to 10"
        />

        {currentUser?.gender === 'woman' ? (
          <Pressable
            onPress={() => setWomenOnly((value) => !value)}
            style={{
              backgroundColor: womenOnly ? colors.status.danger.bg : colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: womenOnly ? colors.status.danger.border : colors.border,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Women only</Text>
              <Text style={{ color: colors.muted }}>
                Only women should be able to view and request this plan.
              </Text>
            </View>
            <Icon
              name={womenOnly ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={womenOnly ? colors.status.danger.text : colors.muted}
            />
          </Pressable>
        ) : null}

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        <GradientButton
          label={isSubmitting ? 'Dropping the plan...' : 'Drop the Plan'}
          onPress={handleCreate}
          disabled={!isFormValid || isSubmitting}
          fullWidth
        />
      </ScrollView>

      {Platform.OS !== 'android' && showDatePicker ? (
        <Modal transparent animationType="fade" visible={showDatePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <DateTimePicker
                value={eventDate ?? new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_event, selectedDate) => {
                  if (selectedDate) setEventDate(selectedDate);
                }}
              />
              <GradientButton label="Done" onPress={() => setShowDatePicker(false)} fullWidth />
            </View>
          </View>
        </Modal>
      ) : null}

      {Platform.OS !== 'android' && showTimePicker ? (
        <Modal transparent animationType="fade" visible={showTimePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <DateTimePicker
                value={eventTime ?? new Date()}
                mode="time"
                display="spinner"
                onChange={(_event, selectedTime) => {
                  if (selectedTime) setEventTime(selectedTime);
                }}
              />
              <GradientButton label="Done" onPress={() => setShowTimePicker(false)} fullWidth />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
