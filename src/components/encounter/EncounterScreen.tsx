import React from 'react';
import { CornerBrackets } from '../common/CornerBrackets';
import {
  ChevronRight,
  CircleAlert,
  Eye,
  Heart,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { GameState } from '../../types';
import type { EncounterActionView, EncounterInstance, EncounterRisk } from '../../encounter/encounterTypes';
import { getEncounterActions, isEncounterSafe } from '../../encounter/encounterEngine';
import { ItemIcon } from '../common/ItemIcon';
import {
  FootprintsAssetIcon,
  ObserveAssetIcon,
  CalmAssetIcon,
  BackAwayAssetIcon,
  DefendAssetIcon,
  LeaveMapAssetIcon,
  WildernessTreesAssetIcon,
  RewardChestAssetIcon,
  TacticalShieldAssetIcon,
  KnowledgeAssetIcon,
  InjuryAssetIcon,
  ExperienceAssetIcon,
} from './encounterUiAssets';

interface EncounterScreenProps {
  encounter: EncounterInstance;
  state: GameState;
  onChooseAction: (actionId: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const STORY_FONT = '"Baskerville", "Palatino Linotype", "Book Antiqua", Georgia, serif';

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(12,36,31,.97), rgba(7,24,21,.98))',
  border: '2px solid rgba(122, 88, 54, .82)',
  borderRadius: '8px 6px 9px 7px / 7px 9px 6px 8px',
  boxShadow: 'inset 0 1px 0 rgba(238,206,148,.18), inset 1px 0 0 rgba(195,160,105,.08), inset 0 -3px 0 rgba(0,0,0,.60), inset 0 -6px 14px rgba(0,0,0,.45), 0 6px 20px rgba(0,0,0,.60)',
};

const riskColor: Record<EncounterRisk, string> = {
  low: '#62e79c',
  medium: '#f3bf4e',
  high: '#ff6b54',
  extreme: '#ff3c3c',
};

const riskLabel: Record<EncounterRisk, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  extreme: 'Extreme Risk',
};

const ActionIcon: React.FC<{ action: EncounterActionView }> = ({ action }) => {
  const className = 'w-7 h-7 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';
  switch (action.icon) {
    case 'observe': return <ObserveAssetIcon className={className} />;
    case 'calm': return <CalmAssetIcon className={className} />;
    case 'back_away': return <BackAwayAssetIcon className={className} />;
    case 'defend': return <DefendAssetIcon className={className} />;
    case 'food':
      // Dùng ItemIcon ảnh thật nếu là đồ ăn / vật phẩm
      return (
        <div className="w-7 h-7 flex items-center justify-center">
          <ItemIcon itemId="animal_fat" size={28} className="drop-shadow-md" />
        </div>
      );
    case 'leave': return <LeaveMapAssetIcon className={className} />;
    default: return <ObserveAssetIcon className={className} />;
  }
};

const OutcomeIcon: React.FC<{ icon: string }> = ({ icon }) => {
  const className = 'w-4 h-4 shrink-0';
  switch (icon) {
    // 1. Các kết quả là VẬT PHẨM: giữ nguyên dùng ItemIcon ảnh asset
    case 'meat':
      return (
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <ItemIcon itemId="animal_fat" size={16} />
        </div>
      );
    case 'fiber':
      return (
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <ItemIcon itemId="bark_fiber" size={16} />
        </div>
      );
    case 'food':
      return (
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          <ItemIcon itemId="animal_fat" size={16} />
        </div>
      );

    // 2. Các icon phi vật phẩm: dùng asset icon rustic
    case 'knowledge': return <KnowledgeAssetIcon className={className} />;
    case 'route': return <BackAwayAssetIcon className={className} />;
    case 'location': return <MapPin className={`${className} text-[#e6d8ae]`} />;
    case 'injury': return <InjuryAssetIcon className={className} />;
    case 'medical': return <Heart className={`${className} text-[#ff665c]`} />;
    case 'risk': return <CircleAlert className={`${className} text-[#e8d7b4]`} />;
    case 'xp': return <ExperienceAssetIcon className={className} />;
    default: return <Sparkles className={className} />;
  }
};

const ChanceText: React.FC<{ action: EncounterActionView }> = ({ action }) => {
  const color = action.chance >= 70 ? '#77efa8' : action.chance >= 50 ? '#d7dc62' : action.chance >= 35 ? '#f3bf4e' : '#ff755e';
  return (
    <div className="text-right leading-none min-w-[74px]">
      <div className="text-[18px] font-black tabular-nums" style={{ color }}>{action.estimate}</div>
      <div className="text-[10px] font-bold mt-1" style={{ color: riskColor[action.risk] }}>{riskLabel[action.risk]}</div>
    </div>
  );
};

interface ActionCardProps {
  action: EncounterActionView;
  onChooseAction: (id: string) => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ action, onChooseAction }) => {
  const isStayCalm = action.id === 'stay_calm';
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => onChooseAction(action.id)}
      title={action.disabledReason || `${action.title} • ${action.timeMinutes} min • ${action.noise.replace('_', ' ')} noise`}
      className={`group relative w-full min-h-[68px] text-left transition-all ${
        action.disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:-translate-y-[1px] hover:brightness-105 active:translate-y-[1px] cursor-pointer'
      }`}
      style={{
        borderRadius: '7px 5px 8px 6px / 6px 8px 5px 7px',
        background: isStayCalm
          ? 'linear-gradient(90deg, rgba(38,98,62,.72), rgba(16,52,40,.92) 80%)'
          : 'linear-gradient(90deg, rgba(24,39,32,.95), rgba(12,25,21,.98) 80%)',
        border: isStayCalm ? '2px solid #52bc7a' : '2px solid #6b4d31',
        boxShadow: isStayCalm
          ? 'inset 0 1px 0 rgba(210,255,225,.25), inset 0 -3px 0 rgba(0,0,0,.55), inset 0 -5px 10px rgba(0,0,0,.35), 0 3px 8px rgba(0,0,0,.45), 0 0 12px rgba(82,188,122,.15)'
          : 'inset 0 1px 0 rgba(245,220,170,.14), inset 0 -3px 0 rgba(0,0,0,.55), inset 0 -5px 10px rgba(0,0,0,.35), 0 3px 8px rgba(0,0,0,.40)',
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[58px] flex items-center justify-center text-[#ead6b0]"
        style={{
          background: 'rgba(0, 0, 0, 0.24)',
          borderRight: '1.5px solid rgba(120, 88, 56, 0.40)',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.03)',
        }}
      >
        <ActionIcon action={action} />
      </div>
      <div className="pl-[72px] pr-[118px] py-[10px]">
        <div className="font-black text-[17px] leading-tight text-[#f0e5d2] tracking-[0.01em]">{action.title}</div>
        <div className="text-[11px] mt-1 text-[#c7bba5] leading-tight">{action.description}</div>
        <div className="text-[9px] mt-1.5 text-[#8fa99b] uppercase tracking-[0.08em]">
          ~{action.timeMinutes} min · {action.noise.replace('_', ' ')} noise
        </div>
      </div>
      <div className="absolute right-[36px] top-1/2 -translate-y-1/2">
        <ChanceText action={action} />
      </div>
      <ChevronRight className="absolute right-[10px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#e8c99c] group-hover:translate-x-[2px] transition-transform" />
    </button>
  );
};

export const EncounterScreen: React.FC<EncounterScreenProps> = ({ encounter, state, onChooseAction }) => {
  const actions = getEncounterActions(encounter, state);
  const mainActions = actions.filter((action) => action.id !== 'observe');
  const observe = actions.find((action) => action.id === 'observe');
  const safe = isEncounterSafe(encounter);
  const escalation = Math.round(encounter.state.escalation);

  return (
    <div className="absolute left-[0.8%] top-[10.7%] right-[14.5%] bottom-[1.1%] z-20" style={{ fontFamily: UI_FONT }}>
      {/* Main visual */}
      <section
        className="absolute left-0 top-0 w-[64.5%] h-[82.2%] overflow-hidden rounded-[5px]"
        style={panelStyle}
      >
        <CornerBrackets style="bronze" size={24} inset={3} />
        <img
          src={encounter.sceneImageUrl}
          alt={encounter.sceneAlt}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.13),rgba(0,0,0,.02)_52%,rgba(0,0,0,.18)),linear-gradient(0deg,rgba(1,11,8,.46),transparent_38%)]" />

        {/* encounter wood title */}
        <div
          className="absolute left-[2.3%] top-[2.2%] min-w-[45%] h-[14.2%] flex items-center pl-[88px] pr-8 rounded-sm"
          style={{
            background: 'linear-gradient(180deg, rgba(91,52,27,.96), rgba(52,31,18,.97))',
            border: '2px solid #9c7042',
            boxShadow: '0 5px 14px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,226,165,.16)',
          }}
        >
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-[62px] h-[62px] rounded-sm bg-[#e2a65f]/95 border-2 border-[#57371e] flex items-center justify-center shadow-inner overflow-hidden">
            <FootprintsAssetIcon className="w-10 h-10 drop-shadow-md" />
          </div>
          <div>
            <div className="font-black text-[26px] tracking-[0.05em] text-[#f2d4ac] drop-shadow-[0_2px_2px_rgba(0,0,0,.9)]">{encounter.title}</div>
            <div className="text-[16px] mt-1 text-[#f0d8ba]" style={{ fontFamily: STORY_FONT }}>{encounter.subtitle}</div>
          </div>
        </div>

        {/* subtle animal presence overlay because current repo has no dedicated encounter art yet */}
        <div className="absolute right-[9%] top-[25%] w-[28%] h-[34%] rounded-full border border-amber-200/5 bg-black/5 shadow-[0_0_80px_rgba(0,0,0,.12)] pointer-events-none" />

        {/* narrative box */}
        <div
          className="absolute left-[2.2%] right-[2.2%] bottom-[2.3%] min-h-[15%] px-6 py-4"
          style={{
            borderRadius: '7px 5px 8px 6px / 6px 8px 5px 7px',
            background: 'linear-gradient(180deg, rgba(8,24,20,.94), rgba(4,16,13,.98))',
            border: '2px solid rgba(125, 92, 56, .78)',
            boxShadow: 'inset 0 1px 0 rgba(235,205,150,.16), inset 0 4px 10px rgba(0,0,0,.70), 0 3px 8px rgba(0,0,0,.50)',
            fontFamily: STORY_FONT,
          }}
        >
          {encounter.narrative.map((line, index) => (
            <div key={`${line}_${index}`} className="text-[14px] italic leading-[1.45] text-[#eee4d2]">{line}</div>
          ))}
        </div>

        {/* context chips */}
        <div className="absolute right-[2%] top-[2%] flex gap-1.5 text-[9px] uppercase tracking-[.07em]">
          <span className="px-2.5 py-1 rounded bg-[#091714]/85 border border-[#52412e] text-[#d9ccb3] shadow-[0_1px_3px_rgba(0,0,0,.45)]">{Math.round(encounter.state.distance)} m</span>
          <span className="px-2.5 py-1 rounded bg-[#091714]/85 border border-[#52412e] text-[#d9ccb3] shadow-[0_1px_3px_rgba(0,0,0,.45)]">Knowledge {Math.round(encounter.knowledge.total)}%</span>
        </div>
      </section>

      {/* Decision column */}
      <section className="absolute left-[65.5%] top-0 w-[34.5%] h-[82.2%] flex flex-col gap-[1.4%]">
        <div className="relative h-[65.5%] rounded-[5px] px-4 pt-3 pb-3 overflow-hidden" style={panelStyle}>
          <CornerBrackets style="bronze" size={20} inset={2} />
          <div className="flex items-center gap-3 h-[34px] border-b border-[#6f5136]/55 mb-2">
            <WildernessTreesAssetIcon className="w-7 h-7 drop-shadow-sm" />
            <h2 className="font-black text-[20px] tracking-[0.075em] text-[#f0e5d1]">WHAT WILL YOU DO?</h2>
          </div>

          <div
            className="relative rounded-md px-3 py-2 pr-[112px] min-h-[58px] mb-2.5"
            style={{
              background: 'rgba(5, 15, 12, 0.65)',
              border: '1.5px solid rgba(75, 58, 38, 0.70)',
              boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.65)',
            }}
          >
            <p className="text-[12px] leading-[1.45] text-[#e2d8c6]" style={{ fontFamily: STORY_FONT }}>{encounter.intro}</p>
            {observe && !safe && (
              <button
                type="button"
                onClick={() => onChooseAction(observe.id)}
                className="btn-organic-action absolute right-2 top-2 bottom-2 w-[96px] text-[#e8d8ba] text-[10px] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer"
                title="Observe creature behavior"
              >
                <ObserveAssetIcon className="w-4 h-4 drop-shadow-sm" />
                <span className="tracking-wider">OBSERVE</span>
                <span className="text-[#96f5ba] font-mono text-[9px]">{observe.estimate}</span>
              </button>
            )}
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 max-h-[calc(100%-132px)]">
            {mainActions.map((action) => (
              <ActionCard key={action.id} action={action} onChooseAction={onChooseAction} />
            ))}
          </div>

          <div className="absolute left-4 right-4 bottom-2.5">
            <div className="flex justify-between text-[8px] uppercase tracking-[.08em] text-[#8b9e94] mb-1">
              <span>Calm</span><span>Escalation {escalation}%</span><span>Danger</span>
            </div>
            <div className="h-[6px] rounded-full bg-black/60 overflow-hidden border border-[#52412e] shadow-inner">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${escalation}%`,
                  background: 'linear-gradient(90deg,#4cc978,#e5b548 65%,#e95843)',
                }}
              />
            </div>
          </div>
        </div>

        {/* outcomes */}
        <div className="relative flex-1 rounded-[5px] px-3 pt-2 pb-2 overflow-hidden" style={panelStyle}>
          <div className="flex items-center gap-2 h-[26px] text-[#ead9bb] border-b border-[#6f5136]/55 mb-2">
            <RewardChestAssetIcon className="w-4 h-4" />
            <span className="font-black text-[12px] tracking-[0.06em] uppercase">Known Possible Outcomes</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 h-[calc(100%-34px)]">
            {encounter.outcomeGroups.map((group) => {
              const headColor = group.tone === 'success' ? '#68e290' : group.tone === 'danger' ? '#ff7260' : '#e8dec9';
              const borderColor = group.tone === 'success' ? 'rgba(68,135,85,.75)' : group.tone === 'danger' ? 'rgba(145,60,50,.75)' : 'rgba(105,82,54,.75)';
              return (
                <div
                  key={group.id}
                  className="rounded overflow-hidden flex flex-col"
                  style={{
                    borderRadius: '6px 4px 6px 5px',
                    border: `1.5px solid ${borderColor}`,
                    background: 'rgba(7, 20, 17, 0.88)',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.60)',
                  }}
                >
                  <div
                    className="h-[24px] flex items-center justify-center font-bold text-[10px] tracking-wider uppercase"
                    style={{
                      color: headColor,
                      background: 'rgba(0,0,0,.35)',
                      borderBottom: `1px solid ${borderColor}`,
                    }}
                  >
                    {group.title}
                  </div>
                  <div className="p-2 space-y-1.5 flex-1">
                    {group.items.map((item, idx) => {
                      const visible = encounter.knowledge.total >= (item.revealAtKnowledge || 0);
                      return (
                        <div key={`${group.id}_${idx}`} className="flex items-start gap-1.5 text-[9px] leading-tight text-[#d7cfbe]">
                          {visible ? <OutcomeIcon icon={item.icon} /> : <Eye className="w-4 h-4 shrink-0 text-[#756d61]" />}
                          <span className={visible ? '' : 'text-[#746f68] italic'}>{visible ? item.label : 'Unknown consequence'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* bottom event log */}
      <section className="absolute left-0 bottom-0 w-full h-[16.4%] rounded-[5px] px-4 py-2 overflow-hidden" style={panelStyle}>
        <CornerBrackets style="bronze" size={18} inset={2} />
        <div className="h-[27px] border-b border-[#6f5136]/55 flex items-center gap-2 text-[#efe3ce]">
          <TacticalShieldAssetIcon className="w-4 h-4" />
          <span className="font-black text-[12px] tracking-[0.06em]">EVENT LOG</span>
          <div className="ml-auto flex items-center gap-3 text-[9px] text-[#82968c]">
            <span>AGG {Math.round(encounter.state.aggression)}</span>
            <span>FEAR {Math.round(encounter.state.fear)}</span>
            <span>PANIC {Math.round(encounter.state.partyPanic)}</span>
            <span>TURN {encounter.turn}</span>
          </div>
        </div>
        <div className="pt-1.5 space-y-0.5 overflow-y-auto h-[calc(100%-27px)]">
          {encounter.history.slice().reverse().slice(0, 6).reverse().map((entry) => {
            const tone = entry.tone === 'danger' ? '#ff735f' : entry.tone === 'warning' ? '#e4b84f' : entry.tone === 'success' ? '#79d99b' : '#d6d0c2';
            return (
              <div key={entry.id} className="grid grid-cols-[42px_1fr] gap-2 text-[10px] leading-[1.25]">
                <span className="text-[#a9a08f] tabular-nums">{entry.timeLabel}</span>
                <span style={{ color: tone }}>✦ {entry.text}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
