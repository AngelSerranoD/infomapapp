"""Genera los iconos de InfoMap a partir de la paleta Ocean.

    python tool/make_icons.py

El dibujo es un mapa plegado de cuatro paneles con una carretera de puntos y la
chincheta encima, en linea. Se dibuja todo a 4x y se reduce con LANCZOS para que
los bordes salgan limpios.

Los cuatro colores de la paleta son 345DA7 / 3B8AC4 / 4BB4DE / EFDBCB; el azul
marino del fondo sale del propio muestrario.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

INK_TOP = (34, 53, 75)      # #22354B
INK_BOTTOM = (22, 41, 61)   # #16293D
SKY = (75, 180, 222)        # #4BB4DE
BLUE = (59, 138, 196)       # #3B8AC4
SAND = (239, 219, 203)      # #EFDBCB

SS = 4        # supersampling
UNIT = 512.0  # sistema de coordenadas del dibujo


def gradient(size: int) -> Image.Image:
    """Fondo azul marino con degradado vertical."""
    image = Image.new("RGB", (1, size), INK_TOP)
    pixels = image.load()
    for y in range(size):
        t = y / max(1, size - 1)
        pixels[0, y] = tuple(
            round(INK_TOP[i] + (INK_BOTTOM[i] - INK_TOP[i]) * t) for i in range(3)
        )
    return image.resize((size, size), Image.NEAREST)


def dashed(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    dash: float,
    gap: float,
    fill: tuple[int, int, int],
    width: int,
) -> None:
    """Recorre la polilinea repartiendo trazos y huecos de longitud constante."""
    drawing = True
    left = dash
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        length = math.hypot(x2 - x1, y2 - y1)
        travelled = 0.0
        while travelled < length:
            step = min(left, length - travelled)
            ta = travelled / length
            tb = (travelled + step) / length
            if drawing:
                draw.line(
                    [
                        (x1 + (x2 - x1) * ta, y1 + (y2 - y1) * ta),
                        (x1 + (x2 - x1) * tb, y1 + (y2 - y1) * tb),
                    ],
                    fill=fill,
                    width=width,
                )
            travelled += step
            left -= step
            if left <= 0.001:
                drawing = not drawing
                left = dash if drawing else gap


def draw_art(size: int, inset: float) -> Image.Image:
    """Mapa plegado + chincheta. `inset` deja margen para los iconos maskable."""
    s = size * SS
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    scale = (s / UNIT) * (1.0 - inset)
    mid = s / 2

    def px(x: float, y: float) -> tuple[float, float]:
        """Coordenada del dibujo (512x512) a pixeles, escalando desde el centro."""
        return (mid + (x - UNIT / 2) * scale, mid + (y - UNIT / 2) * scale)

    def w(value: float) -> int:
        return max(1, round(value * scale))

    # --- Mapa plegado: cuatro paneles, arriba y abajo en zigzag ---
    folds = [88.0, 172.0, 256.0, 340.0, 424.0]
    high, low = 190.0, 248.0
    depth = 174.0
    tops = [high if i % 2 == 0 else low for i in range(len(folds))]

    outline = (
        [px(x, y) for x, y in zip(folds, tops)]
        + [px(folds[-1], tops[-1] + depth)]
        + [px(x, y + depth) for x, y in zip(reversed(folds[:-1]), reversed(tops[:-1]))]
        + [px(folds[0], tops[0])]
    )
    draw.line(outline, fill=SKY + (255,), width=w(15), joint="curve")
    # PIL solo redondea las esquinas interiores: la de cierre hay que taparla.
    corner = px(folds[0], tops[0])
    cap = w(15) / 2
    draw.ellipse(
        [corner[0] - cap, corner[1] - cap, corner[0] + cap, corner[1] + cap],
        fill=SKY + (255,),
    )

    for x, top in zip(folds[1:-1], tops[1:-1]):
        draw.line([px(x, top), px(x, top + depth)], fill=SKY + (255,), width=w(15))

    # --- Carretera de puntos cruzando el mapa ---
    road = [(102, 322), (176, 348), (256, 300), (338, 352), (410, 324)]
    dashed(
        draw,
        [px(x, y) for x, y in road],
        dash=26 * scale,
        gap=22 * scale,
        fill=BLUE + (255,),
        width=w(13),
    )

    # --- Chincheta ---
    cx, cy, radius, tip_y = 256.0, 164.0, 68.0, 306.0
    distance = tip_y - cy
    phi = math.acos(radius / distance)
    contact = (
        cx - radius * math.sin(phi),
        cx + radius * math.sin(phi),
        cy + radius * math.cos(phi),
    )

    # Primero se tapa el mapa que queda debajo, para que la chincheta no se cruce.
    draw.polygon(
        [px(contact[0], contact[2]), px(contact[1], contact[2]), px(cx, tip_y)],
        fill=INK_BOTTOM + (255,),
    )
    head_box = [px(cx - radius, cy - radius), px(cx + radius, cy + radius)]
    draw.ellipse([head_box[0], head_box[1]], fill=INK_BOTTOM + (255,))

    stroke = w(17)
    # El arco va del punto de tangencia izquierdo al derecho por arriba, dejando
    # que los dos lados rectos bajen hasta la punta.
    start = math.degrees(math.atan2(math.cos(phi), -math.sin(phi)))
    end = math.degrees(math.atan2(math.cos(phi), math.sin(phi)))
    draw.arc([head_box[0], head_box[1]], start=start, end=end, fill=SAND + (255,), width=stroke)
    draw.line(
        [px(contact[0], contact[2]), px(cx, tip_y), px(contact[1], contact[2])],
        fill=SAND + (255,),
        width=stroke,
        joint="curve",
    )

    inner = 30.0
    draw.ellipse(
        [px(cx - inner, cy - inner), px(cx + inner, cy + inner)],
        outline=SAND + (255,),
        width=w(14),
    )

    return canvas.resize((size, size), Image.LANCZOS)


def build(size: int, inset: float = 0.0) -> Image.Image:
    base = gradient(size).convert("RGBA")
    base.alpha_composite(draw_art(size, inset))
    return base.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build(192).save(OUT / "icon-192.png")
    build(512).save(OUT / "icon-512.png")
    # Los iconos maskable se recortan en circulo: todo dentro del 80% central.
    build(512, inset=0.22).save(OUT / "icon-maskable-512.png")
    build(180).save(OUT / "apple-touch-icon.png")
    build(32).save(OUT / "favicon-32.png")
    print(f"Iconos escritos en {OUT}")


if __name__ == "__main__":
    main()
