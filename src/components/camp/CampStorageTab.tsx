import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Box,
  ChevronRight,
  Droplets,
  Info,
  Package,
  Pause,
  Play,
  Search,
  Settings2,
  Truck,
  Warehouse,
  Weight,
  X,
} from 'lucide-react';
import type { GameState, InventoryItem } from '../../types';
import type { StorageLocation, StoragePriority } from '../../types/storageSimulation';
import '../../types/storageSimulation';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';
import { QualityBadge } from '../common/QualityBadge';
import {
  canStoreItemInLocation,
  getDynamicStorageSlotCount,
  getStorageLocationItems,
  summarizeStorageLocation,
} from '../../simulation/storageSystem';
import { calculateInventoryOccupancy, getAvailableInventoryItemQuantity } from '../../simulation/inventorySystem';

interface CampStorageTabProps {
  state: GameState;
  onNavigateTab: (tab: string) => void;
  onStorageCommand?: (command: string) => void;
}

type CategoryFilter = 'all' | 'food' | 'water' | 'materials' | 'tools' | 'medicine' | 'misc';
type DetailSource = 'stored' | 'carried';

const CAMP_POI_ID = 'AREA_CAMP_CLEARING';
const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(5,35,32,.88), rgba(3,24,23,.94))',
  border: '1px solid rgba(103,132,103,.34)',
  boxShadow: 'inset 0 6px 16px rgba(0,0,0,.32)',
};
const slotStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(5,31,29,.86), rgba(2,21,20,.92))',
  border: '1px solid rgba(111,132,98,.35)',
  boxShadow: 'inset 0 4px 10px rgba(0,0,0,.36)',
};

function categoryForItem(item: InventoryItem): CategoryFilter {
  const def = ITEMS_DATABASE[item.itemId];
  if (!def) return 'misc';
  if (def.category === 'food') return 'food';
  if (def.category === 'water') return 'water';
  if (def.category === 'tool') return 'tools';
  if (def.category === 'medicine') return 'medicine';
  if (['raw_material', 'component', 'construction', 'seed'].includes(def.category)) return 'materials';
  return 'misc';
}

function locationIcon(location: StorageLocation) {
  if (location.isGroundCache) return Package;
  if (location.kind === 'rack') return Archive;
  if (location.kind === 'structure') return Warehouse;
  if (location.kind === 'liquid') return Droplets;
  if (location.kind === 'bulk') return Box;
  return Package;
}

function meterLabel(value: number): string {
  if (value >= 75) return 'Cao';
  if (value >= 45) return 'Khá';
  if (value >= 20) return 'Thấp';
  return 'Rất thấp';
}

function capacityTone(percent: number) {
  if (percent >= 100) return '#ef6a5b';
  if (percent >= 85) return '#e5bd58';
  return '#73d56a';
}

function haulStatusLabel(status: string): string {
  if (status === 'waiting_worker') return 'Chờ người';
  if (status === 'in_progress') return 'Đang vận chuyển';
  if (status === 'blocked') return 'Bị chặn';
  if (status === 'paused') return 'Tạm dừng';
  return 'Hoàn tất';
}

export const CampStorageTab: React.FC<CampStorageTabProps> = ({ state, onNavigateTab, onStorageCommand }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const campLocations = useMemo(
    () => (state.storageSystem?.locations || []).filter(location => location.poiId === CAMP_POI_ID),
    [state.storageSystem?.locations],
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>(campLocations[0]?.id || '');
  const [selectedStoredInstanceId, setSelectedStoredInstanceId] = useState<string | null>(null);
  const [selectedCarriedInstanceId, setSelectedCarriedInstanceId] = useState<string | null>(state.inventory.items[0]?.instanceId || null);
  const [detailSource, setDetailSource] = useState<DetailSource>('stored');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [policyMin, setPolicyMin] = useState('0');
  const [policyMax, setPolicyMax] = useState('');

  useEffect(() => {
    if (!campLocations.some(location => location.id === selectedLocationId)) {
      setSelectedLocationId(campLocations[0]?.id || '');
      setSelectedStoredInstanceId(null);
    }
  }, [campLocations, selectedLocationId]);

  const selectedLocation = campLocations.find(location => location.id === selectedLocationId) || campLocations[0] || null;
  const locationItems = selectedLocation ? getStorageLocationItems(state, selectedLocation.id) : [];
  const summary = selectedLocation ? summarizeStorageLocation(state, selectedLocation.id) : null;

  const filteredItems = useMemo(() => locationItems.filter(item => {
    const def = ITEMS_DATABASE[item.itemId];
    if (!def) return false;
    if (selectedCategory !== 'all' && categoryForItem(item) !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return def.name.toLowerCase().includes(query) || def.category.toLowerCase().includes(query) || def.tags.some(tag => tag.toLowerCase().includes(query));
  }), [locationItems, selectedCategory, searchQuery]);

  const selectedStoredItem = locationItems.find(item => item.instanceId === selectedStoredInstanceId) || (detailSource === 'stored' ? filteredItems[0] : null) || null;
  const selectedCarriedItem = state.inventory.items.find(item => item.instanceId === selectedCarriedInstanceId) || state.inventory.items[0] || null;
  const detailItem = detailSource === 'carried' ? selectedCarriedItem : selectedStoredItem;
  const detailDef = detailItem ? ITEMS_DATABASE[detailItem.itemId] : null;
  const carriedOccupancy = calculateInventoryOccupancy(state.inventory.items);
  const acceptance = selectedLocation && selectedCarriedItem
    ? canStoreItemInLocation(state, selectedLocation.id, selectedCarriedItem, getAvailableInventoryItemQuantity(selectedCarriedItem))
    : null;

  const columns = 5;
  const slotCount = getDynamicStorageSlotCount(filteredItems.length, columns, summary?.isFull || false);
  const emptySlots = Math.max(0, slotCount - filteredItems.length);
  const alerts = (state.storageSystem?.alerts || []).filter(alert => !selectedLocation || alert.locationId === selectedLocation.id);
  const activeHaulJobs = (state.storageSystem?.haulJobs || []).filter(job =>
    job.status !== 'completed' && (!selectedLocation || job.sourceLocationId === selectedLocation.id || job.targetLocationId === selectedLocation.id),
  );
  const transferTargets = campLocations.filter(location => location.id !== selectedLocation?.id && !location.isGroundCache === false ? true : location.id !== selectedLocation?.id);

  useEffect(() => {
    const validTargets = campLocations.filter(location => location.id !== selectedLocation?.id);
    if (!validTargets.some(location => location.id === transferTargetId)) setTransferTargetId(validTargets[0]?.id || '');
  }, [campLocations, selectedLocation?.id, transferTargetId]);

  useEffect(() => {
    if (!selectedLocation || !detailItem) {
      setPolicyMin('0');
      setPolicyMax('');
      return;
    }
    const rule = selectedLocation.policy.stockRules.find(entry => entry.itemId === detailItem.itemId);
    setPolicyMin(String(rule?.minQuantity ?? 0));
    setPolicyMax(rule?.maxQuantity === undefined ? '' : String(rule.maxQuantity));
  }, [selectedLocation?.id, detailItem?.itemId, selectedLocation?.policy.stockRules]);

  const categories: Array<{ id: CategoryFilter; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'food', label: 'Thực phẩm' },
    { id: 'water', label: 'Nước' },
    { id: 'materials', label: 'Nguyên liệu' },
    { id: 'tools', label: 'Công cụ' },
    { id: 'medicine', label: 'Thuốc' },
    { id: 'misc', label: 'Khác' },
  ];

  const send = (command: string) => onStorageCommand?.(command);
  const setPriority = (priority: StoragePriority) => selectedLocation && send(`__storage_priority__:${selectedLocation.id}:${priority}`);

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2 text-[#e9dfcc] select-none" style={{ fontFamily: UI_FONT }}>
      <div className="shrink-0 rounded-lg px-3 py-2 flex items-center gap-2" style={panelStyle}>
        <div className="mr-2 flex items-center gap-2 min-w-[180px]">
          <Warehouse className="w-5 h-5 text-[#e3d59d]" />
          <div><div className="text-[14px] font-bold">STORAGE</div><div className="text-[9px] text-[#789489]">Lưu trữ · bảo quản · logistics</div></div>
        </div>
        <div className="flex-1 grid grid-cols-7 gap-1.5">
          {categories.map(category => (
            <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className="rounded px-2 py-1.5 text-[10px] border transition-all" style={{ background: selectedCategory === category.id ? '#27522e' : '#0a2d29', borderColor: selectedCategory === category.id ? '#ccb94f' : '#486659', color: selectedCategory === category.id ? '#fff0ad' : '#a5b4a8' }}>{category.label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_340px] gap-2">
        <section className="min-h-0 rounded-lg p-2.5 flex flex-col" style={panelStyle}>
          <div className="flex items-center justify-between pb-2 border-b border-[#557061]/30">
            <div><div className="text-[12px] font-bold">STORAGE LOCATIONS</div><div className="text-[9px] text-[#769086]">Công trình & nội thất chứa đồ</div></div>
            <button type="button" onClick={() => onNavigateTab('buildings')} className="text-[9px] px-2 py-1 rounded border border-[#6f7e48] text-[#e2c861] hover:bg-white/5">+ Plan Storage</button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto py-2 space-y-1.5 building-scroll">
            {campLocations.map(location => {
              const Icon = locationIcon(location);
              const rowSummary = summarizeStorageLocation(state, location.id);
              const selected = selectedLocation?.id === location.id;
              const pct = Math.min(100, rowSummary?.usedPercent || 0);
              const incoming = (state.storageSystem?.haulJobs || []).filter(job => job.targetLocationId === location.id && job.status !== 'completed').length;
              return (
                <button key={location.id} type="button" onClick={() => { setSelectedLocationId(location.id); setSelectedStoredInstanceId(null); setDetailSource('stored'); }} className="w-full rounded-md p-2 text-left border transition-all" style={{ ...slotStyle, borderColor: selected ? '#d4bd50' : 'rgba(111,132,98,.35)', boxShadow: selected ? '0 0 12px rgba(197,177,59,.16), inset 0 4px 10px rgba(0,0,0,.36)' : slotStyle.boxShadow }}>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded flex items-center justify-center bg-black/20 border border-[#526b5d]/40"><Icon className="w-5 h-5 text-[#d6c898]" /></div>
                    <div className="min-w-0 flex-1"><div className="text-[11px] font-semibold truncate">{location.name}</div><div className="text-[9px] text-[#789084]">{location.isGroundCache ? 'Unprotected stockpile' : `${location.kind} · ${location.policy.priority}`}</div></div>
                    {incoming > 0 ? <Truck className="w-4 h-4 text-[#e3bf5e]" /> : <ChevronRight className="w-4 h-4 text-[#718b7c]" />}
                  </div>
                  <div className="mt-2 h-1.5 bg-black/35 rounded overflow-hidden"><div className="h-full" style={{ width: `${pct}%`, background: capacityTone(pct) }} /></div>
                  <div className="mt-1 flex justify-between text-[9px] text-[#82978d]"><span>{rowSummary?.usedVolumeL.toFixed(1) || 0}/{location.capacity.maxVolumeL} L</span><span>{rowSummary?.usedWeightKg.toFixed(1) || 0}/{location.capacity.maxWeightKg} kg</span></div>
                </button>
              );
            })}
          </div>
          {alerts.length > 0 && <div className="shrink-0 mt-1 rounded p-2 border border-amber-700/40 bg-amber-950/15 text-[9px] text-amber-200"><AlertTriangle className="w-3 h-3 inline mr-1" />{alerts[0].message}</div>}
        </section>

        <section className="min-h-0 rounded-lg p-2.5 flex flex-col" style={panelStyle}>
          <div className="shrink-0 flex items-center justify-between gap-3 pb-2 border-b border-[#557061]/30">
            <div className="min-w-0"><div className="text-[14px] font-bold truncate">{selectedLocation?.name || 'Chưa chọn kho'}</div><div className="text-[9px] text-[#789084]">Slot là vùng hiển thị; volume/weight mới là capacity thật.</div></div>
            <div className="relative w-[180px]"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6e877a]" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Tìm vật phẩm..." className="w-full rounded bg-[#061f1d] border border-[#456052]/50 pl-7 pr-2 py-1.5 text-[10px] outline-none" /></div>
          </div>

          {summary && selectedLocation && (
            <div className="shrink-0 grid grid-cols-3 gap-2 py-2 text-[9px]">
              <div className="rounded p-1.5" style={slotStyle}><div className="text-[#718b7e]">Dung tích</div><div className="text-[11px]">{summary.usedVolumeL.toFixed(1)} / {selectedLocation.capacity.maxVolumeL} L</div></div>
              <div className="rounded p-1.5" style={slotStyle}><div className="text-[#718b7e]">Tải trọng</div><div className="text-[11px]">{summary.usedWeightKg.toFixed(1)} / {selectedLocation.capacity.maxWeightKg} kg</div></div>
              <div className="rounded p-1.5" style={slotStyle}><div className="text-[#718b7e]">Trạng thái</div><div className="text-[11px]" style={{ color: summary.isFull ? '#ef7767' : '#76d56e' }}>{summary.isFull ? 'FULL' : `${Math.min(100, summary.usedPercent)}% used`}</div></div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto building-scroll pr-1">
            <div className="grid grid-cols-5 gap-2 auto-rows-[92px]">
              {filteredItems.map(item => {
                const def = ITEMS_DATABASE[item.itemId];
                const selected = selectedStoredItem?.instanceId === item.instanceId && detailSource === 'stored';
                const reserved = item.reservedQuantity || 0;
                return (
                  <button key={item.instanceId} type="button" onClick={() => { setSelectedStoredInstanceId(item.instanceId); setDetailSource('stored'); }} className="relative rounded-md p-1.5 flex flex-col items-center justify-center border" style={{ ...slotStyle, borderColor: selected ? '#d6bc4b' : 'rgba(111,132,98,.35)' }}>
                    <ItemIcon itemId={item.itemId} className="w-9 h-9 object-contain" />
                    <div className="text-[9px] leading-tight mt-1 text-center w-full truncate">{def?.name || item.itemId}</div>
                    <div className="absolute right-1.5 bottom-1 text-[10px] font-bold text-[#e6ca6b]">×{item.quantity}</div>
                    {reserved > 0 && <div className="absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] bg-[#684e1a]/85 text-[#ffd979]">R {reserved}</div>}
                    {item.quality && item.quality !== 'standard' && <div className="absolute right-1 top-1 scale-75 origin-top-right"><QualityBadge quality={item.quality} showText={false} size="sm" /></div>}
                  </button>
                );
              })}
              {Array.from({ length: emptySlots }).map((_, index) => (
                <div key={`empty_${index}`} className="rounded-md border border-dashed border-[#496255]/45 flex items-center justify-center text-[#425c50]" style={{ background: 'rgba(3,25,22,.35)' }} title={summary?.isFull ? 'Kho đã đầy' : 'Drop target động; không phải slot capacity'}><Package className="w-5 h-5 opacity-35" /></div>
              ))}
            </div>
          </div>
        </section>

        <aside className="min-h-0 flex flex-col gap-2">
          {selectedLocation && summary && (
            <div className="rounded-lg p-2.5 shrink-0" style={panelStyle}>
              <div className="flex items-center justify-between pb-2 border-b border-[#557061]/30"><div className="text-[12px] font-bold">STORAGE INFO</div><Settings2 className="w-4 h-4 text-[#81968b]" /></div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px]">
                <div className="text-[#7d9489]">Chống ẩm</div><div className="text-right">{meterLabel(selectedLocation.environment.moistureProtection)}</div>
                <div className="text-[#7d9489]">Pest protection</div><div className="text-right">{meterLabel(selectedLocation.environment.pestProtection)}</div>
                <div className="text-[#7d9489]">Thông khí</div><div className="text-right">{meterLabel(selectedLocation.environment.ventilation)}</div>
                <div className="text-[#7d9489]">Tình trạng</div><div className="text-right">{Math.round(selectedLocation.condition)}%</div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#557061]/25 grid grid-cols-[1fr_1fr] gap-1.5">
                <select value={selectedLocation.policy.priority} onChange={event => setPriority(event.target.value as StoragePriority)} className="bg-[#061f1d] border border-[#4d6759]/55 rounded px-2 py-1.5 text-[9px] outline-none">
                  <option value="low">Priority: Low</option><option value="normal">Priority: Normal</option><option value="high">Priority: High</option><option value="critical">Priority: Critical</option>
                </select>
                <button type="button" disabled={Boolean(selectedLocation.isGroundCache)} onClick={() => send(`__storage_autohaul__:${selectedLocation.id}:${selectedLocation.policy.autoHaul ? 0 : 1}`)} className="rounded border px-2 py-1.5 text-[9px] disabled:opacity-30" style={{ borderColor: selectedLocation.policy.autoHaul ? '#84a946' : '#50695b', background: selectedLocation.policy.autoHaul ? '#244a2a' : '#102e28', color: selectedLocation.policy.autoHaul ? '#e1e797' : '#9aaba1' }}>Auto Haul {selectedLocation.policy.autoHaul ? 'ON' : 'OFF'}</button>
              </div>
            </div>
          )}

          {activeHaulJobs.length > 0 && (
            <div className="rounded-lg p-2.5 shrink-0 max-h-[128px] overflow-auto building-scroll" style={panelStyle}>
              <div className="flex items-center gap-1.5 text-[11px] font-bold mb-1.5"><Truck className="w-3.5 h-3.5 text-[#ddbd61]" />LOGISTICS QUEUE</div>
              {activeHaulJobs.map(job => {
                const pct = job.totalSeconds > 0 ? Math.min(100, job.progressSeconds / job.totalSeconds * 100) : 0;
                return <div key={job.id} className="py-1.5 border-t border-[#52685b]/20 first:border-0 text-[9px]">
                  <div className="flex items-center gap-1"><span className="flex-1 truncate">{ITEMS_DATABASE[job.itemId]?.name || job.itemId} ×{job.quantity}</span><span className={job.status === 'blocked' ? 'text-[#ef7b69]' : 'text-[#c9b55f]'}>{haulStatusLabel(job.status)}</span></div>
                  <div className="flex items-center gap-1 mt-1"><div className="flex-1 h-1 bg-black/40 rounded overflow-hidden"><div className="h-full bg-[#68c678]" style={{ width: `${pct}%` }} /></div><button type="button" onClick={() => send(`__storage_haul_pause__:${job.id}`)} className="p-0.5 text-[#c8b96d]">{job.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}</button><button type="button" onClick={() => send(`__storage_haul_cancel__:${job.id}`)} className="p-0.5 text-[#d86a5c]"><X className="w-3 h-3" /></button></div>
                </div>;
              })}
            </div>
          )}

          <div className="rounded-lg p-2.5 flex-1 min-h-0 overflow-auto building-scroll" style={panelStyle}>
            <div className="text-[12px] font-bold pb-2 border-b border-[#557061]/30">ITEM DETAILS</div>
            {detailItem && detailDef ? (
              <div className="pt-2">
                <div className="flex gap-2.5"><div className="w-14 h-14 rounded flex items-center justify-center" style={slotStyle}><ItemIcon itemId={detailItem.itemId} className="w-10 h-10 object-contain" /></div><div className="min-w-0"><div className="text-[13px] font-semibold">{detailDef.name}</div><div className="text-[9px] uppercase text-[#759084]">{detailDef.category}</div><p className="text-[9px] text-[#93a69b] leading-relaxed mt-1 line-clamp-2">{detailDef.description}</p></div></div>
                <div className="mt-2 grid grid-cols-2 gap-y-1 text-[9px]"><span className="text-[#7d9489]">Số lượng</span><span className="text-right">{detailItem.quantity}</span><span className="text-[#7d9489]">Khả dụng</span><span className="text-right">{getAvailableInventoryItemQuantity(detailItem)}</span><span className="text-[#7d9489]">Reserved</span><span className="text-right">{detailItem.reservedQuantity || 0}</span><span className="text-[#7d9489]">Weight / Volume</span><span className="text-right">{detailDef.weight}kg / {detailDef.volume}L</span>{detailItem.moisture !== undefined && <><span className="text-[#7d9489]">Độ ẩm</span><span className="text-right">{Math.round(detailItem.moisture)}%</span></>}</div>

                {selectedLocation && detailSource === 'stored' && selectedStoredItem && (
                  <div className="mt-2 pt-2 border-t border-[#557061]/25 space-y-1.5">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                      <input type="number" min={0} value={policyMin} onChange={event => setPolicyMin(event.target.value)} className="bg-[#061f1d] border border-[#4d6759]/55 rounded px-1.5 py-1 text-[9px]" placeholder="Min" />
                      <input type="number" min={0} value={policyMax} onChange={event => setPolicyMax(event.target.value)} className="bg-[#061f1d] border border-[#4d6759]/55 rounded px-1.5 py-1 text-[9px]" placeholder="Max ∞" />
                      <button type="button" onClick={() => send(`__storage_stockrule__:${selectedLocation.id}:${selectedStoredItem.itemId}:${Number(policyMin || 0)}:${policyMax}`)} className="rounded border border-[#708447] px-2 text-[9px] text-[#d6d784]">Policy</button>
                    </div>
                    {transferTargets.length > 0 && <div className="grid grid-cols-[1fr_auto] gap-1"><select value={transferTargetId} onChange={event => setTransferTargetId(event.target.value)} className="bg-[#061f1d] border border-[#4d6759]/55 rounded px-1.5 py-1 text-[9px]">{transferTargets.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select><button type="button" disabled={getAvailableInventoryItemQuantity(selectedStoredItem) <= 0 || !transferTargetId} onClick={() => send(`__storage_haul__:${selectedLocation.id}:${transferTargetId}:${selectedStoredItem.itemId}:${getAvailableInventoryItemQuantity(selectedStoredItem)}`)} className="rounded border border-[#a88938] bg-[#3b471e] text-[#ffe38a] px-2 text-[9px] disabled:opacity-35"><ArrowRightLeft className="w-3 h-3 inline mr-1" />Transfer</button></div>}
                    <button type="button" disabled={getAvailableInventoryItemQuantity(selectedStoredItem) <= 0} onClick={() => send(`__storage_take__:${selectedLocation.id}:${selectedStoredItem.instanceId}`)} className="w-full py-1.5 rounded border border-[#a88938] bg-[#3b471e] text-[#ffe38a] text-[9px] disabled:opacity-35">Lấy vào Carrying Inventory</button>
                  </div>
                )}
              </div>
            ) : <div className="h-full flex flex-col items-center justify-center text-center text-[#71897e]"><Info className="w-7 h-7 mb-2 opacity-50" /><span className="text-[10px]">Chọn vật phẩm để xem chi tiết.</span></div>}
          </div>
        </aside>
      </div>

      <div className="shrink-0 rounded-lg p-2 grid grid-cols-[170px_minmax(0,1fr)_230px] gap-2 items-center" style={panelStyle}>
        <div><div className="text-[11px] font-bold">CARRYING INVENTORY</div><div className="text-[9px] text-[#789084]">Đồ nhóm đang mang</div><div className="flex items-center gap-1 mt-1 text-[9px] text-[#a8b5aa]"><Weight className="w-3 h-3" />{carriedOccupancy.weight.toFixed(1)} / {state.inventory.maxWeightKg} kg · {carriedOccupancy.volume.toFixed(1)} / {state.inventory.maxVolumeL} L</div></div>
        <div className="flex gap-1.5 overflow-x-auto building-scroll pb-1">
          {state.inventory.items.map(item => {
            const def = ITEMS_DATABASE[item.itemId];
            const selected = selectedCarriedItem?.instanceId === item.instanceId && detailSource === 'carried';
            return <button key={item.instanceId} type="button" onClick={() => { setSelectedCarriedInstanceId(item.instanceId); setDetailSource('carried'); }} className="relative w-[64px] h-[58px] shrink-0 rounded border flex flex-col items-center justify-center" style={{ ...slotStyle, borderColor: selected ? '#d4bd50' : 'rgba(111,132,98,.35)' }}><ItemIcon itemId={item.itemId} className="w-7 h-7 object-contain" /><span className="text-[8px] w-[56px] truncate">{def?.name || item.itemId}</span><span className="absolute right-1 bottom-0.5 text-[9px] text-[#e5c75f]">×{item.quantity}</span></button>;
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={!selectedLocation || !selectedCarriedItem || !acceptance?.accepted} onClick={() => selectedLocation && selectedCarriedItem && send(`__storage_store__:${selectedLocation.id}:${selectedCarriedItem.instanceId}`)} className="rounded py-2 text-[10px] border border-[#73943f] bg-[#28502c] text-[#e5e7a3] disabled:opacity-35" title={!acceptance?.accepted ? acceptance?.reasons[0] : undefined}>Cất đã chọn</button>
          <button type="button" disabled={!selectedLocation || summary?.isFull || state.inventory.items.length === 0} onClick={() => selectedLocation && send(`__storage_store_all__:${selectedLocation.id}`)} className="rounded py-2 text-[10px] border border-[#73943f] bg-[#28502c] text-[#e5e7a3] disabled:opacity-35">Cất tất cả</button>
          <div className="col-span-2 text-[8px] text-center min-h-[12px]" style={{ color: acceptance?.accepted ? '#79c976' : '#c59a64' }}>{selectedCarriedItem && selectedLocation ? (acceptance?.accepted ? `Có thể cất ${acceptance.maxAcceptableQuantity} đơn vị` : acceptance?.reasons[0] || 'Không thể cất') : 'Chọn vật phẩm đang mang và nơi chứa'}</div>
        </div>
      </div>
    </div>
  );
};