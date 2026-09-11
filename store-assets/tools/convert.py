from PIL import Image
import os

SPEC = {
    "screenshot-1.png": (1280, 800),
    "screenshot-2.png": (1280, 800),
    "screenshot-3.png": (1280, 800),
    "screenshot-4.png": (1280, 800),
    "screenshot-5.png": (1280, 800),
    "promo-small.png": (440, 280),
    "promo-marquee.png": (1400, 560),
}

ok = True
for name, (w, h) in SPEC.items():
    src = os.path.join("out", name)
    dst = os.path.join("final", name)
    im = Image.open(src)
    if im.size != (w, h):
        # composite onto opaque then resize would distort; just report
        print(f"!! {name} is {im.size}, expected {(w, h)}")
        ok = False
    # flatten any alpha onto white-free background: source is fully opaque art,
    # but composite explicitly so a stray transparent pixel can't go black.
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im.save(dst, "PNG", optimize=True)

for name, (w, h) in SPEC.items():
    p = os.path.join("final", name)
    im = Image.open(p)
    size_kb = os.path.getsize(p) / 1024
    status = "OK" if (im.size == (w, h) and im.mode == "RGB") else "FAIL"
    print(f"{status:4} {name:20} {im.size[0]}x{im.size[1]:<5} mode={im.mode} bits={im.bits if hasattr(im,'bits') else '-'} {size_kb:7.0f} KB")
    if status == "FAIL":
        ok = False

print("ALL GOOD" if ok else "PROBLEMS FOUND")
