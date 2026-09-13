import React from 'react';
import {
  Cloud,
  CloudLightning,
  CloudRain,
  Droplets,
  Leaf,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { GameState, WeatherType } from '../../types';

/**
 * =============================================================================
 * TROPICAL MAP CLOCK — QUICK TUNING
 * =============================================================================
 * Chỉ dùng MỘT raster asset: tropical-clock-frame.png.
 * Kim + text + icon mùa/thời tiết là DOM overlay trên chính asset này.
 *
 * Tất cả tọa độ bên trong clock dùng DESIGN PIXEL của ảnh gốc 2048 x 682.
 * Vì vậy muốn căn lệch 2–3 px chỉ cần sửa x / y / w / h ở đây.
 * =============================================================================
 */

const CLOCK_FRAME_SRC = '/public/tropical-clock-frame.png';

const CLOCK_UI = {
  // Kích thước thật của PNG clock frame.
  frameReference: {
    width: 2048,
    height: 682,
  },

  // Vị trí + kích thước TỔNG của clock khi nằm trên World Map.
  // Các giá trị dùng design-pixel của map reference 953 x 846.
  mapReference: {
    width: 953,
    height: 846,
  },

  root: {
    left: -15,
    top: -15,
    width: 430,
    scale: 1.0,
    zIndex: 45,
    opacity: 0.98,
    shadow: 'drop-shadow(0 5px 8px rgba(0,0,0,0.72))',
  },

  // ---------------------------------------------------------------------------
  // DIAL / KIM 24 GIỜ
  // ---------------------------------------------------------------------------
  // Tâm kim đã căn theo núm đồng nằm giữa mặt Sun/Moon của ảnh mới.
  dial: {
    pivotX: 397,
    pivotY: 322,
  },

  hand: {
    // Kim được dựng bằng DOM, không dùng thêm asset.
    // x/y tự tính từ pivot; chỉ cần chỉnh length/width hoặc offset nếu cần.
    length: 174,
    width: 8,
    offsetX: 0,
    offsetY: 0,
    zIndex: 12,
    background:
      'linear-gradient(90deg, #4a2914 0%, #bb7c35 22%, #f2c56f 48%, #fff0b1 58%, #a9672d 82%, #3a2113 100%)',
    shadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(238,190,99,0.45)',
    opacity: 0.92,
  },

  handCap: {
    x: 384,
    y: 309,
    w: 26,
    h: 26,
    zIndex: 13,
  },

  // ---------------------------------------------------------------------------
  // TOP PANEL — giờ + ngày/tháng/năm
  // ---------------------------------------------------------------------------
  time: {
    x: 750,
    y: 188,
    w: 370,
    h: 112,
    fontPx: 108,
    weight: 800,
    letterSpacingEm: 0.035,
  },

  date: {
    x: 1190,
    y: 194,
    w: 570,
    h: 100,
    fontPx: 75,
    weight: 700,
    letterSpacingEm: 0.05,
  },

  // ---------------------------------------------------------------------------
  // BOTTOM PANEL — mùa / thời tiết / nhiệt độ
  // ---------------------------------------------------------------------------
  season: {
    x: 750,
    y: 380,
    w: 340,
    h: 82,
    iconPx: 75,
    fontPx: 68,
    gapPx: 17,
  },

  weather: {
    x: 1120,
    y: 380,
    w: 390,
    h: 82,
    iconPx: 75,
    fontPx: 58,
    gapPx: 17,
  },

  temperature: {
    x: 1540,
    y: 380,
    w: 250,
    h: 82,
    iconPx: 69,
    fontPx: 62,
    gapPx: 12,
  },

  // Giữ humidity nếu muốn dùng về sau. false = không render.
  humidity: {
    enabled: false,
    x: 1780,
    y: 380,
    w: 150,
    h: 82,
    iconPx: 34,
    fontPx: 24,
    gapPx: 9,
  },

  typography: {
    family: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
    primary: '#f1e4c9',
    secondary: '#c9d4bd',
    accent: '#e4b86b',
    softBlurPx: 0.10,
    shadow: '0 2px 2px rgba(0,0,0,0.92), 0 0 2px rgba(0,0,0,0.62)',
  },

  iconStyle: {
    color: '#e4b86b',
    strokeWidth: 2.2,
    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.9))',
    opacity: 0.94,
  },
} as const;

const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  light_rain: 'Light Rain',
  heavy_rain: 'Heavy Rain',
  storm: 'Storm',
  heat_wave: 'Heat Wave',
};

const SEASONS = ['Wet Season', 'High Rain', 'Late Wet', 'Dry Season'] as const;
const DAYS_PER_SEASON = 30;
const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

// 120-day game year -> 12 compact game-months of 10 days each.
const DAYS_PER_MONTH = 10;
const MONTHS_PER_YEAR = DAYS_PER_YEAR / DAYS_PER_MONTH;

interface TropicalMapClockProps {
  gameTime: GameState['gameTime'];
  weather: GameState['weather'];
}

const formatClockTime = (minuteOfDay: number) => {
  const normalizedMinutes = ((minuteOfDay % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = Math.floor(normalizedMinutes % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const frameRectStyle = (
  box: { x: number; y: number; w: number; h: number },
): React.CSSProperties => ({
  position: 'absolute',
  left: `${(box.x / CLOCK_UI.frameReference.width) * 100}%`,
  top: `${(box.y / CLOCK_UI.frameReference.height) * 100}%`,
  width: `${(box.w / CLOCK_UI.frameReference.width) * 100}%`,
  height: `${(box.h / CLOCK_UI.frameReference.height) * 100}%`,
});

const scaledPx = (px: number) => `${(px / CLOCK_UI.frameReference.width) * 100}cqw`;

const softTextStyle = (
  fontPx: number,
  weight: number,
  color: string = CLOCK_UI.typography.primary,
): React.CSSProperties => ({
  fontFamily: CLOCK_UI.typography.family,
  fontSize: scaledPx(fontPx),
  fontWeight: weight,
  color,
  textShadow: CLOCK_UI.typography.shadow,
  filter: `blur(${CLOCK_UI.typography.softBlurPx}px)`,
  lineHeight: 1,
  whiteSpace: 'nowrap',
});

const SeasonIcon: React.FC<{ seasonIndex: number; sizePx: number }> = ({ seasonIndex, sizePx }) => {
  const common = {
    width: scaledPx(sizePx),
    height: scaledPx(sizePx),
    color: CLOCK_UI.iconStyle.color,
    strokeWidth: CLOCK_UI.iconStyle.strokeWidth,
    filter: CLOCK_UI.iconStyle.filter,
    opacity: CLOCK_UI.iconStyle.opacity,
  };

  if (seasonIndex === 0) return <Droplets style={common} />;
  if (seasonIndex === 1) return <CloudRain style={common} />;
  if (seasonIndex === 2) return <Leaf style={common} />;
  return <Sun style={common} />;
};

const WeatherIcon: React.FC<{ weather: WeatherType; sizePx: number }> = ({ weather, sizePx }) => {
  const common = {
    width: scaledPx(sizePx),
    height: scaledPx(sizePx),
    color: CLOCK_UI.iconStyle.color,
    strokeWidth: CLOCK_UI.iconStyle.strokeWidth,
    filter: CLOCK_UI.iconStyle.filter,
    opacity: CLOCK_UI.iconStyle.opacity,
  };

  switch (weather) {
    case 'clear':
    case 'heat_wave':
      return <Sun style={common} />;
    case 'cloudy':
      return <Cloud style={common} />;
    case 'light_rain':
    case 'heavy_rain':
      return <CloudRain style={common} />;
    case 'storm':
      return <CloudLightning style={common} />;
    default:
      return <Cloud style={common} />;
  }
};

export const TropicalMapClock: React.FC<TropicalMapClockProps> = ({ gameTime, weather }) => {
  const normalizedDay = Math.max(1, Math.floor(gameTime.day));
  const dayIndex = normalizedDay - 1;

  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const season = SEASONS[seasonIndex];

  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1;
  const dayOfMonth = (dayOfYear % DAYS_PER_MONTH) + 1;

  // Mặt clock này là Sun/Moon 24h:
  // 00:00 -> chỉ xuống Moon, 12:00 -> chỉ lên Sun.
  const normalizedMinutes = ((gameTime.minuteOfDay % 1440) + 1440) % 1440;
  const handRotation = (normalizedMinutes / 1440) * 360 + 180;

  const pivotX = CLOCK_UI.dial.pivotX + CLOCK_UI.hand.offsetX;
  const pivotY = CLOCK_UI.dial.pivotY + CLOCK_UI.hand.offsetY;

  const handBox = {
    x: pivotX - CLOCK_UI.hand.width / 2,
    y: pivotY - CLOCK_UI.hand.length,
    w: CLOCK_UI.hand.width,
    h: CLOCK_UI.hand.length,
  };

  const rootWidthPct = (CLOCK_UI.root.width / CLOCK_UI.mapReference.width) * 100;
  const rootLeftPct = (CLOCK_UI.root.left / CLOCK_UI.mapReference.width) * 100;
  const rootTopPct = (CLOCK_UI.root.top / CLOCK_UI.mapReference.height) * 100;

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        left: `${rootLeftPct}%`,
        top: `${rootTopPct}%`,
        width: `${rootWidthPct}%`,
        aspectRatio: `${CLOCK_UI.frameReference.width} / ${CLOCK_UI.frameReference.height}`,
        zIndex: CLOCK_UI.root.zIndex,
        opacity: CLOCK_UI.root.opacity,
        filter: CLOCK_UI.root.shadow,
        transform: `scale(${CLOCK_UI.root.scale})`,
        transformOrigin: 'top left',
        containerType: 'inline-size',
      }}
      aria-label={`Day ${normalizedDay}, ${formatClockTime(gameTime.minuteOfDay)}, ${WEATHER_LABELS[weather.current]}`}
    >
      {/* The ONE AND ONLY raster clock asset. */}
      <img
        src={CLOCK_FRAME_SRC}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
      />

      {/* 24-hour hand. Initial geometry points straight up; rotate around exact brass pivot. */}
      <div
        style={{
          ...frameRectStyle(handBox),
          zIndex: CLOCK_UI.hand.zIndex,
          transform: `rotate(${handRotation}deg)`,
          transformOrigin: '50% 100%',
          opacity: CLOCK_UI.hand.opacity,
        }}
      >
        <div
          className="h-full w-full"
          style={{
            background: CLOCK_UI.hand.background,
            boxShadow: CLOCK_UI.hand.shadow,
            clipPath: 'polygon(50% 0%, 100% 12%, 70% 100%, 30% 100%, 0% 12%)',
            borderRadius: '999px 999px 2px 2px',
          }}
        />
      </div>

      {/* Small DOM cap hides the hand base and blends into the baked brass hub. */}
      <div
        style={{
          ...frameRectStyle(CLOCK_UI.handCap),
          zIndex: CLOCK_UI.handCap.zIndex,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 40% 35%, #f2c77b 0%, #ad6a2a 35%, #613516 67%, #2c1b10 100%)',
          border: `${scaledPx(2)} solid rgba(229,181,92,0.72)`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.9)',
        }}
      />

      {/* TOP PANEL */}
      <div
        className="absolute flex items-center"
        style={{
          ...frameRectStyle(CLOCK_UI.time),
          ...softTextStyle(CLOCK_UI.time.fontPx, CLOCK_UI.time.weight),
          letterSpacing: `${CLOCK_UI.time.letterSpacingEm}em`,
        }}
      >
        {formatClockTime(gameTime.minuteOfDay)}
      </div>

      <div
        className="absolute flex items-center"
        style={{
          ...frameRectStyle(CLOCK_UI.date),
          ...softTextStyle(CLOCK_UI.date.fontPx, CLOCK_UI.date.weight, CLOCK_UI.typography.secondary),
          letterSpacing: `${CLOCK_UI.date.letterSpacingEm}em`,
        }}
      >
        {dayOfMonth.toString().padStart(2, '0')} / {month.toString().padStart(2, '0')} / Y{year.toString().padStart(2, '0')}
      </div>

      {/* BOTTOM PANEL */}
      <div
        className="absolute flex items-center"
        style={{
          ...frameRectStyle(CLOCK_UI.season),
          gap: scaledPx(CLOCK_UI.season.gapPx),
        }}
      >
        <SeasonIcon seasonIndex={seasonIndex} sizePx={CLOCK_UI.season.iconPx} />
        <span style={softTextStyle(CLOCK_UI.season.fontPx, 700, CLOCK_UI.typography.secondary)}>{season}</span>
      </div>

      <div
        className="absolute flex items-center"
        style={{
          ...frameRectStyle(CLOCK_UI.weather),
          gap: scaledPx(CLOCK_UI.weather.gapPx),
        }}
      >
        <WeatherIcon weather={weather.current} sizePx={CLOCK_UI.weather.iconPx} />
        <span style={softTextStyle(CLOCK_UI.weather.fontPx, 700, CLOCK_UI.typography.secondary)}>
          {WEATHER_LABELS[weather.current]}
        </span>
      </div>

      <div
        className="absolute flex items-center"
        style={{
          ...frameRectStyle(CLOCK_UI.temperature),
          gap: scaledPx(CLOCK_UI.temperature.gapPx),
        }}
      >
        <Thermometer
          style={{
            width: scaledPx(CLOCK_UI.temperature.iconPx),
            height: scaledPx(CLOCK_UI.temperature.iconPx),
            color: CLOCK_UI.iconStyle.color,
            strokeWidth: CLOCK_UI.iconStyle.strokeWidth,
            filter: CLOCK_UI.iconStyle.filter,
          }}
        />
        <span style={softTextStyle(CLOCK_UI.temperature.fontPx, 800)}>
          {Math.round(weather.temperatureC)}°C
        </span>
      </div>

      {weather.wind && (
        <div
          className="absolute flex items-center"
          style={{
            left: '88%',
            top: '56%',
            height: '12%',
            gap: scaledPx(10),
          }}
          title={`Gió: ${weather.wind.speedKmh} km/h (Gió giật ${weather.wind.gustKmh} km/h), Hướng ${weather.wind.cardinal} (${weather.wind.directionDeg}°)`}
        >
          <Wind
            style={{
              width: scaledPx(52),
              height: scaledPx(52),
              color: CLOCK_UI.iconStyle.color,
              strokeWidth: CLOCK_UI.iconStyle.strokeWidth,
              filter: CLOCK_UI.iconStyle.filter,
              transform: `rotate(${weather.wind.directionDeg}deg)`,
              transition: 'transform 0.5s ease-out',
            }}
          />
          <span style={softTextStyle(44, 700, CLOCK_UI.typography.secondary)}>
            {Math.round(weather.wind.speedKmh)} <span className="text-[0.8em] opacity-80">{weather.wind.cardinal}</span>
          </span>
        </div>
      )}

      {CLOCK_UI.humidity.enabled && (
        <div
          className="absolute flex items-center"
          style={{
            ...frameRectStyle(CLOCK_UI.humidity),
            gap: scaledPx(CLOCK_UI.humidity.gapPx),
          }}
        >
          <Droplets
            style={{
              width: scaledPx(CLOCK_UI.humidity.iconPx),
              height: scaledPx(CLOCK_UI.humidity.iconPx),
              color: '#9ed9df',
              strokeWidth: CLOCK_UI.iconStyle.strokeWidth,
              filter: CLOCK_UI.iconStyle.filter,
            }}
          />
          <span style={softTextStyle(CLOCK_UI.humidity.fontPx, 700, CLOCK_UI.typography.secondary)}>
            {Math.round(weather.humidityPercent)}%
          </span>
        </div>
      )}
    </div>
  );
};
