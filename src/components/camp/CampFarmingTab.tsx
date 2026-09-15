import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bug,
  ClipboardList,
  Clock,
  Droplets,
  Fish,
  Leaf,
  Package,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Sprout,
  Sun,
  TreePine,
  Waves,
  X,
} from 'lucide-react';
import type { GameState } from '../../types';
import type { AgricultureJob, AgricultureCarePolicy } from '../../types/agricultureSimulation';
import { AQUATIC_SPECIES, PLANT_SPECIES, TERRESTRIAL_SPECIES } from '../../data/agricultureSpecies';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';

interface CampFarmingTabProps {
  state: GameState;
  onNavigateTab: (tab: string) => void;
  onAgricultureCommand: (command: string) => void;
}

type AgricultureMode = 'crops' | 'perennials' | 'livestock' | 'aquatic' | 'tasks';

const CAMP_POI = 'AREA_CAMP_CLEARING';
const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const MODE_TABS: Array<{ id: AgricultureMode; label: string; sub: string; icon: React.ElementType }> = [
  { id: 'crops', label: 'Trồng trọt', sub: 'CROP AREAS', icon: Sprout },
  { id: 'perennials', label: 'Cây lâu năm', sub: 'PERENNIALS', icon: TreePine },
  { id: 'livestock', label: 'Chăn nuôi', sub: 'LIVESTOCK', icon: ShieldCheck },
  { id: 'aquatic', label: 'Thủy sinh', sub: 'AQUACULTURE', icon: Fish },
  { id: 'tasks', label: 'Công việc', sub: 'TASKS', icon: ClipboardList },
];

const STATUS_LABEL: Record<string, string> = {
  waiting_materials: 'Chờ vật liệu',
  waiting_worker: 'Chờ nhân công',
  in_progress: 'Đang thực hiện',
  paused: 'Tạm dừng',
  completed: 'Hoàn thành',
  blocked: 'Bị chặn',
};

function pct(value: number | undefined): string {
  return `${Math.round(value || 0)}%`;
}

function meter(value: number, tone = 'bg-emerald-500'): React.ReactNode {
  return <div className="h-1.5 rounded-full bg-black/45 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function countItemAcrossPoi(state: GameState, itemId: string): number {
  let total = state.inventory.items.filter(item => item.itemId === itemId).reduce((sum, item) => sum + item.quantity, 0);
  for (const storage of Object.values(state.poiStorages || {})) total += storage.items.filter(item => item.itemId === itemId).reduce((sum, item) => sum + item.quantity, 0);
  return total;
}

function agricultureMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

export const CampFarmingTab: React.FC<CampFarmingTabProps> = ({ state, onNavigateTab, onAgricultureCommand }) => {
  const [mode, setMode] = useState<AgricultureMode>('crops');
  const system = state.agricultureSystem;
  const [selectedSpecies, setSelectedSpecies] = useState('PLANT_CASSAVA');
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const cultivationAreas = system?.cultivationAreas || [];
  const plants = system?.plants || [];
  const terrestrialHabitats = system?.terrestrialHabitats || [];
  const terrestrialAnimals = system?.terrestrialAnimals || [];
  const aquaticHabitats = system?.aquaticHabitats || [];
  const aquaticAnimals = system?.aquaticAnimals || [];
  const jobs = system?.jobs || [];

  const outputLast7Days = useMemo(() => {
    const cutoff = agricultureMinute(state) - 7 * 1440;
    const grouped: Record<string, number> = {};
    for (const record of system?.productionHistory || []) {
      if (record.gameMinute < cutoff) continue;
      grouped[record.itemId] = (grouped[record.itemId] || 0) + record.quantity;
    }
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [system?.productionHistory, state.gameTime.day, state.gameTime.minuteOfDay]);

  const seedStocks = useMemo(() => Object.values(PLANT_SPECIES).map(species => ({
    species,
    count: countItemAcrossPoi(state, species.seedItemId),
  })).filter(entry => entry.count > 0), [state.inventory, state.poiStorages]);

  const plantSpecies = Object.values(PLANT_SPECIES).filter(species => mode === 'perennials' ? species.architecture !== 'herbaceous' : species.architecture === 'herbaceous');
  const selectedArea = cultivationAreas.find(area => area.id === selectedTarget) || cultivationAreas[0];
  const selectedPen = terrestrialHabitats.find(habitat => habitat.id === selectedTarget) || terrestrialHabitats[0];
  const selectedAquatic = aquaticHabitats.find(habitat => habitat.id === selectedTarget) || aquaticHabitats[0];
  const selectedPlant = selectedArea?.plantIds.map(id => plants.find(plant => plant.id === id)).find(Boolean);
  const selectedAnimal = selectedPen?.animalIds.map(id => terrestrialAnimals.find(animal => animal.id === id)).find(Boolean);
  const selectedFish = selectedAquatic?.aquaticAnimalIds.map(id => aquaticAnimals.find(animal => animal.id === id)).find(Boolean);

  const changePolicy = (targetId: string, policy: AgricultureCarePolicy) => onAgricultureCommand(`__agri_policy__:${targetId}:${policy}`);
  const care = (kind: string, targetId: string) => onAgricultureCommand(`__agri_care__:${kind}:${targetId}`);

  const renderSpeciesList = () => {
    if (mode === 'livestock') return (
      <div className="space-y-1.5">
        {Object.values(TERRESTRIAL_SPECIES).map(species => (
          <div key={species.id} className="camp-sunken-slot px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded border border-[#425a42] bg-[#12231b] flex items-center justify-center text-amber-300"><ShieldCheck className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-[#eee5d1]">{species.name}</div>
              <div className="text-[10px] text-[#8fa798]">{species.tags.slice(0, 3).join(' · ')}</div>
              <div className="text-[10px] text-[#b7c6b8] mt-0.5">Cần ~{species.spaceM2} m² / cá thể</div>
            </div>
          </div>
        ))}
        <div className="p-2.5 rounded border border-amber-700/35 bg-amber-950/15 text-[10px] leading-relaxed text-[#b8aa89]">
          Cá thể mới phải đến từ bắt, cứu hộ hoặc thuần hóa trong Encounter. Chuồng không tự sinh vật nuôi.
        </div>
      </div>
    );

    if (mode === 'aquatic') return (
      <div className="space-y-1.5">
        {Object.values(AQUATIC_SPECIES).map(species => (
          <div key={species.id} className="camp-sunken-slot px-2.5 py-2 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded border border-sky-800/60 bg-[#102129] flex items-center justify-center text-sky-300"><Fish className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-[#eee5d1]">{species.name}</div>
              <div className="text-[10px] text-[#8fa798]">O₂ tối thiểu {species.minimumOxygen}% · {species.idealTemperatureC[0]}–{species.idealTemperatureC[1]}°C</div>
              <div className="text-[10px] text-sky-300/80 mt-0.5">Mật độ cơ sở {species.densityM2} m² / cá thể</div>
            </div>
          </div>
        ))}
        <div className="p-2.5 rounded border border-sky-800/45 bg-sky-950/15 text-[10px] leading-relaxed text-[#9db8bf]">Nguồn con giống thủy sinh sẽ đến từ khai thác/Encounter; habitat chỉ tạo môi trường nuôi.</div>
      </div>
    );

    return (
      <div className="space-y-1.5">
        {plantSpecies.map(species => {
          const seedCount = countItemAcrossPoi(state, species.seedItemId);
          const active = selectedSpecies === species.id;
          return (
            <button key={species.id} type="button" onClick={() => setSelectedSpecies(species.id)} className={`w-full text-left rounded border px-2.5 py-2 flex gap-2.5 transition-colors ${active ? 'border-lime-400/70 bg-[#1a3d28]' : 'border-[#30473a] bg-[#10231b]/80 hover:bg-[#173226]'}`}>
              <div className="w-9 h-9 shrink-0"><ItemIcon itemId={species.seedItemId} size={36} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-bold text-[#efe6d3]">{species.name}</span><span className={seedCount > 0 ? 'text-lime-300 text-[10px]' : 'text-red-300 text-[10px]'}>Giống {seedCount}</span></div>
                <div className="text-[10px] text-[#91a99a]">{species.architecture === 'woody' ? 'Thân gỗ' : species.architecture === 'clumping' ? 'Dạng bụi / thân ngầm' : 'Thân thảo'} · {species.spacingM2} m²/cây</div>
                <div className="text-[10px] text-amber-200/70">Thu: {ITEMS_DATABASE[species.harvestItemId]?.name || species.harvestItemId}</div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderCultivation = () => {
    const relevantAreas = cultivationAreas;
    return (
      <div className="h-full flex flex-col gap-2.5 min-h-0">
        <div className="flex items-center justify-between">
          <div><div className="text-[12px] font-bold uppercase tracking-wider text-[#e9e0cd]">Khu canh tác</div><div className="text-[10px] text-[#819b8d]">Đất chỉ là habitat; từng cây được mô phỏng riêng.</div></div>
          <button type="button" onClick={() => onAgricultureCommand(`__agri_plot__:${CAMP_POI}`)} className="px-3 py-1.5 rounded border border-lime-600/60 bg-[#1d4328] hover:bg-[#285536] text-[11px] font-bold text-lime-100 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Dọn luống sơ khai</button>
        </div>
        <div className="grid grid-cols-3 gap-2 min-h-[112px]">
          {relevantAreas.length ? relevantAreas.map(area => {
            const areaPlants = area.plantIds.map(id => plants.find(plant => plant.id === id)).filter(Boolean);
            const healthy = areaPlants.length ? areaPlants.reduce((sum, plant) => sum + (plant?.health || 0), 0) / areaPlants.length : 0;
            return <button key={area.id} onClick={() => setSelectedTarget(area.id)} className={`camp-sunken-slot rounded border p-2 text-left ${selectedArea?.id === area.id ? 'border-lime-400/70 shadow-[0_0_12px_rgba(163,230,53,.12)]' : 'border-black/40'}`}>
              <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-[#eee4d0]">{area.name}</span><span className="text-[9px] text-lime-300">{Math.round(area.usableAreaM2)} m²</span></div>
              <div className="text-[10px] text-[#8ca292] mt-1">{areaPlants.length} cây · {new Set(areaPlants.map(p => p?.speciesId)).size} loài</div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px]"><span>Đất <b className="text-lime-300">{Math.round(area.soil.fertility)}%</b></span><span>Ẩm <b className="text-sky-300">{Math.round(area.soil.moisture)}%</b></span><span>Sức cây <b className="text-emerald-300">{areaPlants.length ? Math.round(healthy) : '—'}</b></span><span>Nén đất <b className="text-amber-300">{Math.round(area.soil.compaction)}%</b></span></div>
            </button>;
          }) : <div className="col-span-3 camp-sunken-slot rounded border border-dashed border-[#3a4d40] flex items-center justify-center text-[11px] text-[#809687]">Chưa có khu đất được quản lý. Dọn một luống sơ khai để bắt đầu.</div>}
        </div>

        <div className="flex-1 grid grid-cols-[1.12fr_.88fr] gap-2.5 min-h-0">
          <div className="camp-sunken-panel p-3 min-h-0 overflow-y-auto">
            {selectedArea ? <>
              <div className="flex items-center justify-between pb-2 camp-groove-divider"><div><div className="text-[13px] font-bold text-[#f1e7d3]">{selectedArea.name}</div><div className="text-[10px] text-[#8ba191]">{selectedArea.plantIds.length} thực thể thực vật · chăm sóc {selectedArea.carePolicy}</div></div><select value={selectedArea.carePolicy} onChange={event => changePolicy(selectedArea.id, event.target.value as AgricultureCarePolicy)} className="bg-[#0e2119] border border-[#3b5945] rounded px-2 py-1 text-[10px]"><option value="minimal">Tối thiểu</option><option value="normal">Bình thường</option><option value="intensive">Tích cực</option><option value="emergency_only">Chỉ khẩn cấp</option></select></div>
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[['Độ màu mỡ', selectedArea.soil.fertility, 'bg-lime-500'], ['Độ ẩm', selectedArea.soil.moisture, 'bg-sky-500'], ['Hữu cơ', selectedArea.soil.organicMatter, 'bg-emerald-500'], ['Xói mòn', selectedArea.soil.erosion, 'bg-amber-500']].map(([label, value, tone]) => <div key={String(label)} className="camp-sunken-slot p-1.5 rounded"><div className="text-[9px] text-[#8fa392] mb-1">{label}</div>{meter(Number(value), String(tone))}<div className="text-right text-[9px] mt-0.5">{Math.round(Number(value))}%</div></div>)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {selectedArea.plantIds.slice(0, 18).map(id => {
                  const plant = plants.find(p => p.id === id); if (!plant) return null;
                  const species = PLANT_SPECIES[plant.speciesId];
                  return <div key={id} className="camp-sunken-slot rounded p-1.5"><div className="flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5 text-lime-300"/><span className="text-[10px] font-semibold truncate">{species?.name || plant.speciesId}</span></div><div className="text-[9px] text-[#879e8e] mt-1">{plant.lifeStage} · sức khỏe {Math.round(plant.health)}%</div>{meter(plant.health)}</div>;
                })}
                {!selectedArea.plantIds.length && <div className="col-span-3 py-5 text-center text-[10px] text-[#758c7d]">Đất đã sẵn sàng nhưng chưa có cây.</div>}
              </div>
            </> : <div className="h-full flex items-center justify-center text-[11px] text-[#7b9183]">Chọn hoặc tạo một khu canh tác.</div>}
          </div>

          <div className="camp-sunken-panel p-3 flex flex-col min-h-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#e5dcc7] pb-2 camp-groove-divider">Thực thể / thao tác</div>
            {selectedPlant ? <div className="mt-2 space-y-2 text-[10px]"><div className="flex items-center gap-2"><div className="w-12 h-12"><ItemIcon itemId={PLANT_SPECIES[selectedPlant.speciesId]?.seedItemId} size={48}/></div><div><div className="text-[13px] font-bold">{PLANT_SPECIES[selectedPlant.speciesId]?.name}</div><div className="text-[#8ea395]">{selectedPlant.lifeStage} · tuổi {(selectedPlant.ageHours / 24).toFixed(1)} ngày</div></div></div>{[['Sức khỏe', selectedPlant.health], ['Nước', selectedPlant.hydration], ['Dinh dưỡng', selectedPlant.nutrientStatus], ['Stress', selectedPlant.stress], ['Sâu hại', selectedPlant.pestDamage], ['Bệnh', selectedPlant.diseaseLoad]].map(([label,value]) => <div key={String(label)}><div className="flex justify-between"><span className="text-[#9aaf9f]">{label}</span><span>{pct(Number(value))}</span></div>{meter(Number(value), Number(value) > 65 && (label === 'Stress' || label === 'Sâu hại' || label === 'Bệnh') ? 'bg-red-500' : 'bg-emerald-500')}</div>)}</div> : <div className="mt-3 text-[10px] text-[#7c9183]">Khi cây được trồng, panel này hiển thị physiology của từng cá thể.</div>}
            <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
              <button disabled={!selectedArea} onClick={() => selectedArea && onAgricultureCommand(`__agri_plant__:${selectedArea.id}:${selectedSpecies}:1`)} className="camp-action-button px-2 py-1.5 text-[10px] disabled:opacity-40"><Sprout className="w-3.5 h-3.5 inline mr-1"/>Trồng 1</button>
              <button disabled={!selectedArea} onClick={() => selectedArea && onAgricultureCommand(`__agri_plant__:${selectedArea.id}:${selectedSpecies}:3`)} className="camp-action-button px-2 py-1.5 text-[10px] disabled:opacity-40">Trồng 3</button>
              <button disabled={!selectedArea} onClick={() => selectedArea && care('water', selectedArea.id)} className="camp-action-button px-2 py-1.5 text-[10px] disabled:opacity-40"><Droplets className="w-3.5 h-3.5 inline mr-1"/>Tưới</button>
              <button disabled={!selectedArea} onClick={() => selectedArea && care('tend', selectedArea.id)} className="camp-action-button px-2 py-1.5 text-[10px] disabled:opacity-40">Chăm sóc</button>
              <button disabled={!selectedArea} onClick={() => selectedArea && care('harvest', selectedArea.id)} className="camp-action-button px-2 py-1.5 text-[10px] disabled:opacity-40">Thu hoạch</button>
              <button disabled={!selectedArea} onClick={() => selectedArea && care('collect_seed', selectedArea.id)} className="camp-action-button px-2 py-1.5 text-[10px] disabled:opacity-40">Thu giống</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLivestock = () => <div className="h-full flex flex-col gap-2.5 min-h-0">
    <div className="flex items-center justify-between"><div><div className="text-[12px] font-bold uppercase tracking-wider">Bãi chăn nuôi trên cạn</div><div className="text-[10px] text-[#819b8d]">Hàng rào chỉ giới hạn habitat; mỗi con vật có health, nhu cầu và tuổi riêng.</div></div><button onClick={() => onAgricultureCommand(`__agri_pen__:${CAMP_POI}`)} className="px-3 py-1.5 rounded border border-lime-600/60 bg-[#1d4328] text-[11px] font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5"/>Dựng bãi rào sơ khai</button></div>
    <div className="grid grid-cols-3 gap-2 min-h-[120px]">{terrestrialHabitats.length ? terrestrialHabitats.map(habitat => {
      const animals = habitat.animalIds.map(id => terrestrialAnimals.find(a => a.id === id)).filter(Boolean);
      const health = animals.length ? animals.reduce((sum,a) => sum + (a?.health || 0),0)/animals.length : 0;
      return <button key={habitat.id} onClick={() => setSelectedTarget(habitat.id)} className={`camp-sunken-slot rounded border p-2 text-left ${selectedPen?.id===habitat.id?'border-lime-400/70':'border-black/40'}`}><div className="flex justify-between"><b className="text-[11px]">{habitat.name}</b><span className="text-[9px] text-lime-300">{Math.round(habitat.usableAreaM2)}m²</span></div><div className="text-[10px] text-[#8fa394] mt-1">{animals.length} cá thể · sức khỏe {animals.length?Math.round(health):'—'}</div><div className="grid grid-cols-2 gap-1 mt-2 text-[9px]"><span>Thức ăn tự nhiên {Math.round(habitat.ground.vegetationBiomass)}%</span><span>Phân {Math.round(habitat.ground.manureLoad)}%</span><span>Bùn {Math.round(habitat.ground.mud)}%</span><span>An toàn {Math.round(habitat.predatorProtection)}%</span></div></button>;
    }):<div className="col-span-3 camp-sunken-slot border border-dashed border-[#3d5143] flex items-center justify-center text-[11px] text-[#809687]">Chưa có habitat. Một hàng rào đơn giản đã đủ để bắt đầu.</div>}</div>
    <div className="flex-1 grid grid-cols-[1.12fr_.88fr] gap-2.5 min-h-0"><div className="camp-sunken-panel p-3 overflow-y-auto">{selectedPen ? <><div className="flex justify-between pb-2 camp-groove-divider"><div><b className="text-[13px]">{selectedPen.name}</b><div className="text-[10px] text-[#879c8e]">{selectedPen.animalIds.length} cá thể · boundary {Math.round(selectedPen.boundaryCondition)}%</div></div><select value={selectedPen.carePolicy} onChange={e=>changePolicy(selectedPen.id,e.target.value as AgricultureCarePolicy)} className="bg-[#0e2119] border border-[#3b5945] rounded px-2 text-[10px]"><option value="minimal">Tối thiểu</option><option value="normal">Bình thường</option><option value="intensive">Tích cực</option><option value="emergency_only">Khẩn cấp</option></select></div><div className="grid grid-cols-2 gap-2 mt-2">{selectedPen.animalIds.map(id=>{const animal=terrestrialAnimals.find(a=>a.id===id);if(!animal)return null;const species=TERRESTRIAL_SPECIES[animal.speciesId];return <div key={id} className="camp-sunken-slot p-2 rounded"><div className="flex justify-between"><b className="text-[11px]">{species?.name}</b><span className="text-[9px]">{animal.sex==='female'?'♀':'♂'} {animal.lifeStage}</span></div><div className="text-[9px] text-[#8da092] mt-1">{animal.bodyWeightKg.toFixed(1)} kg · health {Math.round(animal.health)}%</div>{meter(animal.health)}</div>})}{!selectedPen.animalIds.length&&<div className="col-span-2 py-6 text-center text-[10px] text-[#778d7f]">Habitat sẵn sàng. Cá thể phải được bắt/thuần hóa trước khi đưa vào.</div>}</div></>:<div className="h-full flex items-center justify-center text-[11px] text-[#778d7f]">Tạo một bãi chăn nuôi.</div>}</div><div className="camp-sunken-panel p-3 flex flex-col">{selectedAnimal?<div className="space-y-2 text-[10px]"><div className="text-[13px] font-bold">{TERRESTRIAL_SPECIES[selectedAnimal.speciesId]?.name} · {selectedAnimal.sex==='female'?'Cái':'Đực'}</div>{[['Sức khỏe',selectedAnimal.health],['Thể trạng',selectedAnimal.bodyCondition],['Đói',selectedAnimal.hunger],['Nước',selectedAnimal.hydration],['Stress',selectedAnimal.stress],['Ký sinh',selectedAnimal.parasiteLoad]].map(([label,value])=><div key={String(label)}><div className="flex justify-between"><span>{label}</span><span>{pct(Number(value))}</span></div>{meter(Number(value),label==='Đói'||label==='Stress'||label==='Ký sinh'?'bg-amber-500':'bg-emerald-500')}</div>)}</div>:<div className="text-[10px] text-[#7e9385]">Chọn habitat có vật nuôi để inspect từng cá thể.</div>}<div className="mt-auto grid grid-cols-2 gap-1.5 pt-2"><button disabled={!selectedPen} onClick={()=>selectedPen&&care('feed_animals',selectedPen.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Cho ăn</button><button disabled={!selectedPen} onClick={()=>selectedPen&&care('water_animals',selectedPen.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Cho nước</button><button disabled={!selectedPen} onClick={()=>selectedPen&&care('clean_habitat',selectedPen.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Dọn chuồng</button><button disabled={!selectedPen} onClick={()=>selectedPen&&care('collect_product',selectedPen.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Thu sản phẩm</button></div></div></div>
  </div>;

  const renderAquatic = () => <div className="h-full flex flex-col gap-2.5 min-h-0"><div className="flex items-center justify-between"><div><div className="text-[12px] font-bold uppercase tracking-wider">Habitat thủy sinh</div><div className="text-[10px] text-[#819b8d]">Ưu tiên tận dụng sông/hồ; chỉ đào ao nếu Build Grid không có mặt nước phù hợp.</div></div><button onClick={()=>onAgricultureCommand(`__agri_aquatic__:${CAMP_POI}`)} className="px-3 py-1.5 rounded border border-sky-700/60 bg-[#153c47] text-[11px] font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5"/>Tạo khu nuôi sơ khai</button></div><div className="grid grid-cols-3 gap-2 min-h-[120px]">{aquaticHabitats.length?aquaticHabitats.map(h=><button key={h.id} onClick={()=>setSelectedTarget(h.id)} className={`camp-sunken-slot rounded border p-2 text-left ${selectedAquatic?.id===h.id?'border-sky-400/70':'border-black/40'}`}><div className="flex justify-between"><b className="text-[11px]">{h.name}</b><span className="text-[9px] text-sky-300">{h.aquaticAnimalIds.length} cá thể</span></div><div className="grid grid-cols-2 gap-1 mt-2 text-[9px]"><span>O₂ {Math.round(h.water.oxygen)}%</span><span>Nhiệt {h.water.temperatureC.toFixed(1)}°C</span><span>Waste {Math.round(h.water.wasteLoad)}%</span><span>Thoát {Math.round(h.escapeRisk)}%</span></div></button>):<div className="col-span-3 camp-sunken-slot border border-dashed border-[#36525a] flex items-center justify-center text-[11px] text-[#8099a0]">Chưa có khu nuôi nước. Hệ thống sẽ tìm đoạn sông/hồ phù hợp trước khi dùng ao đào.</div>}</div><div className="flex-1 grid grid-cols-[1.12fr_.88fr] gap-2.5 min-h-0"><div className="camp-sunken-panel p-3">{selectedAquatic?<><div className="flex justify-between pb-2 camp-groove-divider"><div><b className="text-[13px]">{selectedAquatic.name}</b><div className="text-[10px] text-[#8ba2a8]">{selectedAquatic.siteType.replace('_',' ')} · {selectedAquatic.areaM2}m²</div></div></div><div className="grid grid-cols-3 gap-2 mt-2">{[['Oxygen',selectedAquatic.water.oxygen],['Turbidity',selectedAquatic.water.turbidity],['Waste',selectedAquatic.water.wasteLoad],['Pathogen',selectedAquatic.water.pathogenLoad],['Barrier',selectedAquatic.barrierCondition],['Predator',selectedAquatic.predatorProtection]].map(([label,value])=><div key={String(label)} className="camp-sunken-slot p-2 rounded"><div className="text-[9px] text-[#8da1a5]">{label}</div><div className="text-[12px] font-bold">{Math.round(Number(value))}%</div>{meter(Number(value),label==='Waste'||label==='Pathogen'?'bg-amber-500':'bg-sky-500')}</div>)}</div><div className="mt-2 grid grid-cols-3 gap-1.5">{selectedAquatic.aquaticAnimalIds.slice(0,12).map(id=>{const animal=aquaticAnimals.find(a=>a.id===id);if(!animal)return null;return <div key={id} className="camp-sunken-slot p-1.5 rounded text-[9px]"><b>{AQUATIC_SPECIES[animal.speciesId]?.name}</b><div>{animal.weightKg.toFixed(2)}kg · {Math.round(animal.health)}%</div></div>})}</div></>:<div className="h-full flex items-center justify-center text-[11px] text-[#789099]">Tạo một habitat thủy sinh.</div>}</div><div className="camp-sunken-panel p-3 flex flex-col">{selectedFish?<div className="space-y-2 text-[10px]"><div className="text-[13px] font-bold">{AQUATIC_SPECIES[selectedFish.speciesId]?.name}</div><div>{selectedFish.lifeStage} · {selectedFish.weightKg.toFixed(2)} kg</div>{[['Sức khỏe',selectedFish.health],['Đói',selectedFish.hunger],['Stress',selectedFish.stress],['Thiếu O₂',selectedFish.oxygenStress],['Bệnh',selectedFish.diseaseLoad]].map(([label,value])=><div key={String(label)}><div className="flex justify-between"><span>{label}</span><span>{pct(Number(value))}</span></div>{meter(Number(value),label==='Sức khỏe'?'bg-emerald-500':'bg-amber-500')}</div>)}</div>:<div className="text-[10px] text-[#789099]">Con giống thủy sinh sẽ được nối từ khai thác/Encounter; habitat hiện đã mô phỏng nước độc lập.</div>}<div className="mt-auto grid grid-cols-2 gap-1.5"><button disabled={!selectedAquatic} onClick={()=>selectedAquatic&&care('feed_aquatic',selectedAquatic.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Cho ăn</button><button disabled={!selectedAquatic} onClick={()=>selectedAquatic&&care('inspect_water',selectedAquatic.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Kiểm tra nước</button><button disabled={!selectedAquatic} onClick={()=>selectedAquatic&&care('clean_aquatic',selectedAquatic.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Làm sạch</button><button disabled={!selectedAquatic} onClick={()=>selectedAquatic&&care('harvest_aquatic',selectedAquatic.id)} className="camp-action-button py-1.5 text-[10px] disabled:opacity-40">Thu hoạch</button></div></div></div></div>;

  const renderTasks = () => <div className="h-full grid grid-cols-[1.35fr_.65fr] gap-2.5 min-h-0"><div className="camp-sunken-panel p-3 overflow-y-auto"><div className="text-[12px] font-bold uppercase pb-2 camp-groove-divider">Hàng đợi công việc Nông nghiệp</div><div className="space-y-1.5 mt-2">{jobs.length?jobs.slice().reverse().map(job=><JobRow key={job.id} job={job} onAgricultureCommand={onAgricultureCommand}/>):<div className="py-10 text-center text-[11px] text-[#768c7e]">Không có công việc nông nghiệp.</div>}</div></div><div className="camp-sunken-panel p-3"><div className="text-[12px] font-bold uppercase pb-2 camp-groove-divider">Nguyên tắc scheduler</div><div className="space-y-2 mt-3 text-[10px] leading-relaxed text-[#9bad9f]"><p>• Công việc sinh ra từ nhu cầu của entity: đất khô, con vật đói, nước bẩn…</p><p>• Vật liệu gieo trồng được reserve chính xác trước khi worker bắt đầu.</p><p>• Harvest đi vào Ground Cache của đúng POI; Storage/Hauling xử lý vận chuyển tiếp.</p><p>• Policy Tích cực tạo task sớm hơn; Khẩn cấp chỉ can thiệp khi trạng thái nguy hiểm.</p></div></div></div>;

  return <div className="w-full h-full flex flex-col text-[#e8dfce] select-none pointer-events-auto" style={{fontFamily:UI_FONT}}>
    <div className="camp-sunken-panel-soft px-3.5 py-2 flex items-center justify-between shrink-0"><div className="flex items-center gap-3"><div className="camp-sunken-slot p-1.5 text-lime-300"><Leaf className="w-5 h-5"/></div><div><h2 className="text-[15px] font-bold uppercase tracking-[0.12em] text-[#f5ecd8]">NÔNG NGHIỆP <span className="text-[10px] text-[#84988b] ml-2">AGRICULTURE</span></h2><p className="text-[10px] text-[#9db0a2]">Mỗi cây và vật nuôi là một thực thể sống. Luống, hàng rào và ao chỉ tạo môi trường quản lý.</p></div></div><div className="flex gap-4 text-[10px]"><span><Sprout className="w-3.5 h-3.5 inline text-lime-300 mr-1"/>{plants.filter(p=>p.lifeStage!=='dead').length} cây sống</span><span><ShieldCheck className="w-3.5 h-3.5 inline text-amber-300 mr-1"/>{terrestrialAnimals.filter(a=>a.lifeStage!=='dead').length} vật nuôi</span><span><Fish className="w-3.5 h-3.5 inline text-sky-300 mr-1"/>{aquaticAnimals.filter(a=>a.lifeStage!=='dead').length} thủy sinh</span></div></div>
    <div className="grid grid-cols-5 gap-1.5 mt-2 shrink-0">{MODE_TABS.map(tab=>{const Icon=tab.icon;return <button key={tab.id} onClick={()=>setMode(tab.id)} className={`rounded border px-2 py-1.5 flex items-center justify-center gap-2 ${mode===tab.id?'border-lime-400/60 bg-[#1b432b] text-[#f0eadb]':'border-[#31483a] bg-[#10251c] text-[#91a496] hover:bg-[#173126]'}`}><Icon className="w-3.5 h-3.5"/><span className="text-[10px] font-bold">{tab.label}</span><span className="text-[8px] opacity-50">{tab.sub}</span></button>})}</div>
    <div className="flex-1 grid grid-cols-[250px_minmax(0,1fr)_275px] gap-2.5 mt-2 min-h-0">
      <aside className="camp-sunken-panel p-2.5 min-h-0 overflow-y-auto"><div className="text-[10px] font-bold uppercase tracking-wider text-[#dcd4c2] pb-2 camp-groove-divider">{mode==='livestock'?'Loài vật nuôi':mode==='aquatic'?'Loài thủy sinh':'Loài cây khả dụng'}</div><div className="mt-2">{mode==='tasks'?<div className="text-[10px] text-[#819487] leading-relaxed">Danh sách bên giữa hiển thị tất cả agriculture job persistent. Chuyển sang mode sinh học để thao tác habitat.</div>:renderSpeciesList()}</div></aside>
      <main className="min-w-0 min-h-0">{mode==='crops'||mode==='perennials'?renderCultivation():mode==='livestock'?renderLivestock():mode==='aquatic'?renderAquatic():renderTasks()}</main>
      <aside className="flex flex-col gap-2.5 min-h-0"><div className="camp-sunken-panel p-2.5 max-h-[34%] overflow-y-auto"><div className="text-[10px] font-bold uppercase tracking-wider pb-2 camp-groove-divider">Sản lượng 7 ngày</div><div className="space-y-1.5 mt-2">{outputLast7Days.length?outputLast7Days.slice(0,7).map(([itemId,quantity])=><div key={itemId} className="flex items-center gap-2"><ItemIcon itemId={itemId} size={26}/><span className="text-[10px] flex-1 truncate">{ITEMS_DATABASE[itemId]?.name||itemId}</span><b className="text-[11px] text-lime-300">{quantity}</b></div>):<div className="text-[10px] text-[#758a7d]">Chưa có thu hoạch.</div>}</div></div><div className="camp-sunken-panel p-2.5 max-h-[33%] overflow-y-auto"><div className="flex items-center justify-between pb-2 camp-groove-divider"><span className="text-[10px] font-bold uppercase tracking-wider">Giống đang lưu trữ</span><button onClick={()=>onNavigateTab('storage')} className="text-[9px] text-lime-300 hover:text-lime-200">Mở kho</button></div><div className="grid grid-cols-2 gap-1.5 mt-2">{seedStocks.length?seedStocks.slice(0,8).map(({species,count})=><div key={species.id} className="camp-sunken-slot rounded p-1.5 flex items-center gap-1.5"><ItemIcon itemId={species.seedItemId} size={26}/><div className="min-w-0"><div className="text-[9px] truncate">{species.name}</div><b className="text-[10px] text-lime-300">×{count}</b></div></div>):<div className="col-span-2 text-[10px] text-[#758a7d]">Không có giống khả dụng.</div>}</div></div><div className="camp-sunken-panel p-2.5 flex-1 min-h-0 overflow-y-auto"><div className="flex items-center justify-between pb-2 camp-groove-divider"><span className="text-[10px] font-bold uppercase tracking-wider">Công việc đang hoạt động</span><Clock className="w-3.5 h-3.5 text-amber-300"/></div><div className="space-y-1.5 mt-2">{jobs.filter(j=>j.status!=='completed').slice(0,6).map(job=><JobRow key={job.id} job={job} onAgricultureCommand={onAgricultureCommand} compact/>)}{!jobs.some(j=>j.status!=='completed')&&<div className="text-[10px] text-[#758a7d]">Không có task cần xử lý.</div>}</div></div></aside>
    </div>
  </div>;
};

const JobRow: React.FC<{job:AgricultureJob;onAgricultureCommand:(command:string)=>void;compact?:boolean}> = ({job,onAgricultureCommand,compact}) => {
  const progress = job.totalSeconds > 0 ? Math.min(100, job.progressSeconds / job.totalSeconds * 100) : 0;
  return <div className="camp-sunken-slot rounded px-2 py-1.5"><div className="flex items-center gap-2"><Activity className={`w-3.5 h-3.5 ${job.status==='blocked'?'text-red-400':job.status==='in_progress'?'text-lime-300':'text-amber-300'}`}/><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold truncate">{job.kind.replace(/_/g,' ')}</div><div className="text-[8px] text-[#819688]">{STATUS_LABEL[job.status]||job.status}</div></div>{job.status!=='completed'&&<><button title={job.status==='paused'?'Tiếp tục':'Tạm dừng'} onClick={()=>onAgricultureCommand(`__agri_pause__:${job.id}`)} className="w-6 h-6 rounded border border-[#405646] flex items-center justify-center">{job.status==='paused'?<Play className="w-3 h-3"/>:<Pause className="w-3 h-3"/>}</button><button title="Hủy" onClick={()=>onAgricultureCommand(`__agri_cancel__:${job.id}`)} className="w-6 h-6 rounded border border-red-800/60 text-red-300 flex items-center justify-center"><X className="w-3 h-3"/></button></>}</div>{!compact&&<div className="mt-1.5">{meter(progress,job.status==='blocked'?'bg-red-500':'bg-lime-500')}</div>}{job.blockedReasons?.length>0&&<div className="text-[8px] text-red-300 mt-1 truncate">{job.blockedReasons.join(' · ')}</div>}</div>;
};
