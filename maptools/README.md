# Map tools

These scripts drew the sample map pictures in `maps/`. They paint top-down battlemaps from a terrain grid with
lighting that walls block, and never bake in grid lines (the site draws those).

- `layouts.py` has the terrain grids (the same letters as `js/maps.js`).
- `mapkit.py` is the drawing kit: flagstones, walls, water, stairs, rubble, pillars, sarcophagi, braziers, lighting.
- `render.py` draws Stone Hall and the Barrow. Its light sources are the ones `js/maps.js` uses for the Barrow's
  gameplay lighting, so keep the two in step when a map changes.

```
pip install numpy pillow scipy
cd maptools
python3 render.py ../maps /tmp both
```

The first argument is where the `.webp` pictures go, the second where grid previews go, and the third is
`stone-hall-2`, `barrow` or `both`. At 64 pixels per 5 ft square, a map's picture is `cols × 64` by `rows × 64`.
When you redraw a map, raise its `rev` in `js/maps.js` so tokens saved on the old version go back to the start.
