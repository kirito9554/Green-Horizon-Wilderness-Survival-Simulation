import React, { useEffect, useRef } from 'react';
import {
  normalizeMapShaderEnvironment,
  type MapShaderEnvironment,
} from './MapShaderEnvironment';
import { MAP_WATERFALL_IMPACTS } from './MapWaterfallFlow';

export const PARTICLE_TUNING = {
  strength: 1,
  speed: 1,
  fps: 30,
  maxDpr: 1,
  maxCanvasSide: 1448,
  fireflyCount: 6,
  leafCount: 16,
} as const;

type SpriteSet = {
  smoke: HTMLCanvasElement[];
  mist: HTMLCanvasElement[];
  leaves: HTMLCanvasElement[];
  firefly: HTMLCanvasElement;
  birds: HTMLCanvasElement;
};

type BirdOffset = {
  back: number;
  side: number;
  scale: number;
  phase: number;
};

type ActiveFlock = {
  start: number;
  duration: number;
  route: number;
  offsets: BirdOffset[];
};

const LABEL_RECTS = [
  [.146,.163,.088,.027],[.390,.166,.080,.027],[.600,.112,.070,.028],[.845,.100,.073,.028],
  [.610,.259,.084,.028],[.875,.333,.090,.028],[.665,.358,.070,.028],[.410,.424,.070,.028],
  [.090,.355,.057,.028],[.120,.490,.088,.028],[.610,.485,.100,.029],[.907,.574,.080,.029],
  [.720,.590,.090,.029],[.040,.634,.085,.029],[.517,.635,.088,.029],[.350,.785,.090,.029],
  [.745,.765,.090,.029],[.115,.884,.085,.029],
] as const;

const LEAF_REGIONS = [
  [.835,.205,.155,.150],
  [.610,.505,.145,.130],
  [.245,.430,.160,.150],
  [.520,.675,.160,.125],
  [.275,.105,.155,.105],
] as const;

const BIRD_ROUTES = [
  [[1.08,.085],[.86,.035],[.54,.105],[.25,.19]],
  [[-.08,.82],[.16,.77],[.44,.72],[.70,.67]],
  [[1.06,.50],[.88,.46],[.66,.38],[.47,.31]],
] as const;

const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value));
const fract=(value:number)=>value-Math.floor(value);
const smooth=(edge0:number,edge1:number,value:number)=>{
  const t=clamp((value-edge0)/(edge1-edge0));
  return t*t*(3-2*t);
};
const hash=(value:number)=>fract(Math.sin(value*127.1+311.7)*43758.5453);

function nightWeight(minute:number):number{
  const smoother=(a:number,b:number,value:number)=>{
    const t=clamp((value-a)/(b-a));
    return t*t*t*(t*(t*6-15)+10);
  };
  const dayGate=smoother(300,435,minute)*(1-smoother(1035,1190,minute));
  const dawn=Math.exp(-Math.pow((minute-365)/82,2));
  const dusk=Math.exp(-Math.pow((minute-1105)/92,2));
  const twilight=Math.max(dawn,dusk);
  const day=Math.max(0,dayGate*(1-twilight*.72));
  const night=Math.max(0,(1-dayGate)*(1-twilight*.56));
  return night/Math.max(night+dawn+day+dusk,.0001);
}

function createPuffSprite(
  seed:number,
  color:readonly [number,number,number],
  density:number,
):HTMLCanvasElement{
  const size=72;
  const canvas=document.createElement('canvas');
  canvas.width=size;
  canvas.height=size;
  const context=canvas.getContext('2d');
  if(!context)return canvas;
  context.filter='blur(1.15px)';
  for(let index=0;index<9;index++){
    const angle=hash(seed+index*2.7)*Math.PI*2;
    const distance=(4+hash(seed+index*7.1)*14)*(index?1:0);
    const x=size*.5+Math.cos(angle)*distance;
    const y=size*.5+Math.sin(angle)*distance*.78;
    const radius=11+hash(seed+index*11.9)*16;
    const gradient=context.createRadialGradient(x,y,0,x,y,radius);
    const alpha=(.10+hash(seed+index*17.3)*.13)*density;
    gradient.addColorStop(0,`rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
    gradient.addColorStop(.48,`rgba(${color[0]},${color[1]},${color[2]},${alpha*.62})`);
    gradient.addColorStop(1,`rgba(${color[0]},${color[1]},${color[2]},0)`);
    context.fillStyle=gradient;
    context.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  context.filter='none';
  context.globalCompositeOperation='destination-out';
  for(let index=0;index<3;index++){
    const x=size*(.28+hash(seed+index*23.1)*.44);
    const y=size*(.28+hash(seed+index*29.7)*.44);
    const radius=4+hash(seed+index*31.9)*8;
    const gradient=context.createRadialGradient(x,y,0,x,y,radius);
    gradient.addColorStop(0,'rgba(0,0,0,.18)');
    gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle=gradient;
    context.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  context.globalCompositeOperation='source-over';
  return canvas;
}

function createLeafSprite(seed:number,color:string):HTMLCanvasElement{
  const canvas=document.createElement('canvas');
  canvas.width=18;
  canvas.height=12;
  const context=canvas.getContext('2d');
  if(!context)return canvas;
  context.translate(9,6);
  context.rotate((hash(seed)-.5)*.35);
  context.fillStyle=color;
  context.beginPath();
  context.moveTo(-7,0);
  context.bezierCurveTo(-3,-5,4,-4,7,0);
  context.bezierCurveTo(3,4,-3,5,-7,0);
  context.closePath();
  context.fill();
  context.strokeStyle='rgba(32,52,18,.45)';
  context.lineWidth=.65;
  context.beginPath();
  context.moveTo(-6,0);
  context.quadraticCurveTo(0,.7,6,0);
  context.stroke();
  return canvas;
}

function createFireflySprite():HTMLCanvasElement{
  const canvas=document.createElement('canvas');
  canvas.width=20;
  canvas.height=20;
  const context=canvas.getContext('2d');
  if(!context)return canvas;
  const gradient=context.createRadialGradient(10,10,0,10,10,10);
  gradient.addColorStop(0,'rgba(224,255,136,1)');
  gradient.addColorStop(.14,'rgba(170,255,94,.82)');
  gradient.addColorStop(.48,'rgba(132,238,72,.30)');
  gradient.addColorStop(1,'rgba(92,196,54,0)');
  context.fillStyle=gradient;
  context.fillRect(0,0,20,20);
  return canvas;
}

function createBirdAtlas():HTMLCanvasElement{
  const cellWidth=36;
  const cellHeight=24;
  const canvas=document.createElement('canvas');
  canvas.width=cellWidth*4;
  canvas.height=cellHeight;
  const context=canvas.getContext('2d');
  if(!context)return canvas;
  const wingLift=[-7,-2,3,-2];
  for(let frame=0;frame<4;frame++){
    context.save();
    context.translate(frame*cellWidth+cellWidth*.5,cellHeight*.53);
    context.fillStyle='rgba(27,38,43,.94)';
    context.beginPath();
    context.moveTo(-5,0);
    context.bezierCurveTo(-2,-2,5,-2,8,0);
    context.bezierCurveTo(4,2,-2,2,-5,0);
    context.fill();
    const lift=wingLift[frame];
    context.beginPath();
    context.moveTo(0,0);
    context.bezierCurveTo(-5,lift*.35,-11,lift,-15,lift*.76);
    context.bezierCurveTo(-10,lift*.15,-5,1,-1,1.2);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(1,0);
    context.bezierCurveTo(6,lift*.35,12,lift,16,lift*.72);
    context.bezierCurveTo(11,lift*.12,6,1,1,1.2);
    context.closePath();
    context.fill();
    context.restore();
  }
  return canvas;
}

function createSprites():SpriteSet{
  return {
    smoke:[
      createPuffSprite(1.7,[151,157,153],1),
      createPuffSprite(4.9,[130,139,139],.95),
      createPuffSprite(8.2,[174,177,168],.88),
    ],
    mist:[
      createPuffSprite(3.1,[220,239,238],1.15),
      createPuffSprite(6.6,[193,221,222],1),
      createPuffSprite(11.4,[232,245,241],1.08),
    ],
    leaves:[
      createLeafSprite(2.4,'rgba(79,119,31,.92)'),
      createLeafSprite(7.8,'rgba(172,127,39,.90)'),
      createLeafSprite(13.2,'rgba(48,91,27,.92)'),
    ],
    firefly:createFireflySprite(),
    birds:createBirdAtlas(),
  };
}

function labelVisibility(x:number,y:number):number{
  let visibility=1;
  for(const [left,top,width,height] of LABEL_RECTS){
    const centerX=left+width*.5;
    const centerY=top+height*.5;
    const qx=Math.abs(x-centerX)/(width*.62+.010);
    const qy=Math.abs(y-centerY)/(height*.75+.009);
    const distance=Math.max(qx,qy);
    visibility=Math.min(visibility,smooth(.82,1.18,distance));
  }
  return visibility;
}

function cubicPoint(route:typeof BIRD_ROUTES[number],t:number):readonly [number,number]{
  const inverse=1-t;
  const x=inverse*inverse*inverse*route[0][0]+3*inverse*inverse*t*route[1][0]+3*inverse*t*t*route[2][0]+t*t*t*route[3][0];
  const y=inverse*inverse*inverse*route[0][1]+3*inverse*inverse*t*route[1][1]+3*inverse*t*t*route[2][1]+t*t*t*route[3][1];
  return [x,y];
}

function cubicTangent(route:typeof BIRD_ROUTES[number],t:number):readonly [number,number]{
  const inverse=1-t;
  const x=3*inverse*inverse*(route[1][0]-route[0][0])+6*inverse*t*(route[2][0]-route[1][0])+3*t*t*(route[3][0]-route[2][0]);
  const y=3*inverse*inverse*(route[1][1]-route[0][1])+6*inverse*t*(route[2][1]-route[1][1])+3*t*t*(route[3][1]-route[2][1]);
  const length=Math.hypot(x,y)||1;
  return [x/length,y/length];
}

export interface MapParticleEffectsProps {
  enabled?: boolean;
  strength?: number;
  speed?: number;
  environment?: Partial<MapShaderEnvironment>;
  respectReducedMotion?: boolean;
}

export function MapParticleEffects({
  enabled=true,
  strength=PARTICLE_TUNING.strength,
  speed=PARTICLE_TUNING.speed,
  environment,
  respectReducedMotion=false,
}:MapParticleEffectsProps){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const paramsRef=useRef({strength,speed,environment,respectReducedMotion});
  paramsRef.current={strength,speed,environment,respectReducedMotion};

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||!enabled)return;
    const context=canvas.getContext('2d',{alpha:true});
    if(!context)return;

    const sprites=createSprites();
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame=0;
    let resizeObserver:ResizeObserver|null=null;
    let disposed=false;
    let lastFrame=0;
    let elapsed=0;
    let smoothWindDirection=-1;
    let smoothWindSpeed=8;
    let smoothRain=0;
    let smoothDayMinutes=720;
    let smoothHumidity=65;
    let activeFlock:ActiveFlock|null=null;
    let nextFlockAt=9+hash(3.7)*6;
    let flockIndex=0;

    const pausesForMotion=()=>paramsRef.current.respectReducedMotion&&motion.matches;
    const stop=()=>{cancelAnimationFrame(animationFrame);animationFrame=0;lastFrame=0;};
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      const scale=Math.min(
        window.devicePixelRatio||1,
        PARTICLE_TUNING.maxDpr,
        PARTICLE_TUNING.maxCanvasSide/Math.max(rect.width,rect.height,1),
      );
      const width=Math.max(1,Math.round(rect.width*scale));
      const height=Math.max(1,Math.round(rect.height*scale));
      if(Math.abs(canvas.width-width)>2||Math.abs(canvas.height-height)>2){
        canvas.width=width;
        canvas.height=height;
      }
      context.imageSmoothingEnabled=true;
    };

    const drawSprite=(sprite:HTMLCanvasElement,x:number,y:number,width:number,height:number,alpha:number,rotation=0)=>{
      if(alpha<=.001||x+width<0||x-width>canvas.width||y+height<0||y-height>canvas.height)return;
      context.save();
      context.globalAlpha=clamp(alpha,0,1);
      context.translate(x,y);
      context.rotate(rotation);
      context.drawImage(sprite,-width*.5,-height*.5,width,height);
      context.restore();
    };

    const spawnFlock=()=>{
      const seed=flockIndex*19.7+7.3;
      const count=4+Math.floor(hash(seed)*5);
      const offsets:BirdOffset[]=[];
      for(let index=0;index<count;index++){
        if(index===0){
          offsets.push({back:0,side:0,scale:1,phase:hash(seed+1.1)*4});
          continue;
        }
        const rank=Math.ceil(index/2);
        const side=(index%2?1:-1)*(rank*.010+hash(seed+index*3.1)*.008);
        offsets.push({
          back:rank*.022+hash(seed+index*5.9)*.015,
          side,
          scale:.78+hash(seed+index*7.7)*.28,
          phase:hash(seed+index*11.3)*4,
        });
      }
      activeFlock={
        start:elapsed,
        duration:6.5+hash(seed+17.1)*3.5,
        route:Math.floor(hash(seed+29.3)*BIRD_ROUTES.length),
        offsets,
      };
      flockIndex++;
    };

    const drawParticles=()=>{
      const width=canvas.width;
      const height=canvas.height;
      if(width<=1||height<=1)return;
      const current=paramsRef.current;
      const effectStrength=clamp(current.strength,0,2);
      const wind01=clamp(smoothWindSpeed/85);
      const windRadians=smoothWindDirection*Math.PI/180;
      const windX=Math.sin(windRadians);
      const windY=-Math.cos(windRadians);
      const sizeScale=Math.min(width/1000,height/750);
      const night=nightWeight(smoothDayMinutes);
      context.clearRect(0,0,width,height);

      // Irregular waterfall vapor sprites, localized to the three impact pools.
      MAP_WATERFALL_IMPACTS.forEach((impact,impactIndex)=>{
        const baseRadiusX=impact.radius[0]/100*width;
        const baseRadiusY=impact.radius[1]/100*height;
        for(let index=0;index<4;index++){
          const age=fract(elapsed*(.048+impact.seed*.012)+index/4+impact.seed);
          const life=smooth(0,.16,age)*(1-smooth(.68,1,age));
          const drift=(.08+.28*wind01)*age;
          const x=(impact.center[0]/100+windX*drift*impact.radius[0]/100+Math.sin(age*7+index)*.003)*width;
          const y=(impact.center[1]/100-age*impact.radius[1]/100*1.35+windY*drift*impact.radius[1]/100)*height;
          const spriteWidth=baseRadiusX*(1.20+age*1.65);
          const spriteHeight=baseRadiusY*(1.65+age*1.85);
          const humidityGain=.72+clamp((smoothHumidity-45)/55)*.52;
          const alpha=life*(.46+smoothRain*.20)*humidityGain*effectStrength*labelVisibility(x/width,y/height);
          drawSprite(sprites.mist[(index+impactIndex)%sprites.mist.length],x,y,spriteWidth,spriteHeight,alpha,Math.sin(age*5+index)*.12);
        }
      });

      // Campfire smoke; each torn sprite is cheap and expands as it cools.
      for(let index=0;index<9;index++){
        const age=fract(elapsed*.075+index/9);
        const life=smooth(0,.13,age)*(1-smooth(.52,1,age));
        const drift=Math.pow(age,1.2)*(.014+wind01*.055);
        const x=(.4406+windX*drift+Math.sin(age*9+index*1.7)*.004*age)*width;
        const y=(.3969-age*.092+windY*drift*.34+Math.cos(age*7+index)*.002*age)*height;
        const spriteSize=(7+age*35)*sizeScale;
        const alpha=life*(1-smoothRain*.40)*.74*effectStrength*labelVisibility(x/width,y/height);
        drawSprite(sprites.smoke[index%sprites.smoke.length],x,y,spriteSize*1.08,spriteSize*1.28,alpha,Math.sin(age*5.3+index)*.18);
      }

      // Small drifting leaves, restricted to authored canopy zones.
      for(let index=0;index<PARTICLE_TUNING.leafCount;index++){
        const region=LEAF_REGIONS[index%LEAF_REGIONS.length];
        const age=fract(elapsed*(.031+hash(index+2.1)*.022)+hash(index+17.4));
        const startX=region[0]+(hash(index+31.8)-.5)*region[2];
        const startY=region[1]+(hash(index+47.2)-.5)*region[3];
        const x=(startX+windX*age*(.018+wind01*.075)+Math.sin(age*12+index)*(.003+wind01*.006))*width;
        const y=(startY+windY*age*(.008+wind01*.022)+age*(.032+.024*(1-wind01))+Math.sin(age*8+index*1.7)*.004)*height;
        const life=smooth(0,.10,age)*(1-smooth(.78,1,age));
        const leafWidth=(3.2+hash(index+61.5)*2.5)*sizeScale;
        const leafHeight=leafWidth*.58;
        const alpha=life*(.48+wind01*.32)*effectStrength*labelVisibility(x/width,y/height);
        const rotation=age*(7+wind01*8)+index*2.3;
        drawSprite(sprites.leaves[index%sprites.leaves.length],x,y,leafWidth,leafHeight,alpha,rotation);
      }

      // Fireflies now have a sub-pixel core and a 2.5-3 px total halo.
      if(night>.15){
        for(let index=0;index<PARTICLE_TUNING.fireflyCount;index++){
          const originX=.32+.35*hash(index+73.2);
          const originY=.30+.38*hash(index+89.6);
          const x=(originX+Math.sin(elapsed*.44+index*1.8)*.035)*width;
          const y=(originY+Math.cos(elapsed*.36+index*2.4)*.026)*height;
          const pulse=.62+.18*Math.sin(elapsed*2.15+index*4.7);
          const halo=(2.5+hash(index+101.3)*.5)*sizeScale;
          const alpha=night*pulse*.58*effectStrength*labelVisibility(x/width,y/height);
          drawSprite(sprites.firefly,x,y,halo,halo,alpha);
        }
      }

      // Rare distant flocks use four hand-shaped wing frames, not procedural V marks.
      if(!activeFlock&&elapsed>=nextFlockAt)spawnFlock();
      const flock=activeFlock;
      if(flock){
        const progress=(elapsed-flock.start)/flock.duration;
        if(progress>=1){
          activeFlock=null;
          nextFlockAt=elapsed+25+hash(flockIndex*23.9)*35;
        }else{
          const route=BIRD_ROUTES[flock.route];
          const routeScale=flock.route===0?.78:1;
          const flockFade=smooth(0,.12,progress)*(1-smooth(.84,1,progress));
          flock.offsets.forEach((offset,index)=>{
            const birdProgress=clamp(progress-offset.back,-.08,1.04);
            const point=cubicPoint(route,birdProgress);
            const tangent=cubicTangent(route,birdProgress);
            const xNorm=point[0]-tangent[1]*offset.side;
            const yNorm=point[1]+tangent[0]*offset.side+Math.sin(elapsed*.7+index)*.0018;
            const x=xNorm*width;
            const y=yNorm*height;
            const frame=Math.floor((elapsed*5.4+offset.phase)%4);
            const birdWidth=(9.0+hash(index+flock.route*13.7)*3.0)*sizeScale*offset.scale*routeScale;
            const birdHeight=birdWidth*.62;
            const alpha=flockFade*(.68+night*.10)*effectStrength*labelVisibility(xNorm,yNorm);
            context.save();
            context.globalAlpha=clamp(alpha,0,1);
            context.translate(x,y);
            context.rotate(Math.atan2(tangent[1],tangent[0]));
            context.drawImage(sprites.birds,frame*36,0,36,24,-birdWidth*.5,-birdHeight*.5,birdWidth,birdHeight);
            context.restore();
          });
        }
      }
    };

    const tick=(now:number)=>{
      animationFrame=0;
      if(disposed||document.hidden||pausesForMotion())return;
      const frameInterval=1000/Math.max(1,PARTICLE_TUNING.fps);
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

      const next=normalizeMapShaderEnvironment(paramsRef.current.environment);
      if(smoothWindDirection<0){
        smoothWindDirection=next.windDirectionDeg;
        smoothWindSpeed=next.windSpeedKmh;
        smoothRain=next.rainIntensity;
        smoothDayMinutes=next.timeOfDayMinutes;
        smoothHumidity=next.humidityPercent;
      }else{
        const factor=Math.min(1,dt*3.5);
        const lightFactor=Math.min(1,dt*1.25);
        let directionDelta=(next.windDirectionDeg-smoothWindDirection)%360;
        if(directionDelta>180)directionDelta-=360;
        if(directionDelta<-180)directionDelta+=360;
        smoothWindDirection=(smoothWindDirection+directionDelta*factor+360)%360;
        smoothWindSpeed+=(next.windSpeedKmh-smoothWindSpeed)*factor;
        smoothRain+=(next.rainIntensity-smoothRain)*factor;
        let minuteDelta=next.timeOfDayMinutes-smoothDayMinutes;
        if(minuteDelta>720)minuteDelta-=1440;
        if(minuteDelta<-720)minuteDelta+=1440;
        smoothDayMinutes=(smoothDayMinutes+minuteDelta*lightFactor+1440)%1440;
        smoothHumidity+=(next.humidityPercent-smoothHumidity)*factor;
      }
      drawParticles();
      animationFrame=requestAnimationFrame(tick);
    };

    const resume=()=>{
      stop();
      if(disposed)return;
      drawParticles();
      lastFrame=performance.now();
      if(!document.hidden&&!pausesForMotion())animationFrame=requestAnimationFrame(tick);
    };
    const onResize=()=>{resize();drawParticles();};
    resize();
    if(typeof ResizeObserver!=='undefined'){
      resizeObserver=new ResizeObserver(onResize);
      resizeObserver.observe(canvas);
    }else{
      window.addEventListener('resize',onResize);
    }
    document.addEventListener('visibilitychange',resume);
    motion.addEventListener?.('change',resume);
    resume();

    return()=>{
      disposed=true;
      stop();
      resizeObserver?.disconnect();
      window.removeEventListener('resize',onResize);
      document.removeEventListener('visibilitychange',resume);
      motion.removeEventListener?.('change',resume);
    };
  },[enabled]);

  return enabled?(
    <canvas
      ref={canvasRef}
      data-map-effect="particles-v1"
      aria-hidden="true"
      style={{position:'absolute',inset:0,zIndex:4,width:'100%',height:'100%',pointerEvents:'none'}}
    />
  ):null;
}
