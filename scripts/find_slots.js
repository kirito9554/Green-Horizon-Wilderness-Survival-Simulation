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
  
  const startX = Math.floor(w * 0.579);
  const endX = Math.floor(w * (0.579 + 0.272));
  const startY = Math.floor(h * 0.109);
  const endY = Math.floor(h * (0.109 + 0.864));
  
  const sec1 = 0.208;
  const sec2 = 0.175;
  const sec3 = 0.340;
  
  const invStartY = startY + Math.floor((endY - startY) * (sec1 + sec2));
  const invEndY = invStartY + Math.floor((endY - startY) * sec3);
  const invH = invEndY - invStartY;
  const invW = endX - startX;
  
  // We'll scan vertical columns and horizontal rows to find gaps (which are lighter borders).
  let ySums = [];
  for (let y = invStartY; y < invEndY; y++) {
    let sum = 0;
    for (let x = startX + 20; x < endX - 20; x++) {
      const [r, g, b] = getPixel(x, y);
      sum += r + g + b;
    }
    ySums.push({ y, sum });
  }
  
  // Find local minima of sum (darkest parts = inside slots)
  // Or local maxima (lightest parts = slot borders)
  // Actually, let's just print a mini ascii art of the sums!
  const minSum = Math.min(...ySums.map(s => s.sum));
  const maxSum = Math.max(...ySums.map(s => s.sum));
  
  console.log("Vertical profile:");
  for (let i = 0; i < ySums.length; i += 4) { // step by 4 to compress
    const { y, sum } = ySums[i];
    const val = Math.floor((sum - minSum) / (maxSum - minSum) * 20);
    console.log(`${y.toString().padStart(4, ' ')}: ` + '*'.repeat(val));
  }
}
run();
