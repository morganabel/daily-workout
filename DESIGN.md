---
name: Leveza
colors:
  surface: '#F8FAFC'
  surface-dim: '#E2E8F0'
  surface-bright: '#FFFFFF'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#F8FAFC'
  surface-container: '#F1F5F9'
  surface-container-high: '#E2E8F0'
  surface-container-highest: '#CBD5E1'
  on-surface: '#0F172A'
  on-surface-variant: '#64748B'
  inverse-surface: '#0F172A'
  inverse-on-surface: '#F8FAFC'
  outline: '#94A3B8'
  outline-variant: '#E2E8F0'
  surface-tint: '#0EA5E9'
  primary: '#0EA5E9'
  on-primary: '#FFFFFF'
  primary-container: '#E0F2FE'
  on-primary-container: '#0284C7'
  inverse-primary: '#7DD3FC'
  secondary: '#64748B'
  on-secondary: '#FFFFFF'
  secondary-container: '#F1F5F9'
  on-secondary-container: '#334155'
  tertiary: '#6366F1'
  on-tertiary: '#FFFFFF'
  tertiary-container: '#EEF2FF'
  on-tertiary-container: '#3730A3'
  error: '#EF4444'
  on-error: '#FFFFFF'
  error-container: '#FEE2E2'
  on-error-container: '#991B1B'
  primary-fixed: '#E0F2FE'
  primary-fixed-dim: '#7DD3FC'
  on-primary-fixed: '#082F49'
  on-primary-fixed-variant: '#0284C7'
  secondary-fixed: '#F1F5F9'
  secondary-fixed-dim: '#CBD5E1'
  on-secondary-fixed: '#0F172A'
  on-secondary-fixed-variant: '#475569'
  tertiary-fixed: '#EEF2FF'
  tertiary-fixed-dim: '#C7D2FE'
  on-tertiary-fixed: '#1E1B4B'
  on-tertiary-fixed-variant: '#4338CA'
  background: '#F8FAFC'
  on-background: '#0F172A'
  surface-variant: '#F1F5F9'
  card: '#FFFFFF'
  card-secondary: '#F1F5F9'
  border: '#E2E8F0'
  border-strong: '#CBD5E1'
  text-muted: '#94A3B8'
  success: '#10B981'
  success-container: '#D1FAE5'
  warning: '#F59E0B'
  warning-container: '#FEF3C7'
  destructive: '#EF4444'
  destructive-container: '#FEE2E2'
  accent-purple: '#A855F7'
  accent-indigo: '#6366F1'
typography:
  display:
    fontFamily: Manrope
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 41px
    letterSpacing: -0.6px
  h1:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.4px
  h2:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: '800'
    lineHeight: 28px
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-caps:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 1px
  metric:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.4px
rounded:
  sm: 0.375rem
  DEFAULT: 0.75rem
  md: 0.875rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-edge: 20px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  touch-target-min: 44px
---

## Brand & Style

Leveza is a minimalist, open-source workout companion that feels like a personal trainer with memory. The design system should feel **calm, tactile, and credible**: one or two taps should get a user to the next useful action without dense setup, over-explaining, or gym-bro intensity.

The visual direction is "Quiet Coach". It borrows from iOS Human Interface Guidelines through large touch targets, clear hierarchy, safe-area-aware layouts, bottom navigation, and restrained motion. It also keeps the open-source product promise visible through clarity and trust: no dark patterns, no ad-like surfaces, no unnecessary social pressure.

The app should look premium but not precious. Use generous spacing, rounded white cards, thin slate borders, and a focused sky-blue action color. Interfaces should feel fast and obvious during physical activity: concise labels, short forms, tappable chips, and a default path that fits on one screen whenever possible.

## Colors

The palette is a light slate system with a sky-blue action layer. Most screens sit on a soft slate canvas with white cards and low-contrast slate containers. Color is used functionally: blue means action/progress/selection, green means completed, amber means caution, and red means destructive or blocked.

- **Primary Sky (#0EA5E9):** Used for main CTAs, selected chips/cards, active nav tabs, timers, progress markers, links, and emphasis states.
- **Background (#F8FAFC):** The main app canvas. Keep it visible around cards so the UI breathes.
- **Card (#FFFFFF):** Primary content containers, account cards, history cards, and major choice surfaces.
- **Card Secondary (#F1F5F9):** Input fills, flat cards, segmented controls, inactive pills, set rows, and subtle grouped areas.
- **Text Primary (#0F172A):** Titles, important instructions, workout names, and active content.
- **Text Secondary (#64748B):** Supporting metadata, descriptions, inactive labels, and secondary controls.
- **Text Muted (#94A3B8):** Helper labels, disabled text, empty states, section labels, and low-priority metadata.
- **Border (#E2E8F0):** Default 1px separators and card/control outlines. Use #CBD5E1 only for stronger emphasis, such as today's calendar outline.
- **Success (#10B981):** Completed exercise and set checkmarks.
- **Warning (#F59E0B):** Recoverable validation or caution states.
- **Destructive (#EF4444):** Delete/archive errors and destructive actions, normally paired with #FEE2E2 containers.

Avoid large gradients and decorative color fields. When a lighter primary treatment is needed, prefer a pale sky container (#E0F2FE) or a low-opacity sky tint over inventing new blues.

## Typography

The app uses **Manrope** through the Expo Google Fonts package. Current loaded weights are 600, 700, and 800, so the system is intentionally sturdy and legible rather than delicate.

- **Display:** Use 34px/800 for launch-page brand messaging and rare hero statements.
- **Screen Titles:** Use 28px/800 for most screens. 32px/800 is acceptable for history-style overview pages that need stronger hierarchy.
- **Section Titles:** Use 11-13px/700 uppercase labels with 0.8-1px letter spacing for scan-friendly blocks.
- **Body Text:** Use 14-16px/600 with 20-24px line height. Keep body copy short; the product voice is concise and trainer-like.
- **Controls:** Use 13-16px/700 for buttons, chips, tabs, and links.
- **Metrics:** Use 32px/700 with tabular numerals for timers and live workout values.

Do not introduce decorative font pairings. The product should feel utilitarian, clear, and native-mobile.

## Layout & Spacing

The system is mobile-first and optimized for one-handed use during workouts. Screens use a 20px outer margin, safe-area-aware top padding, and bottom spacing that respects the tab bar or sticky workout footer.

- **Outer Margin:** 20px on mobile screens.
- **Card Padding:** 16px for standard cards and 20px for forms, sheets, and important groupings.
- **Section Rhythm:** Use 24px between normal sections and 32px for large settings/profile group breaks.
- **Internal Gaps:** Use 8px for tight rows, 12px for related controls, and 16px for card content groups.
- **Touch Targets:** Keep all primary interactions at least 44px tall or wide. Primary buttons should feel closer to 52-56px tall through 16px vertical padding.
- **Alignment:** Prefer left-aligned content. Center only transient metrics, empty states, and loading states.
- **Scrolling:** Preserve breathing room above sticky footers and the bottom nav; content should never feel trapped behind fixed controls.

Use chips and cards instead of dense forms wherever possible. When forms are necessary, group fields in short, clearly labeled sections.

## Elevation & Depth

Depth is subtle and mostly structural. The app relies on tonal layers, 1px borders, and sparse shadows rather than heavy elevation.

- **Level 0 (Canvas):** #F8FAFC for the application background.
- **Level 1 (Primary Card):** #FFFFFF with 1px #E2E8F0 border and 16px radius.
- **Level 2 (Inset/Flat Surface):** #F1F5F9 with optional border for inputs, segmented controls, and flat cards.
- **Card Shadow:** `0px 4px 16px rgba(14, 165, 233, 0.05)` for reusable cards when lift is needed.
- **Primary Button Shadow:** `0px 4px 8px rgba(14, 165, 233, 0.20)` for standard primary buttons.
- **Hero CTA Shadow:** `0px 8px 16px rgba(14, 165, 233, 0.30)` for the main Generate Workout action.
- **Bottom Nav Shadow:** `0px -2px 8px rgba(0, 0, 0, 0.05)` with a translucent white surface.
- **Sheets:** Use a dark scrim (`#000000aa`) and white bottom sheet with 24px top corners.

Avoid shadow stacks, glassmorphism, and high-contrast drop shadows. If the surface already has a border, a shadow is optional and should be barely visible.

## Shapes

The shape language is soft, practical, and tap-friendly. Rounded forms should make the app feel safe and approachable without becoming bubbly or childish.

- **Cards:** 16px radius for most content cards; 18px for large workout-preview blocks; 24px for bottom sheets and major modal surfaces.
- **Buttons:** 14px radius for standard buttons; full radius for compact save pills and provider pills.
- **Inputs:** 12px radius with a 1px slate border and a #F1F5F9 or #FFFFFF fill depending on context.
- **Chips:** 12px radius for filter chips; full radius for compact focus pills and tags.
- **Checkboxes:** Rounded squares, 24-28px, with 2px border and green fill when completed.
- **Icons:** Use simple Ionicons-style line icons at 20-24px. Active bottom nav icons may switch to filled variants.

Do not use sharp cards, hard rectangles, or ornamental icon containers unless they communicate a clear workout state.

## Components

- **Buttons:** Primary buttons are solid #0EA5E9 with white 16px/700 text, 16px vertical padding, 24px horizontal padding, 14px radius, and a soft sky shadow. Secondary buttons use #F1F5F9 with #0F172A text and a #E2E8F0 border. Ghost/outline buttons remain quiet and should not compete with the primary path.
- **Cards:** Use white cards with 16px radius, 16-20px padding, 1px #E2E8F0 border, and optional subtle sky-tinted shadow. Flat cards use #F1F5F9 and no shadow.
- **Choice Cards:** Selected workout focus cards invert to #0EA5E9 with white text. Unselected cards remain white with slate borders. Use clear labels, short descriptions, and optional checkmarks rather than complex controls.
- **Chips/Filters:** Chips use 10px vertical and 16px horizontal padding, 12px radius, white or #F1F5F9 fills, and #64748B text. Selected chips use #0EA5E9 with white text.
- **Inputs:** Inputs use #F1F5F9 or white fills, 12px radius, 1px #E2E8F0 border, 14-16px Manrope text, and #94A3B8 placeholders. Keep forms short and use helper text sparingly.
- **Bottom Navigation:** Use a translucent white surface (`rgba(255, 255, 255, 0.9)`), 1px top border, 24px icons, 10px labels, and #0EA5E9 for the active tab. Labels are Today, History, and Profile.
- **Bottom Sheets:** Sheets slide from the bottom over a dark scrim, use 24px top corners, 20px padding, a 40x4px handle, and 90% max height. Keep sheet titles at 22px/800 with concise 15px supporting text.
- **Workout Timer:** Use metric typography in #0EA5E9 with tabular numerals. Keep the timer immediately scannable in active workout headers.
- **Workout Logging Rows:** Exercise groups live in bordered white cards. Sets use compact rows, rounded square checkboxes, #F1F5F9 inputs, and 8-10px gaps to support fast in-gym logging.
- **Calendar & History:** Calendar days use 34px circular hit areas, sky fill for selected dates, thin slate outline for today, and small sky dots for activity markers. History cards use clear workout names, muted metadata, and quiet action links.
- **Status Banners:** Use pale containers with matching borders: #D1FAE5 for success, #FEF3C7 for warning, and #FEE2E2 for destructive/error states. Keep copy direct and actionable.
- **Advanced/BYOK Areas:** De-emphasize advanced configuration with muted uppercase labels and secondary links. These controls should feel available but never like the primary onboarding path.
