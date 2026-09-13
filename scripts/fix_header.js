import fs from 'fs';

// We want to generate the TopHeader resource counters with precise absolute positioning.
const iconsX = [328, 448, 544, 644, 752, 848, 944, 1048, 1168];
const textLabels = ['FOOD', 'WATER', 'WOOD', 'STONE', 'FIBER', 'LEAVES', 'ROPE', 'MEDICINE', 'FIREWOOD'];
const variables = ['foodCount', 'waterCount', 'woodCount', 'stoneCount', 'fiberCount', 'leavesCount', 'ropeCount', 'medicineCount', 'firewoodCount'];
const titles = ['Lương thực (Food)', 'Nước ngọt (Water)', 'Gỗ & Tre (Wood)', 'Đá suối (Stone)', 'Sợi dây leo (Fiber)', 'Lá cọ (Leaves)', 'Dây thừng (Rope)', 'Dược liệu (Medicine)', 'Củi đốt (Firewood)'];

// Original manual tweaking from the user:
// 1: marginLeft: 22px
// 2: marginLeft: 0
// 3: marginLeft: 1px
// 4: marginLeft: 11px
// 5: marginLeft: 21px
// 6: marginLeft: 21px
// 7: marginLeft: 31px
// 8: marginLeft: 47px
// 9: marginLeft: 84px

// To avoid messing with the user's manual offsets which were relative to a `justify-between` flexbox, 
// I will just use the known icon centers and place the text directly to the right of each icon.
// The icons are ~30-40px wide. Center is `iconsX`. Let's place the text center at `iconsX + 35`.
// 35px / 1586px = 2.2%.

let jsx = `      {/* 2. Middle 9 Resource Value Counters */}
      <div className="absolute left-0 top-[10%] bottom-[10%] w-full pointer-events-auto">\n`;

for (let i = 0; i < 9; i++) {
  // Let's place the center of the text block slightly to the right of the icon center.
  // We'll use 32px offset.
  const cx = iconsX[i] + 32;
  const leftPct = (cx / 1586) * 100;
  
  jsx += `        <div 
          className="absolute flex flex-col items-center justify-center top-0 h-full"
          style={{ left: '${leftPct.toFixed(2)}%', transform: 'translateX(-50%)' }}
          title="${titles[i]}"
        >
          <span className="font-bold text-[#a69279] tracking-widest uppercase leading-none mb-1 text-[9px] sm:text-[10.5px]">${textLabels[i]}</span>
          <span className="font-bold font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none text-sm sm:text-base">
            {${variables[i]}}
          </span>
        </div>\n`;
}

jsx += `      </div>`;
console.log(jsx);
