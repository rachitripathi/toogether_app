# Toogether Product Overview

## 1. One-Line Pitch

Toogether is a spontaneous social planning app that helps people discover nearby real-world plans, request to join safely, meet people through shared activities, and turn good interactions into a trusted crew.

## 2. Core Idea

Most social discovery apps start with profiles, swipes, or chat. Toogether starts with a plan.

Users do not need to cold-message strangers or keep dead group chats alive. They can either create a specific hangout or join one that already has a vibe, time window, locality, category, and host. Exact details stay private until the host approves a user.

The app is built around three loops:

1. Discover plans nearby.
2. Join or host plans with controlled approvals.
3. Build trust and repeat connections through crew, ratings, and verified profiles.

## 3. Target User

Primary users:

- Young adults who want spontaneous plans without awkward coordination.
- Students and early professionals in a city who want to meet people around low-pressure activities.
- People who prefer activity-first socializing over dating-style swiping.
- Women who need stronger visibility and safety controls before meeting new people.

Initial city context in the prototype is Guwahati, but the flow can generalize to any city.

## 4. Product Positioning

Toogether sits between:

- Meetup-style event discovery, but lighter and more spontaneous.
- Social networking, but centered on real plans.
- Group chat coordination, but with discovery, trust, and approval built in.
- Friend-making apps, but without making the profile the first move.

The product promise is: "Find the plan first, meet the people through it, keep the ones you vibe with."

## 5. Main App Flow

### 5.1 First Launch

The app starts with onboarding:

- Slide 1: discover spontaneous plans.
- Slide 2: create the vibe you want.
- Slide 3: meet people you click with.

The user can continue through the slides or skip, then lands on authentication.

### 5.2 Authentication

The app supports a simplified social login/signup flow:

- Continue with Google.
- Continue with Apple.
- Login and signup modes are separated visually.

The prototype currently uses mock users behind these buttons, but the intended direction is social authentication with a profile completion step afterward.

Important note in the product:

- Google and Apple do not reliably provide gender data.
- The app should ask users to confirm profile fields, especially for women-only plan visibility.

### 5.3 Verification Prompt

After sign-in, non-verified users can see a verification prompt.

The prompt explains that verification:

- Helps profiles feel safer.
- Improves host trust.
- Can support future discovery boosts.

Users can dismiss it or go to verification later.

## 6. Home / Discovery

The Home screen is the main discovery surface.

### What users see

- Personalized greeting.
- Sticky search bar.
- Category chips.
- Count of plans happening.
- Feed of plan cards.
- Floating create-plan button.
- Bottom navigation.

### Categories

There are eight plan categories:

1. Movies
2. Chill
3. Music
4. Sports
5. Food
6. Travel / Drives
7. Gaming
8. Other

Each category has its own card background art, color theme, CTA styling, and visual tone.

### Search and Filters

Users can filter by:

- Category.
- Plan title.
- Public locality.
- Public one-line location note.

Private exact address is intentionally not used as a public discovery field.

### Card Design

Each home card includes:

- Category theme background image.
- Category label.
- Spots left.
- Plan title.
- Public date and shift, not exact private time.
- Public locality.
- Host identity preview.
- Host age and karma status.
- CTA state.

CTA states include:

- Request to Join
- Pending
- Joined
- Manage
- Full
- Declined

CTA buttons are category-colored, vibrant, and lightly elevated.

## 7. Create Plan Flow

Users can create a new plan from the floating plus button.

### Plan fields

The create-plan flow includes:

- Category / vibe
- Title
- Description
- Date
- Exact time
- Public shift: Morning, Afternoon, Evening, Night
- Locality shown publicly
- One-line location note
- Private exact address
- Max people
- Optional women-only toggle for women users

### Native Date and Time

The app uses native date and time pickers:

- Android uses native picker dialogs.
- iOS/web fallback uses modal picker UI.

### Location and Map Pinning

The app supports pinning a location:

- Users can tap to open a map picker.
- Native builds use `react-native-maps`.
- Web/static preview uses a safe fallback so the app does not crash.
- Users can use current location.
- Reverse geocoding fills locality and exact address when available.
- The app stores latitude, longitude, and Google Maps URL.

### Public vs Private Location Design

Public before approval:

- Locality
- Date
- Shift
- One-line location hint

Private after approval:

- Exact meeting time
- Exact address
- Pinned map link

This gives enough context to decide whether to request joining, without exposing sensitive meeting details to everyone.

## 8. Event Detail Flow

The Event Detail page uses the same visual theme as the card.

### Header

The top area uses:

- Category background image.
- Event emoji and title.
- Category chip.
- Status pill.
- Open Chat button for approved users or host.

Status examples:

- Open for requests
- Approval pending
- Approved member
- You are hosting
- Request declined

### Public Information

All users who can view the event can see:

- Schedule card.
- Attendance card.
- Public date and shift.
- Public locality.
- Public location note.
- Spots / max people.
- Description.
- Host profile preview.
- Going list, if any.

### Private Details

Private details are locked until approval.

Locked state explains:

- Exact address and time unlock after approval.
- This protects spontaneous plans while keeping discovery useful.

Unlocked state shows:

- Exact meeting time.
- Exact address.
- Button to open pinned location in the phone's Maps app.

### Host Controls

If the current user is the host, they can:

- See pending join requests.
- Approve a request.
- Reject a request.
- Open chat.
- Manage the event from the detail page.

### Participant Controls

If the user is not the host, they can:

- Request to join.
- See pending state.
- See rejected/full states.
- Open chat once approved.

## 9. Chat

Each event has a chat screen.

Chat access rules:

- Host can chat.
- Approved participants can chat.
- Non-approved users see a locked message.

Chat screen includes:

- Compact event header.
- Message bubbles.
- User avatar per message.
- Sender name, age, and verified status for other users.
- Time stamp per message.
- Message composer for approved participants and hosts.

The chat intentionally avoids showing public/private event details in the header, keeping the screen focused on coordination.

## 10. People / My Crew

The People tab is the relationship layer.

It combines:

- Accepted crew members.
- People the user has interacted with through plans.
- Incoming crew requests.

### Crew Requests

Incoming requests show:

- User avatar.
- Verification state.
- Karma.
- Mutual plans.
- Existing personal rating, if any.
- Accept and decline actions.

### Crew Members

Crew member cards show:

- Name, avatar, username.
- Verification status.
- Karma average.
- Mutual plan count.
- Shared plans as horizontal chips.
- City.
- Rating action.

### Ratings

Users can rate people after sharing a plan.

The rating modal:

- Shows target user.
- Lets the current user choose 1-5 stars.
- Associates rating with a shared event.

Karma is calculated from received ratings.

## 11. Activity / Notifications

The Activity tab acts as an inbox.

It shows important updates such as:

- Someone wants to join a plan you host.
- Your join request was approved.
- Your join request was rejected.
- Someone sent you a crew request.
- Someone accepted your crew request.

Each activity item includes:

- Status label: Action needed, Good news, Update.
- Relevant user avatar.
- Title and subtitle.
- Helper text explaining what to do.
- Tap target to the relevant screen.

## 12. Profile

The user's own Profile tab includes:

- Avatar.
- Name and age.
- Verified badge.
- Bio.
- City and username.
- Metrics: total plans, crew, karma.

Profile sections:

- Plans I am hosting.
- Plans I joined.
- Past plans.
- Edit profile and settings.
- My crew.
- Notifications inbox.
- Logout.

Separate profile-plan pages list the relevant plans for each section.

## 13. Public User Profiles

Every user has a public profile screen.

It shows:

- Name, age, username, city.
- Verified badge.
- Bio.
- Plans hosted.
- Mutual plans.
- Karma.
- Trust snapshot.

Trust snapshot includes:

- ID verified or verification pending.
- Karma status.
- Mutual plans count.
- Hosted plans count.

Actions from another user's profile:

- Add to my crew.
- See crew request state.
- Invite the user to one of my events.
- Open mutual plans.
- Open plans hosted by that user.

## 14. Settings and Profile Editing

Settings include:

- Edit profile photo.
- Edit name.
- Edit username.
- Edit city.
- Edit bio.
- View app details.
- View privacy/community/safety messaging.
- App version.

Profile image editing uses the phone photo library.

## 15. Verification

Verification screen communicates the value of becoming verified:

- Profiles feel safer and more credible.
- Join requests are easier for hosts to trust.
- Future reach boosts can be tied to verified status.

Current prototype has the UI and messaging, but the actual document/ID verification process is not implemented yet.

## 16. Safety and Trust Model

The app has several safety-oriented mechanics:

### Host Approval

Users request to join; hosts approve or reject.

### Private Detail Lock

Exact time, exact address, and map pin are hidden until approval.

### Women-Only Visibility

Women users can create women-only plans. Those plans are hidden from non-women users unless they are the host.

### Verification

Verified badges are surfaced in:

- Event host previews.
- User profiles.
- Crew cards.
- Activity items.
- Chat sender metadata.

### Crew and Karma

Trust grows through repeated real interactions:

- Shared plans.
- Crew connections.
- Ratings.
- Karma average.

## 17. Visual System

The app uses a soft, friendly, mobile-first visual system.

Key visual choices:

- Rounded cards.
- Category-specific background art.
- Category-matched CTA colors.
- Floating bottom nav.
- Avatar gradients or user photo.
- Soft page background.
- Compact but playful headers.

Home card backgrounds currently exist for:

- Chill
- Food
- Gaming
- Movies
- Music
- Other
- Sports
- Travel

## 18. Current Prototype Data

The app currently uses mock in-memory data for:

- Users
- Events
- Join requests
- Crew requests
- Messages
- Ratings

This means data resets on app restart unless later connected to a backend.

Sample events include all eight categories so the feed can demonstrate the full card system.

## 19. Current Technical Stack

The prototype is built with:

- Expo
- React Native
- Expo Router
- TypeScript
- React Context for state
- Expo Location
- React Native Maps for native map pinning
- Expo Image Picker
- Expo Linear Gradient
- Ionicons
- React Native SVG

## 20. What Is Implemented vs Future Work

### Implemented in prototype

- Onboarding
- Social auth mock flow
- Home discovery
- Category filtering
- Search
- Category-themed cards
- Create plan
- Native date/time pickers
- Map pinning and reverse geocoding
- Public/private event details
- Host approval flow
- Chat access gating
- Crew requests
- Crew list
- Ratings and karma
- Activity inbox
- Profile and settings
- Verification messaging
- Women-only plan visibility logic

### Future work needed

- Real authentication.
- Backend database.
- Real-time chat.
- Push notifications.
- Real identity verification.
- Persistent user profiles.
- Moderation/reporting/blocking.
- Payment or monetization experiments.
- Location privacy hardening.
- Admin tools.
- Better onboarding profile completion.
- Matching/discovery ranking.
- Analytics.
- Production map API key setup.

## 21. Possible Monetization Paths

Potential future monetization options:

- Verified boosts for users.
- Hosted plan boosts.
- Premium trust features.
- Partnered local venues.
- Event discovery placements.
- Campus/city ambassador programs.
- Safety subscription for power users.

The current product should first validate repeat usage and trust before pushing monetization.

## 22. Metrics to Track

Early product metrics:

- Plans created per week.
- Join requests per plan.
- Approval rate.
- Chat activation after approval.
- Plans with at least one attendee.
- Repeat interactions between same users.
- Crew requests sent and accepted.
- Ratings submitted after plans.
- Verified conversion.
- Women-only plan creation and join rates.
- User retention after first joined/hosted plan.

## 23. Founder Discussion Points

Important strategic questions:

- Is Toogether a city-based social app, a campus app, or a broad friend-making app?
- Should the first wedge be women-safe plans, college hangouts, or city explorers?
- What is the minimum trust layer required before real-world meetups?
- Should the app prioritize hosting or joining in the first version?
- What should count as a successful plan?
- How strict should verification be?
- Should discovery be location-first, category-first, or social graph-first?
- What community guidelines and moderation tools are non-negotiable before launch?

## 24. Suggested Cofounder Summary

Toogether is an activity-first social discovery app. Instead of asking users to swipe on people or start awkward chats, it asks them what they want to do. Users create or join spontaneous plans like movie nights, chai runs, drives, games, music sessions, food crawls, and casual hangouts. Hosts approve join requests, exact details stay private until approval, and users build a trusted crew through shared plans, ratings, and verification.

The current prototype demonstrates the full loop: onboarding, discovery, plan creation, map pinning, public/private details, approvals, chat, crew, profiles, ratings, activity inbox, and safety-oriented visibility rules.
