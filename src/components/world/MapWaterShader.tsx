import React, { useEffect, useRef } from 'react';
import {
  normalizeMapShaderEnvironment,
  type MapShaderEnvironment,
} from './MapShaderEnvironment';
import {
  MAP_WATERFALL_IMPACTS,
  MAP_WATERFALLS,
  buildWaterfallFlowTexture,
} from './MapWaterfallFlow';

type Point = readonly [number, number];
type Stream = { points: readonly Point[]; width: number };
type PoolKind = 'lake' | 'ocean';

export const WATER_TUNING = {
  /** Overall water visibility. River intensity is controlled independently. */
  strength: 0.95,
  /** V4 river displacement is restrained; waterfalls use their own energy model. */
  riverStrength: 0.55,
  speed: 0.7,
  fps: 30,
  maxDpr: 1,
  maxCanvasSide: 1448,
};

// Width is percentage of source-image width. Point order is downstream direction.
export const MAP_STREAMS: readonly Stream[] = [
  {points:[[15,0],[19,3],[26,6],[30,11],[28,16]],width:3.3},
  {points:[[13,20],[20,23],[28,26],[35,30],[38,33],[42,37]],width:4.8},
  {points:[[57,20],[53,21],[51,24],[52,28],[49,32],[53,35],[55,39],[57,43],[56,46],[54,50],[50,54],[44,56],[39,59],[37,63],[34,65]],width:3.4},
  {points:[[29,43],[28,46],[30,49],[33,52],[35,55],[39,57]],width:3.5},
  {points:[[76,32],[75,35],[77,39],[81,42],[85,44],[86,48],[89,51]],width:2.7},
];

export const MAP_POOLS: readonly (readonly Point[])[] = [
  [[7,20],[10,17.5],[15,18],[20,17.5],[25,18.5],[30,21],[30,25],[26,28],[19,28],[13,26],[8,24]],
  [[7,0],[13,0],[18,1],[23,0],[34,0],[37,4],[34,9],[29,12],[22,10],[16,9],[10,7]],
  [[0,70],[7,70],[17,68],[25,67],[35,65],[37,70],[32,77],[40,83],[43,95],[39,100],[0,100]],
  [[64,100],[70,91],[76,85],[89,86],[94,74],[100,69],[100,100]],
  [[78,3.5],[89,3.5],[100,4],[100,13],[91,12],[87,8],[79,7]],
];

// Keeps whitecaps out of inland pools while retaining the existing public polygon format.
export const MAP_POOL_KINDS: readonly PoolKind[] = [
  'lake',
  'lake',
  'lake',
  'ocean',
  'ocean',
];

const VERTEX = `attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv=vec2(aPosition.x*.5+.5,.5-aPosition.y*.5);
  gl_Position=vec4(aPosition,0.,1.);
}`;

export const WATER_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform sampler2D uFallData;
uniform vec2 uViewSize;
uniform float uTime;
uniform float uStrength;
uniform float uRiverStrength;
uniform float uDayMinutes;
uniform float uRainIntensity;
uniform float uCloudCover;
uniform float uWindSpeed;
uniform float uWindDirection;
uniform float uDebug;
uniform vec4 uFallImpact0;
uniform vec4 uFallImpact1;
uniform vec4 uFallImpact2;
uniform vec3 uFallImpactSeeds;

float hash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  return noise(p)*.54+noise(p*2.03+9.7)*.29+noise(p*4.07-4.2)*.17;
}
float smootherStep(float edge0,float edge1,float value){
  float t=clamp((value-edge0)/max(edge1-edge0,.0001),0.,1.);
  return t*t*t*(t*(t*6.-15.)+10.);
}
vec4 lightingWeights(float minute){
  float dayGate=smootherStep(300.,435.,minute)*(1.-smootherStep(1035.,1190.,minute));
  float dawn=exp(-pow((minute-365.)/82.,2.));
  float dusk=exp(-pow((minute-1105.)/92.,2.));
  float twilight=max(dawn,dusk);
  float day=max(0.,dayGate*(1.-twilight*.72));
  float night=max(0.,(1.-dayGate)*(1.-twilight*.56));
  vec4 weights=vec4(night,dawn,day,dusk);
  return weights/max(dot(weights,vec4(1.)),.0001);
}

// Expanding soft rain ripple
float rainRing(vec2 p,float time,float rain,vec2 cellOffset){
  float cellSize=mix(58.,36.,rain);
  vec2 shifted=p+cellOffset*cellSize;
  vec2 cell=floor(shifted/cellSize);
  vec2 randomCenter=vec2(hash(cell+3.1),hash(cell+19.7));
  vec2 center=(cell+mix(vec2(.18),vec2(.82),randomCenter)-cellOffset)*cellSize;
  float age=fract(time*(.48+rain*.75)+hash(cell+7.4));
  float radius=age*cellSize*.45;
  float distanceToRing=abs(length(p-center)-radius);
  float ring=smoothstep(4.2,.6,distanceToRing);
  float life=smoothstep(.01,.18,age)*(1.-smoothstep(.60,1.,age));
  return ring*life*step(.32,hash(cell+31.));
}

// Organic waterfall plunge pool foam: boiling, turbulent aeration with downstream dispersing veins
// Eliminates unnatural expanding concentric sonar circles
float impactFoam(vec2 uv,vec4 impact,float time,float seed,vec2 flow){
  vec2 q=(uv-impact.xy)/max(impact.zw,vec2(.0001));
  
  // Plunge pool churn is naturally biased downstream (positive q.y)
  float dist=length(q*vec2(1.1,1.3-clamp(q.y,-.4,.5)*.7));
  if(dist>1.5)return 0.;
  
  // High-frequency boiling froth
  vec2 boilUv1=q*vec2(4.2,6.5)+vec2(seed*9.3,-time*1.65);
  vec2 boilUv2=q*vec2(8.5,12.0)-vec2(seed*17.1,time*2.2);
  float boil1=fbm(boilUv1);
  float boil2=fbm(boilUv2);
  float churnFroth=smoothstep(.36,.76,boil1*.62+boil2*.38);
  
  // Dissolving foam tendrils trailing downstream
  vec2 trailUv=q*vec2(5.5,10.5)-flow*time*1.2+vec2(seed*13.2,0.);
  float foamVeins=smoothstep(.40,.72,fbm(trailUv));
  
  // Immediate impact boil at the waterfall lip (where water crashes down)
  float lipBoil=exp(-abs(q.y)*6.2)*(1.-smoothstep(.15,1.05,abs(q.x)));
  lipBoil*=.55+.45*smoothstep(.32,.78,fbm(vec2(q.x*8.+seed*5.,time*.85)));
  
  // Organic gaussian-style dissipation
  float envelope=exp(-dist*dist*2.8);
  float totalFoam=(churnFroth*.65+foamVeins*.35+lipBoil*.42)*envelope;
  return clamp(totalFoam,0.,1.);
}

void main(){
  vec4 maskData=texture2D(uMask,vUv);
  vec4 fallData=texture2D(uFallData,vUv);
  float mask=maskData.a;
  if(mask<.005){gl_FragColor=vec4(0.);return;}

  vec2 view=max(uViewSize,vec2(1.));
  vec2 p=vUv*view;
  vec2 flow=maskData.rg*2.-1.;
  flow=flow/max(length(flow),.001);
  float fall=step(.012,fallData.a);
  float river=step(.25,maskData.b)*(1.-fall);
  float ocean=step(.10,maskData.b)*(1.-step(.25,maskData.b));
  float pool=1.-max(river,fall);
  float lake=max(0.,pool-ocean);

  float wind01=clamp(uWindSpeed/85.,0.,1.);
  float windRad=radians(uWindDirection);
  vec2 windDir=normalize(vec2(sin(windRad),-cos(windRad))+vec2(.0001));
  vec2 windCross=vec2(-windDir.y,windDir.x);
  vec2 crossFlow=vec2(-flow.y,flow.x);
  float along=dot(p,flow);
  float across=dot(p,crossFlow);

  // Center coordinate frame at island center to minimize rotational translation
  vec2 pCenter=p-view*.5;
  float windAlong=dot(pCenter,windDir);
  float windAcross=dot(pCenter,windCross);
  
  // Ocean: deep rolling swell waves + surface chop aligned with wind
  float oceanSwellPhase=windAlong*.028-uTime*1.45+sin(windAcross*.018)*1.35;
  float oceanChopPhase=windAcross*.048+uTime*1.20+sin(windAlong*.022)*1.10;
  vec2 oceanOffset=(windCross*sin(oceanSwellPhase)*2.2+windDir*cos(oceanChopPhase)*1.6)*mix(.9,2.1,wind01);
  
  // Lake: gentle intersecting ripples + breathing caustics
  float lakePhase1=windAlong*.042-uTime*1.15+sin(windAcross*.025)*1.05;
  float lakePhase2=windAcross*.055+uTime*1.05+sin(windAlong*.020)*.95;
  vec2 lakeOffset=(windCross*sin(lakePhase1)*1.5+windDir*cos(lakePhase2)*1.2)*mix(.85,1.7,wind01);
  vec2 poolOffset=mix(lakeOffset,oceanOffset,ocean);

  // River: Dual-phase continuous downstream advection
  // Eliminates oscillating/wobbling by advecting texture coordinates strictly downstream
  float flowSpeed=uTime*1.8;
  float advProgress1=fract(flowSpeed);
  float advProgress2=fract(flowSpeed+.5);
  float advWeight=abs(advProgress1*2.-1.); // Triangle crossfade between the 2 advection phases

  // Parabolic riverbed curvature: water flows faster in center than banks
  float bankDist=abs(across*.08);
  float channelSpeedCurve=clamp(1.4-bankDist*.35,.7,1.5);

  vec2 rUv1=vec2(across*.18,along*.06-advProgress1*1.8*channelSpeedCurve);
  vec2 rUv2=vec2(across*.18,along*.06-advProgress2*1.8*channelSpeedCurve);
  float rNoise1=noise(rUv1);
  float rNoise2=noise(rUv2);
  float fluidFlowNoise=mix(rNoise1,rNoise2,advWeight);

  // Lateral meandering wavelets that travel strictly downstream
  vec2 rWaveUv1=vec2(across*.32+3.7,along*.12-advProgress1*2.6*channelSpeedCurve);
  vec2 rWaveUv2=vec2(across*.32+3.7,along*.12-advProgress2*2.6*channelSpeedCurve);
  float rWaveNoise=mix(noise(rWaveUv1),noise(rWaveUv2),advWeight);

  // Broad, soft flow ribbons: a medium/large-scale directional cue that remains
  // transparent and organic instead of painting obvious streaks over the river.
  // Slower than the regular ripples so the surface reads as several velocity layers.
  float ribbonTime=uTime*.72;
  vec2 flowRibbonUv=vec2(across*.075,along*.030-ribbonTime);
  float ribbonNoise=fbm(flowRibbonUv)*.68+
    noise(vec2(across*.16+11.3,along*.055-uTime*1.05))*.32;
  float ribbonBreakup=fbm(vec2(across*.025-7.1,along*.018-uTime*.20));
  float flowRibbon=smoothstep(.50,.72,ribbonNoise+ribbonBreakup*.20);
  flowRibbon*=river;

  // River surface micro-undulation:
  // the river should not only translate downstream, it also needs a living surface that
  // continuously wrinkles, sways and reforms like shallow moving water.
  float riverSurfacePhase1=across*.58+sin(along*.09-uTime*1.10)*1.15-uTime*1.95;
  float riverSurfacePhase2=along*.16-uTime*2.35+sin(across*.21+uTime*.68)*.95;
  float riverSurfaceWave1=sin(riverSurfacePhase1);
  float riverSurfaceWave2=sin(riverSurfacePhase2);
  float riverSurfaceNoise=fbm(vec2(across*.24+4.8,along*.10-uTime*.92));
  float riverSurfaceEnvelope=(.45+.55*riverSurfaceNoise)*(1.-smoothstep(.82,1.55,bankDist));
  float riverSurfaceChop=smoothstep(.38,.86,
    riverSurfaceNoise*.42+
    (riverSurfaceWave1*.5+.5)*.34+
    (riverSurfaceWave2*.5+.5)*.24
  )*river*riverSurfaceEnvelope;

  // Strictly forward-propagating vector displacement.
  // The ribbon adds only a small cross-flow refraction so the image never looks rubbery.
  vec2 riverDisp=crossFlow*(rWaveNoise-.5)*1.8+flow*(fluidFlowNoise-.5)*1.8;
  riverDisp+=crossFlow*(flowRibbon-.35)*.55;

  // Add a softer local wobble layer so the river surface itself feels alive instead of static.
  vec2 riverSurfaceDisp=crossFlow*riverSurfaceWave1*.60+flow*riverSurfaceWave2*.28;
  riverSurfaceDisp+=crossFlow*(riverSurfaceNoise-.5)*.55;
  riverSurfaceDisp*=riverSurfaceEnvelope;

  vec2 riverOffset=(riverDisp+riverSurfaceDisp)*uRiverStrength*2.42;

  // Continuous downward waterfall cascade:
  // Monotonically increasing downward advection coordinate (y - v*t) guarantees downward flow with 0 phase reversal.
  float fallProgress=clamp(fallData.r,0.,1.);
  float fallCore=fallData.g;
  float fallSeed=fallData.b;
  
  float fallCoord=along*.075+fallProgress*3.2-uTime*7.2;
  float fallWhiteWater=0.;
  vec2 fallOffset=vec2(0.);
  if(fall>.5){
    float fallBroad=fbm(vec2(across*.08+fallSeed*17.,fallCoord*.28));
    float fallFine=fbm(vec2(across*.22-fallSeed*9.,fallCoord*.75));
    float fallBurst=fbm(vec2(across*.15+fallSeed*29.,along*.04-uTime*3.2));

    // Dense foaming water sheet accelerating and plunging DOWN
    float fallSheet=smoothstep(.22,.70,fallCore*(.65+fallBurst*.45));
    fallWhiteWater=smoothstep(.38,.72,fallBroad*.5+fallFine*.5)*fallSheet;

    // Gentle lateral wavering (no upstream tearing)
    fallOffset=crossFlow*(sin(fallCoord*.4+across*.08)*.55)*fallCore;
    fallOffset+=flow*(sin(fallCoord*.8)*.35)*fallCore;
  }

  vec2 offsetPx=(pool*poolOffset+river*riverOffset+fall*fallOffset)*uStrength*mask;
  vec2 uv=clamp(vUv+offsetPx/view,vec2(0.),vec2(1.));
  float safe=texture2D(uMask,uv).a;
  vec3 base=texture2D(uImage,vUv).rgb;
  vec3 warped=texture2D(uImage,uv).rgb;
  vec3 color=mix(base,warped,safe);

  // --- Organic Living Water Surface Optics ---
  // 1. Soft 2D Caustic Network on Lake & Ocean
  float caustics=fbm(pCenter*.032+vec2(uTime*.16,-uTime*.12));
  float causticShimmer=smoothstep(.32,.68,caustics)*pool*(.11+wind01*.09);

  // 2. Wind-driven specular shimmer across water facets (soft organic sheen)
  float windShimmer=smoothstep(.36,.80,sin(windAlong*.040-uTime*1.6+caustics*1.8)*.5+.5)*(lake*.09+ocean*.15)*(.6+wind01*.7);

  // 3. Ocean Rolling Swell & Gentle Whitecaps
  float oceanSwell=smoothstep(.45,.85,sin(oceanSwellPhase)*.5+.5)*ocean*.12;
  float stormNoise=noise(vec2(windAcross*.055,windAlong*.020-uTime*1.3));
  float whiteCap=smoothstep(.58,.92,sin(oceanSwellPhase*1.1+stormNoise*1.9)*.5+.5)*ocean*smoothstep(.30,1.,wind01)*.22;

  // 4. Waterfall Impact Foam (Organic Plunge Boil)
  float impact=max(
    impactFoam(vUv,uFallImpact0,uTime,uFallImpactSeeds.x,flow),
    max(
      impactFoam(vUv,uFallImpact1,uTime+2.7,uFallImpactSeeds.y,flow),
      impactFoam(vUv,uFallImpact2,uTime+5.1,uFallImpactSeeds.z,flow)
    )
  );

  // 5. Rain Ripples on water
  float rain=clamp(uRainIntensity,0.,1.);
  float rippleA=rainRing(p,uTime,rain,vec2(0.));
  float rippleB=rainRing(p,uTime+2.7,rain,vec2(.47,.63));
  float rainRipple=max(rippleA,rippleB)*rain*(pool+river*.35);

  // River: Natural traveling wave crests & ripples moving downstream
  // Fast downstream wavefronts (parabolic curved ripples) that give immediate directional velocity cue
  float waveFront1=sin((along*.08-advProgress1*3.6*channelSpeedCurve)+sin(across*.15)*1.8);
  float waveFront2=sin((along*.08-advProgress2*3.6*channelSpeedCurve)+sin(across*.15)*1.8);
  float waveCrest1=pow(waveFront1*.5+.5,2.4);
  float waveCrest2=pow(waveFront2*.5+.5,2.4);
  float travelingWaveCrests=mix(waveCrest1,waveCrest2,advWeight)*river*uRiverStrength;

  // Break the otherwise regular crest pattern into uneven natural fragments.
  // This makes the direction easier to perceive without turning the river into bright bands.
  float crestBreakup=.65+noise(vec2(across*.21+4.3,along*.065-uTime*.85))*.35;
  travelingWaveCrests*=crestBreakup;

  // Pinpoint micro-sparkles run faster than both ribbons and crests, creating
  // a third velocity layer that helps the eye lock onto downstream movement.
  float sparkleUv=noise(vec2(across*.55,along*.22-uTime*4.4));
  float microSparkles=smoothstep(.65,.92,sparkleUv)*travelingWaveCrests;

  // Extra soft sheen on the locally undulating surface so the river feels like water,
  // not just a scrolling distortion field.
  float riverSurfaceSheen=smoothstep(.44,.88,riverSurfaceChop)*river*uRiverStrength;

  // Water depth color enrichment
  vec3 deepWater=mix(color,color*vec3(.88,1.04,1.08)+vec3(0.,.015,.035),pool*.25);
  color=mix(color,deepWater,safe);

  // Shared V5 celestial timeline: water and land now cross every phase together.
  vec4 phaseWeights=lightingWeights(uDayMinutes);
  float night=phaseWeights.x;
  float dawn=phaseWeights.y;
  float day=phaseWeights.z;
  float dusk=phaseWeights.w;
  float cloud=clamp(uCloudCover,0.,1.);
  float sunIntensity=clamp(day+(dawn+dusk)*.52,0.,1.)*(1.-cloud*.78)*(1.-rain*.82);
  float moonIntensity=night*(1.-cloud*.72)*(1.-rain*.55);

  // Reuse the existing caustic field so celestial reflections stay organic
  // without paying for two additional FBM evaluations on every water pixel.
  float sunFacetField=caustics*.72+(sin(oceanSwellPhase)*.5+.5)*.28;
  float moonFacetField=caustics*.68+(cos(lakePhase2)*.5+.5)*.32;
  float sunFacets=smoothstep(.49,.80,sunFacetField);
  float moonFacets=smoothstep(.52,.83,moonFacetField);

  // Keep management-map readability at night; celestial light changes mood, not visibility.
  float surfaceVisibility=mix(.72,1.,clamp(sunIntensity+(dawn+dusk)*.28,0.,1.));
  float surfaceLight=(causticShimmer+windShimmer+oceanSwell+whiteCap)*uStrength*surfaceVisibility;
  surfaceLight+=rainRipple*.12;

  float sunReflection=(sunFacets*(lake*.034+ocean*.072)+fallWhiteWater*.045*fall)*sunIntensity;
  float moonReflection=(moonFacets*(lake*.026+ocean*.061)+impact*.045+fallWhiteWater*.064*fall)*moonIntensity;

  // Pure Optical River Surface:
  // Zero color bands or paint streaks. 100% natural transparent refraction of the hand-painted riverbed.
  // Subtle light glints and delicate highlights on traveling wave crests:
  vec3 riverGlintColor=mix(vec3(.78,.92,1.),vec3(1.,.98,.90),sunIntensity);
  color+=riverGlintColor*(
    microSparkles*.40+
    travelingWaveCrests*.30+
    flowRibbon*.075*uRiverStrength+
    riverSurfaceSheen*.16
  )*uStrength*surfaceVisibility;

  // Aerated white water cascades down the fall
  color=mix(color,vec3(.88,.95,.98),fall*fallWhiteWater*.50*uStrength);
  
  // Natural aerated plunge foam blending (cyan-tinted froth highlights in the plunge pool)
  vec3 foamHighlight=vec3(.92,.97,1.);
  color=mix(color,foamHighlight,impact*.55*uStrength);
  
  color=clamp(color+vec3(.65,.88,1.)*surfaceLight,0.,1.);
  color=clamp(color+vec3(1.,.82,.52)*sunReflection*uStrength,0.,1.);
  color=clamp(color+vec3(.50,.70,.95)*moonReflection*uStrength,0.,1.);
  color*=1.-rain*.04;

  // Seamless blend back into original hand-painted map art (river blends an extra 10% into base)
  float baseBlend=mix(.10,.20,river);
  color=mix(color,base,baseBlend);

  if(uDebug>.5){
    vec3 typeColor=vec3(.12,.72,.97);
    typeColor=mix(typeColor,vec3(.18,.91,.72),ocean);
    typeColor=mix(typeColor,vec3(.79,.35,.95),river);
    typeColor=mix(typeColor,vec3(1.,.28,.07),fall);
    typeColor=mix(typeColor,vec3(fallProgress,fallCore,fallSeed),fall);
    gl_FragColor=vec4(typeColor,max(mask,fallData.a));
    return;
  }
  // River is ~10% more transparent (effective alpha 0.80 instead of 0.90) so underlying riverbed details shine through
  float effectiveMask=mask*mix(.90,.80,river);
  gl_FragColor=vec4(color,effectiveMask);
}`;

// RG = flow direction, B = water kind, A = color-gated coverage.
function buildMask(img: HTMLImageElement): HTMLCanvasElement {
  const scale=Math.min(1,1024/img.naturalWidth);
  const w=Math.max(1,Math.round(img.naturalWidth*scale));
  const h=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=w;
  canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('2D canvas unavailable while building water mask');

  ctx.drawImage(img,0,0,w,h);
  const source=ctx.getImageData(0,0,w,h).data;
  ctx.clearRect(0,0,w,h);

  MAP_POOLS.forEach((poly,index)=>{
    const kind=MAP_POOL_KINDS[index]??'lake';
    const blue=kind==='ocean'?48:0;
    ctx.fillStyle=`rgb(160,220,${blue})`;
    ctx.beginPath();
    poly.forEach(([x,y],pointIndex)=>{
      if(pointIndex)ctx.lineTo(x*w/100,y*h/100);
      else ctx.moveTo(x*w/100,y*h/100);
    });
    ctx.closePath();
    ctx.fill();
  });

  ctx.lineCap='round';
  ctx.lineJoin='round';
  for(const stream of MAP_STREAMS){
    for(let index=1;index<stream.points.length;index++){
      const start=stream.points[index-1];
      const end=stream.points[index];
      const dx=(end[0]-start[0])*w;
      const dy=(end[1]-start[1])*h;
      const length=Math.hypot(dx,dy)||1;
      ctx.strokeStyle=`rgb(${Math.round(127.5+127.5*dx/length)},${Math.round(127.5+127.5*dy/length)},128)`;
      ctx.lineWidth=stream.width*w/100;
      ctx.beginPath();
      ctx.moveTo(start[0]*w/100,start[1]*h/100);
      ctx.lineTo(end[0]*w/100,end[1]*h/100);
      ctx.stroke();
    }
  }

  for(const waterfall of MAP_WATERFALLS){
    for(let index=1;index<waterfall.points.length;index++){
      const start=waterfall.points[index-1];
      const end=waterfall.points[index];
      const progress=(index-.5)/(waterfall.points.length-1);
      const width=waterfall.widthTop+(waterfall.widthBottom-waterfall.widthTop)*progress;
      const dx=(end[0]-start[0])*w;
      const dy=(end[1]-start[1])*h;
      const length=Math.hypot(dx,dy)||1;
      ctx.strokeStyle=`rgb(${Math.round(127.5+127.5*dx/length)},${Math.round(127.5+127.5*dy/length)},255)`;
      ctx.lineWidth=width*w/100;
      ctx.beginPath();
      ctx.moveTo(start[0]*w/100,start[1]*h/100);
      ctx.lineTo(end[0]*w/100,end[1]*h/100);
      ctx.stroke();
    }
  }

  const imageData=ctx.getImageData(0,0,w,h);
  const data=imageData.data;
  const smooth=(a:number,b:number,value:number)=>{
    const normalized=Math.max(0,Math.min(1,(value-a)/(b-a)));
    return normalized*normalized*(3-2*normalized);
  };
  for(let index=0;index<data.length;index+=4){
    if(!data[index+3])continue;
    const red=source[index]/255;
    const green=source[index+1]/255;
    const blue=source[index+2]/255;
    const cyan=smooth(.025,.12,Math.min(green-red,blue-red))*smooth(.14,.30,green);
    const neutral=smooth(.42,.77,Math.min(red,green,blue))*(1-smooth(.12,.28,Math.max(red,green,blue)-Math.min(red,green,blue)));
    const isFall=data[index+2]>200;
    const coverage=isFall?Math.max(cyan,neutral):cyan;
    data[index+3]=Math.round(data[index+3]*coverage);
  }
  ctx.putImageData(imageData,0,0);

  const labels=[
    [14.6,16.3,8.8,2.7],[39,16.6,8,2.7],[60,11.2,7,2.8],[84.5,10,7.3,2.8],
    [61,25.9,8.4,2.8],[87.5,33.3,9,2.8],[66.5,35.8,7,2.8],[41,42.4,7,2.8],
    [9,35.5,5.7,2.8],[12,49,8.8,2.8],[61,48.5,10,2.9],[90.7,57.4,8,2.9],
    [72,59,9,2.9],[4,63.4,8.5,2.9],[51.7,63.5,8.8,2.9],[35,78.5,9,2.9],
    [74.5,76.5,9,2.9],[11.5,88.4,8.5,2.9],
  ];
  for(const [x,y,labelWidth,labelHeight] of labels){
    ctx.clearRect(x*w/100,y*h/100,labelWidth*w/100,labelHeight*h/100);
  }
  return canvas;
}

export interface MapWaterShaderProps {
  src: string;
  enabled?: boolean;
  strength?: number;
  riverStrength?: number;
  speed?: number;
  environment?: Partial<MapShaderEnvironment>;
  debugMask?: boolean;
  respectReducedMotion?: boolean;
}

export function MapWaterShader({
  src,
  enabled=true,
  strength=WATER_TUNING.strength,
  riverStrength=WATER_TUNING.riverStrength,
  speed=WATER_TUNING.speed,
  environment,
  debugMask=false,
  respectReducedMotion=false,
}:MapWaterShaderProps){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const paramsRef=useRef({strength,riverStrength,speed,environment,debugMask,respectReducedMotion});
  paramsRef.current={strength,riverStrength,speed,environment,debugMask,respectReducedMotion};

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||!enabled)return;

    let disposed=false;
    let animationFrame=0;
    let ready=false;
    let lastFrame=0;
    let elapsed=0;
    let gl:WebGLRenderingContext|null=null;
    const shaders:WebGLShader[]=[];
    const textures:WebGLTexture[]=[];
    let program:WebGLProgram|null=null;
    let buffer:WebGLBuffer|null=null;
    let resizeObserver:ResizeObserver|null=null;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const image=new Image();
    image.crossOrigin='anonymous';

    const pausesForMotion=()=>paramsRef.current.respectReducedMotion&&motion.matches;
    const stop=()=>{cancelAnimationFrame(animationFrame);animationFrame=0;lastFrame=0;};
    const fail=(error:unknown)=>{
      ready=false;
      stop();
      canvas.style.visibility='hidden';
      console.warn('[MapWaterShader] Static map fallback:',error);
    };
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      const scale=Math.min(
        window.devicePixelRatio||1,
        WATER_TUNING.maxDpr,
        WATER_TUNING.maxCanvasSide/Math.max(rect.width,rect.height,1),
      );
      const width=Math.max(1,Math.round(rect.width*scale));
      const height=Math.max(1,Math.round(rect.height*scale));
      if(Math.abs(canvas.width-width)>2||Math.abs(canvas.height-height)>2){
        canvas.width=width;
        canvas.height=height;
      }
      gl?.viewport(0,0,canvas.width,canvas.height);
      if(gl&&program){
        gl.uniform2f(gl.getUniformLocation(program,'uViewSize'),Math.max(1,rect.width),Math.max(1,rect.height));
      }
    };

    let smoothWindDir = -1;
    let smoothWindSpeed = 8;
    let smoothRain = 0;
    let smoothCloud = .1;
    let smoothDayMinutes = 510;

    let draw=(_wDir:number,_wSpd:number,_rain:number,_cloud:number,_day:number)=>{};
    const tick=(now:number)=>{
      animationFrame=0;
      if(disposed||!ready||document.hidden||pausesForMotion())return;
      const frameInterval=1000/Math.max(1,WATER_TUNING.fps);
      if(!lastFrame)lastFrame=now-frameInterval;
      const elapsedSinceFrame=now-lastFrame;
      if(elapsedSinceFrame+.5<frameInterval){
        animationFrame=requestAnimationFrame(tick);
        return;
      }
      const remainder=elapsedSinceFrame%frameInterval;
      const delta=Math.min(elapsedSinceFrame-remainder,100);
      lastFrame=now-remainder;
      const dt=delta*.001;
      elapsed+=dt*Math.max(0,paramsRef.current.speed);

      const env=normalizeMapShaderEnvironment(paramsRef.current.environment);
      if(smoothWindDir<0){
        smoothWindDir=env.windDirectionDeg;
        smoothWindSpeed=env.windSpeedKmh;
        smoothRain=env.rainIntensity;
        smoothCloud=env.cloudCover;
        smoothDayMinutes=env.timeOfDayMinutes;
      }else{
        const lerpFactor=Math.min(1,dt*3.5);
        const lightLerpFactor=Math.min(1,dt*1.25);
        let diff=(env.windDirectionDeg-smoothWindDir)%360;
        if(diff>180)diff-=360;
        if(diff<-180)diff+=360;
        smoothWindDir=(smoothWindDir+diff*lerpFactor+360)%360;
        smoothWindSpeed+=(env.windSpeedKmh-smoothWindSpeed)*lerpFactor;
        smoothRain+=(env.rainIntensity-smoothRain)*lerpFactor;
        smoothCloud+=(env.cloudCover-smoothCloud)*lerpFactor;
        let minuteDiff=env.timeOfDayMinutes-smoothDayMinutes;
        if(minuteDiff>720)minuteDiff-=1440;
        if(minuteDiff<-720)minuteDiff+=1440;
        smoothDayMinutes=(smoothDayMinutes+minuteDiff*lightLerpFactor+1440)%1440;
      }

      draw(smoothWindDir,smoothWindSpeed,smoothRain,smoothCloud,smoothDayMinutes);
      animationFrame=requestAnimationFrame(tick);
    };
    const resume=()=>{
      stop();
      if(!ready||disposed)return;
      draw(smoothWindDir>=0?smoothWindDir:45,smoothWindSpeed,smoothRain,smoothCloud,smoothDayMinutes);
      lastFrame=performance.now();
      if(!document.hidden&&!pausesForMotion())animationFrame=requestAnimationFrame(tick);
    };
    const onResize=()=>{
      resize();
      if(ready)draw(smoothWindDir>=0?smoothWindDir:45,smoothWindSpeed,smoothRain,smoothCloud,smoothDayMinutes);
    };
    if(typeof ResizeObserver!=='undefined'){
      resizeObserver=new ResizeObserver(onResize);
      resizeObserver.observe(canvas);
    }else{
      window.addEventListener('resize',onResize);
    }
    document.addEventListener('visibilitychange',resume);
    motion.addEventListener?.('change',resume);
    const onContextLost=(event:Event)=>{event.preventDefault();fail('WebGL context lost');};
    canvas.addEventListener('webglcontextlost',onContextLost);

    image.onload=()=>{
      if(disposed)return;
      try{
        gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false});
        if(!gl)throw new Error('WebGL unavailable');
        const context=gl;
        const compile=(kind:number,source:string)=>{
          const shader=context.createShader(kind);
          if(!shader)throw new Error('Shader allocation failed');
          shaders.push(shader);
          context.shaderSource(shader,source);
          context.compileShader(shader);
          if(!context.getShaderParameter(shader,context.COMPILE_STATUS)){
            throw new Error(context.getShaderInfoLog(shader)||'Shader compile failed');
          }
          return shader;
        };
        program=context.createProgram();
        if(!program)throw new Error('Program allocation failed');
        context.attachShader(program,compile(context.VERTEX_SHADER,VERTEX));
        context.attachShader(program,compile(context.FRAGMENT_SHADER,WATER_FRAGMENT_SHADER));
        context.linkProgram(program);
        if(!context.getProgramParameter(program,context.LINK_STATUS)){
          throw new Error(context.getProgramInfoLog(program)||'Program link failed');
        }
        context.useProgram(program);
        buffer=context.createBuffer();
        context.bindBuffer(context.ARRAY_BUFFER,buffer);
        context.bufferData(context.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),context.STATIC_DRAW);
        const position=context.getAttribLocation(program,'aPosition');
        context.enableVertexAttribArray(position);
        context.vertexAttribPointer(position,2,context.FLOAT,false,0,0);

        const uploadTexture=(source:TexImageSource,unit:number,name:string)=>{
          const texture=context.createTexture();
          if(!texture)throw new Error('Texture allocation failed');
          textures.push(texture);
          context.activeTexture(context.TEXTURE0+unit);
          context.bindTexture(context.TEXTURE_2D,texture);
          context.texParameteri(context.TEXTURE_2D,context.TEXTURE_MIN_FILTER,context.LINEAR);
          context.texParameteri(context.TEXTURE_2D,context.TEXTURE_MAG_FILTER,context.LINEAR);
          context.texParameteri(context.TEXTURE_2D,context.TEXTURE_WRAP_S,context.CLAMP_TO_EDGE);
          context.texParameteri(context.TEXTURE_2D,context.TEXTURE_WRAP_T,context.CLAMP_TO_EDGE);
          context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL,0);
          context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL,0);
          context.texImage2D(context.TEXTURE_2D,0,context.RGBA,context.RGBA,context.UNSIGNED_BYTE,source);
          context.uniform1i(context.getUniformLocation(program!,name),unit);
        };
        if(Math.max(image.naturalWidth,image.naturalHeight)>context.getParameter(context.MAX_TEXTURE_SIZE)){
          throw new Error('Map exceeds GPU texture limit');
        }
        uploadTexture(image,0,'uImage');
        uploadTexture(buildMask(image),1,'uMask');
        uploadTexture(buildWaterfallFlowTexture(image),2,'uFallData');

        const locations={
          time:context.getUniformLocation(program,'uTime'),
          strength:context.getUniformLocation(program,'uStrength'),
          riverStrength:context.getUniformLocation(program,'uRiverStrength'),
          dayMinutes:context.getUniformLocation(program,'uDayMinutes'),
          rain:context.getUniformLocation(program,'uRainIntensity'),
          cloud:context.getUniformLocation(program,'uCloudCover'),
          windSpeed:context.getUniformLocation(program,'uWindSpeed'),
          windDirection:context.getUniformLocation(program,'uWindDirection'),
          debug:context.getUniformLocation(program,'uDebug'),
          fallImpact0:context.getUniformLocation(program,'uFallImpact0'),
          fallImpact1:context.getUniformLocation(program,'uFallImpact1'),
          fallImpact2:context.getUniformLocation(program,'uFallImpact2'),
          fallImpactSeeds:context.getUniformLocation(program,'uFallImpactSeeds'),
        };
        const setImpact=(location:WebGLUniformLocation|null,index:number)=>{
          const impact=MAP_WATERFALL_IMPACTS[index];
          context.uniform4f(
            location,
            impact.center[0]/100,
            impact.center[1]/100,
            impact.radius[0]/100,
            impact.radius[1]/100,
          );
        };
        setImpact(locations.fallImpact0,0);
        setImpact(locations.fallImpact1,1);
        setImpact(locations.fallImpact2,2);
        context.uniform3f(
          locations.fallImpactSeeds,
          MAP_WATERFALL_IMPACTS[0].seed,
          MAP_WATERFALL_IMPACTS[1].seed,
          MAP_WATERFALL_IMPACTS[2].seed,
        );
        draw=(windDir:number,windSpd:number,rain:number,cloud:number,dayMin:number)=>{
          const current=paramsRef.current;
          context.uniform1f(locations.time,elapsed);
          context.uniform1f(locations.strength,Math.max(0,Math.min(2,current.strength)));
          context.uniform1f(locations.riverStrength,Math.max(0,Math.min(1.5,current.riverStrength)));
          context.uniform1f(locations.dayMinutes,dayMin);
          context.uniform1f(locations.rain,rain);
          context.uniform1f(locations.cloud,cloud);
          context.uniform1f(locations.windSpeed,windSpd);
          context.uniform1f(locations.windDirection,windDir);
          context.uniform1f(locations.debug,current.debugMask?1:0);
          context.drawArrays(context.TRIANGLES,0,6);
        };
        resize();
        ready=true;
        canvas.style.visibility='visible';
        resume();
      }catch(error){fail(error);}
    };
    image.onerror=()=>fail('Image unavailable or CORS denied');
    canvas.style.visibility='hidden';
    image.src=src;

    return()=>{
      disposed=true;
      stop();
      resizeObserver?.disconnect();
      window.removeEventListener('resize',onResize);
      document.removeEventListener('visibilitychange',resume);
      motion.removeEventListener?.('change',resume);
      canvas.removeEventListener('webglcontextlost',onContextLost);
      image.onload=null;
      image.onerror=null;
      if(gl){
        textures.forEach(texture=>gl!.deleteTexture(texture));
        shaders.forEach(shader=>gl!.deleteShader(shader));
        if(buffer)gl.deleteBuffer(buffer);
        if(program)gl.deleteProgram(program);
      }
    };
  },[src,enabled]);

  return enabled?(
    <canvas
      ref={canvasRef}
      data-map-effect="water-v5.1"
      aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:2,width:'100%',height:'100%',pointerEvents:'none',filter:'contrast(1.03) brightness(0.95)'}}
    />
  ):null;
}
