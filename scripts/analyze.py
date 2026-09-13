from PIL import Image
img = Image.open('public/UI-BG.png')
w, h = img.size
print(f"Image size: {w}x{h}")
