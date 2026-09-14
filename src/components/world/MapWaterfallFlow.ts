import {
  MAIN_MAP_WATERFALL_IMPACTS,
  MAIN_MAP_WATERFALLS,
} from './MainMapGeometry';

export type WaterfallPoint = readonly [number, number];

export interface WaterfallDescriptor {
  id: string;
  points: readonly WaterfallPoint[];
  widthTop: number;
  widthBottom: number;
  seed: number;
}

export interface WaterfallImpact {
  center: WaterfallPoint;
  radius: WaterfallPoint;
  seed: number;
}

/**
 * Main-map waterfall spines. Geometry is isolated in MainMapGeometry.ts so a
 * future sector can provide its own calibration without rewriting the shader.
 */
export const MAP_WATERFALLS: readonly WaterfallDescriptor[] = MAIN_MAP_WATERFALLS;

/** Impact ellipses: center.xy and radius.xy, in map percentages. */
export const MAP_WATERFALL_IMPACTS: readonly WaterfallImpact[] = MAIN_MAP_WATERFALL_IMPACTS;

/**
 * Creates compact per-pixel waterfall metadata at runtime, so the package does
 * not need a fragile external flow-map asset.
 *
 * R = progress from lip to impact
 * G = curtain core weight (edge -> center)
 * B = stable turbulence seed per waterfall
 * A = coverage gated by the original map's water / white-water colors
 */
export function buildWaterfallFlowTexture(img: HTMLImageElement): HTMLCanvasElement {
  const scale=Math.min(1,1024/img.naturalWidth);
  const width=Math.max(1,Math.round(img.naturalWidth*scale));
  const height=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('2D canvas unavailable while building waterfall flow texture');

  const sourceCanvas=document.createElement('canvas');
  sourceCanvas.width=width;
  sourceCanvas.height=height;
  const sourceCtx=sourceCanvas.getContext('2d',{willReadFrequently:true});
  if(!sourceCtx)throw new Error('2D canvas unavailable while reading waterfall colors');
  sourceCtx.drawImage(img,0,0,width,height);
  const source=sourceCtx.getImageData(0,0,width,height).data;

  ctx.lineCap='round';
  ctx.lineJoin='round';
  const layers=[
    {core:28,widthScale:1},
    {core:138,widthScale:.72},
    {core:235,widthScale:.38},
  ] as const;

  for(const waterfall of MAP_WATERFALLS){
    const lengths:number[]=[];
    let totalLength=0;
    for(let index=1;index<waterfall.points.length;index++){
      const start=waterfall.points[index-1];
      const end=waterfall.points[index];
      const segmentLength=Math.hypot(
        (end[0]-start[0])*width/100,
        (end[1]-start[1])*height/100,
      );
      lengths.push(segmentLength);
      totalLength+=segmentLength;
    }

    let distance=0;
    for(let index=1;index<waterfall.points.length;index++){
      const start=waterfall.points[index-1];
      const end=waterfall.points[index];
      const segmentLength=lengths[index-1];
      const startProgress=totalLength?distance/totalLength:0;
      const endProgress=totalLength?(distance+segmentLength)/totalLength:1;
      const averageProgress=(startProgress+endProgress)*.5;
      const curtainWidth=waterfall.widthTop+(waterfall.widthBottom-waterfall.widthTop)*averageProgress;
      const sx=start[0]*width/100;
      const sy=start[1]*height/100;
      const ex=end[0]*width/100;
      const ey=end[1]*height/100;

      for(const layer of layers){
        const gradient=ctx.createLinearGradient(sx,sy,ex,ey);
        const startRed=Math.round(4+247*startProgress);
        const endRed=Math.round(4+247*endProgress);
        const blue=Math.round(255*waterfall.seed);
        gradient.addColorStop(0,`rgba(${startRed},${layer.core},${blue},1)`);
        gradient.addColorStop(1,`rgba(${endRed},${layer.core},${blue},1)`);
        ctx.strokeStyle=gradient;
        ctx.lineWidth=curtainWidth*width/100*layer.widthScale;
        ctx.beginPath();
        ctx.moveTo(sx,sy);
        ctx.lineTo(ex,ey);
        ctx.stroke();
      }
      distance+=segmentLength;
    }
  }

  const flowImage=ctx.getImageData(0,0,width,height);
  const data=flowImage.data;
  const smooth=(edge0:number,edge1:number,value:number)=>{
    const t=Math.max(0,Math.min(1,(value-edge0)/(edge1-edge0)));
    return t*t*(3-2*t);
  };
  for(let index=0;index<data.length;index+=4){
    if(!data[index+3])continue;
    const red=source[index]/255;
    const green=source[index+1]/255;
    const blue=source[index+2]/255;
    const maximum=Math.max(red,green,blue);
    const minimum=Math.min(red,green,blue);
    const cyan=smooth(.02,.12,Math.min(green-red,blue-red))*smooth(.13,.31,green);
    const pale=smooth(.40,.78,minimum)*(1-smooth(.11,.30,maximum-minimum));
    const blueWhite=smooth(.28,.58,blue)*smooth(-.02,.16,blue-red)*smooth(-.02,.14,green-red);
    const coverage=Math.max(cyan,pale*.94,blueWhite*.76);
    data[index+3]=Math.round(data[index+3]*coverage);
  }
  ctx.putImageData(flowImage,0,0);
  return canvas;
}
