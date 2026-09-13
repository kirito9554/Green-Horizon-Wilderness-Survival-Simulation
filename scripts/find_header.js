import { createCanvas, loadImage } from 'canvas';

async function run() {
  const img = await loadImage('public/UI-BG.png');
  const w = img.width;
  const h = img.height;
  
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  function getPixel(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return [0,0,0,0];
    const idx = (y * w + x) * 4;
    return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
  }
  
  // Header is h-[9.6%] of full image.
  // 992 * 0.096 = 95
  // The header section is full width (1586), y from 0 to 95.
  // We want to find the icons!
  // It has 9 icons.
  // We can just scan horizontally across the middle of the header.
  
  let xSums = [];
  for (let x = 320; x < 1200; x++) { // The middle area where resources are
    let sum = 0;
    for (let y = 30; y < 65; y++) { // Middle height of header
      const [r, g, b] = getPixel(x, y);
      sum += r + g + b;
    }
    xSums.push({ x, sum });
  }
  
  const minSum = Math.min(...xSums.map(s => s.sum));
  const maxSum = Math.max(...xSums.map(s => s.sum));
  
  console.log("Horizontal profile of Header:");
  for (let i = 0; i < xSums.length; i += 8) { 
    const { x, sum } = xSums[i];
    const val = Math.floor((sum - minSum) / (maxSum - minSum) * 20);
    console.log(`${x.toString().padStart(4, ' ')}: ` + '*'.repeat(val));
  }
}
run();
