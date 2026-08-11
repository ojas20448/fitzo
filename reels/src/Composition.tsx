import {
  AbsoluteFill,
  Composition,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Img,
  staticFile,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Lexend";
import React from "react";

const { fontFamily } = loadFont();

// ─── Brand tokens (matches Fitzo app theme.ts) ──────────────────────
const BRAND = {
  bg: "#000000",
  surface: "#0A0A0A",
  surfaceLight: "#121212",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.55)",
  subtle: "rgba(255,255,255,0.35)",
  protein: "#4ECDC4",   // Fitzo teal
  carbs: "#FFE66D",     // Fitzo yellow
  fat: "#FF6B6B",       // Fitzo coral
  orange: "#FF6B35",    // Fitzo streak/brand orange
  success: "#22C55E",
  glass: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.12)",
};

const FOOD_DATA = [
  {
    rank: 1,
    name: "Chicken Breast",
    hindiName: "चिकन ब्रेस्ट",
    image: staticFile("chicken.jpg"),
    per100g: { protein: 31, fat: 3.6, carbs: 0, calories: 165 },
    tip: "King of lean protein. Grill it, shred it, curry it.",
    badge: "👑 #1 Protein King",
  },
  {
    rank: 2,
    name: "Eggs (Whole)",
    hindiName: "अंडे",
    image: staticFile("eggs.jpg"),
    per100g: { protein: 13, fat: 11, carbs: 1, calories: 155 },
    tip: "Cheapest complete protein. 2 eggs = 12g protein.",
    badge: "💰 Budget GOAT",
  },
  {
    rank: 3,
    name: "Paneer",
    hindiName: "पनीर",
    image: staticFile("paneer.jpg"),
    per100g: { protein: 18, fat: 20, carbs: 1.2, calories: 265 },
    tip: "Great protein — but watch the fat. It adds up fast.",
    badge: "⚠️ Hidden Fat Trap",
  },
  {
    rank: 4,
    name: "Dal / Lentils",
    hindiName: "दाल",
    image: staticFile("dal.jpg"),
    per100g: { protein: 9, fat: 0.4, carbs: 20, calories: 116 },
    tip: "Veg staple. Pair with rice for complete amino acids.",
    badge: "🌱 Veg Staple",
  },
  {
    rank: 5,
    name: "Greek Yogurt",
    hindiName: "ग्रीक दही",
    image: staticFile("yogurt.jpg"),
    per100g: { protein: 10, fat: 0.7, carbs: 3.6, calories: 59 },
    tip: "Low cal, high protein snack. Add it to everything.",
    badge: "🥄 Snack Hack",
  },
];

const SERVING_INFO: Record<number, { serving: string; proteinPerServing: string }> = {
  1: { serving: "1 breast (~150g)", proteinPerServing: "46g" },
  2: { serving: "2 whole eggs (~100g)", proteinPerServing: "12g" },
  3: { serving: "4 cubes (~80g)", proteinPerServing: "14g" },
  4: { serving: "1 katori (~150g)", proteinPerServing: "13g" },
  5: { serving: "1 cup (~170g)", proteinPerServing: "17g" },
};

// ─── TIMING (frames at 30fps) ────────────────────────────────────────
const FPS = 30;
const SCENE_HOOK = 5 * FPS;         // 150 frames (5s)
const SCENE_FOOD = 6 * FPS;         // each food card: 180 frames (6s)
const SCENE_APP = 5 * FPS;          // 150 frames (5s) — app preview
const SCENE_CTA = 6 * FPS;          // 180 frames (6s)
const TOTAL = SCENE_HOOK + SCENE_FOOD * 5 + SCENE_APP + SCENE_CTA; // 1380 frames = 46s

// ─── HELPERS ──────────────────────────────────────────────────────────
const ease = (t: number) =>
  interpolate(t, [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });

const AnimatedBar: React.FC<{
  value: number;
  max: number;
  color: string;
  label: string;
  unit?: string;
  frame: number;
  delay?: number;
}> = ({ value, max, color, label, unit = "g", frame, delay = 0 }) => {
  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: { damping: 18, mass: 0.8 },
  });
  const width = (value / max) * 100 * progress;
  const displayVal = (value * progress).toFixed(1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 110,
          fontSize: 28,
          color: "rgba(255,255,255,0.7)",
          fontWeight: 600,
          textAlign: "right",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 48,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 14,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: 14,
            boxShadow: `0 0 20px ${color}44`,
          }}
        />
      </div>
      <div
        style={{
          width: 90,
          fontSize: 30,
          fontWeight: 700,
          color: BRAND.white,
          textAlign: "left",
        }}
      >
        {displayVal}
        {unit}
      </div>
    </div>
  );
};

// ─── PROTEIN % RING ───────────────────────────────────────────────────
const ProteinRing: React.FC<{ calories: number; proteinG: number; frame: number }> = ({ calories, proteinG, frame }) => {
  const proteinCals = proteinG * 4;
  const pct = Math.round((proteinCals / calories) * 100);
  const progress = spring({ frame: Math.max(0, frame - 55), fps: FPS, config: { damping: 20 } });
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (circumference * pct / 100) * progress;
  const displayPct = Math.round(pct * progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r="54" fill="none"
          stroke={BRAND.protein}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 65 65)"
          style={{ filter: `drop-shadow(0 0 8px ${BRAND.protein}88)` }}
        />
        <text x="65" y="60" textAnchor="middle" fill={BRAND.white} fontSize="34" fontWeight="800" fontFamily={fontFamily}>
          {displayPct}%
        </text>
        <text x="65" y="82" textAnchor="middle" fill={BRAND.muted} fontSize="14" fontWeight="500" fontFamily={fontFamily}>
          protein cal
        </text>
      </svg>
    </div>
  );
};

// ─── SCENE: HOOK ──────────────────────────────────────────────────────
const SceneHook: React.FC<{ frame: number }> = ({ frame }) => {
  const logoScale = spring({
    frame,
    fps: FPS,
    config: { damping: 10, mass: 0.6 },
  });
  const textOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [15, 35], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flagScale = spring({
    frame: Math.max(0, frame - 40),
    fps: FPS,
    config: { damping: 8 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
      }}
    >
      {/* Subtle radial gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      <div
        style={{
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile("fitzo-logo.png")}
          style={{ width: 140, height: 140, borderRadius: 28 }}
        />
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: BRAND.white,
            letterSpacing: -1,
          }}
        >
          FITZO
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 320,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: BRAND.white,
            lineHeight: 1.15,
            letterSpacing: -2,
          }}
        >
          Top 5 Protein
          <br />
          Sources in
          <br />
          <span style={{ color: BRAND.orange }}>Indian Diets</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 220,
          opacity: subtitleOpacity,
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 52,
            transform: `scale(${flagScale})`,
          }}
        >
          🇮🇳
        </div>
        <div
          style={{
            fontSize: 28,
            color: BRAND.muted,
            fontWeight: 500,
          }}
        >
          per 100g · cooked
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE: FOOD CARD ─────────────────────────────────────────────────
const SceneFood: React.FC<{
  food: (typeof FOOD_DATA)[number];
  frame: number;
}> = ({ food, frame }) => {
  const slideIn = spring({
    frame,
    fps: FPS,
    config: { damping: 14, mass: 0.7 },
  });
  const imageScale = spring({
    frame: Math.max(0, frame - 5),
    fps: FPS,
    config: { damping: 16 },
  });
  const badgeOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tipOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const maxMacro = 35;

  const serving = SERVING_INFO[food.rank];
  const servingOpacity = interpolate(frame, [60, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        fontFamily,
        padding: 48,
      }}
    >
      {/* Subtle background glow behind image area */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: "50%",
          width: 500,
          height: 500,
          transform: "translateX(-50%)",
          background: `radial-gradient(circle, ${BRAND.orange}08 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Top bar: rank + badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: slideIn,
          marginTop: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: BRAND.orange,
              lineHeight: 1,
            }}
          >
            #{food.rank}
          </span>
        </div>
        <div
          style={{
            opacity: badgeOpacity,
            fontSize: 24,
            fontWeight: 600,
            color: BRAND.white,
            background: BRAND.glass,
            border: `1px solid ${BRAND.glassBorder}`,
            borderRadius: 50,
            padding: "8px 20px",
          }}
        >
          {food.badge}
        </div>
      </div>

      {/* Food name */}
      <div
        style={{
          opacity: slideIn,
          transform: `translateX(${(1 - slideIn) * 60}px)`,
          marginTop: 12,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: BRAND.white,
            letterSpacing: -1,
          }}
        >
          {food.name}
        </div>
        <div
          style={{
            fontSize: 28,
            color: BRAND.muted,
            marginTop: 2,
          }}
        >
          {food.hindiName}
        </div>
      </div>

      {/* Food image — enlarged with glow ring */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${imageScale})`,
          position: "relative",
        }}
      >
        {/* Glow ring behind image */}
        <div
          style={{
            position: "absolute",
            inset: -12,
            borderRadius: 40,
            background: `conic-gradient(from 0deg, ${BRAND.protein}33, ${BRAND.orange}33, ${BRAND.fat}33, ${BRAND.protein}33)`,
            filter: "blur(16px)",
            opacity: imageScale * 0.6,
          }}
        />
        <div
          style={{
            width: 440,
            height: 440,
            borderRadius: 36,
            overflow: "hidden",
            border: `2px solid ${BRAND.glassBorder}`,
            position: "relative",
          }}
        >
          <Img
            src={food.image}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Calorie overlay on image */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "16px 0",
              background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
              textAlign: "center",
              opacity: badgeOpacity,
            }}
          >
            <span style={{ fontSize: 40, fontWeight: 800, color: BRAND.white }}>
              {food.per100g.calories}
            </span>
            <span style={{ fontSize: 24, color: BRAND.muted, marginLeft: 8 }}>
              kcal / 100g
            </span>
          </div>
        </div>
      </div>

      {/* Macro bars */}
      <div style={{ marginTop: 32, padding: "0 8px" }}>
        <AnimatedBar
          label="Protein"
          value={food.per100g.protein}
          max={maxMacro}
          color={BRAND.protein}
          frame={frame}
          delay={25}
        />
        <AnimatedBar
          label="Fat"
          value={food.per100g.fat}
          max={maxMacro}
          color={BRAND.fat}
          frame={frame}
          delay={35}
        />
        <AnimatedBar
          label="Carbs"
          value={food.per100g.carbs}
          max={maxMacro}
          color={BRAND.carbs}
          frame={frame}
          delay={45}
        />
      </div>

      {/* Bottom section: Pro tip + Protein ring + Serving info */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          gap: 24,
          opacity: tipOpacity,
        }}
      >
        {/* Left: Pro tip + serving */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: BRAND.glass,
              border: `1px solid ${BRAND.glassBorder}`,
              borderRadius: 20,
              padding: "18px 24px",
            }}
          >
            <div
              style={{
                fontSize: 20,
                color: BRAND.orange,
                fontWeight: 700,
                marginBottom: 6,
                letterSpacing: 1,
              }}
            >
              💡 PRO TIP
            </div>
            <div
              style={{
                fontSize: 24,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              {food.tip}
            </div>
          </div>

          {/* Serving size card */}
          {serving && (
            <div
              style={{
                background: BRAND.glass,
                border: `1px solid ${BRAND.glassBorder}`,
                borderRadius: 20,
                padding: "16px 24px",
                opacity: servingOpacity,
              }}
            >
              <div style={{ fontSize: 18, color: BRAND.muted, fontWeight: 600, letterSpacing: 1 }}>
                🍽️ TYPICAL SERVING
              </div>
              <div style={{ fontSize: 24, color: BRAND.white, fontWeight: 700, marginTop: 6 }}>
                {serving.serving}
              </div>
              <div style={{ fontSize: 22, color: BRAND.protein, fontWeight: 700, marginTop: 4 }}>
                → {serving.proteinPerServing} protein
              </div>
            </div>
          )}
        </div>

        {/* Right: Protein % ring */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <ProteinRing
            calories={food.per100g.calories}
            proteinG={food.per100g.protein}
            frame={frame}
          />
        </div>
      </div>

      {/* Fitzo watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          opacity: 0.35,
        }}
      >
        <Img
          src={staticFile("fitzo-logo.png")}
          style={{ width: 28, height: 28, borderRadius: 6 }}
        />
        <span style={{ fontSize: 20, fontWeight: 600, color: BRAND.white }}>
          FITZO
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE: CTA ───────────────────────────────────────────────────────
const SceneCTA: React.FC<{ frame: number }> = ({ frame }) => {
  const logoScale = spring({
    frame,
    fps: FPS,
    config: { damping: 10, mass: 0.5 },
  });
  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaScale = spring({
    frame: Math.max(0, frame - 35),
    fps: FPS,
    config: { damping: 12 },
  });
  const arrowBounce =
    Math.sin((frame - 60) * 0.15) * 8;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(255,107,53,0.08) 0%, transparent 60%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          transform: `scale(${logoScale})`,
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile("fitzo-logo.png")}
          style={{ width: 160, height: 160, borderRadius: 32 }}
        />
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: BRAND.white,
            letterSpacing: -1,
          }}
        >
          FITZO
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 360,
          textAlign: "center",
          opacity: textOpacity,
          zIndex: 1,
          padding: "0 48px",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: BRAND.white,
            lineHeight: 1.3,
          }}
        >
          Track every{" "}
          <span style={{ color: BRAND.protein }}>roti</span>,{" "}
          <span style={{ color: BRAND.fat }}>dal</span> &{" "}
          <span style={{ color: BRAND.carbs }}>paneer</span>
        </div>
        <div
          style={{
            fontSize: 30,
            color: BRAND.muted,
            marginTop: 16,
          }}
        >
          India's smartest nutrition coach
        </div>
      </div>

      {/* CTA button */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          transform: `scale(${ctaScale})`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: BRAND.white,
            color: BRAND.bg,
            fontSize: 32,
            fontWeight: 800,
            padding: "20px 56px",
            borderRadius: 50,
            letterSpacing: -0.5,
          }}
        >
          Download Fitzo
        </div>
      </div>

      {/* Link in bio arrow */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          zIndex: 1,
          opacity: interpolate(frame, [60, 75], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: BRAND.muted,
            fontWeight: 600,
          }}
        >
          Link in bio
        </div>
        <div
          style={{
            fontSize: 36,
            transform: `translateY(${arrowBounce}px)`,
          }}
        >
          👇
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── SCENE: APP PREVIEW (Phone Mockup) ────────────────────────────────
const SceneAppPreview: React.FC<{ frame: number }> = ({ frame }) => {
  const phoneScale = spring({ frame, fps: FPS, config: { damping: 14, mass: 0.7 } });
  const uiOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const barProgress = (delay: number) => spring({ frame: Math.max(0, frame - delay), fps: FPS, config: { damping: 18 } });
  const shimmer = interpolate(frame, [0, 150], [-200, 600], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg, fontFamily, alignItems: "center", justifyContent: "center" }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 45%, rgba(78,205,196,0.06) 0%, transparent 60%)",
      }} />

      {/* Title text */}
      <div style={{
        position: "absolute", top: 120, textAlign: "center", opacity: textOpacity, zIndex: 2,
      }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: BRAND.white, lineHeight: 1.2, letterSpacing: -1 }}>
          Track all of this
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: BRAND.orange, lineHeight: 1.2, letterSpacing: -1 }}>
          in one app
        </div>
      </div>

      {/* Phone frame */}
      <div style={{
        transform: `scale(${phoneScale}) translateY(40px)`,
        width: 380, height: 780,
        borderRadius: 48, border: `3px solid rgba(255,255,255,0.2)`,
        background: BRAND.surface,
        overflow: "hidden", position: "relative",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(78,205,196,0.1)",
      }}>
        {/* Phone notch */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 140, height: 32, borderRadius: "0 0 20px 20px",
          background: "#000", zIndex: 10,
        }} />

        {/* Status bar */}
        <div style={{
          padding: "42px 24px 12px", display: "flex", justifyContent: "space-between",
          fontSize: 14, color: BRAND.muted, fontWeight: 600,
        }}>
          <span>9:41</span>
          <span>●●● ▐█▌</span>
        </div>

        {/* App header */}
        <div style={{ padding: "8px 24px 16px", opacity: uiOpacity }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Img src={staticFile("fitzo-logo.png")} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: BRAND.white }}>FITZO</span>
          </div>
          <div style={{ fontSize: 14, color: BRAND.muted, marginTop: 8 }}>Today's Nutrition</div>
        </div>

        {/* Calorie ring card */}
        <div style={{
          margin: "0 16px", padding: 20, borderRadius: 24,
          background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}`,
          opacity: uiOpacity, position: "relative", overflow: "hidden",
        }}>
          {/* Shimmer effect */}
          <div style={{
            position: "absolute", top: 0, left: shimmer, width: 100, height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
            transform: "skewX(-15deg)",
          }} />
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Mini calorie ring */}
            <svg width="90" height="90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle cx="45" cy="45" r="36" fill="none" stroke={BRAND.protein} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 * (1 - 0.68 * barProgress(40))}
                transform="rotate(-90 45 45)"
                style={{ filter: `drop-shadow(0 0 6px ${BRAND.protein}66)` }}
              />
              <text x="45" y="42" textAnchor="middle" fill={BRAND.white} fontSize="20" fontWeight="800" fontFamily={fontFamily}>
                {Math.round(1840 * barProgress(40))}
              </text>
              <text x="45" y="56" textAnchor="middle" fill={BRAND.muted} fontSize="10" fontFamily={fontFamily}>
                / 2700
              </text>
            </svg>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.white }}>Calories</div>
              <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>860 remaining</div>
            </div>
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ margin: "16px 16px 0", padding: "16px 20px", borderRadius: 24,
          background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}`, opacity: uiOpacity }}>
          {[{ label: "Protein", cur: 98, goal: 150, color: BRAND.protein, d: 50 },
            { label: "Carbs", cur: 210, goal: 340, color: BRAND.carbs, d: 60 },
            { label: "Fat", cur: 52, goal: 75, color: BRAND.fat, d: 70 }].map(m => (
            <div key={m.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{m.label}</span>
                <span style={{ color: BRAND.white, fontWeight: 700 }}>
                  {Math.round(m.cur * barProgress(m.d))}g / {m.goal}g
                </span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  width: `${(m.cur / m.goal) * 100 * barProgress(m.d)}%`, height: "100%",
                  background: `linear-gradient(90deg, ${m.color}, ${m.color}cc)`, borderRadius: 8,
                  boxShadow: `0 0 10px ${m.color}44`,
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent meals */}
        <div style={{ margin: "16px 16px 0", padding: "16px 20px", borderRadius: 24,
          background: BRAND.glass, border: `1px solid ${BRAND.glassBorder}`,
          opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          <div style={{ fontSize: 13, color: BRAND.muted, fontWeight: 600, marginBottom: 12, letterSpacing: 0.5 }}>
            RECENT MEALS
          </div>
          {[{ name: "Chicken Curry + Rice", cal: 520, time: "1:30 PM" },
            { name: "2 Boiled Eggs", cal: 155, time: "10:00 AM" },
            { name: "Greek Yogurt + Honey", cal: 120, time: "8:30 AM" }].map((meal, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderTop: i > 0 ? `1px solid ${BRAND.glassBorder}` : "none",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.white }}>{meal.name}</div>
                <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2 }}>{meal.time}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.protein }}>{meal.cal} kcal</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom text */}
      <div style={{
        position: "absolute", bottom: 100, textAlign: "center",
        opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 28, color: BRAND.muted, fontWeight: 500 }}>
          Every roti. Every dal. Tracked.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── ROOT COMPOSITION ─────────────────────────────────────────────────
export const TopProteinReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appFrom = SCENE_HOOK + 5 * SCENE_FOOD;
  const ctaFrom = appFrom + SCENE_APP;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg, fontFamily }}>
      {/* Scene 1: Hook */}
      <Sequence from={0} durationInFrames={SCENE_HOOK}>
        <SceneHook frame={frame} />
      </Sequence>

      {/* Scenes 2-6: Food cards */}
      {FOOD_DATA.map((food, i) => {
        const from = SCENE_HOOK + i * SCENE_FOOD;
        return (
          <Sequence key={food.rank} from={from} durationInFrames={SCENE_FOOD}>
            <SceneFood food={food} frame={frame - from} />
          </Sequence>
        );
      })}

      {/* Scene 7: App Preview */}
      <Sequence from={appFrom} durationInFrames={SCENE_APP}>
        <SceneAppPreview frame={frame - appFrom} />
      </Sequence>

      {/* Scene 8: CTA */}
      <Sequence from={ctaFrom} durationInFrames={SCENE_CTA}>
        <SceneCTA frame={frame - ctaFrom} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── REGISTER ─────────────────────────────────────────────────────────
export const MyComposition = () => {
  return (
    <Composition
      id="TopProteinReel"
      component={TopProteinReel}
      durationInFrames={TOTAL}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
