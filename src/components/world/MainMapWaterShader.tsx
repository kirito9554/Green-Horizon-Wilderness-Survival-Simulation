import React, { useEffect, useRef } from 'react';
import {
  MAIN_MAP_LABEL_EXCLUSIONS,
  MAIN_MAP_POOL_KINDS,
  MAIN_MAP_POOLS,
  MAIN_MAP_STREAMS,
  MAIN_MAP_WATERFALL_IMPACTS,
} from './MainMapGeometry';
import { buildWaterfallFlowTexture } from './MapWaterfallFlow';
import {
  normalizeMapShaderEnvironment,
  type MapShaderEnvironment,
} from './MapShaderEnvironment';

export const MAIN_MAP_WATER_TUNING = {
  strength: 0.92,
  riverStrength: 0.66,
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
uniform float uRainIntensity;
uniform float uWindSpeed;
uniform float uWindDirection;
uniform float uCloudCover;
uniform vec4 uImpact0;
uniform vec4 uImpact1;
uniform vec4 uImpact2;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){return noise(p)*.56+noise(p*2.03+7.1)*.29+noise(p*4.07-5.4)*.15;}
float impactFoam(vec2 uv,vec4 impact,float time){
  vec2 q=(uv-impact.xy)/max(impact.zw,vec2(.0001));
  float d=length(q*vec2(1.0,1.18));
  if(d>1.35)return 0.;
  float boil=fbm(q*vec2(5.5,8.0)+vec2(time*.22,-time*1.1));
  float vein=fbm(q*vec2(10.,5.)+vec2(-time*.7,time*.18));
  float froth=smoothstep(.43,.73,boil*.62+vein*.38);
  return froth*exp(-d*d*2.6);
}

void main(){
  vec4 maskData=texture2D(uMask,vUv);
  vec4 fallData=texture2D(uFallData,vUv);
  float coverage=maskData.a;
  float fall=step(.012,fallData.a);
  if(coverage<.004 && fall<.5){gl_FragColor=vec4(0.);return;}

  float kind=maskData.b;
  float river=step(.82,kind)*(1.-fall);
  float ocean=step(.38,kind)*(1.-step(.82,kind))*(1.-fall);
  float lake=step(.12,kind)*(1.-step(.38,kind))*(1.-fall);
  vec2 flow=maskData.rg*2.-1.;
  if(length(flow)<.05)flow=vec2(0.,1.);
  flow=normalize(flow);
  vec2 crossFlow=vec2(-flow.y,flow.x);

  vec2 view=max(uViewSize,vec2(1.));
  vec2 pixel=vUv*view;
  float wind01=clamp(uWindSpeed/75.,0.,1.);
  float windRad=radians(uWindDirection);
  vec2 windDir=normalize(vec2(sin(windRad),-cos(windRad))+vec2(.0001));
  vec2 windCross=vec2(-windDir.y,windDir.x);
  vec2 centered=pixel-view*.5;
  float windAlong=dot(centered,windDir);
  float windAcross=dot(centered,windCross);

  float oceanPhase=windAlong*.027-uTime*1.38+sin(windAcross*.017)*1.25;
  float oceanCross=windAcross*.052+uTime*1.12+sin(windAlong*.019)*.95;
  vec2 oceanPx=(windCross*sin(oceanPhase)*2.25+windDir*cos(oceanCross)*1.45)*mix(.8,1.9,wind01);

  float lakePhase=windAlong*.039-uTime*.92+sin(windAcross*.024)*.75;
  float lakeCross=windAcross*.051+uTime*.78+sin(windAlong*.016)*.62;
  vec2 lakePx=(windCross*sin(lakePhase)*1.15+windDir*cos(lakeCross)*.75)*mix(.65,1.35,wind01);

  float along=dot(pixel,flow);
  float across=dot(pixel,crossFlow);
  float riverNoise=fbm(vec2(across*.075,along*.035-uTime*.92));
  float riverWave=sin(along*.092-uTime*2.0+sin(across*.12)*.8);
  float riverCross=sin(across*.19+along*.028-uTime*1.25);
  vec2 riverPx=(
    crossFlow*((riverNoise-.5)*1.65+riverCross*.48)+
    flow*(riverWave*.36+(riverNoise-.5)*.52)
  )*uRiverStrength*2.05;

  float fallProgress=clamp(fallData.r,0.,1.);
  float fallCore=fallData.g;
  vec2 fallPx=vec2(
    sin(pixel.y*.14+uTime*3.0+fallData.b*8.)*.55,
    1.4+fallProgress*2.7
  )*fall;

  vec2 offsetPx=oceanPx*ocean+lakePx*lake+riverPx*river+fallPx;
  vec2 sampleUv=clamp(vUv+offsetPx/view,vec2(.001),vec2(.999));
  vec3 base=texture2D(uImage,vUv).rgb;
  vec3 refracted=texture2D(uImage,sampleUv).rgb;

  float rain=clamp(uRainIntensity,0.,1.);
  float clouds=clamp(uCloudCover,0.,1.);
  float shimmerOcean=(sin(oceanPhase*1.55)*.5+.5)*ocean;
  float shimmerLake=(sin(lakePhase*1.8)*.5+.5)*lake;
  float riverGlint=smoothstep(.62,.88,riverNoise)*river;
  float surfaceLight=(shimmerOcean*.065+shimmerLake*.038+riverGlint*.052)*(1.-clouds*.55);

  float whiteWater=fall*(.28+.72*smoothstep(.28,.78,fbm(vec2(pixel.x*.09,pixel.y*.12-uTime*2.7))));
  float foam=max(
    impactFoam(vUv,uImpact0,uTime),
    max(impactFoam(vUv,uImpact1,uTime+2.7),impactFoam(vUv,uImpact2,uTime+5.1))
  );

  vec3 color=mix(base,refracted,.74);
  color+=vec3(.58,.82,.96)*surfaceLight*uStrength;
  color=mix(color,vec3(.88,.95,.98),whiteWater*.46*uStrength);
  color=mix(color,vec3(.91,.97,1.),foam*.48*uStrength);
  color*=1.-rain*.035;

  float typeAlpha=lake*.60+ocean*.66+river*.71+fall*.84;
  float alpha=max(coverage,typeAlpha*coverage);
  alpha=max(alpha,fallData.a*.90);
  alpha=clamp(alpha*uStrength,0.,.88);
  gl_FragColor=vec4(clamp(color,0.,1.),alpha);
}`;

function buildMainMapMask(img: HTMLImageElement): HTMLCanvasElement {
  const scale=Math.min(1,1024/img.naturalWidth);
  const w=Math.max(1,Math.round(img.naturalWidth*scale));
  const h=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=w;
  canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('2D canvas unavailable while building main-map water mask');

  const sourceCanvas=document.createElement('canvas');
  sourceCanvas.width=w;
  sourceCanvas.height=h;
  const sourceCtx=sourceCanvas.getContext('2d',{willReadFrequently:true});
  if(!sourceCtx)throw new Error('2D canvas unavailable while reading main-map water colors');
  sourceCtx.drawImage(img,0,0,w,h);
  const source=sourceCtx.getImageData(0,0,w,h).data;

  ctx.clearRect(0,0,w,h);

  MAIN_MAP_POOLS.forEach((poly,index)=>{
    const kind=MAIN_MAP_POOL_KINDS[index]??'lake';
    const blue=kind==='ocean'?128:64;
    ctx.fillStyle=`rgb(128,128,${blue})`;
    ctx.beginPath();
    poly.forEach(([x,y],i)=>{
      const px=x*w/100,py=y*h/100;
      if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
    });
    ctx.closePath();
    ctx.fill();
  });

  ctx.lineCap='round';
  ctx.lineJoin='round';
  for(const stream of MAIN_MAP_STREAMS){
    for(let i=1;i<stream.points.length;i++){
      const a=stream.points[i-1],b=stream.points[i];
      const dx=(b[0]-a[0])*w;
      const dy=(b[1]-a[1])*h;
      const len=Math.hypot(dx,dy)||1;
      const r=Math.round(127.5+127.5*dx/len);
      const g=Math.round(127.5+127.5*dy/len);
      ctx.strokeStyle=`rgb(${r},${g},255)`;
      ctx.lineWidth=stream.width*w/100;
      ctx.beginPath();
      ctx.moveTo(a[0]*w/100,a[1]*h/100);
      ctx.lineTo(b[0]*w/100,b[1]*h/100);
      ctx.stroke();
    }
  }

  const imageData=ctx.getImageData(0,0,w,h);
  const data=imageData.data;
  const smooth=(a:number,b:number,v:number)=>{
    const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
    return t*t*(3-2*t);
  };

  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const r=source[i]/255,g=source[i+1]/255,b=source[i+2]/255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    const cyanLead=Math.min(g-r,b-r);
    const cyan=smooth(.018,.115,cyanLead)*smooth(.12,.30,g);
    const blueWater=smooth(.24,.52,b)*smooth(-.04,.13,b-r)*smooth(-.05,.11,g-r);
    const pale=smooth(.46,.78,min)*(1-smooth(.13,.32,max-min));
    const coverage=Math.max(cyan,blueWater*.86,pale*.32);
    data[i+3]=Math.round(data[i+3]*coverage);
  }
  ctx.putImageData(imageData,0,0);

  for(const label of MAIN_MAP_LABEL_EXCLUSIONS){
    ctx.clearRect(label.x*w/100,label.y*h/100,label.w*w/100,label.h*h/100);
  }

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
  enabled=true,
  strength=MAIN_MAP_WATER_TUNING.strength,
  riverStrength=MAIN_MAP_WATER_TUNING.riverStrength,
  speed=MAIN_MAP_WATER_TUNING.speed,
  environment,
}:MainMapWaterShaderProps){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const paramsRef=useRef({strength,riverStrength,speed,environment});
  paramsRef.current={strength,riverStrength,speed,environment};

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||!enabled)return;

    let disposed=false;
    let raf=0;
    let gl:WebGLRenderingContext|null=null;
    let program:WebGLProgram|null=null;
    let buffer:WebGLBuffer|null=null;
    const textures:WebGLTexture[]=[];
    const shaders:WebGLShader[]=[];
    let observer:ResizeObserver|null=null;
    let ready=false;
    let elapsed=0;
    let last=0;

    const image=new Image();
    image.crossOrigin='anonymous';

    const compile=(type:number,source:string)=>{
      const shader=gl!.createShader(type);
      if(!shader)throw new Error('Unable to allocate WebGL shader');
      gl!.shaderSource(shader,source);
      gl!.compileShader(shader);
      if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS)){
        throw new Error(gl!.getShaderInfoLog(shader)||'Shader compilation failed');
      }
      shaders.push(shader);
      return shader;
    };

    const textureFrom=(source:TexImageSource,unit:number)=>{
      const texture=gl!.createTexture();
      if(!texture)throw new Error('Unable to allocate WebGL texture');
      textures.push(texture);
      gl!.activeTexture(gl!.TEXTURE0+unit);
      gl!.bindTexture(gl!.TEXTURE_2D,texture);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL,0);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_S,gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_T,gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MIN_FILTER,gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MAG_FILTER,gl!.LINEAR);
      gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,gl!.RGBA,gl!.UNSIGNED_BYTE,source);
      return texture;
    };

    const resize=()=>{
      if(!gl||!program)return;
      const rect=canvas.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      const scale=Math.min(
        window.devicePixelRatio||1,
        MAIN_MAP_WATER_TUNING.maxDpr,
        MAIN_MAP_WATER_TUNING.maxCanvasSide/Math.max(rect.width,rect.height,1),
      );
      const w=Math.max(1,Math.round(rect.width*scale));
      const h=Math.max(1,Math.round(rect.height*scale));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);
      gl.uniform2f(gl.getUniformLocation(program,'uViewSize'),Math.max(1,rect.width),Math.max(1,rect.height));
    };

    const draw=(now:number)=>{
      raf=0;
      if(disposed||!ready||!gl||!program||document.hidden)return;
      const frameMs=1000/MAIN_MAP_WATER_TUNING.fps;
      if(!last)last=now-frameMs;
      const delta=now-last;
      if(delta<frameMs-.5){raf=requestAnimationFrame(draw);return;}
      last=now-(delta%frameMs);
      elapsed+=Math.min(delta,100)*.001*Math.max(0,paramsRef.current.speed);

      const env=normalizeMapShaderEnvironment(paramsRef.current.environment);
      gl.useProgram(program);
      gl.uniform1f(gl.getUniformLocation(program,'uTime'),elapsed);
      gl.uniform1f(gl.getUniformLocation(program,'uStrength'),paramsRef.current.strength);
      gl.uniform1f(gl.getUniformLocation(program,'uRiverStrength'),paramsRef.current.riverStrength);
      gl.uniform1f(gl.getUniformLocation(program,'uRainIntensity'),env.rainIntensity);
      gl.uniform1f(gl.getUniformLocation(program,'uCloudCover'),env.cloudCover);
      gl.uniform1f(gl.getUniformLocation(program,'uWindSpeed'),env.windSpeedKmh);
      gl.uniform1f(gl.getUniformLocation(program,'uWindDirection'),env.windDirectionDeg);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      raf=requestAnimationFrame(draw);
    };

    image.onload=()=>{
      if(disposed)return;
      try{
        gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
        if(!gl)throw new Error('WebGL unavailable');
        const vs=compile(gl.VERTEX_SHADER,VERTEX);
        const fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);
        program=gl.createProgram();
        if(!program)throw new Error('Unable to allocate WebGL program');
        gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Program link failed');
        gl.useProgram(program);

        buffer=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
        const position=gl.getAttribLocation(program,'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);

        textureFrom(image,0);
        textureFrom(buildMainMapMask(image),1);
        textureFrom(buildWaterfallFlowTexture(image),2);
        gl.uniform1i(gl.getUniformLocation(program,'uImage'),0);
        gl.uniform1i(gl.getUniformLocation(program,'uMask'),1);
        gl.uniform1i(gl.getUniformLocation(program,'uFallData'),2);

        const impacts=MAIN_MAP_WATERFALL_IMPACTS;
        ['uImpact0','uImpact1','uImpact2'].forEach((name,index)=>{
          const impact=impacts[index]??{center:[-10,-10] as const,radius:[.01,.01] as const,seed:0};
          gl!.uniform4f(
            gl!.getUniformLocation(program!,name),
            impact.center[0]/100,impact.center[1]/100,
            impact.radius[0]/100,impact.radius[1]/100,
          );
        });

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        observer=new ResizeObserver(resize);
        observer.observe(canvas);
        resize();
        ready=true;
        canvas.style.visibility='visible';
        raf=requestAnimationFrame(draw);
      }catch(error){
        console.warn('[MainMapWaterShader] Static map fallback:',error);
        canvas.style.visibility='hidden';
      }
    };
    image.onerror=()=>{canvas.style.visibility='hidden';};
    image.src=src;

    const visibility=()=>{
      if(!document.hidden&&ready&&!raf)raf=requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange',visibility);

    return()=>{
      disposed=true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener('visibilitychange',visibility);
      if(gl){textures.forEach(t=>gl!.deleteTexture(t));shaders.forEach(s=>gl!.deleteShader(s));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
    };
  },[src,enabled]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[3]" aria-hidden="true" />;
}
