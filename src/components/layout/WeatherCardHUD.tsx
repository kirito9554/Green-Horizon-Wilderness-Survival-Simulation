import React from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Eye,
  ThermometerSun,
  ArrowRight,
} from 'lucide-react';
import { WeatherType, WeatherState } from '../../types';

interface WeatherCardHUDProps {
  weather: WeatherState;
}

export const WEATHER_CONFIG: Record<
  WeatherType,
  {
    nameVi: string;
    image: string;
    description: string;
    ambientGlow: string;
    accentColor: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }
> = {
  clear: {
    nameVi: 'Nắng Trong',
    image: '/weather-card/01_sunny.png',
    description: 'Nắng ráo, tầm nhìn tốt',
    ambientGlow: 'rgba(230, 168, 70, 0.25)',
    accentColor: '#e5ad53',
    icon: Sun,
  },
  light_rain: {
    nameVi: 'Mưa Rào',
    image: '/weather-card/02_light_rain.png',
    description: 'Mưa lất phất, mát mẻ',
    ambientGlow: 'rgba(56, 189, 248, 0.25)',
    accentColor: '#5ec4e6',
    icon: CloudRain,
  },
  heavy_rain: {
    nameVi: 'Mưa Rất Lớn',
    image: '/weather-card/03_heavy_rain.png',
    description: 'Mưa tầm tã xối xả',
    ambientGlow: 'rgba(59, 130, 246, 0.3)',
    accentColor: '#4f9ee8',
    icon: CloudRain,
  },
  storm: {
    nameVi: 'Bão Táp Dữ Dội',
    image: '/weather-card/04_storm.png',
    description: 'Gió giật sấm sét nguy hiểm',
    ambientGlow: 'rgba(225, 29, 72, 0.35)',
    accentColor: '#e66578',
    icon: CloudLightning,
  },
  cloudy: {
    nameVi: 'Nhiều Mây',
    image: '/weather-card/05_cloudy.png',
    description: 'Mây che râm mát',
    ambientGlow: 'rgba(148, 163, 184, 0.2)',
    accentColor: '#a9b9c9',
    icon: Cloud,
  },
  fog: {
    nameVi: 'Sương Mù Dày',
    image: '/weather-card/06_fog.png',
    description: 'Tầm nhìn hạn chế',
    ambientGlow: 'rgba(52, 211, 153, 0.25)',
    accentColor: '#7dd3a8',
    icon: Eye,
  },
  heat_wave: {
    nameVi: 'Sóng Nhiệt Gay Gắt',
    image: '/weather-card/07_heatwave.png',
    description: 'Nhiệt độ cao, tiêu hao nước nhanh',
    ambientGlow: 'rgba(249, 115, 22, 0.35)',
    accentColor: '#f18c47',
    icon: ThermometerSun,
  },
};

export const WeatherCardHUD: React.FC<WeatherCardHUDProps> = ({ weather }) => {
  const currentCfg = WEATHER_CONFIG[weather.current] || WEATHER_CONFIG.clear;
  const nextCfg = weather.next ? WEATHER_CONFIG[weather.next] : undefined;
  const CurrentIcon = currentCfg.icon;

  const remainingHours = Math.floor(weather.durationRemainingMinutes / 60);
  const remainingMins = Math.round(weather.durationRemainingMinutes % 60);
  const remainingStr =
    remainingHours > 0
      ? `còn ~${remainingHours}h${remainingMins > 0 ? `${remainingMins}p` : ''}`
      : `còn ~${remainingMins}p`;

  return (
    <div
      className="relative flex items-center h-full gap-3 select-none pointer-events-auto"
      title={`Thời tiết: ${currentCfg.nameVi} (${currentCfg.description})\n${
        nextCfg ? `• Sắp tới: ${nextCfg.nameVi} (${remainingStr})` : ''
      }`}
    >
      {/* 1. Organic Weather Painting Card (Chất liệu giấy bìa/tranh cổ viền gỗ ngả ấm) */}
      <div
        className="relative h-[66px] aspect-[16/9] rounded overflow-hidden group shrink-0"
        style={{
          boxShadow: `
            0 2px 8px rgba(0,0,0,0.85),
            0 0 0 1px rgba(78, 56, 32, 0.75),
            inset 0 0 0 1px rgba(235, 210, 165, 0.12)
          `,
        }}
      >
        {/* The painting */}
        <img
          key={currentCfg.image}
          src={currentCfg.image}
          alt={currentCfg.nameVi}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Vintage vignette edge tint (làm mép tranh ăn nhập tự nhiên với nền gỗ) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0a06]/85 via-[#0e0a06]/15 to-[#0e0a06]/20 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 12px rgba(0,0,0,0.65)',
          }}
        />

        {/* Mini stamp icon (khắc chìm nhẹ nhàng góc trên) */}
        <div className="absolute top-1 right-1 px-1 py-0.5 rounded bg-[#0d0a07]/75 backdrop-blur-[1px] border border-[#3e2e1c]/80 flex items-center gap-0.5 shadow-sm pointer-events-none">
          <CurrentIcon
            className="w-3 h-3 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]"
            style={{ color: currentCfg.accentColor }}
          />
        </div>

        {/* Bottom subtle title line */}
        <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-serif font-bold text-[#f2e6ce] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] tracking-wide pointer-events-none">
          <span className="truncate">{currentCfg.nameVi}</span>
          <span
            className="w-1.5 h-1.5 rounded-full shadow-[0_0_4px_currentColor]"
            style={{ backgroundColor: currentCfg.accentColor }}
          />
        </div>
      </div>

      {/* 2. Weather Label & Forecast Details */}
      <div className="flex flex-col justify-center min-w-0 pr-1">
        {/* Caption row */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-serif tracking-widest text-[#9c8669] uppercase font-semibold">
            Thời Tiết Hiện Tại
          </span>
          <span className="text-[9px] text-[#826e55] font-serif italic">
            ({remainingStr})
          </span>
        </div>

        {/* Weather Main Name (Organic Warm Typography) */}
        <div className="text-[15px] font-bold text-[#faecd5] tracking-wide font-serif leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
          {currentCfg.nameVi}
        </div>

        {/* Next transition forecast */}
        {nextCfg && (
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#b8a486] font-serif leading-tight">
            <span className="text-[#846f56]">Sắp tới:</span>
            <div className="flex items-center gap-1 text-[#eedbc0] font-semibold">
              <ArrowRight className="w-2.5 h-2.5 text-[#d8ad69] shrink-0" />
              <span className="truncate">{nextCfg.nameVi}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
