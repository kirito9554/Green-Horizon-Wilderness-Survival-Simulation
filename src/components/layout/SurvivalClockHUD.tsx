import React from 'react';
import {
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Calendar,
  Thermometer,
  Droplets,
  Wind,
} from 'lucide-react';
import { GameState } from '../../types';

interface SurvivalClockHUDProps {
  gameTime: GameState['gameTime'];
  weather: GameState['weather'];
}

// 4 Mùa dã ngoại sinh tồn (30 ngày/mùa, 120 ngày/năm)
const SEASONS_CONFIG = [
  { name: 'Mùa Mưa Nhiệt Đới', color: '#68c5db' },
  { name: 'Mùa Mưa Cực Đại', color: '#5b9fe3' },
  { name: 'Mùa Chuyển Gió', color: '#6ed19d' },
  { name: 'Mùa Khô Khắc Nghiệt', color: '#e5ad53' },
];

const DAYS_PER_SEASON = 30;
const DAYS_PER_YEAR = 120;
const DAYS_PER_MONTH = 10;

export const SurvivalClockHUD: React.FC<SurvivalClockHUDProps> = ({ gameTime, weather }) => {
  const normalizedDay = Math.max(1, gameTime.day);
  const dayIndex = normalizedDay - 1;
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const dayOfYear = dayIndex % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON) % SEASONS_CONFIG.length;
  const currentSeason = SEASONS_CONFIG[seasonIndex];

  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1;
  const dayOfMonth = (dayOfYear % DAYS_PER_MONTH) + 1;

  // Giờ:Phút
  const normalizedMinutes = ((gameTime.minuteOfDay % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = Math.floor(normalizedMinutes % 60);
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  // Chu kỳ ngày đêm (Icon & Pha)
  let DayCycleIcon = Sun;
  let cycleLabel = 'Ban Ngày';
  let cycleColor = '#e5b358';

  if (hours >= 5 && hours < 8) {
    DayCycleIcon = Sunrise;
    cycleLabel = 'Bình Minh';
    cycleColor = '#e8a252';
  } else if (hours >= 8 && hours < 16) {
    DayCycleIcon = Sun;
    cycleLabel = 'Đứng Bóng';
    cycleColor = '#ecc069';
  } else if (hours >= 16 && hours < 19) {
    DayCycleIcon = Sunset;
    cycleLabel = 'Hoàng Hôn';
    cycleColor = '#df7c49';
  } else {
    DayCycleIcon = Moon;
    cycleLabel = 'Đêm Tối';
    cycleColor = '#8ba3ce';
  }

  // Nhiệt độ & Màu sắc
  const tempC = Math.round(weather.temperatureC);
  let tempColor = '#eedcc5';
  if (tempC >= 35) tempColor = '#e57368';
  else if (tempC >= 30) tempColor = '#ecc069';
  else if (tempC <= 22) tempColor = '#7bc6dc';

  const humidity = Math.round(weather.humidityPercent);
  const windSpeed = weather.wind?.speedKmh ? Math.round(weather.wind.speedKmh) : 8;
  const windCardinal = weather.wind?.cardinal || 'ĐB';
  const windDeg = weather.wind?.directionDeg ?? 45;

  return (
    <div className="relative flex items-center h-full pl-5 gap-6 select-none pointer-events-auto">
      {/* Subtle organic vertical divider with brass/wood tone */}
      <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-transparent via-[#5a422a]/70 to-transparent" />

      {/* 1. Time & Natural Solar/Lunar Phase */}
      <div className="flex items-center gap-2.5">
        {/* Natural Sun/Moon Seal */}
        <div
          className="relative flex items-center justify-center w-8 h-8 rounded-full border border-[#543d26]/80 bg-gradient-to-b from-[#1b140c] to-[#0f0b07] shadow-[0_2px_5px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(240,215,170,0.15)]"
          title={`Thời điểm: ${cycleLabel}`}
        >
          <DayCycleIcon
            className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-colors duration-500"
            style={{ color: cycleColor }}
          />
        </div>

        {/* Time Digits & Period */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[22px] font-bold text-[#f7eedf] font-serif leading-none tracking-wider drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]"
              style={{
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 1px rgba(250,230,195,0.3)',
              }}
            >
              {timeString}
            </span>
            <span className="text-[10px] font-serif uppercase text-[#a68f70] tracking-wider font-semibold">
              {cycleLabel}
            </span>
          </div>

          {/* Calendar: Day / Month / Year */}
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#baa486] font-serif leading-none">
            <span className="font-bold text-[#eed8b8]">
              Ngày {normalizedDay}
            </span>
            <span className="text-[#67523c] font-sans">•</span>
            <span className="text-[10px] text-[#9a8569]">
              Tháng {month}, Năm {year}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Season & Living Environment Specs */}
      <div className="relative flex items-center gap-4 pl-5">
        {/* Second soft divider */}
        <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-[#5a422a]/60 to-transparent" />

        {/* Season Badge */}
        <div
          className="flex flex-col justify-center"
          title={`Mùa: ${currentSeason.name} (Chu kỳ ${DAYS_PER_SEASON} ngày/mùa)`}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase font-serif tracking-widest text-[#8a7458]">
            <Calendar className="w-2.5 h-2.5 text-[#cf9f53]" />
            <span>Mùa Vụ</span>
          </div>
          <span
            className="text-[13px] font-bold font-serif tracking-normal leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
            style={{ color: currentSeason.color }}
          >
            {currentSeason.name}
          </span>
        </div>

        {/* Environment Stat Chips: Temperature, Humidity, Wind */}
        <div className="flex items-center gap-2">
          {/* Nhiệt độ */}
          <div
            className="flex flex-col items-center justify-center px-2 py-1 rounded bg-[#16100a]/70 border border-[#3e2e1c]/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]"
            title={`Nhiệt độ không khí: ${tempC}°C`}
          >
            <div className="flex items-center gap-0.5 text-[9px] text-[#8e7b65] font-serif">
              <Thermometer className="w-2.5 h-2.5 text-[#dca658]" />
              <span className="tracking-wider">NHIỆT</span>
            </div>
            <span
              className="text-[12px] font-serif font-bold leading-none mt-0.5"
              style={{ color: tempColor }}
            >
              {tempC}°C
            </span>
          </div>

          {/* Độ ẩm */}
          <div
            className="flex flex-col items-center justify-center px-2 py-1 rounded bg-[#16100a]/70 border border-[#3e2e1c]/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]"
            title={`Độ ẩm tương đối: ${humidity}%`}
          >
            <div className="flex items-center gap-0.5 text-[9px] text-[#8e7b65] font-serif">
              <Droplets className="w-2.5 h-2.5 text-[#63b3ce]" />
              <span className="tracking-wider">ĐỘ ẨM</span>
            </div>
            <span className="text-[12px] font-serif font-bold text-[#a6d7e8] leading-none mt-0.5">
              {humidity}%
            </span>
          </div>

          {/* Gió */}
          <div
            className="flex flex-col items-center justify-center px-2 py-1 rounded bg-[#16100a]/70 border border-[#3e2e1c]/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]"
            title={`Gió: ${windSpeed} km/h, hướng ${windCardinal} (${windDeg}°)`}
          >
            <div className="flex items-center gap-0.5 text-[9px] text-[#8e7b65] font-serif">
              <Wind className="w-2.5 h-2.5 text-[#6ec297]" />
              <span className="tracking-wider">GIÓ</span>
            </div>
            <div className="flex items-baseline gap-0.5 text-[12px] font-serif font-bold text-[#b7e3cc] leading-none mt-0.5">
              <span>{windSpeed}</span>
              <span className="text-[9px] text-[#88aa97] font-semibold">{windCardinal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
