import { GameState, ItemQuality } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { AREAS_DATABASE } from '../data/areas';
import { addItemToInventory, deductItemFromInventory, getOrCreatePoiStorage } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { rollGatherQuality, QUALITY_CONFIG, getFreshnessStage, FRESHNESS_CONFIG, getDominantQuality } from '../utils/qualityUtils';
import { calculateToolWear, applyToolWear, synthesizeCraftedQuality } from './itemSimulation';

export function tickSurvivors(
  next: GameState, 
  deltaGameMinutes: number, 
  deltaGameSeconds: number
): void {
  const hasShelter = next.buildings.some(b => b.buildingId === 'BUILDING_LEAF_SHELTER' && b.isBuilt);

  for (const survivor of next.survivors) {
    // Metabolic rates per game minute
    const hungerRate = 0.015; // ~21 hunger per day
    const thirstRate = next.weather.current === 'heat_wave' ? 0.035 : 0.025; // ~36 thirst per day
    const fatigueRate = survivor.currentAction.type === 'resting' ? -0.06 : 0.012;

    survivor.hunger = Math.min(100, Math.max(0, survivor.hunger + hungerRate * deltaGameMinutes));
    survivor.thirst = Math.min(100, Math.max(0, survivor.thirst + thirstRate * deltaGameMinutes));
    survivor.fatigue = Math.min(100, Math.max(0, survivor.fatigue + fatigueRate * deltaGameMinutes * (hasShelter ? 1.4 : 1.0)));

    // Health damage if starving or dehydrated
    if (survivor.hunger >= 95 || survivor.thirst >= 95) {
      survivor.health = Math.max(0, survivor.health - 0.03 * deltaGameMinutes);
    } else if (survivor.hunger < 40 && survivor.thirst < 40 && survivor.health < 100) {
      survivor.health = Math.min(100, survivor.health + 0.02 * deltaGameMinutes);
    }

    // Auto-consume food if enabled and hungry
    if (next.settings.autoConsumeFood && survivor.hunger > 50 && survivor.currentAction.type !== 'on_expedition') {
      const foodItems = next.inventory.items.filter(i => {
        const d = ITEMS_DATABASE[i.itemId];
        if (!d || d.category !== 'food' || !d.nutrition || d.nutrition.calories <= 0) return false;
        // Không tự động ăn đồ đã phân hủy thành mùn
        if (i.freshness !== undefined && i.freshness <= 0) return false;
        return true;
      });
      if (foodItems.length > 0) {
        const chosen = foodItems[0];
        const def = ITEMS_DATABASE[chosen.itemId];
        if (def && def.nutrition) {
          deductItemFromInventory(next.inventory, chosen.itemId, 1);
          
          // Đánh giá tác động của độ tươi
          const fStage = getFreshnessStage(chosen.freshness);
          const fMeta = FRESHNESS_CONFIG[fStage];
          
          // Đánh giá tác động của phẩm chất
          const domQuality = getDominantQuality(chosen.qualityBreakdown, chosen.quality);
          const qMult = domQuality === 'masterwork' ? 1.5 : domQuality === 'prime' ? 1.25 : domQuality === 'crude' ? 0.85 : 1.0;

          const finalCalories = def.nutrition.calories * fMeta.nutritionMultiplier * qMult;
          survivor.hunger = Math.max(0, survivor.hunger - finalCalories * 0.15);
          
          const moraleChange = (def.nutrition.moraleBonus || 1) + fMeta.moraleModifier;
          survivor.morale = Math.min(100, Math.max(0, survivor.morale + moraleChange));

          // Rủi ro đau bụng nếu ăn đồ ôi thiu
          if (fMeta.healthRiskPercent > 0 && Math.random() < (fMeta.healthRiskPercent / 100)) {
            survivor.health = Math.max(0, survivor.health - 6);
            next.logs.unshift({
              id: `sick_${Date.now()}_${survivor.id}`,
              day: next.gameTime.day,
              timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
              text: `[Đau bụng] ${survivor.name} bị khó chịu sau khi ăn ${def.name} đã ${fMeta.labelVi.toLowerCase()}! (-6 Máu)`,
              type: 'danger',
            });
          } else {
            next.logs.unshift({
              id: `eat_${Date.now()}_${survivor.id}`,
              day: next.gameTime.day,
              timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
              text: `${survivor.name} đã ăn ${def.name} (${fMeta.labelVi}), hồi phục cơn đói.`,
              type: 'info',
            });
          }
        }
      }
    }

    // Auto-consume water if enabled and thirsty
    if (next.settings.autoConsumeWater && survivor.thirst > 45 && survivor.currentAction.type !== 'on_expedition') {
      const waterItems = next.inventory.items.filter(i => {
        const d = ITEMS_DATABASE[i.itemId];
        return d && (d.category === 'water' || d.tags.includes('drinkable')) && !d.tags.includes('dirty');
      });
      if (waterItems.length > 0) {
        const chosen = waterItems[0];
        const def = ITEMS_DATABASE[chosen.itemId];
        if (def && def.nutrition) {
          deductItemFromInventory(next.inventory, chosen.itemId, 1);
          survivor.thirst = Math.max(0, survivor.thirst - (def.nutrition.hydration * 0.12));
          // If drinking open coconut, return coconut bowl!
          if (chosen.itemId === 'ITEM_OPEN_COCONUT') {
            addItemToInventory(next.inventory, 'ITEM_COCONUT_MEAT', 1);
            addItemToInventory(next.inventory, 'ITEM_COCONUT_BOWL', 1);
          }
          // If drinking boiled water bowl, return empty coconut bowl!
          if (chosen.itemId === 'ITEM_BOILED_WATER_BOWL') {
            addItemToInventory(next.inventory, 'ITEM_COCONUT_BOWL', 1);
          }
          next.logs.unshift({
            id: `drink_${Date.now()}_${survivor.id}`,
            day: next.gameTime.day,
            timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
            text: `${survivor.name} drank clean water, quenching thirst.`,
            type: 'info',
          });
        }
      }
    }

    // Survivor Action Progress (Gathering, Crafting, Building, Resting)
    if (survivor.currentAction.type !== 'idle' && survivor.currentAction.type !== 'on_expedition') {
      survivor.currentAction.progressSeconds += deltaGameSeconds;
      if (survivor.currentAction.progressSeconds >= survivor.currentAction.totalSeconds) {
        const actionType = survivor.currentAction.type;
        const targetId = survivor.currentAction.targetId;
        const payload = survivor.currentAction.resultPayload || {};

        // Finished Gathering
        if (actionType === 'gathering' && payload.nodeItemId) {
          const itemId = payload.nodeItemId as string;
          const nodeName = (payload.nodeName as string) || 'Resource Node';
          const minYield = (payload.minYield as number) || 1;
          const maxYield = (payload.maxYield as number) || minYield;
          const pool = targetId && next.resourcePools ? next.resourcePools[targetId] : null;

          // Calculate harvest yield
          const rolledYield = Math.floor(Math.random() * (maxYield - minYield + 1)) + minYield;
          let actualQty = rolledYield;

          // Account for pool stock limit
          if (pool) {
            actualQty = Math.max(1, Math.min(rolledYield, Math.floor(pool.currentStock)));
            pool.currentStock = Math.max(0, pool.currentStock - actualQty);

            // Depletion status alerts
            if (pool.currentStock <= 0) {
              next.logs.unshift({
                id: `pool_dep_${Date.now()}`,
                day: next.gameTime.day,
                timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
                text: `[Cạn kiệt] Bãi tài nguyên "${nodeName}" đã bị khai thác hết sạch! Cần chờ hệ sinh thái tự phục hồi.`,
                type: 'danger',
              });
            } else if (pool.currentStock / pool.maxStock < 0.25) {
              next.logs.unshift({
                id: `pool_warn_${Date.now()}`,
                day: next.gameTime.day,
                timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
                text: `[Cảnh báo] "${nodeName}" đang bị suy giảm nghiêm trọng (${Math.round(pool.currentStock)}/${pool.maxStock}). Tốc độ hồi phục bị giảm sâu!`,
                type: 'warning',
              });
            }
          }

          const rolledQuality = rollGatherQuality(survivor.skills.foraging || 1);
          const def = ITEMS_DATABASE[itemId];

          // Kiểm tra xem có yêu cầu chuyển thẳng vào kho bãi của POI không
          const targetAreaId = payload.targetAreaId as string | undefined;
          const targetAreaName = targetAreaId ? AREAS_DATABASE[targetAreaId]?.name || 'kho POI' : 'kho chung';
          const targetStorage = targetAreaId ? getOrCreatePoiStorage(next, targetAreaId) : next.inventory;

          let result = addItemToInventory(targetStorage, itemId, actualQty, rolledQuality);
          let storedInPoi = true;

          // Nếu kho POI bị đầy, thử rơi vào túi đồ party
          if (!result.success && targetAreaId) {
            result = addItemToInventory(next.inventory, itemId, actualQty, rolledQuality);
            storedInPoi = false;
          }

          if (result.success) {
            const qualityMeta = QUALITY_CONFIG[rolledQuality];
            const qualityLabel = rolledQuality !== 'standard' ? ` [${qualityMeta.nameVi}]` : '';
            const destinationLabel = storedInPoi && targetAreaId ? ` [Kho bãi ${targetAreaName}]` : ' [Túi hành trang]';
            next.logs.unshift({
              id: `gath_done_${Date.now()}`,
              day: next.gameTime.day,
              timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
              text: `${survivor.name} đã khai thác được ${actualQty}x ${def ? def.name : itemId}${qualityLabel} từ ${nodeName} ➔ nhập vào${destinationLabel}.`,
              type: rolledQuality === 'prime' || rolledQuality === 'masterwork' ? 'success' : 'info',
            });
            // Grant foraging skill progression
            survivor.skills.foraging = (survivor.skills.foraging || 1) + 0.05;

            // Áp dụng hao mòn công cụ thu gom nếu có rìu hoặc dao trong kho
            const availableTool = next.inventory.items.find(i => {
              const td = ITEMS_DATABASE[i.itemId];
              return td && td.toolProperties && (i.condition || 0) > 0;
            });
            if (availableTool) {
              const wear = calculateToolWear(availableTool, 'gathering', survivor, next);
              applyToolWear(next, availableTool.instanceId, wear.wearAmount, survivor);
            }
          } else {
            // Restore back to pool if inventory was full
            if (pool) {
              pool.currentStock = Math.min(pool.maxStock, pool.currentStock + actualQty);
            }
            next.logs.unshift({
              id: `gath_fail_${Date.now()}`,
              day: next.gameTime.day,
              timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
              text: `Kho bãi và túi đồ đều đã đầy! Không thể cất trữ ${actualQty}x ${def ? def.name : itemId}.`,
              type: 'warning',
            });
          }
        }

        // Finished Crafting
        if (actionType === 'crafting' && payload.recipeOutputs) {
          const outputs = payload.recipeOutputs as Array<{ itemId: string; quantity: number }>;
          const recipeName = (payload.recipeName as string) || 'Item';
          const ingredientQualities = (payload.ingredientQualities as ItemQuality[]) || [];
          
          // Phẩm chất thành phẩm phụ thuộc đa biến vào tay nghề, thể trạng thợ và chất lượng nguyên liệu
          const synth = synthesizeCraftedQuality(ingredientQualities, survivor);
          const craftQuality = synth.quality;

          for (const out of outputs) {
            addItemToInventory(next.inventory, out.itemId, out.quantity, craftQuality);
          }
          survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.08;
          const qMeta = QUALITY_CONFIG[craftQuality];
          const qualitySuffix = craftQuality !== 'standard' ? ` [${qMeta.nameVi}]` : '';

          // Hao mòn công cụ chế tác phụ trợ (dao/đá sắc) nếu có
          const knifeTool = next.inventory.items.find(i => {
            const td = ITEMS_DATABASE[i.itemId];
            return td && (td.tags.includes('knife') || td.tags.includes('sharp')) && (i.condition || 0) > 0;
          });
          if (knifeTool) {
            const wear = calculateToolWear(knifeTool, 'crafting', survivor, next);
            applyToolWear(next, knifeTool.instanceId, wear.wearAmount, survivor);
          }

          next.logs.unshift({
            id: `craft_done_${Date.now()}`,
            day: next.gameTime.day,
            timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
            text: `${survivor.name} đã chế tác thành công: ${recipeName}${qualitySuffix}.`,
            type: craftQuality === 'masterwork' || craftQuality === 'prime' ? 'success' : 'info',
          });
        }

        // Finished Building
        if (actionType === 'building' && targetId) {
          const building = next.buildings.find(b => b.id === targetId);
          if (building) {
            building.isBuilt = true;
            building.buildProgressSeconds = building.totalBuildSeconds;
            const bDef = BUILDINGS_DATABASE[building.buildingId];
            if (bDef && bDef.maxCapacityIncrease) {
              const bAreaId = building.areaId || 'AREA_CAMP_CLEARING';
              const pStorage = getOrCreatePoiStorage(next, bAreaId);
              if (bDef.maxCapacityIncrease.weightKg) {
                pStorage.maxWeightKg += bDef.maxCapacityIncrease.weightKg;
              }
              if (bDef.maxCapacityIncrease.volumeL) {
                pStorage.maxVolumeL += bDef.maxCapacityIncrease.volumeL;
              }
              if (bAreaId === 'AREA_CAMP_CLEARING') {
                if (bDef.maxCapacityIncrease.weightKg) next.inventory.maxWeightKg += Math.round(bDef.maxCapacityIncrease.weightKg * 0.5);
                if (bDef.maxCapacityIncrease.volumeL) next.inventory.maxVolumeL += Math.round(bDef.maxCapacityIncrease.volumeL * 0.5);
              }
            }
            survivor.skills.building = (survivor.skills.building || 1) + 0.1;
            const bAreaName = building.areaId ? AREAS_DATABASE[building.areaId]?.name || 'khu vực' : 'căn cứ';
            next.logs.unshift({
              id: `bld_done_${Date.now()}`,
              day: next.gameTime.day,
              timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
              text: `${survivor.name} đã hoàn thành công trình ${bDef ? bDef.name : 'Công trình'} tại ${bAreaName}!`,
              type: 'success',
            });
          }
        }

        // Reset survivor to idle
        survivor.currentAction = {
          type: 'idle',
          description: 'Ready for new assignment',
          progressSeconds: 0,
          totalSeconds: 0,
        };
      }
    }
  }
}
