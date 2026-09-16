import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const path = 'src/data/ecologyPredators.ts';
let text = readFileSync(path, 'utf8');
const from = 'adultWeightKg: 180, dailyFoodKgPerAdult: 1.65, dailyWaterNeed: 90,';
const to = 'adultWeightKg: 180, dailyFoodKgPerAdult: 1.05, dailyWaterNeed: 90,';
if (!text.includes(from)) throw new Error('missing Crocodile demand anchor');
text = text.replace(from, to);
writeFileSync(path, text);
for (const temp of ['scripts/tmp-croc-demand-patch.mjs', '.github/workflows/tmp-croc-demand-patch.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
