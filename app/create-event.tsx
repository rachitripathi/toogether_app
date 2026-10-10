import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { Icon } from '@/components/Icon';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { FormField } from '@/components/FormField';
import { GradientButton } from '@/components/GradientButton';
import { useLocationPickerStore, type MapCoordinate, type MapRegion } from '@/store/locationPickerStore';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import type { EventCategory } from '@/lib/types';
import { PLAN_LIMITS, cleanLine, cleanMultiline, parseGroupSize } from '@/lib/profileFields';
import { timeSlotFor } from '@/lib/eventTime';
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

// The last day a plan can start on: the same date next month, any time that day.
function getMaxEventDate() {
  const today = new Date();
  // Clamp to the target month's last day (Jan 31 -> Feb 28), like Postgres's `+ interval '1 month'`;
  // a plain setMonth would roll over into March.
  const targetMonth = today.getMonth() + PLAN_LIMITS.maxMonthsAhead;
  const lastDayOfTarget = new Date(today.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(today.getFullYear(), targetMonth, Math.min(today.getDate(), lastDayOfTarget), 23, 59, 59, 999);
}

// What the time picker opens on when no time is picked yet: the next half hour that's at least
// an hour away. Opening on "now" meant accepting the default made a plan that had already
// started, and started plans never show on Home.
function getSuggestedStartTime() {
  const suggested = new Date(Date.now() + 60 * 60 * 1000);
  suggested.setMinutes(suggested.getMinutes() <= 30 ? 30 : 60, 0, 0);
  return suggested;
}

function getEarliestStart() {
  return new Date(Date.now() + PLAN_LIMITS.minLeadMinutes * 60 * 1000);
}

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

  // Everything a plan needs before it can go live, in form order. The button stays disabled
  // until this is empty and the list is shown above it, so it's clear what's missing.
  // validate_event() (migration 015) enforces the same rules server-side.
  const startsAt = eventDate && eventTime ? combineDateAndTime(eventDate, eventTime) : null;
  const missing = [
    cleanLine(title).length < PLAN_LIMITS.titleMin && `a title (${PLAN_LIMITS.titleMin}+ characters)`,
    !eventDate && 'a date',
    !eventTime && 'a time',
    !cleanLine(area) && 'the public locality',
    !cleanLine(exactLocation) && 'the exact address',
    parseGroupSize(maxPeople) === null && `group size (${PLAN_LIMITS.minGroup} to ${PLAN_LIMITS.maxGroup})`,
  ].filter(Boolean) as string[];
  const startProblem =
    startsAt && startsAt < getEarliestStart()
      ? `Pick a start at least ${PLAN_LIMITS.minLeadMinutes} minutes from now.`
      : startsAt && startsAt > getMaxEventDate()
        ? `Plans can be at most ${PLAN_LIMITS.maxMonthsAhead} month ahead.`
        : '';
  const isFormValid = !missing.length && !startProblem;

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
        maximumDate: getMaxEventDate(),
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
        value: eventTime ?? getSuggestedStartTime(),
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

    // Re-checked here, not just via the disabled button: time keeps moving while the form is
    // open, so a start that was 20 minutes away can be 10 minutes away by the time of the tap.
    if (!isFormValid || !startsAt) {
      setError(startProblem || `Still needed: ${missing.join(', ')}.`);
      return;
    }
    const parsedMaxPeople = parseGroupSize(maxPeople)!;

    setError('');
    setIsSubmitting(true);

    const selectedCategory = categories.find((item) => item.id === category);
    const dateTime = startsAt;
    const cleanExactLocation = cleanLine(exactLocation);

    try {
      const event = await createEvent({
        title: cleanLine(title),
        description: cleanMultiline(description),
        dateTime: dateTime.toISOString(),
        area: cleanLine(area),
        timeSlot: timeSlotFor(eventTime!),
        exactTime: formatTime(eventTime),
        exactLocation: cleanExactLocation,
        locationNote: cleanLine(locationNote),
        latitude: coordinate?.latitude,
        longitude: coordinate?.longitude,
        mapUrl: coordinate ? googleMapsUrl(coordinate.latitude, coordinate.longitude) : undefined,
        location: cleanExactLocation,
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

      <KeyboardAwareScrollView
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

        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Movie night at City Centre"
          maxLength={PLAN_LIMITS.title}
        />
        <FormField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What is the hangout vibe?"
          multiline
          maxLength={PLAN_LIMITS.description}
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
          {startProblem ? <Text style={{ color: colors.danger, fontSize: 12 }}>{startProblem}</Text> : null}
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
          label="One line about the location (optional)"
          value={locationNote}
          onChangeText={setLocationNote}
          placeholder="Near the main entrance, easy parking"
          maxLength={PLAN_LIMITS.locationNote}
        />
        <FormField
          label="Private exact address"
          value={exactLocation}
          onChangeText={setExactLocation}
          placeholder="PVR City Centre lobby, Christian Basti"
          maxLength={PLAN_LIMITS.exactLocation}
        />
        <FormField
          label="Group size, including you"
          value={maxPeople}
          onChangeText={(text) => setMaxPeople(text.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder={`${PLAN_LIMITS.minGroup} to ${PLAN_LIMITS.maxGroup}`}
          error={maxPeople && parseGroupSize(maxPeople) === null ? `Enter a number from ${PLAN_LIMITS.minGroup} to ${PLAN_LIMITS.maxGroup}.` : undefined}
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

        {missing.length ? (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            Still needed: {missing.join(', ')}.
          </Text>
        ) : null}
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        <GradientButton
          label={isSubmitting ? 'Dropping the plan...' : 'Drop the Plan'}
          onPress={handleCreate}
          disabled={!isFormValid || isSubmitting}
          fullWidth
        />
      </KeyboardAwareScrollView>

      {Platform.OS !== 'android' && showDatePicker ? (
        <Modal transparent animationType="fade" visible={showDatePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <View style={{ backgroundColor: colors.card, padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <DateTimePicker
                value={eventDate ?? new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                maximumDate={getMaxEventDate()}
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
                value={eventTime ?? getSuggestedStartTime()}
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
