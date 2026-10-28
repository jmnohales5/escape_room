# La Llave del Calabozo

Escape room medieval en pixel art para el navegador. HTML, CSS y JavaScript puros, sin dependencias.

**Jugar:** https://jmnohales5.github.io/escape_room/

## Cómo se juega

- Mueve al guerrero con las **flechas** o **WASD** (en móvil, con la cruceta en pantalla).
- Choca con las puertas para afrontar las pruebas:
  - **Puerta del acertijo**: responde bien o pierdes una vida.
  - **Portón de runas**: memoriza la secuencia y repítela (teclas 1-4 o clic).
- Esquiva los **esqueletos** y los **pinchos** que suben y bajan. Si te alcanzan, pierdes una vida y vuelves al último punto seguro.
- Encuentra la **llave** y abre la puerta de salida.
- **M** activa o silencia la música, **ESC** cierra una prueba sin penalización.

## Estructura

```
index.html         página principal
css/style.css      aspecto retro (marco de recreativa, scanlines)
js/audio.js        música y efectos chiptune con Web Audio (sin archivos de audio)
js/game.js         mapa, movimiento, pruebas y dibujo en canvas
assets/*.svg       sprites y tiles en SVG (pixel art)
assets/fonts/      Press Start 2P (licencia OFL, ver OFL.txt)
tools/make_assets.py  genera todos los SVG de assets/
```

Para regenerar los gráficos: `python3 tools/make_assets.py`.

Para probar en local: `python3 -m http.server 8000 --bind 127.0.0.1` y abrir `http://127.0.0.1:8000/`.
