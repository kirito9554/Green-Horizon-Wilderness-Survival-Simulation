import React from 'react';
import {
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  CloudLightning,
  Cloud,
  Eye,
  ThermometerSun,
  Leaf,
} from 'lucide-react';
import { GameState, WeatherType } from '../../types';

interface HeaderTacticalHUDProps {
  weather: GameState['weather'];
  gameTime: GameState['gameTime'];
}

type HudBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * =============================================================================
 * HEADER TACTICAL HUD — MEASURED LAYOUT
 * =============================================================================
 * Source asset: public/header-hud-bg.png
 * Native size: 2168 x 258 px.
 *
 * The three rope dividers were measured directly from the raster at roughly:
 *   x = 648, 1484, 1777
 *
 * Every interactive/content region below uses that same design coordinate space,
 * then converts to percentages. This keeps text, icons and images locked to the
 * painted wood panels even when the HUD is stretched by the 16:9 game canvas.
 *
 * Font/icon sizes use cqh (container-query height units) instead of fixed px.
 * This is intentional: the header height is the limiting dimension, so UI type
 * now grows/shrinks with the actual rendered HUD rather than staying fixed-size.
 * =============================================================================
 */
export const HEADER_HUD_UI = {
  reference: {
    width: 2168,
    height: 258,
  },

  measuredDividers: [648, 1484, 1777],

  // Safe dark interior, excluding the top/bottom wooden rails.
  safeContent: { x: 78, y: 52, w: 2024, h: 156 } satisfies HudBox,

  // Panel 1 — Current weather.
  weatherPhoto: { x: 88, y: 57, w: 154, h: 145 } satisfies HudBox,
  weatherInfo: { x: 260, y: 55, w: 355, h: 150 } satisfies HudBox,

  // Panel 2 — Day-cycle medallion, clock and calendar.
  clockMedallion: { x: 700, y: 72, w: 115, h: 115 } satisfies HudBox,
  clockInfo: { x: 840, y: 53, w: 585, h: 151 } satisfies HudBox,

  // Panel 3 — Season.
  season: { x: 1510, y: 55, w: 238, h: 152 } satisfies HudBox,

  // Panel 4 — Temperature / humidity / wind.
  environment: { x: 1802, y: 55, w: 298, h: 152 } satisfies HudBox,
} as const;

export const WEATHER_CONFIG: Record<
  WeatherType,
  {
    nameVi: string;
    image: string;
    description: string;
    accentColor: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }
> = {
  clear: {
    nameVi: 'Nắng Trong',
    image: '/weather-card/01_sunny.png',
    description: 'Nắng ráo, tầm nhìn tốt',
    accentColor: '#e5ad53',
    icon: Sun,
  },
  light_rain: {
    nameVi: 'Mưa Rào',
    image: '/weather-card/02_light_rain.png',
    description: 'Mưa lất phất, mát mẻ',
    accentColor: '#5ec4e6',
    icon: CloudRain,
  },
  heavy_rain: {
    nameVi: 'Mưa Rất Lớn',
    image: '/weather-card/03_heavy_rain.png',
    description: 'Mưa tầm tã xối xả',
    accentColor: '#4f9ee8',
    icon: CloudRain,
  },
  storm: {
    nameVi: 'Bão Táp Dữ Dội',
    image: '/weather-card/04_storm.png',
    description: 'Gió giật sấm sét nguy hiểm',
    accentColor: '#e66578',
    icon: CloudLightning,
  },
  cloudy: {
    nameVi: 'Nhiều Mây',
    image: '/weather-card/05_cloudy.png',
    description: 'Mây che râm mát',
    accentColor: '#d1d5db',
    icon: Cloud,
  },
  fog: {
    nameVi: 'Sương Mù Dày',
    image: '/weather-card/06_fog.png',
    description: 'Tầm nhìn hạn chế',
    accentColor: '#7dd3a8',
    icon: Eye,
  },
  heat_wave: {
    nameVi: 'Sóng Nhiệt Gay Gắt',
    image: '/weather-card/07_heatwave.png',
    description: 'Nhiệt độ cao, tiêu hao nước nhanh',
    accentColor: '#f18c47',
    icon: ThermometerSun,
  },
};

const SEASONS_CONFIG = [
  { name: 'Mùa Mưa Nhiệt Đới', color: '#4ade80' },
  { name: 'Mùa Mưa Cực Đại', color: '#60a5fa' },
  { name: 'Mùa Chuyển Gió', color: '#34d399' },
  { name: 'Mùa Khô Khắc Nghiệt', color: '#fbbf24' },
];

const DAYS_PER_SEASON = 30;
const DAYS_PER_YEAR = 120;
const DAYS_PER_MONTH = 10;

const pxX = (px: number) => `${(px / HEADER_HUD_UI.reference.width) * 100}%`;
const pxY = (px: number) => `${(px / HEADER_HUD_UI.reference.height) * 100}%`;

const boxStyle = (box: HudBox): React.CSSProperties => ({
  left: pxX(box.x),
  top: pxY(box.y),
  width: pxX(box.w),
  height: pxY(box.h),
});

/**
 * Scale a source-design pixel measurement against the *rendered HUD height*.
 * Clamp only prevents text becoming physically unreadable on very small windows.
 */
const hudSize = (designPx: number, minPx: number, maxPx: number) =>
  `clamp(${minPx}px, ${(designPx / HEADER_HUD_UI.reference.height) * 100}cqh, ${maxPx}px)`;

const hudFont = (designPx: number, minPx: number, maxPx: number): React.CSSProperties => ({
  fontSize: hudSize(designPx, minPx, maxPx),
});

const TEXT_SHADOW = '0 2px 4px rgba(0, 0, 0, 0.95)';
const SMALL_TEXT_SHADOW = '0 1px 2px rgba(0, 0, 0, 0.95)';

export const HeaderTacticalHUD: React.FC<HeaderTacticalHUDProps> = ({ weather, gameTime }) => {
  const currentCfg = WEATHER_CONFIG[weather.current] || WEATHER_CONFIG.clear;
  const nextCfg = weather.next ? WEATHER_CONFIG[weather.next] : undefined;
  const WeatherIcon = currentCfg.icon;

  const normalizedDay = Math.max(1, gameTime.day);
  const dayIndex = normalizedDay - 1;
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON) % SEASONS_CONFIG.length;
  const currentSeason = SEASONS_CONFIG[seasonIndex];
  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1;

  const normalizedMinutes = ((gameTime.minuteOfDay % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = Math.floor(normalizedMinutes % 60);
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  let DayCycleIcon = Sun;
  let cycleLabel = 'BAN NGÀY';
  let cycleGlow = '#ecc069';

  if (hours >= 5 && hours < 8) {
    DayCycleIcon = Sunrise;
    cycleLabel = 'BÌNH MINH';
    cycleGlow = '#e8a252';
  } else if (hours >= 8 && hours < 16) {
    DayCycleIcon = Sun;
    cycleLabel = 'BAN NGÀY';
    cycleGlow = '#ecc069';
  } else if (hours >= 16 && hours < 19) {
    DayCycleIcon = Sunset;
    cycleLabel = 'HOÀNG HÔN';
    cycleGlow = '#df7c49';
  } else {
    DayCycleIcon = Moon;
    cycleLabel = 'ĐÊM TỐI';
    cycleGlow = '#8ba3ce';
  }

  const tempC = Math.round(weather.temperatureC);
  const humidity = Math.round(weather.humidityPercent);
  const windSpeed = weather.wind?.speedKmh ? Math.round(weather.wind.speedKmh) : 14;
  const windCardinal = weather.wind?.cardinal || 'E';

  const statLabelStyle: React.CSSProperties = {
    ...hudFont(18, 7, 11),
    fontFamily: '"Roboto Condensed", "Be Vietnam Pro", sans-serif',
    color: '#bca073',
    fontWeight: 700,
    letterSpacing: '0.06em',
    lineHeight: 1,
    textShadow: SMALL_TEXT_SHADOW,
    whiteSpace: 'nowrap',
  };

  const statValueStyle: React.CSSProperties = {
    ...hudFont(31, 10, 18),
    fontFamily: '"Lora", "Merriweather", serif',
    color: '#f7edd9',
    fontWeight: 700,
    lineHeight: 1,
    textShadow: TEXT_SHADOW,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      className="relative w-full h-full select-none bg-[url('/header-hud-bg.png')] bg-[length:100%_100%] bg-no-repeat filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
      style={{
        imageRendering: 'auto',
        containerType: 'size',
        pointerEvents: 'none',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* PANEL 1 — weather photo                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute overflow-hidden"
        style={{
          ...boxStyle(HEADER_HUD_UI.weatherPhoto),
          borderRadius: hudSize(5, 2, 5),
          boxShadow:
            'inset 0 3px 11px rgba(0,0,0,0.92), 0 1px 3px rgba(196,145,76,0.15)',
        }}
        title={`Thời tiết hiện tại: ${currentCfg.nameVi}\n${currentCfg.description}`}
      >
        <img
          src={currentCfg.image}
          alt={currentCfg.nameVi}
          className="absolute inset-0 w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />

        <div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            right: hudSize(7, 2, 6),
            top: hudSize(7, 2, 6),
            width: hudSize(31, 12, 20),
            height: hudSize(31, 12, 20),
            background: 'rgba(6, 8, 6, 0.76)',
            border: '1px solid rgba(226, 207, 169, 0.28)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.75)',
          }}
        >
          <WeatherIcon
            style={{
              width: hudSize(17, 7, 12),
              height: hudSize(17, 7, 12),
              color: currentCfg.accentColor,
            }}
          />
        </div>
      </div>

      {/* PANEL 1 — weather text */}
      <div
        className="absolute flex flex-col justify-center min-w-0"
        style={{
          ...boxStyle(HEADER_HUD_UI.weatherInfo),
          fontFamily: '"Lora", "Merriweather", serif',
        }}
      >
        <div className="flex items-center min-w-0" style={{ gap: hudSize(8, 3, 7) }}>
          <span
            style={{
              ...hudFont(19, 7.5, 12),
              color: '#bca073',
              fontFamily: '"Roboto Condensed", "Be Vietnam Pro", sans-serif',
              fontWeight: 700,
              letterSpacing: '0.075em',
              lineHeight: 1,
              textShadow: SMALL_TEXT_SHADOW,
              whiteSpace: 'nowrap',
            }}
          >
            THỜI TIẾT HIỆN TẠI
          </span>
          <span
            className="flex-1"
            style={{
              height: 1,
              minWidth: hudSize(18, 7, 16),
              background: 'linear-gradient(90deg, rgba(154,111,59,.72), rgba(154,111,59,0))',
            }}
          />
        </div>

        <div
          className="flex items-center min-w-0"
          style={{
            gap: hudSize(10, 3, 8),
            marginTop: hudSize(10, 3, 8),
          }}
        >
          <div
            className="shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: hudSize(39, 15, 26),
              height: hudSize(39, 15, 26),
              background: 'rgba(16, 13, 8, 0.66)',
              border: '1px solid rgba(128, 91, 48, 0.58)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,.85)',
            }}
          >
            <WeatherIcon
              style={{
                width: hudSize(22, 8, 15),
                height: hudSize(22, 8, 15),
                color: currentCfg.accentColor,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.9))',
              }}
            />
          </div>

          <span
            className="truncate"
            style={{
              ...hudFont(34, 12, 22),
              color: '#f3e5ca',
              fontWeight: 700,
              lineHeight: 1.02,
              textShadow: TEXT_SHADOW,
            }}
          >
            {currentCfg.nameVi}
          </span>
        </div>

        <div
          className="flex items-center min-w-0 truncate"
          style={{
            marginTop: hudSize(9, 2, 7),
            gap: hudSize(7, 2, 5),
            ...hudFont(19, 7.5, 12),
            color: '#a99477',
            fontFamily: '"Roboto Condensed", "Be Vietnam Pro", sans-serif',
            lineHeight: 1,
            textShadow: SMALL_TEXT_SHADOW,
          }}
        >
          <span className="shrink-0">Sắp tới:</span>
          <span className="shrink-0 font-bold" style={{ color: '#d9a452' }}>›</span>
          <span className="truncate" style={{ color: '#d8c3a5', fontWeight: 600 }}>
            {nextCfg?.nameVi || currentCfg.nameVi}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PANEL 2 — day-cycle medallion                                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          ...boxStyle(HEADER_HUD_UI.clockMedallion),
          border: `${hudSize(3, 1, 2)} solid rgba(157, 111, 55, 0.86)`,
          background:
            'radial-gradient(circle at 50% 42%, rgba(74,49,22,.95) 0%, rgba(34,22,10,.98) 58%, rgba(10,8,5,.98) 100%)',
          boxShadow:
            '0 3px 9px rgba(0,0,0,.9), inset 0 0 0 2px rgba(235,190,120,.12), inset 0 3px 7px rgba(255,214,145,.08)',
        }}
        title={`Thời khắc: ${cycleLabel}`}
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: hudSize(10, 3, 8),
            border: '1px solid rgba(195,145,76,.32)',
          }}
        />
        <DayCycleIcon
          style={{
            width: hudSize(48, 17, 31),
            height: hudSize(48, 17, 31),
            color: cycleGlow,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.95))',
          }}
        />
      </div>

      {/* PANEL 2 — clock / calendar */}
      <div
        className="absolute flex flex-col justify-center min-w-0"
        style={{
          ...boxStyle(HEADER_HUD_UI.clockInfo),
          fontFamily: '"Lora", "Merriweather", serif',
        }}
      >
        <div
          className="flex items-baseline min-w-0 whitespace-nowrap"
          style={{ gap: hudSize(12, 4, 10) }}
        >
          <span
            style={{
              ...hudFont(53, 17, 31),
              color: '#f7edd9',
              fontFamily: '"Merriweather", "Lora", serif',
              fontWeight: 900,
              letterSpacing: '0.035em',
              lineHeight: 1,
              textShadow: '0 2px 5px rgba(0,0,0,1)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeString}
          </span>

          <span
            aria-hidden="true"
            style={{
              ...hudFont(35, 12, 21),
              color: '#765331',
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            |
          </span>

          <span
            className="truncate"
            style={{
              ...hudFont(25, 9, 16),
              color: cycleGlow,
              fontFamily: '"Roboto Condensed", "Be Vietnam Pro", sans-serif',
              fontWeight: 700,
              letterSpacing: '0.085em',
              lineHeight: 1,
              textShadow: SMALL_TEXT_SHADOW,
            }}
          >
            {cycleLabel}
          </span>
        </div>

        <div
          className="flex items-center min-w-0"
          style={{
            marginTop: hudSize(17, 5, 12),
            gap: hudSize(13, 4, 10),
          }}
        >
          <span
            className="whitespace-nowrap"
            style={{
              ...hudFont(21, 8, 14),
              color: '#bca98a',
              fontWeight: 500,
              lineHeight: 1,
              textShadow: SMALL_TEXT_SHADOW,
            }}
          >
            Ngày <strong style={{ color: '#ead4b2' }}>{normalizedDay}</strong>
            {' · '}Tháng {month}
            {' · '}Năm {year}
          </span>
          <span
            className="flex-1"
            style={{
              height: 1,
              maxWidth: pxX(120),
              background: 'linear-gradient(90deg, rgba(154,111,59,.7), rgba(154,111,59,0))',
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PANEL 3 — season                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute flex flex-col justify-center min-w-0"
        style={{
          ...boxStyle(HEADER_HUD_UI.season),
          fontFamily: '"Lora", "Merriweather", serif',
        }}
      >
        <div
          className="flex items-center min-w-0"
          style={{ gap: hudSize(8, 2, 6) }}
        >
          <Leaf
            className="shrink-0"
            style={{
              width: hudSize(27, 9, 17),
              height: hudSize(27, 9, 17),
              color: '#75c98f',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.9))',
            }}
          />
          <span
            style={{
              ...hudFont(20, 8, 13),
              color: '#bca073',
              fontFamily: '"Roboto Condensed", "Be Vietnam Pro", sans-serif',
              fontWeight: 700,
              letterSpacing: '0.07em',
              lineHeight: 1,
              textShadow: SMALL_TEXT_SHADOW,
              whiteSpace: 'nowrap',
            }}
          >
            MÙA VỤ
          </span>
        </div>

        <span
          className="block min-w-0"
          title={`Mùa hiện tại: ${currentSeason.name}`}
          style={{
            marginTop: hudSize(13, 4, 10),
            ...hudFont(28, 10, 18),
            color: currentSeason.color,
            fontWeight: 700,
            lineHeight: 1.12,
            textShadow: TEXT_SHADOW,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {currentSeason.name}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PANEL 4 — environment                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute grid grid-cols-3 items-stretch"
        style={boxStyle(HEADER_HUD_UI.environment)}
      >
        <div className="flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center" style={{ gap: hudSize(5, 2, 4) }}>
            <Thermometer
              style={{
                width: hudSize(23, 8, 15),
                height: hudSize(23, 8, 15),
                color: '#e5ad53',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.9))',
              }}
            />
            <span style={statLabelStyle}>NHIỆT</span>
          </div>
          <span style={{ ...statValueStyle, marginTop: hudSize(13, 4, 9) }}>{tempC}°C</span>
        </div>

        <div
          className="flex flex-col items-center justify-center min-w-0"
          style={{
            borderLeft: '1px solid rgba(119,84,46,.26)',
            borderRight: '1px solid rgba(119,84,46,.26)',
          }}
        >
          <div className="flex items-center" style={{ gap: hudSize(5, 2, 4) }}>
            <Droplets
              style={{
                width: hudSize(23, 8, 15),
                height: hudSize(23, 8, 15),
                color: '#55bde2',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.9))',
              }}
            />
            <span style={statLabelStyle}>ĐỘ ẨM</span>
          </div>
          <span
            style={{
              ...statValueStyle,
              marginTop: hudSize(13, 4, 9),
              color: '#7bcbe8',
            }}
          >
            {humidity}%
          </span>
        </div>

        <div className="flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center" style={{ gap: hudSize(5, 2, 4) }}>
            <Wind
              style={{
                width: hudSize(23, 8, 15),
                height: hudSize(23, 8, 15),
                color: '#86c997',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.9))',
              }}
            />
            <span style={statLabelStyle}>GIÓ</span>
          </div>
          <span style={{ ...statValueStyle, marginTop: hudSize(13, 4, 9) }}>
            {windSpeed} {windCardinal}
          </span>
        </div>
      </div>
    </div>
  );
};
