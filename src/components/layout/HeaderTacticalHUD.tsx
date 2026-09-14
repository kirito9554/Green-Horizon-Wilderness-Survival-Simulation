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

export const HeaderTacticalHUD: React.FC<HeaderTacticalHUDProps> = ({ weather, gameTime }) => {
  // Current & next weather
  const currentCfg = WEATHER_CONFIG[weather.current] || WEATHER_CONFIG.clear;
  const nextCfg = weather.next ? WEATHER_CONFIG[weather.next] : undefined;
  const WeatherIcon = currentCfg.icon;

  // Calendar calculations
  const normalizedDay = Math.max(1, gameTime.day);
  const dayIndex = normalizedDay - 1;
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON) % SEASONS_CONFIG.length;
  const currentSeason = SEASONS_CONFIG[seasonIndex];

  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1;

  // Time & cycle calculations
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

  // Environmental numbers
  const tempC = Math.round(weather.temperatureC);
  const humidity = Math.round(weather.humidityPercent);
  const windSpeed = weather.wind?.speedKmh ? Math.round(weather.wind.speedKmh) : 14;
  const windCardinal = weather.wind?.cardinal || 'E';

  return (
    <div
      className="relative w-full h-full pointer-events-auto select-none bg-[url('/header-hud-bg.png')] bg-[length:100%_100%] bg-no-repeat filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
      style={{
        imageRendering: 'auto',
      }}
    >
      {/* 1. Left Weather Photo (nested inside the foliage wooden photo frame) */}
      <div
        className="absolute overflow-hidden rounded-[3px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.85),0_1px_4px_rgba(0,0,0,0.6)]"
        style={{
          left: '1.65%',
          top: '14.5%',
          width: '12.4%',
          height: '71%',
        }}
        title={`Thời tiết hiện tại: ${currentCfg.nameVi}\n${currentCfg.description}`}
      >
        <img
          src={currentCfg.image}
          alt={currentCfg.nameVi}
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />

        {/* Top-Right Weather Badge */}
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center shadow-md backdrop-blur-[1px]">
          <WeatherIcon className="w-3 h-3 text-white" />
        </div>

        {/* Bottom Title Label */}
        <div className="absolute bottom-1 inset-x-1.5 flex items-center justify-center">
          <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] font-serif font-bold text-[#fcefdc] tracking-wide shadow-md border border-white/10 truncate max-w-full">
            {currentCfg.nameVi}
          </span>
        </div>
      </div>

      {/* 2. Weather Details Section (Right of photo) */}
      <div
        className="absolute flex flex-col justify-center font-hud"
        style={{
          left: '15.0%',
          top: '14%',
          width: '20.6%',
          height: '72%',
        }}
      >
        {/* Top Label: THỜI TIẾT HIỆN TẠI — */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-[#bca073] tracking-[0.06em] uppercase whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
            THỜI TIẾT HIỆN TẠI
          </span>
          <span className="flex-1 h-[1px] bg-[#61472c]/90 min-w-[12px]" />
        </div>

        {/* Middle Row: Icon Badge + Weather Name */}
        <div className="flex items-center gap-2 mt-1 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#181109] border border-[#5a4228] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] shrink-0">
            <WeatherIcon
              className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ color: currentCfg.accentColor }}
            />
          </div>
          <span className="font-bold text-[19px] text-[#f7ecd8] drop-shadow-[0_2px_4px_rgba(0,0,0,1)] tracking-normal truncate">
            {currentCfg.nameVi}
          </span>
        </div>

        {/* Bottom Row: Sắp tới: > [Next Weather] */}
        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#a99477] truncate">
          <span>Sắp tới:</span>
          <span className="text-amber-400/90 font-bold">›</span>
          <span className="text-[#d8c3a5] truncate">
            {nextCfg?.nameVi || currentCfg.nameVi}
          </span>
        </div>
      </div>

      {/* 3. Center Clock & Date Section */}
      <div
        className="absolute flex items-center font-hud"
        style={{
          left: '37.0%',
          top: '14%',
          width: '25.6%',
          height: '72%',
        }}
      >
        {/* Circular Sun/Moon Medallion */}
        <div
          className="relative w-11 h-11 rounded-full border-2 border-[#8c6738] bg-gradient-to-b from-[#2a1d10] via-[#1b1208] to-[#0f0a04] shadow-[0_2px_6px_rgba(0,0,0,0.9),inset_0_1px_3px_rgba(235,190,120,0.4)] flex items-center justify-center shrink-0 mr-3"
          title={`Thời khắc: ${cycleLabel}`}
        >
          <DayCycleIcon
            className="w-5 h-5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-colors duration-500"
            style={{ color: cycleGlow }}
          />
        </div>

        {/* Time, Period & Calendar */}
        <div className="flex flex-col justify-center min-w-0">
          {/* Row 1: 06:00 | BÌNH MINH */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-bold text-[22px] text-[#f7edd9] tracking-wider tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none">
              {timeString}
            </span>
            <span className="text-[#5a4228] font-light text-[17px] leading-none">|</span>
            <span className="font-bold text-[13px] text-[#dca052] tracking-[0.08em] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-none">
              {cycleLabel}
            </span>
          </div>

          {/* Row 2: Ngày 5 - Tháng 9, Năm 1 — */}
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <span className="text-[11px] text-[#b7a285] tracking-wide whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
              Ngày <strong className="text-[#ecd6b7]">{normalizedDay}</strong> - Tháng {month}, Năm {year}
            </span>
            <span className="w-5 h-[1px] bg-[#61472c]/90 min-w-[8px]" />
          </div>
        </div>
      </div>

      {/* 4. Season Section */}
      <div
        className="absolute flex flex-col justify-center font-hud"
        style={{
          left: '63.8%',
          top: '14%',
          width: '12.8%',
          height: '72%',
        }}
      >
        {/* Top: Leaf Icon + MÙA VỤ */}
        <div className="flex items-center gap-1 min-w-0">
          <Leaf className="w-3 h-3 text-emerald-400 drop-shadow shrink-0" />
          <span className="text-[10.5px] font-bold text-[#bca073] tracking-[0.06em] uppercase whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
            MÙA VỤ
          </span>
        </div>

        {/* Bottom: Tên Mùa */}
        <div className="mt-1 min-w-0">
          <span
            className="font-bold text-[14.5px] text-[#4ade80] drop-shadow-[0_2px_4px_rgba(0,0,0,1)] tracking-normal truncate block"
            title={`Mùa hiện tại: ${currentSeason.name}`}
          >
            {currentSeason.name}
          </span>
        </div>
      </div>

      {/* 5. Right Environmental Stats (3 sub-boxes: Nhiệt độ, Độ ẩm, Gió) */}
      <div
        className="absolute grid grid-cols-3 items-center font-hud"
        style={{
          left: '78.5%',
          top: '14%',
          width: '19.8%',
          height: '72%',
        }}
      >
        {/* Box 1: Nhiệt độ */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className="flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5 text-amber-400 drop-shadow" />
            <span className="text-[10px] font-bold text-[#bca073] tracking-[0.05em] uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
              NHIỆT
            </span>
          </div>
          <span className="font-bold text-[15px] text-[#f7edd9] drop-shadow-[0_2px_3px_rgba(0,0,0,1)] mt-0.5">
            {tempC}°C
          </span>
        </div>

        {/* Box 2: Độ ẩm */}
        <div className="flex flex-col items-center justify-center px-1 border-x border-[#382618]/50">
          <div className="flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-[#38bdf8] drop-shadow" />
            <span className="text-[10px] font-bold text-[#bca073] tracking-[0.05em] uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
              ĐỘ ẨM
            </span>
          </div>
          <span className="font-bold text-[15px] text-[#38bdf8] drop-shadow-[0_2px_3px_rgba(0,0,0,1)] mt-0.5">
            {humidity}%
          </span>
        </div>

        {/* Box 3: Gió */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className="flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-[#86efac] drop-shadow" />
            <span className="text-[10px] font-bold text-[#bca073] tracking-[0.05em] uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
              GIÓ
            </span>
          </div>
          <span className="font-bold text-[15px] text-[#f7edd9] drop-shadow-[0_2px_3px_rgba(0,0,0,1)] mt-0.5">
            {windSpeed} {windCardinal}
          </span>
        </div>
      </div>
    </div>
  );
};
