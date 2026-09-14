import React, { useEffect, useRef } from 'react';
import {
  MAIN_MAP_POOL_KINDS,
  MAIN_MAP_POOLS,
  MAIN_MAP_STREAMS,
  MAIN_MAP_WATERFALL_IMPACTS,
  MAIN_MAP_WATERFALLS,
} from './MainMapGeometry';
import { buildWaterfallFlowTexture } from './MapWaterfallFlow';
import {
  normalizeMapShaderEnvironment,
  type MapShaderEnvironment,
} from './MapShaderEnvironment';

export const MAIN_MAP_WATER_TUNING = {
  strength: 0.95,
  riverStrength: 0.58,
  speed: 0.72,
  fps: 30,
  maxDpr: 1,
  maxCanvasSide: 1448,
} as const;

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv=vec2(aPosition.x*.5+.5,.5-aPosition.y*.5);
  gl_Position=vec4(aPosition,0.,1.);
}`;

const FRAGMENT = `
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
uniform float uWindSpeed;
uniform float uWindDirection;
uniform float uCloudCover;
uniform vec4 uFallImpact0;
uniform vec4 uFallImpact1;
uniform vec4 uFallImpact2;
uniform vec3 uFallImpactSeeds;
uniform float uDebug;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  return noise(p)*.53+noise(p*2.04+5.2)*.27+noise(p*4.09-3.7)*.14+noise(p*8.17+1.3)*.06;
}

vec4 lightingWeights(float minutes){
  float m=mod(minutes,1440.);
  float night=0.,dawn=0.,day=0.,dusk=0.;
  if(m<300.){night=1.;}
  else if(m<390.){float t=(m-300.)/90.;night=1.-t;dawn=t;}
  else if(m<450.){float t=(m-390.)/60.;dawn=1.-t;day=t;}
  else if(m<1050.){day=1.;}
  else if(m<1110.){float t=(m-1050.)/60.;day=1.-t;dusk=t;}
  else if(m<1200.){float t=(m-1110.)/90.;dusk=1.-t;night=t;}
  else{night=1.;}
  return vec4(night,dawn,day,dusk);
}

float rainRing(vec2 p,float time,float rain,vec2 offset){
  if(rain<.03)return 0.;
  vec2 grid=p*.045+offset;
  vec2 cell=floor(grid);
  vec2 f=fract(grid);
  float seed=hash(cell);
  float speed=mix(1.4,2.6,seed);
  float age=fract(time*speed+seed);
  vec2 center=vec2(hash(cell+7.1),hash(cell+13.7));
  float radius=age*18.;
  float distanceToRing=abs(length(p-center)-radius);
  float ring=smoothstep(4.2,.6,distanceToRing);
  float life=smoothstep(.01,.18,age)*(1.-smoothstep(.60,1.,age));
  return ring*life*step(.32,hash(cell+31.));
}

float impactFoam(vec2 uv,vec4 impact,float time,float seed,vec2 flow){
  vec2 q=(uv-impact.xy)/max(impact.zw,vec2(.0001));
  float dist=length(q*vec2(1.1,1.3-clamp(q.y,-.4,.5)*.7));
  if(dist>1.5)return 0.;
  vec2 boilUv1=q*vec2(4.2,6.5)+vec2(seed*9.3,-time*1.65);
  vec2 boilUv2=q*vec2(8.5,12.0)-vec2(seed*17.1,time*2.2);
  float boil1=fbm(boilUv1);
  float boil2=fbm(boilUv2);
  float churnFroth=smoothstep(.36,.76,boil1*.62+boil2*.38);
  vec2 trailUv=q*vec2(5.5,10.5)-flow*time*1.2+vec2(seed*13.2,0.);
  float foamVeins=smoothstep(.40,.72,fbm(trailUv));
  float lipBoil=exp(-abs(q.y)*6.2)*(1.-smoothstep(.15,1.05,abs(q.x)));
  lipBoil*=.55+.45*smoothstep(.32,.78,fbm(vec2(q.x*8.+seed*5.,time*.85)));
  float envelope=exp(-dist*dist*2.8);
  return clamp((churnFroth*.65+foamVeins*.35+lipBoil*.42)*envelope,0.,1.);
}

void main(){
  vec4 maskData=texture2D(uMask,vUv);
  vec4 fallData=texture2D(uFallData,vUv);
  float mask=maskData.a;
  float fall=step(.012,fallData.a);
  if(mask<.004 && fall<.5){gl_FragColor=vec4(0.);return;}

  vec2 view=max(uViewSize,vec2(1.));
  vec2 p=vUv*view;
  vec2 flow=maskData.rg*2.-1.;
  flow=flow/max(length(flow),.001);

  float river=step(.25,maskData.b)*(1.-fall);
  float ocean=step(.10,maskData.b)*(1.-step(.25,maskData.b))*(1.-fall);
  float pool=1.-max(river,fall);
  float lake=max(0.,pool-ocean);

  float wind01=clamp(uWindSpeed/85.,0.,1.);
  float windRad=radians(uWindDirection);
  vec2 windDir=normalize(vec2(sin(windRad),-cos(windRad))+vec2(.0001));
  vec2 windCross=vec2(-windDir.y,windDir.x);
  vec2 crossFlow=vec2(-flow.y,flow.x);
  float along=dot(p,flow);
  float across=dot(p,crossFlow);

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
  float flowSpeed=uTime*1.8;
  float advProgress1=fract(flowSpeed);
  float advProgress2=fract(flowSpeed+.5);
  float advWeight=abs(advProgress1*2.-1.);

  float bankDist=abs(across*.08);
  float channelSpeedCurve=clamp(1.4-bankDist*.35,.7,1.5);

  vec2 rUv1=vec2(across*.18,along*.06-advProgress1*1.8*channelSpeedCurve);
  vec2 rUv2=vec2(across*.18,along*.06-advProgress2*1.8*channelSpeedCurve);
  float fluidFlowNoise=mix(noise(rUv1),noise(rUv2),advWeight);

  vec2 rWaveUv1=vec2(across*.32+3.7,along*.12-advProgress1*2.6*channelSpeedCurve);
  vec2 rWaveUv2=vec2(across*.32+3.7,along*.12-advProgress2*2.6*channelSpeedCurve);
  float rWaveNoise=mix(noise(rWaveUv1),noise(rWaveUv2),advWeight);

  float ribbonTime=uTime*.72;
  vec2 flowRibbonUv=vec2(across*.075,along*.030-ribbonTime);
  float ribbonNoise=fbm(flowRibbonUv)*.68+noise(vec2(across*.16+11.3,along*.055-uTime*1.05))*.32;
  float ribbonBreakup=fbm(vec2(across*.025-7.1,along*.018-uTime*.20));
  float flowRibbon=smoothstep(.50,.72,ribbonNoise+ribbonBreakup*.20)*river;

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

  vec2 riverDisp=crossFlow*(rWaveNoise-.5)*1.8+flow*(fluidFlowNoise-.5)*1.8;
  riverDisp+=crossFlow*(flowRibbon-.35)*.55;
  vec2 riverSurfaceDisp=crossFlow*riverSurfaceWave1*.60+flow*riverSurfaceWave2*.28;
  riverSurfaceDisp+=crossFlow*(riverSurfaceNoise-.5)*.55;
  riverSurfaceDisp*=riverSurfaceEnvelope;
  vec2 riverOffset=(riverDisp+riverSurfaceDisp)*uRiverStrength*2.42;

  // Waterfall cascade
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
    float fallSheet=smoothstep(.22,.70,fallCore*(.65+fallBurst*.45));
    fallWhiteWater=smoothstep(.38,.72,fallBroad*.5+fallFine*.5)*fallSheet;
    fallOffset=crossFlow*(sin(fallCoord*.4+across*.08)*.55)*fallCore;
    fallOffset+=flow*(sin(fallCoord*.8)*.35)*fallCore;
  }

  vec2 offsetPx=(pool*poolOffset+river*riverOffset+fall*fallOffset)*uStrength*max(mask,fallData.a);
  vec2 uv=clamp(vUv+offsetPx/view,vec2(0.),vec2(1.));
  float safe=max(texture2D(uMask,uv).a,fallData.a);
  vec3 base=texture2D(uImage,vUv).rgb;
  vec3 warped=texture2D(uImage,uv).rgb;
  vec3 color=mix(base,warped,safe);

  // Surface optics
  float caustics=fbm(pCenter*.032+vec2(uTime*.16,-uTime*.12));
  float causticShimmer=smoothstep(.32,.68,caustics)*pool*(.11+wind01*.09);
  float windShimmer=smoothstep(.36,.80,sin(windAlong*.040-uTime*1.6+caustics*1.8)*.5+.5)*(lake*.09+ocean*.15)*(.6+wind01*.7);
  float oceanSwell=smoothstep(.45,.85,sin(oceanSwellPhase)*.5+.5)*ocean*.12;
  float stormNoise=noise(vec2(windAcross*.055,windAlong*.020-uTime*1.3));
  float whiteCap=smoothstep(.58,.92,sin(oceanSwellPhase*1.1+stormNoise*1.9)*.5+.5)*ocean*smoothstep(.30,1.,wind01)*.22;

  // Impact foam
  float impact=max(
    impactFoam(vUv,uFallImpact0,uTime,uFallImpactSeeds.x,flow),
    max(
      impactFoam(vUv,uFallImpact1,uTime+2.7,uFallImpactSeeds.y,flow),
      impactFoam(vUv,uFallImpact2,uTime+5.1,uFallImpactSeeds.z,flow)
    )
  );

  // Rain ripples
  float rain=clamp(uRainIntensity,0.,1.);
  float rippleA=rainRing(p,uTime,rain,vec2(0.));
  float rippleB=rainRing(p,uTime+2.7,rain,vec2(.47,.63));
  float rainRipple=max(rippleA,rippleB)*rain*(pool+river*.35);

  // River wavefronts
  float waveFront1=sin((along*.08-advProgress1*3.6*channelSpeedCurve)+sin(across*.15)*1.8);
  float waveFront2=sin((along*.08-advProgress2*3.6*channelSpeedCurve)+sin(across*.15)*1.8);
  float waveCrest1=pow(waveFront1*.5+.5,2.4);
  float waveCrest2=pow(waveFront2*.5+.5,2.4);
  float travelingWaveCrests=mix(waveCrest1,waveCrest2,advWeight)*river*uRiverStrength;
  float crestBreakup=.65+noise(vec2(across*.21+4.3,along*.065-uTime*.85))*.35;
  travelingWaveCrests*=crestBreakup;

  float sparkleUv=noise(vec2(across*.55,along*.22-uTime*4.4));
  float microSparkles=smoothstep(.65,.92,sparkleUv)*travelingWaveCrests;
  float riverSurfaceSheen=smoothstep(.44,.88,riverSurfaceChop)*river*uRiverStrength;

  vec3 deepWater=mix(color,color*vec3(.88,1.04,1.08)+vec3(0.,.015,.035),pool*.25);
  color=mix(color,deepWater,safe);

  vec4 phaseWeights=lightingWeights(uDayMinutes);
  float night=phaseWeights.x;
  float dawn=phaseWeights.y;
  float day=phaseWeights.z;
  float dusk=phaseWeights.w;
  float cloud=clamp(uCloudCover,0.,1.);
  float sunIntensity=clamp(day+(dawn+dusk)*.52,0.,1.)*(1.-cloud*.78)*(1.-rain*.82);
  float moonIntensity=night*(1.-cloud*.72)*(1.-rain*.55);

  float sunFacetField=caustics*.72+(sin(oceanSwellPhase)*.5+.5)*.28;
  float moonFacetField=caustics*.68+(cos(lakePhase2)*.5+.5)*.32;
  float sunFacets=smoothstep(.49,.80,sunFacetField);
  float moonFacets=smoothstep(.52,.83,moonFacetField);

  float surfaceVisibility=mix(.72,1.,clamp(sunIntensity+(dawn+dusk)*.28,0.,1.));
  float surfaceLight=(causticShimmer+windShimmer+oceanSwell+whiteCap)*uStrength*surfaceVisibility;
  surfaceLight+=rainRipple*.12;

  float sunReflection=(sunFacets*(lake*.034+ocean*.072)+fallWhiteWater*.045*fall)*sunIntensity;
  float moonReflection=(moonFacets*(lake*.026+ocean*.061)+impact*.045+fallWhiteWater*.064*fall)*moonIntensity;

  vec3 riverGlintColor=mix(vec3(.78,.92,1.),vec3(1.,.98,.90),sunIntensity);
  color+=riverGlintColor*(
    microSparkles*.40+
    travelingWaveCrests*.30+
    flowRibbon*.075*uRiverStrength+
    riverSurfaceSheen*.16
  )*uStrength*surfaceVisibility;

  color=mix(color,vec3(.88,.95,.98),fall*fallWhiteWater*.50*uStrength);
  color=mix(color,vec3(.92,.97,1.),impact*.55*uStrength);
  color=clamp(color+vec3(.65,.88,1.)*surfaceLight,0.,1.);
  color=clamp(color+vec3(1.,.82,.52)*sunReflection*uStrength,0.,1.);
  color=clamp(color+vec3(.50,.70,.95)*moonReflection*uStrength,0.,1.);
  color*=1.-rain*.04;

  float baseBlend=mix(.10,.20,river);
  color=mix(color,base,baseBlend);

  float effectiveMask=max(mask*mix(.90,.80,river),fallData.a*.92);
  gl_FragColor=vec4(color,clamp(effectiveMask*uStrength,0.,.92));
}`;

function buildMainMapMask(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, 1024 / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable while building main-map water mask');

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = w;
  sourceCanvas.height = h;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) throw new Error('2D canvas unavailable while reading main-map water colors');
  sourceCtx.drawImage(img, 0, 0, w, h);
  const source = sourceCtx.getImageData(0, 0, w, h).data;

  ctx.clearRect(0, 0, w, h);

  MAIN_MAP_POOLS.forEach((poly, index) => {
    const kind = MAIN_MAP_POOL_KINDS[index] ?? 'lake';
    const blue = kind === 'ocean' ? 48 : 0;
    ctx.fillStyle = `rgb(160,220,${blue})`;
    ctx.beginPath();
    poly.forEach(([x, y], pointIndex) => {
      const px = (x * w) / 100;
      const py = (y * h) / 100;
      if (pointIndex) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  });

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stream of MAIN_MAP_STREAMS) {
    for (let i = 1; i < stream.points.length; i++) {
      const a = stream.points[i - 1];
      const b = stream.points[i];
      const dx = (b[0] - a[0]) * w;
      const dy = (b[1] - a[1]) * h;
      const len = Math.hypot(dx, dy) || 1;
      const r = Math.round(127.5 + (127.5 * dx) / len);
      const g = Math.round(127.5 + (127.5 * dy) / len);
      ctx.strokeStyle = `rgb(${r},${g},128)`;
      ctx.lineWidth = (stream.width * w) / 100;
      ctx.beginPath();
      ctx.moveTo((a[0] * w) / 100, (a[1] * h) / 100);
      ctx.lineTo((b[0] * w) / 100, (b[1] * h) / 100);
      ctx.stroke();
    }
  }

  for (const waterfall of MAIN_MAP_WATERFALLS) {
    for (let i = 1; i < waterfall.points.length; i++) {
      const a = waterfall.points[i - 1];
      const b = waterfall.points[i];
      const progress = (i - 0.5) / (waterfall.points.length - 1);
      const width = waterfall.widthTop + (waterfall.widthBottom - waterfall.widthTop) * progress;
      const dx = (b[0] - a[0]) * w;
      const dy = (b[1] - a[1]) * h;
      const len = Math.hypot(dx, dy) || 1;
      const r = Math.round(127.5 + (127.5 * dx) / len);
      const g = Math.round(127.5 + (127.5 * dy) / len);
      ctx.strokeStyle = `rgb(${r},${g},255)`;
      ctx.lineWidth = (width * w) / 100;
      ctx.beginPath();
      ctx.moveTo((a[0] * w) / 100, (a[1] * h) / 100);
      ctx.lineTo((b[0] * w) / 100, (b[1] * h) / 100);
      ctx.stroke();
    }
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = source[i] / 255;
    const g = source[i + 1] / 255;
    const b = source[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Suppress green vegetation where g dominates both b and r
    const foliage = smooth(0.02, 0.12, g - b) * smooth(0.04, 0.14, g - r);
    // Cyan water in wetland channels, clear rivers, and shallow coastal ocean
    const cyan = smooth(-0.01, 0.08, Math.min(g - r, b - r)) * smooth(0.12, 0.28, b) * (1 - foliage * 0.9);
    // Deep blue water in ocean and shaded river pools
    const blueWater = smooth(0.18, 0.45, b) * smooth(-0.02, 0.08, b - r) * (1 - foliage);
    // Aerated foam, river rapids, and waterfall curtains
    const pale = smooth(0.40, 0.75, min) * (1 - smooth(0.10, 0.30, max - min));
    const foam = smooth(0.55, 0.85, (r + g + b) / 3) * smooth(-0.04, 0.04, b - r);

    const isFall = data[i + 2] > 200;
    const coverage = isFall
      ? Math.max(cyan, blueWater * 0.9, pale * 0.95, foam)
      : Math.max(cyan, blueWater * 0.95, pale * 0.4);

    data[i + 3] = Math.round(data[i + 3] * coverage);
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

export interface MainMapWaterShaderProps {
  src: string;
  enabled?: boolean;
  strength?: number;
  riverStrength?: number;
  speed?: number;
  environment?: Partial<MapShaderEnvironment>;
}

export function MainMapWaterShader({
  src,
  enabled = true,
  strength = MAIN_MAP_WATER_TUNING.strength,
  riverStrength = MAIN_MAP_WATER_TUNING.riverStrength,
  speed = MAIN_MAP_WATER_TUNING.speed,
  environment,
}: MainMapWaterShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef({ strength, riverStrength, speed, environment });
  paramsRef.current = { strength, riverStrength, speed, environment };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    let disposed = false;
    let raf = 0;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const textures: WebGLTexture[] = [];
    const shaders: WebGLShader[] = [];
    let observer: ResizeObserver | null = null;
    let ready = false;
    let elapsed = 0;
    let last = 0;

    const image = new Image();
    image.crossOrigin = 'anonymous';

    const compile = (type: number, source: string) => {
      const shader = gl!.createShader(type);
      if (!shader) throw new Error('Unable to allocate WebGL shader');
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        throw new Error(gl!.getShaderInfoLog(shader) || 'Shader compilation failed');
      }
      shaders.push(shader);
      return shader;
    };

    const textureFrom = (source: TexImageSource, unit: number) => {
      const texture = gl!.createTexture();
      if (!texture) throw new Error('Unable to allocate WebGL texture');
      textures.push(texture);
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 0);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, source);
      return texture;
    };

    const resize = () => {
      if (!gl || !program) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scale = Math.min(
        window.devicePixelRatio || 1,
        MAIN_MAP_WATER_TUNING.maxDpr,
        MAIN_MAP_WATER_TUNING.maxCanvasSide / Math.max(rect.width, rect.height, 1),
      );
      const w = Math.max(1, Math.round(rect.width * scale));
      const h = Math.max(1, Math.round(rect.height * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(
        gl.getUniformLocation(program, 'uViewSize'),
        Math.max(1, rect.width),
        Math.max(1, rect.height),
      );
    };

    const draw = (now: number) => {
      raf = 0;
      if (disposed || !ready || !gl || !program || document.hidden) return;
      const frameMs = 1000 / MAIN_MAP_WATER_TUNING.fps;
      if (!last) last = now - frameMs;
      const delta = now - last;
      if (delta < frameMs - 0.5) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = now - (delta % frameMs);
      elapsed += Math.min(delta, 100) * 0.001 * Math.max(0, paramsRef.current.speed);

      const env = normalizeMapShaderEnvironment(paramsRef.current.environment);
      gl.useProgram(program);
      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed);
      gl.uniform1f(gl.getUniformLocation(program, 'uStrength'), paramsRef.current.strength);
      gl.uniform1f(gl.getUniformLocation(program, 'uRiverStrength'), paramsRef.current.riverStrength);
      gl.uniform1f(gl.getUniformLocation(program, 'uDayMinutes'), env.timeOfDayMinutes);
      gl.uniform1f(gl.getUniformLocation(program, 'uRainIntensity'), env.rainIntensity);
      gl.uniform1f(gl.getUniformLocation(program, 'uCloudCover'), env.cloudCover);
      gl.uniform1f(gl.getUniformLocation(program, 'uWindSpeed'), env.windSpeedKmh);
      gl.uniform1f(gl.getUniformLocation(program, 'uWindDirection'), env.windDirectionDeg);
      gl.uniform1f(gl.getUniformLocation(program, 'uDebug'), 0.0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };

    image.onload = () => {
      if (disposed) return;
      try {
        gl = canvas.getContext('webgl', {
          alpha: true,
          premultipliedAlpha: false,
          antialias: false,
        });
        if (!gl) throw new Error('WebGL unavailable');
        const vs = compile(gl.VERTEX_SHADER, VERTEX);
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
        program = gl.createProgram();
        if (!program) throw new Error('Unable to allocate WebGL program');
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
        }
        gl.useProgram(program);

        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl.STATIC_DRAW,
        );
        const position = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        textureFrom(image, 0);
        textureFrom(buildMainMapMask(image), 1);
        textureFrom(buildWaterfallFlowTexture(image), 2);
        gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);
        gl.uniform1i(gl.getUniformLocation(program, 'uMask'), 1);
        gl.uniform1i(gl.getUniformLocation(program, 'uFallData'), 2);

        const impacts = MAIN_MAP_WATERFALL_IMPACTS;
        ['uFallImpact0', 'uFallImpact1', 'uFallImpact2'].forEach((name, index) => {
          const impact = impacts[index] ?? {
            center: [-10, -10] as const,
            radius: [0.01, 0.01] as const,
            seed: 0,
          };
          gl!.uniform4f(
            gl!.getUniformLocation(program!, name),
            impact.center[0] / 100,
            impact.center[1] / 100,
            impact.radius[0] / 100,
            impact.radius[1] / 100,
          );
        });
        gl.uniform3f(
          gl.getUniformLocation(program, 'uFallImpactSeeds'),
          impacts[0]?.seed ?? 0.2,
          impacts[1]?.seed ?? 0.5,
          impacts[2]?.seed ?? 0.8,
        );

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();
        ready = true;
        canvas.style.visibility = 'visible';
        raf = requestAnimationFrame(draw);
      } catch (error) {
        console.warn('[MainMapWaterShader] Static map fallback:', error);
        canvas.style.visibility = 'hidden';
      }
    };
    image.onerror = () => {
      canvas.style.visibility = 'hidden';
    };
    image.src = src;

    const visibility = () => {
      if (!document.hidden && ready && !raf) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', visibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      if (gl) {
        textures.forEach((t) => gl!.deleteTexture(t));
        shaders.forEach((s) => gl!.deleteShader(s));
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
      }
    };
  }, [src, enabled]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[3]"
      aria-hidden="true"
    />
  );
}
