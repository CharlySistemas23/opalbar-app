"""Generate icon.png (1024x1024) + adaptive-icon.png (1024x1024 w/ safe padding)
+ splash.png (2048x2048 logo on black) from the source cocktail logo."""
from PIL import Image
from pathlib import Path

SRC = Path("apps/mobile/assets/ICONOS/ICONO OPAL.jpeg")
OUT = Path("apps/mobile/assets")

BG = (13, 13, 15, 255)

def square_crop(img):
    w, h = img.size
    s = min(w, h)
    return img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))

def make_icon():
    img = Image.open(SRC).convert("RGBA")
    img = square_crop(img).resize((1024, 1024), Image.LANCZOS)
    bg = Image.new("RGBA", (1024, 1024), BG)
    bg.paste(img, (0, 0), img)
    bg.convert("RGB").save(OUT / "icon.png", optimize=True)
    print("wrote icon.png")

def make_adaptive():
    # Android adaptive icons crop ~33% from each edge. Put logo on transparent
    # bg scaled to ~66% so it survives the mask.
    img = Image.open(SRC).convert("RGBA")
    img = square_crop(img)
    inner = 680  # ~66% of 1024
    img = img.resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    off = (1024 - inner) // 2
    canvas.paste(img, (off, off), img)
    canvas.save(OUT / "adaptive-icon.png", optimize=True)
    print("wrote adaptive-icon.png")

def make_splash():
    img = Image.open(SRC).convert("RGBA")
    img = square_crop(img).resize((900, 900), Image.LANCZOS)
    canvas = Image.new("RGBA", (2048, 2048), BG)
    off = (2048 - 900) // 2
    canvas.paste(img, (off, off), img)
    canvas.convert("RGB").save(OUT / "splash.png", optimize=True)
    print("wrote splash.png")

if __name__ == "__main__":
    make_icon()
    make_adaptive()
    make_splash()
