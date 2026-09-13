import React from 'react';
import {
  Binoculars,
  ChevronRight,
  CircleAlert,
  Cross,
  Eye,
  Footprints,
  Hand,
  Heart,
  Leaf,
  Map,
  MapPin,
  Beef,
  PackageOpen,
  Shield,
  Sparkles,
  Star,
  Sword,
  Target,
  Trees,
  Utensils,
} from 'lucide-react';
import type { GameState } from '../../types';
import type { EncounterActionView, EncounterInstance, EncounterRisk } from '../../encounter/encounterTypes';
import { getEncounterActions, isEncounterSafe } from '../../encounter/encounterEngine';

interface EncounterScreenProps {
  encounter: EncounterInstance;
  state: GameState;
  onChooseAction: (actionId: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const STORY_FONT = '"Baskerville", "Palatino Linotype", "Book Antiqua", Georgia, serif';

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(10,39,35,.97), rgba(7,28,26,.98))',
  border: '2px solid #795536',
  boxShadow: 'inset 0 0 0 1px rgba(218,169,98,.22), 0 8px 20px rgba(0,0,0,.55)',
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
  const className = 'w-7 h-7';
  switch (action.icon) {
    case 'observe': return <Binoculars className={className} />;
    case 'calm': return <Hand className={className} />;
    case 'back_away': return <Footprints className={className} />;
    case 'defend': return <Sword className={className} />;
    case 'food': return <Beef className={className} />;
    case 'leave': return <Map className={className} />;
    default: return <Target className={className} />;
  }
};

const OutcomeIcon: React.FC<{ icon: string }> = ({ icon }) => {
  const className = 'w-4 h-4 shrink-0';
  switch (icon) {
    case 'meat': return <Beef className={`${className} text-[#e67958]`} />;
    case 'fiber': return <Leaf className={`${className} text-[#86c94d]`} />;
    case 'knowledge': return <Eye className={`${className} text-[#d6c49d]`} />;
    case 'route': return <Footprints className={`${className} text-[#cdbb8c]`} />;
    case 'location': return <MapPin className={`${className} text-[#e6d8ae]`} />;
    case 'injury': return <Cross className={`${className} text-[#ff665c]`} />;
    case 'food': return <Utensils className={`${className} text-[#e67958]`} />;
    case 'medical': return <Heart className={`${className} text-[#ff665c]`} />;
    case 'risk': return <CircleAlert className={`${className} text-[#e8d7b4]`} />;
    case 'xp': return <Star className={`${className} text-[#f7c64c]`} />;
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
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => onChooseAction(action.id)}
      title={action.disabledReason || `${action.title} • ${action.timeMinutes} min • ${action.noise.replace('_', ' ')} noise`}
      className={`group relative w-full min-h-[68px] rounded-md text-left transition-all ${
        action.disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:-translate-y-[1px] hover:brightness-110 active:translate-y-0 cursor-pointer'
      }`}
      style={{
        background: action.id === 'stay_calm'
          ? 'linear-gradient(90deg, rgba(33,104,58,.58), rgba(9,45,34,.82))'
          : 'linear-gradient(90deg, rgba(10,42,39,.92), rgba(7,31,29,.96))',
        border: action.id === 'stay_calm' ? '2px solid #4cc978' : '1px solid #9a6a40',
        boxShadow: action.id === 'stay_calm'
          ? 'inset 0 0 0 1px rgba(148,255,178,.18), 0 0 10px rgba(62,190,109,.18)'
          : 'inset 0 0 0 1px rgba(255,216,155,.06)',
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[58px] flex items-center justify-center border-r border-white/5 text-[#ead6b0]">
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
}

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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-[62px] h-[62px] rounded-sm bg-[#e2a65f]/95 border-2 border-[#57371e] flex items-center justify-center shadow-inner">
            <Footprints className="w-10 h-10 text-[#1b120c]" strokeWidth={2.6} />
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
          className="absolute left-[2.2%] right-[2.2%] bottom-[2.3%] min-h-[15%] px-6 py-4 rounded-md"
          style={{
            background: 'linear-gradient(180deg, rgba(4,17,15,.88), rgba(5,16,14,.94))',
            border: '1px solid rgba(181,139,84,.7)',
            boxShadow: 'inset 0 0 12px rgba(0,0,0,.55)',
            fontFamily: STORY_FONT,
          }}
        >
          {encounter.narrative.map((line, index) => (
            <div key={`${line}_${index}`} className="text-[14px] italic leading-[1.45] text-[#eee4d2]">{line}</div>
          ))}
        </div>

        {/* context chips */}
        <div className="absolute right-[2%] top-[2%] flex gap-1.5 text-[9px] uppercase tracking-[.07em]">
          <span className="px-2 py-1 rounded bg-black/55 border border-white/10 text-[#d9ccb3]">{Math.round(encounter.state.distance)} m</span>
          <span className="px-2 py-1 rounded bg-black/55 border border-white/10 text-[#d9ccb3]">Knowledge {Math.round(encounter.knowledge.total)}%</span>
        </div>
      </section>

      {/* Decision column */}
      <section className="absolute left-[65.5%] top-0 w-[34.5%] h-[82.2%] flex flex-col gap-[1.4%]">
        <div className="relative h-[65.5%] rounded-[5px] px-4 pt-3 pb-3 overflow-hidden" style={panelStyle}>
          <div className="flex items-center gap-3 h-[34px] border-b border-[#6f5136]/45 mb-2">
            <Trees className="w-7 h-7 text-[#ead5b0]" />
            <h2 className="font-black text-[20px] tracking-[0.075em] text-[#f0e5d1]">WHAT WILL YOU DO?</h2>
          </div>

          <div className="relative rounded-md bg-black/12 border border-white/5 px-3 py-2 pr-[112px] min-h-[58px] mb-2.5">
            <p className="text-[12px] leading-[1.45] text-[#e2d8c6]" style={{ fontFamily: STORY_FONT }}>{encounter.intro}</p>
            {observe && !safe && (
              <button
                type="button"
                onClick={() => onChooseAction(observe.id)}
                className="absolute right-2 top-2 bottom-2 w-[96px] rounded border border-[#786447] bg-[#182a24]/90 hover:bg-[#22382f] text-[#e8d8ba] text-[10px] font-bold flex flex-col items-center justify-center gap-1"
              >
                <Binoculars className="w-4 h-4" />
                <span>OBSERVE</span>
                <span className="text-[#7fcca0]">{observe.estimate}</span>
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
            <div className="h-[5px] rounded-full bg-black/45 overflow-hidden border border-white/5">
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
          <div className="flex items-center gap-2 h-[26px] text-[#ead9bb] border-b border-[#6f5136]/45 mb-2">
            <PackageOpen className="w-4 h-4" />
            <span className="font-black text-[12px] tracking-[0.06em] uppercase">Known Possible Outcomes</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 h-[calc(100%-34px)]">
            {encounter.outcomeGroups.map((group) => {
              const headColor = group.tone === 'success' ? '#58d780' : group.tone === 'danger' ? '#ef6858' : '#e7dfca';
              const borderColor = group.tone === 'success' ? '#4f7852' : group.tone === 'danger' ? '#7d3d35' : '#695b48';
              return (
                <div key={group.id} className="rounded overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: 'rgba(8,27,25,.72)' }}>
                  <div className="h-[24px] flex items-center justify-center font-bold text-[10px]" style={{ color: headColor, background: 'rgba(255,255,255,.035)' }}>{group.title}</div>
                  <div className="p-2 space-y-1.5">
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
        <div className="h-[27px] border-b border-[#6f5136]/45 flex items-center gap-2 text-[#efe3ce]">
          <Shield className="w-4 h-4" />
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
