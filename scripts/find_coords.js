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
  
  // We want to find the middle column frame
  // App.tsx says: left-[57.9%] top-[10.9%] w-[27.2%] h-[86.4%]
  // Let's print the bounding box of the green "Manage Camp" button
  // The first box inside the middle column is the Camp box.
  
  const startX = Math.floor(w * 0.579);
  const endX = Math.floor(w * (0.579 + 0.272));
  const startY = Math.floor(h * 0.109);
  const endY = Math.floor(h * (0.109 + 0.864));
  
  // Camp box is h-[20.8%] of the middle column
  const campBoxH = Math.floor((endY - startY) * 0.208);
  const campBoxEndY = startY + campBoxH;
  
  // Let's sample colors in the camp box to find the green button!
  // It's horizontally centered maybe?
  console.log(`Middle column: x=${startX}..${endX}, y=${startY}..${endY}`);
  console.log(`Camp box: x=${startX}..${endX}, y=${startY}..${campBoxEndY}`);
  
  // Find a line of pixels vertically down the center of the camp box
  const centerX = Math.floor((startX + endX) / 2);
  let greenBtnTop = -1;
  let greenBtnBottom = -1;
  for (let y = startY; y < campBoxEndY; y++) {
    const [r, g, b] = getPixel(centerX, y);
    // Green button is likely to have G > R and G > B by a decent margin
    // And it's noticeably bright
    if (g > r + 15 && g > b + 15 && g > 60) {
      if (greenBtnTop === -1) greenBtnTop = y;
      greenBtnBottom = y;
    }
  }
  
  console.log(`Green button vertical (center): top=${greenBtnTop}, bottom=${greenBtnBottom}`);
  
  // Find horizontal span of green button at (greenBtnTop + greenBtnBottom) / 2
  const btnCenterY = Math.floor((greenBtnTop + greenBtnBottom) / 2);
  let greenBtnLeft = -1;
  let greenBtnRight = -1;
  for (let x = startX; x < endX; x++) {
    const [r, g, b] = getPixel(x, btnCenterY);
    if (g > r + 10 && g > b + 10 && g > 40) {
      if (greenBtnLeft === -1) greenBtnLeft = x;
      greenBtnRight = x;
    }
  }
  
  console.log(`Green button horizontal: left=${greenBtnLeft}, right=${greenBtnRight}`);
  
  // Convert to percentages within the Camp box
  const relLeft = (greenBtnLeft - startX) / (endX - startX);
  const relTop = (greenBtnTop - startY) / campBoxH;
  const relWidth = (greenBtnRight - greenBtnLeft) / (endX - startX);
  const relHeight = (greenBtnBottom - greenBtnTop) / campBoxH;
  
  console.log(`Camp box button CSS: left-[${(relLeft*100).toFixed(1)}%] top-[${(relTop*100).toFixed(1)}%] w-[${(relWidth*100).toFixed(1)}%] h-[${(relHeight*100).toFixed(1)}%]`);
  
  // Let's do the same for the "Unload Inventory" button, just below the green one.
  let darkBtnTop = -1;
  let darkBtnBottom = -1;
  for (let y = greenBtnBottom + 5; y < campBoxEndY; y++) {
    const [r, g, b] = getPixel(centerX, y);
    // Dark button is somewhat dark, maybe bluish/brownish. We can just look for the button border or background.
    // Actually, maybe we can just scan for "non-background" color.
    // Let's sample a background color
    const [br, bg, bb] = getPixel(centerX, campBoxEndY - 5); 
    // Just find something that diverges from background
    if (Math.abs(r - br) > 10 || Math.abs(g - bg) > 10 || Math.abs(b - bb) > 10) {
      if (darkBtnTop === -1) darkBtnTop = y;
      darkBtnBottom = y;
    }
  }
  console.log(`Dark button vertical (center): top=${darkBtnTop}, bottom=${darkBtnBottom}`);
  
  // Find horizontal span
  const darkBtnCenterY = Math.floor((darkBtnTop + darkBtnBottom) / 2);
  let darkBtnLeft = -1;
  let darkBtnRight = -1;
  for (let x = startX; x < endX; x++) {
    const [r, g, b] = getPixel(x, darkBtnCenterY);
    const [br, bg, bb] = getPixel(startX + 10, darkBtnCenterY); // bg at left edge
    if (Math.abs(r - br) > 10 || Math.abs(g - bg) > 10 || Math.abs(b - bb) > 10) {
      if (darkBtnLeft === -1) darkBtnLeft = x;
      darkBtnRight = x;
    }
  }
  console.log(`Dark button horizontal: left=${darkBtnLeft}, right=${darkBtnRight}`);
  
  const relDarkLeft = (darkBtnLeft - startX) / (endX - startX);
  const relDarkTop = (darkBtnTop - startY) / campBoxH;
  const relDarkWidth = (darkBtnRight - darkBtnLeft) / (endX - startX);
  const relDarkHeight = (darkBtnBottom - darkBtnTop) / campBoxH;
  
  console.log(`Dark button CSS: left-[${(relDarkLeft*100).toFixed(1)}%] top-[${(relDarkTop*100).toFixed(1)}%] w-[${(relDarkWidth*100).toFixed(1)}%] h-[${(relDarkHeight*100).toFixed(1)}%]`);

}
run();
