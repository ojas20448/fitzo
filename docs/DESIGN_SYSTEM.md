# Fitzo - Design System

## Theme: Onyx & Snow

A monochromatic design system with pure black backgrounds and white accents, featuring glassmorphism and transparency effects.

## Color Palette

### Core Colors
```css
--color-background: #000000;      /* Pure black */
--color-surface: #121212;          /* Elevated surfaces */
--color-primary: #FFFFFF;          /* Primary actions, text */
--color-text-primary: #FFFFFF;     /* Main text */
--color-text-secondary: #A1A1AA;   /* Secondary text (zinc-400) */
--color-text-muted: #71717A;       /* Muted text (zinc-500) */
```

### Glass Effects
```css
--glass-surface: rgba(255, 255, 255, 0.08);
--glass-border: rgba(255, 255, 255, 0.15);
--glass-hover: rgba(255, 255, 255, 0.15);
--glass-backdrop-blur: 20px;
```

### Semantic Colors
```css
/* Crowd Indicators */
--color-crowd-low: #FFFFFF;        /* White glow for low */
--color-crowd-medium: #FFFFFF;     /* Dimmer white for medium */
--color-crowd-high: #FFFFFF;       /* Pulsing white for high */

/* Status */
--color-active: #FFFFFF;           /* Active/online indicator */
--color-inactive: rgba(255, 255, 255, 0.3);
```

## Typography

### Font Family
```
Primary: "Lexend", sans-serif
```

### Font Weights
```
Light: 300
Regular: 400
Medium: 500
Semibold: 600
Bold: 700
Extrabold: 800
```

### Type Scale
```css
--text-xs: 10px;    /* Labels, captions */
--text-sm: 12px;    /* Secondary text */
--text-base: 14px;  /* Body text */
--text-lg: 16px;    /* Emphasized body */
--text-xl: 18px;    /* Section headers */
--text-2xl: 24px;   /* Large headers */
--text-3xl: 30px;   /* Hero numbers */
--text-4xl: 36px;   /* Primary stats */
```

## Spacing

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

## Border Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-2xl: 32px;
--radius-full: 9999px;
```

## Shadows & Glows

```css
/* Glass shadow */
--shadow-glass: 0 4px 30px rgba(0, 0, 0, 0.5);

/* White glow effects */
--glow-sm: 0 0 10px rgba(255, 255, 255, 0.15);
--glow-md: 0 0 20px rgba(255, 255, 255, 0.2);
--glow-lg: 0 0 30px rgba(255, 255, 255, 0.3);

/* Active element glow */
--glow-active: 0 0 15px rgba(255, 255, 255, 0.6);
```

## Component Patterns

### Glass Panel
```css
.glass-panel {
  background: var(--glass-surface);
  backdrop-filter: blur(var(--glass-backdrop-blur));
  -webkit-backdrop-filter: blur(var(--glass-backdrop-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass);
}
```

### Primary Button
```css
.btn-primary {
  background: var(--color-primary);
  color: var(--color-background);
  font-weight: 700;
  border-radius: var(--radius-lg);
  padding: 16px 24px;
  box-shadow: var(--glow-md);
  transition: all 0.2s ease;
}

.btn-primary:active {
  transform: scale(0.98);
}
```

### Secondary Button
```css
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}
```

### Card (Intent Selector)
```css
.card-intent {
  background: var(--glass-surface);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  transition: all 0.2s ease;
}

.card-intent.active {
  background: var(--color-primary);
  color: var(--color-background);
  border-color: var(--color-primary);
  box-shadow: var(--glow-md);
}
```

### Avatar
```css
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  filter: grayscale(20%);
}

.avatar-glow {
  box-shadow: var(--glow-sm);
}
```

### Badge/Chip
```css
.badge {
  background: var(--glass-surface);
  border: 1px solid var(--glass-border);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-primary {
  background: var(--color-primary);
  color: var(--color-background);
}
```

## Animation

### Transitions
```css
--transition-fast: 150ms ease;
--transition-normal: 200ms ease;
--transition-slow: 300ms ease;
```

### Micro-animations
```css
/* Pulse for live indicators */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Subtle scale on tap */
.tap-scale:active {
  transform: scale(0.95);
}
```

## Layout Guidelines

### Safe Areas
```css
/* Bottom navigation padding */
padding-bottom: env(safe-area-inset-bottom, 24px);

/* Status bar padding */
padding-top: env(safe-area-inset-top, 12px);
```

### Touch Targets
- Minimum touch target: 44x44px
- Recommended: 48x48px for primary actions
- Large buttons: 56px height

### Screen Principles
- Maximum content width: 428px (iPhone 13 Pro Max)
- Horizontal padding: 16-20px
- Vertical rhythm: 8px baseline grid
