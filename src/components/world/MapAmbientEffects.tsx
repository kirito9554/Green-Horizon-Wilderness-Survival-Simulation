import React, { useEffect, useRef } from 'react';
import {
  normalizeMapShaderEnvironment,
  type MapShaderEnvironment,
} from './MapShaderEnvironment';

/** Weather-driven atmosphere and day/night lighting for the supplied center map. */
export const AMBIENT_TUNING = {
  strength: 1,
  speed: 1,
  fps: 20,
  maxDpr: 1,
  maxCanvasSide: 1448,
};

const VERTEX = `attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv=vec2(aPosition.x*.5+.5,.5-aPosition.y*.5);
  gl_Position=vec4(aPosition,0.,1.);
}`;

export const AMBIENT_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uCrownMask;
uniform vec2 uViewSize;
uniform float uTime;
uniform float uStrength;
uniform float uDayMinutes;
uniform float uRainIntensity;
uniform float uCloudCover;
uniform float uWindSpeed;
uniform float uWindDirection;
uniform float uHumidity;
uniform float uTemperature;
uniform float uDebug;
uniform vec2 uCloudOffset;
uniform vec4 uPoiLights[8];
uniform float uPoiLightCount;

float hash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  return noise(p)*.55+noise(p*2.03+9.)*.29+noise(p*4.01+17.)*.16;
}
float vegetation(vec3 c){
  float greenLead=c.g-max(c.r*.82,c.b*.88);
  float notGrey=1.-smoothstep(.01,.20,max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)));
  return smoothstep(.015,.105,greenLead)*smoothstep(.07,.24,c.g)*(1.-notGrey*.38);
}
void over(inout vec3 premul,inout float alpha,vec3 color,float sourceAlpha){
  sourceAlpha=clamp(sourceAlpha,0.,1.);
  premul=color*sourceAlpha+premul*(1.-sourceAlpha);
  alpha=sourceAlpha+alpha*(1.-sourceAlpha);
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
vec3 gradeSample(vec3 color,vec4 phase){
  vec3 nightColor=mix(color,color*vec3(.62,.73,.88)+vec3(.012,.020,.036),.38);
  vec3 dawnColor=color*vec3(1.06,.98,.86)+vec3(.018,.006,0.);
  vec3 dayColor=color*vec3(1.01,1.01,.99);
  vec3 duskColor=color*vec3(1.05,.91,.87)+vec3(.014,0.,.008);
  return clamp(nightColor*phase.x+dawnColor*phase.y+dayColor*phase.z+duskColor*phase.w,0.,1.);
}
float organicPoiLight(vec2 p,float time){
  float result=0.;
  float aspect=uViewSize.x/max(uViewSize.y,1.);
  for(int i=0;i<8;i++){
    float id=float(i);
    float active=step(id+.5,uPoiLightCount);
    if(active>.5){
      vec4 spec=uPoiLights[i];
      vec2 q=(p-spec.xy)*vec2(aspect,1.)/max(spec.z,.002);
      float q2=dot(q,q);
      if(q2<4.85){
        float seed=id*7.13+spec.x*19.+spec.y*31.;
        vec2 warp=vec2(
          noise(q*2.07+vec2(seed,time*.025)),
          noise(q.yx*2.31+vec2(-seed,time*.021))
        )-.5;
        vec2 organicQ=q+warp*.31;
        float envelope=exp(-dot(organicQ,organicQ)*1.85);
        float texture=.78+.22*noise(q*3.7+vec2(seed*.43,-time*.035));
        float breath=.989+.011*sin(time*.58+seed);
        result=max(result,envelope*texture*breath*spec.w);
      }
    }
  }
  return clamp(result,0.,1.);
}

float rainStreakLayer(
  vec2 mapCoord,
  float time,
  vec2 fallDir,
  vec2 crossDir,
  float speed,
  vec2 cellSize,
  vec2 seedOffset,
  float density,
  float widthMin,
  float widthMax,
  float lenMin,
  float lenMax,
  float slantJitter
){
  float along=dot(mapCoord,fallDir)-time*speed;
  float across=dot(mapCoord,crossDir);
  vec2 cell=vec2(floor(across/cellSize.x),floor(along/cellSize.y));
  float seed=hash(cell+seedOffset);
  float active=step(1.-density,seed);
  if(active<.5)return 0.;

  float width=mix(widthMin,widthMax,hash(cell+seedOffset+11.7));
  float length=mix(lenMin,lenMax,hash(cell+seedOffset+23.1));
  float head=mix(.42,.90,hash(cell+seedOffset+31.9));
  float crossCenter=mix(.18,.82,hash(cell+seedOffset+19.4));

  float slant=(hash(cell+seedOffset+5.7)-.5)*slantJitter;
  float cellAcross=across/cellSize.x;
  float cellAlong=along/cellSize.y;
  float localAlong=fract(cellAlong);
  float localAcross=fract(cellAcross+localAlong*slant)-crossCenter;

  float core=1.-smoothstep(width,width*2.6,abs(localAcross));
  float tail=smoothstep(max(.02,head-length),head,localAlong)*(1.-smoothstep(head,min(.995,head+.06),localAlong));
  float breakup=.58+.42*noise(vec2(cell.x*1.37+seed*9.1,cell.y*1.11-time*(.55+seed*.25)));
  float taper=mix(.62,1.,smoothstep(.0,.35,localAlong));
  return core*tail*breakup*taper;
}

float rainStreaksWorld(vec2 uv,float time,vec2 windDir,float rain,float wind01,float openToSky){
  vec2 aspectUv=vec2(uv.x*(uViewSize.x/max(uViewSize.y,1.)),uv.y);
  vec2 mapCoord=aspectUv*980.;
  vec2 fallDir=normalize(vec2(windDir.x*mix(.06,.28,wind01),1.0));
  vec2 crossDir=vec2(-fallDir.y,fallDir.x);

  float layer1=rainStreakLayer(
    mapCoord,
    time,
    fallDir,
    crossDir,
    mix(210.,340.,rain),
    vec2(17.,92.),
    vec2(13.2,7.4),
    mix(.12,.42,rain),
    .030,
    .075,
    .16,
    .34,
    .16
  );

  float layer2=rainStreakLayer(
    mapCoord+vec2(43.,-27.),
    time,
    fallDir,
    crossDir,
    mix(290.,455.,rain),
    vec2(12.,68.),
    vec2(71.3,29.8),
    mix(.10,.34,rain),
    .024,
    .060,
    .12,
    .25,
    .20
  );

  float layer3=rainStreakLayer(
    mapCoord+vec2(-65.,53.),
    time,
    fallDir,
    crossDir,
    mix(365.,560.,rain),
    vec2(8.,44.),
    vec2(121.6,83.1),
    mix(.08,.26,rain),
    .018,
    .045,
    .08,
    .18,
    .24
  );

  float gustBreak=noise(vec2(aspectUv.x*8.5-time*.07,aspectUv.y*6.2+time*.04));
  float gustMask=smoothstep(.20,.88,gustBreak);
  return clamp((layer1*.65+layer2*.38+layer3*.20)*openToSky*gustMask,0.,1.);
}

float rainGroundImpacts(vec2 uv,float time,float rain,float openToSky){
  vec2 aspectUv=vec2(uv.x*(uViewSize.x/max(uViewSize.y,1.)),uv.y);
  vec2 grid=aspectUv*150.;
  vec2 cell=floor(grid);
  vec2 f=fract(grid);
  float seed=hash(cell+17.3);
  vec2 center=vec2(hash(cell+3.1),hash(cell+19.7));
  float age=fract(time*(.34+rain*.48)+seed);
  float drop=smoothstep(.16,.03,length(f-center))*smoothstep(.02,.16,age)*(1.-smoothstep(.16,.42,age));
  float ringRadius=age*.22;
  float ring= smoothstep(.030,.010,abs(length(f-center)-ringRadius));
  float presence=step(1.-mix(.06,.22,rain),seed);
  return clamp((drop*.85+ring*.45)*presence*openToSky,0.,1.);
}

void main(){
  vec2 p=vUv;
  vec2 pixel=p*max(uViewSize,vec2(1.));
  float time=uTime;
  float rain=clamp(uRainIntensity,0.,1.);
  float cloudCover=clamp(uCloudCover,0.,1.);
  float wind01=clamp(uWindSpeed/85.,0.,1.);
  float windRad=radians(uWindDirection);
  vec2 windDir=normalize(vec2(sin(windRad),-cos(windRad))+vec2(.0001));
  vec2 windCross=vec2(-windDir.y,windDir.x);
  vec4 phaseWeights=lightingWeights(uDayMinutes);
  float night=phaseWeights.x;
  float dawn=phaseWeights.y;
  float day=phaseWeights.z;
  float dusk=phaseWeights.w;
  vec3 original=texture2D(uImage,p).rgb;
  vec3 premul=vec3(0.);
  float alpha=0.;

  // 1. Campfire — centered on the painted flame, not the Base Camp label.
  // Noise bends the falloff so neither the spill nor its edge reads as an ellipse.
  vec2 fireQ=(p-vec2(.4406,.3969))/vec2(.060,.048);
  float fireStable=0.;
  float fireLight=0.;
  if(dot(fireQ,fireQ)<7.){
    vec2 fireWarp=vec2(
      noise(fireQ*2.07+vec2(4.3,time*.041)),
      noise(fireQ.yx*2.23+vec2(-7.1,time*.037))
    )-.5;
    vec2 warpedFireQ=fireQ+fireWarp*.30;
    float fireDistance=dot(warpedFireQ,warpedFireQ);
    float fireOuter=exp(-fireDistance*1.75)*(.86+.14*noise(fireQ*3.1+11.));
    float fireNear=exp(-fireDistance*5.8);
    float coreNoise=noise(vec2(time*1.35,17.3));
    float coreFlicker=.96+(coreNoise-.5)*.08;
    float outerBreath=.994+.006*sin(time*.57);
    fireStable=fireOuter*outerBreath*(1.-rain*.20);
    fireLight=clamp(fireStable*.64+fireNear*coreFlicker*.36,0.,1.);
  }

  // 2. Occupied POIs use a soft, torn ground glow with a nearly static pulse.
  float poiLight=organicPoiLight(p,time);
  float lowLight=clamp(night+dusk*.56+dawn*.24,0.,1.);
  float poiVisibility=mix(.07,1.,lowLight);

  // 3. One normalized time palette replaces stacked dawn/day/dusk masks.
  vec3 timeTint=
    vec3(.075,.115,.205)*night+
    vec3(.96,.54,.28)*dawn+
    vec3(.96,.975,.95)*day+
    vec3(.88,.39,.24)*dusk;
  float timeAlpha=night*mix(.22,.34,cloudCover)+dawn*.115+day*.012+dusk*.145;
  float localLightCarve=clamp(fireStable*.64+poiLight*poiVisibility*.28,0.,.72);
  over(premul,alpha,timeTint,timeAlpha*(1.-localLightCarve)*uStrength);

  // 4. Art-directed sun: the painted map already has light from upper-left.
  // Broad FBM patches keep the illumination organic and avoid straight ray shapes.
  vec2 sunDrift=vec2(time*.0016,-time*.0011);
  float sunNoise=fbm(p*vec2(5.2,3.9)+sunDrift);
  float fineSun=fbm(p*vec2(15.7,11.9)-sunDrift*2.7+8.);
  float vegetationMask=vegetation(original);
  float sunDapple=smoothstep(.48,.76,sunNoise*.68+fineSun*.32)*vegetationMask;
  float sunIntensity=clamp(day+(dawn+dusk)*.52,0.,1.)*(1.-cloudCover*.78)*(1.-rain*.82);
  vec3 sunColor=mix(vec3(1.,.95,.84),vec3(1.,.67,.34),clamp(dawn+dusk,0.,1.));
  over(premul,alpha,sunColor,sunIntensity*(.018+sunDapple*.052)*uStrength);

  // 5. Moonlight catches pale rock, water and canopy gaps from upper-right.
  float maximum=max(original.r,max(original.g,original.b));
  float minimum=min(original.r,min(original.g,original.b));
  float paleSurface=smoothstep(.34,.76,minimum)*(1.-smoothstep(.10,.34,maximum-minimum));
  float cyanSurface=smoothstep(.015,.12,min(original.g-original.r,original.b-original.r));
  vec2 moonAxis=vec2(dot(p,normalize(vec2(-.72,.69))),dot(p,normalize(vec2(.69,.72))));
  float moonNoise=fbm(moonAxis*vec2(7.3,4.1)+vec2(time*.002,-time*.001));
  float moonBreakup=smoothstep(.48,.77,moonNoise);
  float moonIntensity=night*(1.-cloudCover*.72)*(1.-rain*.55);
  float moonCatch=clamp(paleSurface*.52+cyanSurface*.66+(1.-vegetationMask)*.10,0.,1.);
  over(premul,alpha,vec3(.55,.70,.90),moonIntensity*moonBreakup*moonCatch*.075*uStrength);

  // Local warm lights stay restrained and never drive the darkness mask directly.
  over(premul,alpha,vec3(1.,.61,.18),fireLight*lowLight*.48*uStrength);
  over(premul,alpha,vec3(1.,.73,.34),poiLight*poiVisibility*.24*uStrength);

  // Overcast sky cast: cool muted slate wash during cloudy daytime
  float overcast=smoothstep(.32,.85,cloudCover)*day*(1.-rain*.6);
  over(premul,alpha,vec3(.35,.44,.52),overcast*.105*uStrength);

  // Rainy atmospheric cool mood: desaturated blue-slate veil
  float rainAtmosphere=rain*mix(.08,.20,cloudCover)*uStrength;
  over(premul,alpha,vec3(.16,.26,.35),rainAtmosphere);

  // Sunlit warmth on clear bright tropical days
  float sunnyWarmth=day*(1.-cloudCover*.85)*(1.-rain);
  over(premul,alpha,vec3(1.,.96,.88),sunnyWarmth*.025*uStrength);

  // Heat wave shimmer during high temperature
  float heat=smoothstep(33.,39.,uTemperature)*(1.-rain)*day;
  over(premul,alpha,vec3(1.,.72,.28),heat*.025*uStrength);

  // 3. Cohesive cloud masses & bands: large connected bodies with softer bridges,
  // so the sky reads as drifting cloud fields instead of a fog layer.
  vec2 cloudUv=p*vec2(2.25,1.70)-uCloudOffset*.72;
  vec2 cloudBandUv=vec2(
    cloudUv.x*.78+sin(cloudUv.y*1.18)*.34,
    cloudUv.y*1.26+sin(cloudUv.x*.86)*.20
  );
  float cloudMajorA=fbm(cloudUv);
  float cloudMajorB=fbm(cloudUv*1.58+vec2(6.8,-3.9));
  float cloudBridge=fbm(cloudBandUv+vec2(2.7,-1.3));
  float cloudEdgeNoise=fbm(cloudUv*3.15+vec2(11.4,-7.2));
  float cloudNoise=cloudMajorA*.46+cloudMajorB*.28+cloudBridge*.26;

  // A higher threshold keeps the field as distinct connected masses instead of a soft full-screen veil.
  float cThresh=mix(.69,.40,cloudCover);
  float cloudMass=smoothstep(cThresh,cThresh+.16,cloudNoise);
  float cloudBody=smoothstep(cThresh-.05,cThresh+.10,cloudNoise+(cloudEdgeNoise-.5)*.12);
  float cloudCore=smoothstep(cThresh+.04,cThresh+.22,cloudNoise);
  float cloudFringe=clamp(cloudBody-cloudCore,0.,1.);
  float cloudLightResponse=mix(.38,1.,clamp(day+(dawn+dusk)*.62,0.,1.));
  float cloudAlpha=cloudBody*mix(.08,.34,cloudCover)*cloudLightResponse*uStrength;

  // Ground cloud shadow uses the same large cloud masses, offset by sun angle,
  // so the shadow feels attached to the cloud body rather than a generic dim wash.
  vec2 shadowOffset=vec2(.028,.036);
  vec2 shadowCloudUv=(p+shadowOffset)*vec2(2.25,1.70)-uCloudOffset*.72;
  vec2 shadowBandUv=vec2(
    shadowCloudUv.x*.78+sin(shadowCloudUv.y*1.18)*.34,
    shadowCloudUv.y*1.26+sin(shadowCloudUv.x*.86)*.20
  );
  float shadowMajorA=fbm(shadowCloudUv);
  float shadowMajorB=fbm(shadowCloudUv*1.58+vec2(6.8,-3.9));
  float shadowBridge=fbm(shadowBandUv+vec2(2.7,-1.3));
  float shadowEdgeNoise=fbm(shadowCloudUv*3.15+vec2(11.4,-7.2));
  float shadowNoise=shadowMajorA*.46+shadowMajorB*.28+shadowBridge*.26;
  float shadowMass=smoothstep(cThresh-.02,cThresh+.12,shadowNoise+(shadowEdgeNoise-.5)*.10);
  float shadowTexture=.82+.18*shadowNoise;
  float shadowAlpha=shadowMass*shadowTexture*cloudCover*mix(.06,.20,cloudCover)*sunIntensity*uStrength;
  over(premul,alpha,vec3(.008,.022,.035),shadowAlpha);

  // Visible overhead cloud bodies: bright cores plus softer rims keep the clouds readable as volume.
  float cloudSunRim=clamp(cloudFringe*(.72+.28*cloudEdgeNoise),0.,1.);
  vec3 dayCloud=mix(vec3(.84,.89,.94),vec3(.99,1.,1.),cloudSunRim+.22*cloudCore);
  vec3 cloudColor=
    vec3(.20,.25,.34)*night+
    mix(vec3(.74,.66,.61),vec3(1.,.78,.56),cloudSunRim+.18*cloudCore)*dawn+
    dayCloud*day+
    mix(vec3(.70,.53,.52),vec3(1.,.62,.42),cloudSunRim+.18*cloudCore)*dusk;
  over(premul,alpha,cloudColor,cloudAlpha);

  // Tropical humidity remains, but only as a light atmospheric veil around and between cloud bodies.
  float humidHaze=smoothstep(76.,100.,uHumidity)*(1.-cloudBody*.72)*cloudCover*(.012+.026*cloudMass);
  over(premul,alpha,vec3(.70,.78,.78),humidHaze*uStrength);

  // 4. Atmospheric Wind Wisps (Soft, curved organic breeze streamlines, eliminating single sharp line)
  float windWisps=0.;
  if(wind01>.05){
    float alongW=dot(pixel,windDir)-time*(180.+wind01*280.);
    float crossW=dot(pixel,windCross);
    
    // Natural undulating meander
    float meander1=sin(alongW*0.0035+crossW*0.002)*18.0;
    float meander2=cos(alongW*0.0028-crossW*0.0018)*22.0;
    
    // Primary breeze filament layer
    float cross1=(crossW+meander1)/52.0;
    float cell1=floor(cross1);
    float localCross1=fract(cross1)-0.5;
    float gustSeed1=hash(vec2(cell1,17.3));
    float alongCell1=alongW*0.0022+gustSeed1*9.1;
    float gustPacket1=smoothstep(0.08,0.45,sin(alongCell1))*(1.0-smoothstep(0.55,0.92,sin(alongCell1)));
    float stream1=exp(-localCross1*localCross1*18.0)*gustPacket1*step(0.35,gustSeed1);

    // Secondary lighter breeze filaments
    float cross2=(crossW+meander2-time*35.0)/70.0;
    float cell2=floor(cross2);
    float localCross2=fract(cross2)-0.5;
    float gustSeed2=hash(vec2(cell2,43.7));
    float alongCell2=(alongW*1.28)*0.002+gustSeed2*13.4;
    float gustPacket2=smoothstep(0.10,0.48,sin(alongCell2))*(1.0-smoothstep(0.52,0.90,sin(alongCell2)));
    float stream2=exp(-localCross2*localCross2*22.0)*gustPacket2*step(0.40,gustSeed2);

    windWisps=(stream1*0.68+stream2*0.32)*smoothstep(0.05,0.65,wind01);
  }
  over(premul,alpha,vec3(.90,.96,1.),windWisps*.14*uStrength);

  // 5. Swaying Forest Tree Crowns along wind vector
  float crowns=texture2D(uCrownMask,p).r*vegetation(original);
  float gust=.76+.24*sin(time*(.28+wind01*.75));
  float phase=p.x*19.+p.y*13.;
  float oscillation=sin(time*(.72+wind01*1.15)+phase)+sin(time*1.63+phase*1.6)*.26;
  vec2 swayPx=windDir*oscillation*mix(.72,2.75,wind01)*gust*uStrength;
  vec2 shifted=clamp(p+swayPx/max(uViewSize,vec2(1.)),vec2(0.),vec2(1.));
  float safe=vegetation(texture2D(uImage,shifted).rgb);
  vec3 shiftedColor=texture2D(uImage,shifted).rgb;
  shiftedColor=clamp((shiftedColor-.5)*1.03+.5,0.,1.)*.95;
  shiftedColor=gradeSample(shiftedColor,phaseWeights);
  over(premul,alpha,shiftedColor,crowns*safe*.80);

  // 6. Rain grounded into the map instead of behaving like a screen overlay.
  float crownCover=texture2D(uCrownMask,p).r;
  float openToSky=clamp(1.-crownCover*.78,0.,1.);
  float rainLines=rainStreaksWorld(p,time,windDir,rain,wind01,openToSky)*rain;
  float rainImpacts=rainGroundImpacts(p,time,rain,openToSky)*rain;
  over(premul,alpha,vec3(.70,.82,.88),rainLines*.24*uStrength);
  over(premul,alpha,vec3(.76,.84,.88),rainImpacts*.11*uStrength);
  over(premul,alpha,vec3(.06,.12,.15),rain*.075*uStrength);

  // 7. Rare Storm Lightning Flash
  float storm=smoothstep(.78,1.,rain)*smoothstep(.50,1.,wind01);
  float lightningCycle=floor(time*.19);
  float lightningAge=fract(time*.19);
  float lightningGate=step(.86,hash(vec2(lightningCycle,47.)));
  float lightning=pow(max(0.,1.-lightningAge*15.),3.)*lightningGate*storm;
  over(premul,alpha,vec3(.79,.88,1.),lightning*.46*uStrength);

  if(uDebug>.5){
    vec3 debugColor=vec3(max(cloudBody,sunDapple),max(rainLines,moonBreakup*moonIntensity),max(poiLight,max(fireLight,crowns)));
    gl_FragColor=vec4(debugColor,.82);
    return;
  }
  gl_FragColor=vec4(alpha>.0001?premul/alpha:vec3(0.),alpha);
}
`;

const CROWN_REGIONS = [
  [.905,.260,.071,.060,1.3],
  [.845,.263,.029,.045,2.7],
  [.633,.698,.040,.051,4.1],
  [.606,.735,.026,.038,5.6],
  [.292,.190,.036,.048,7.2],
  [.096,.443,.042,.050,8.8],
  [.259,.466,.036,.044,10.4],
  [.566,.122,.038,.045,12.1],
] as const;

/** Builds the irregular crown regions once instead of evaluating FBM per fragment. */
function buildCrownMask(image:HTMLImageElement):HTMLCanvasElement{
  const scale=Math.min(1,512/image.naturalWidth);
  const width=Math.max(1,Math.round(image.naturalWidth*scale));
  const height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('2D canvas unavailable while building crown mask');
  const imageData=context.createImageData(width,height);
  const data=imageData.data;
  const smooth=(edge0:number,edge1:number,value:number)=>{
    const t=Math.max(0,Math.min(1,(value-edge0)/(edge1-edge0)));
    return t*t*(3-2*t);
  };

  for(let y=0;y<height;y++){
    const v=(y+.5)/height;
    for(let x=0;x<width;x++){
      const u=(x+.5)/width;
      let mask=0;
      for(const [centerX,centerY,radiusX,radiusY,seed] of CROWN_REGIONS){
        let qx=(u-centerX)/radiusX;
        let qy=(v-centerY)/radiusY;
        if(Math.abs(qx)>1.4||Math.abs(qy)>1.4)continue;
        const warpX=Math.sin(qy*3.7+seed*2.1)*.075+Math.sin((qx+qy)*7.3-seed)*.035;
        const warpY=Math.cos(qx*4.1-seed*1.7)*.068+Math.sin((qx-qy)*8.1+seed)*.032;
        qx+=warpX;
        qy+=warpY;
        const edgeNoise=Math.sin(qx*6.7+qy*5.1+seed)*.055+Math.sin(qx*11.3-qy*8.7-seed*.4)*.03;
        const organicDistance=Math.hypot(qx,qy)+edgeNoise;
        mask=Math.max(mask,1-smooth(.50,1.08,organicDistance));
      }
      const index=(y*width+x)*4;
      const value=Math.round(Math.max(0,Math.min(1,mask))*255);
      data[index]=value;
      data[index+1]=value;
      data[index+2]=value;
      data[index+3]=255;
    }
  }
  context.putImageData(imageData,0,0);
  return canvas;
}

export interface MapPoiLight {
  xPercent: number;
  yPercent: number;
  radiusPercent?: number;
  intensity?: number;
}

export interface MapAmbientEffectsProps {
  src: string;
  enabled?: boolean;
  strength?: number;
  speed?: number;
  environment?: Partial<MapShaderEnvironment>;
  poiLights?: readonly MapPoiLight[];
  debugMask?: boolean;
  respectReducedMotion?: boolean;
}

export function MapAmbientEffects({
  src,
  enabled=true,
  strength=AMBIENT_TUNING.strength,
  speed=AMBIENT_TUNING.speed,
  environment,
  poiLights=[],
  debugMask=false,
  respectReducedMotion=false,
}:MapAmbientEffectsProps){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const paramsRef=useRef({strength,speed,environment,poiLights,debugMask,respectReducedMotion});
  paramsRef.current={strength,speed,environment,poiLights,debugMask,respectReducedMotion};

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
      console.warn('[MapAmbientEffects] Static map fallback:',error);
    };
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      const scale=Math.min(
        window.devicePixelRatio||1,
        AMBIENT_TUNING.maxDpr,
        AMBIENT_TUNING.maxCanvasSide/Math.max(rect.width,rect.height,1),
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
    let smoothCloud = 0.1;
    let smoothDayMinutes = 510;
    let smoothHumidity = 65;
    let smoothTemperature = 28;
    let cloudOffsetX = 0;
    let cloudOffsetY = 0;

    let draw=(
      _wDir:number,
      _wSpd:number,
      _rain:number,
      _cloud:number,
      _day:number,
      _hum:number,
      _temp:number,
      _cOffX:number,
      _cOffY:number,
    )=>{};

    const tick=(now:number)=>{
      animationFrame=0;
      if(disposed||!ready||document.hidden||pausesForMotion())return;
      const frameInterval=1000/Math.max(1,AMBIENT_TUNING.fps);
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
        smoothHumidity=env.humidityPercent;
        smoothTemperature=env.temperatureC;
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
        smoothHumidity+=(env.humidityPercent-smoothHumidity)*lerpFactor;
        smoothTemperature+=(env.temperatureC-smoothTemperature)*lerpFactor;
      }

      // Continuously integrate cloud drift across time without phase teleportation
      const cloudSpeed=(0.006+(smoothWindSpeed/85)*0.028)*dt;
      const rad=(smoothWindDir*Math.PI)/180;
      cloudOffsetX+=Math.sin(rad)*cloudSpeed;
      cloudOffsetY-=Math.cos(rad)*cloudSpeed;

      draw(
        smoothWindDir,
        smoothWindSpeed,
        smoothRain,
        smoothCloud,
        smoothDayMinutes,
        smoothHumidity,
        smoothTemperature,
        cloudOffsetX,
        cloudOffsetY,
      );
      animationFrame=requestAnimationFrame(tick);
    };
    const resume=()=>{
      stop();
      if(!ready||disposed)return;
      draw(
        smoothWindDir>=0?smoothWindDir:45,
        smoothWindSpeed,
        smoothRain,
        smoothCloud,
        smoothDayMinutes,
        smoothHumidity,
        smoothTemperature,
        cloudOffsetX,
        cloudOffsetY,
      );
      lastFrame=performance.now();
      if(!document.hidden&&!pausesForMotion())animationFrame=requestAnimationFrame(tick);
    };
    const onResize=()=>{
      resize();
      if(ready)draw(
        smoothWindDir>=0?smoothWindDir:45,
        smoothWindSpeed,
        smoothRain,
        smoothCloud,
        smoothDayMinutes,
        smoothHumidity,
        smoothTemperature,
        cloudOffsetX,
        cloudOffsetY,
      );
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
        context.attachShader(program,compile(context.FRAGMENT_SHADER,AMBIENT_FRAGMENT_SHADER));
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

        if(Math.max(image.naturalWidth,image.naturalHeight)>context.getParameter(context.MAX_TEXTURE_SIZE)){
          throw new Error('Map exceeds GPU texture limit');
        }
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
        uploadTexture(image,0,'uImage');
        uploadTexture(buildCrownMask(image),1,'uCrownMask');

        const locations={
          time:context.getUniformLocation(program,'uTime'),
          strength:context.getUniformLocation(program,'uStrength'),
          dayMinutes:context.getUniformLocation(program,'uDayMinutes'),
          rain:context.getUniformLocation(program,'uRainIntensity'),
          cloud:context.getUniformLocation(program,'uCloudCover'),
          windSpeed:context.getUniformLocation(program,'uWindSpeed'),
          windDirection:context.getUniformLocation(program,'uWindDirection'),
          humidity:context.getUniformLocation(program,'uHumidity'),
          temperature:context.getUniformLocation(program,'uTemperature'),
          cloudOffset:context.getUniformLocation(program,'uCloudOffset'),
          debug:context.getUniformLocation(program,'uDebug'),
          poiLights:context.getUniformLocation(program,'uPoiLights[0]'),
          poiLightCount:context.getUniformLocation(program,'uPoiLightCount'),
        };
        const poiUniformData=new Float32Array(8*4);
        let uploadedPoiCount=-1;
        draw=(
          wDir:number,
          wSpd:number,
          rain:number,
          cloud:number,
          dayMin:number,
          hum:number,
          temp:number,
          cOffX:number,
          cOffY:number,
        )=>{
          const current=paramsRef.current;
          context.uniform1f(locations.time,elapsed);
          context.uniform1f(locations.strength,Math.max(0,Math.min(2,current.strength)));
          context.uniform1f(locations.dayMinutes,dayMin);
          context.uniform1f(locations.rain,rain);
          context.uniform1f(locations.cloud,cloud);
          context.uniform1f(locations.windSpeed,wSpd);
          context.uniform1f(locations.windDirection,wDir);
          context.uniform1f(locations.humidity,hum);
          context.uniform1f(locations.temperature,temp);
          context.uniform2f(locations.cloudOffset,cOffX,cOffY);
          const poiCount=Math.min(8,current.poiLights.length);
          let poiChanged=poiCount!==uploadedPoiCount;
          for(let index=0;index<8;index++){
            const offset=index*4;
            const light=index<poiCount?current.poiLights[index]:undefined;
            const nextX=light?Math.max(0,Math.min(100,light.xPercent))/100:0;
            const nextY=light?Math.max(0,Math.min(100,light.yPercent))/100:0;
            const nextRadius=light?Math.max(.8,Math.min(12,light.radiusPercent??4.5))/100:0;
            const nextIntensity=light?Math.max(0,Math.min(1.5,light.intensity??1)):0;
            if(
              Math.abs(poiUniformData[offset]-nextX)>1e-6||
              Math.abs(poiUniformData[offset+1]-nextY)>1e-6||
              Math.abs(poiUniformData[offset+2]-nextRadius)>1e-6||
              Math.abs(poiUniformData[offset+3]-nextIntensity)>1e-6
            )poiChanged=true;
            poiUniformData[offset]=nextX;
            poiUniformData[offset+1]=nextY;
            poiUniformData[offset+2]=nextRadius;
            poiUniformData[offset+3]=nextIntensity;
          }
          if(poiChanged){
            context.uniform4fv(locations.poiLights,poiUniformData);
            context.uniform1f(locations.poiLightCount,poiCount);
            uploadedPoiCount=poiCount;
          }
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
      data-map-effect="ambient-v5.1"
      aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:3,width:'100%',height:'100%',pointerEvents:'none'}}
    />
  ):null;
}
