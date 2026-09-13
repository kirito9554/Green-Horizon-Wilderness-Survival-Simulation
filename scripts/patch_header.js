import fs from 'fs';

let content = fs.readFileSync('src/components/layout/TopHeader.tsx', 'utf-8');

const targetStr = `      {/* 2. Middle 9 Resource Value Counters */}
      <div className="absolute left-[20%] top-[10%] bottom-[10%] w-[58%] grid grid-cols-9 pointer-events-auto">
        {/* Food */}
        <div className="flex flex-col items-center justify-center" title="Lương thực (Food)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">FOOD</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {foodCount}
          </span>
        </div>
        {/* Water */}
        <div className="flex flex-col items-center justify-center" title="Nước ngọt (Water)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">WATER</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {waterCount}
          </span>
        </div>
        {/* Wood */}
        <div className="flex flex-col items-center justify-center" title="Gỗ & Tre (Wood)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">WOOD</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {woodCount}
          </span>
        </div>
        {/* Stone */}
        <div className="flex flex-col items-center justify-center" title="Đá suối (Stone)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">STONE</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {stoneCount}
          </span>
        </div>
        {/* Fiber */}
        <div className="flex flex-col items-center justify-center" title="Sợi dây leo (Fiber)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">FIBER</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {fiberCount}
          </span>
        </div>
        {/* Leaves */}
        <div className="flex flex-col items-center justify-center" title="Lá cọ (Leaves)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">LEAVES</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {leavesCount}
          </span>
        </div>
        {/* Rope */}
        <div className="flex flex-col items-center justify-center" title="Dây thừng (Rope)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">ROPE</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {ropeCount}
          </span>
        </div>
        {/* Medicine */}
        <div className="flex flex-col items-center justify-center" title="Dược liệu (Medicine)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">MEDICINE</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {medicineCount}
          </span>
        </div>
        {/* Firewood */}
        <div className="flex flex-col items-center justify-center" title="Củi đốt (Firewood)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">FIREWOOD</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {firewoodCount}
          </span>
        </div>
      </div>`;

const replaceStr = `      {/* 2. Middle 9 Resource Value Counters */}
      <div className="absolute left-0 top-[10%] bottom-[10%] w-full pointer-events-auto">
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '22.70%', transform: 'translateX(-50%)' }} title="Lương thực (Food)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">FOOD</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{foodCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '30.26%', transform: 'translateX(-50%)' }} title="Nước ngọt (Water)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">WATER</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{waterCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '36.32%', transform: 'translateX(-50%)' }} title="Gỗ & Tre (Wood)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">WOOD</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{woodCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '42.62%', transform: 'translateX(-50%)' }} title="Đá suối (Stone)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">STONE</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{stoneCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '49.43%', transform: 'translateX(-50%)' }} title="Sợi dây leo (Fiber)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">FIBER</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{fiberCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '55.49%', transform: 'translateX(-50%)' }} title="Lá cọ (Leaves)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">LEAVES</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{leavesCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '61.54%', transform: 'translateX(-50%)' }} title="Dây thừng (Rope)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">ROPE</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{ropeCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '68.10%', transform: 'translateX(-50%)' }} title="Dược liệu (Medicine)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">MEDICINE</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{medicineCount}</span>
        </div>
        <div className="absolute flex flex-col items-center justify-center top-0 h-full" style={{ left: '75.66%', transform: 'translateX(-50%)' }} title="Củi đốt (Firewood)">
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10px]">FIREWOOD</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">{firewoodCount}</span>
        </div>
      </div>`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/layout/TopHeader.tsx', content);
console.log("Replaced!");
