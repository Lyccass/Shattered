# Terrain Transition Rules

Shattered is grid-first internally. `WorldGrid` stores terrain families such as `grass`, `dirt`, `stone`, `water`, and the current legacy `sand` beach family. It does not store exact sprite variants like `grass7`.

`TerrainResolver` converts a terrain family plus tile coordinates into a visual tile definition. The same grid coordinate and terrain family always resolve to the same sprite variant, so the map does not reshuffle when chunks redraw.

The resolver returns a base tile plus transition overlay metadata. Base tiles are selected by deterministic weighted variants. Transition overlays are detected from neighbouring families and can be rendered as real art later.

Full tiles have matching edge tags on all sides. For example, a full grass tile has `grass` on `xPlus`, `xMinus`, `yPlus`, and `yMinus`.

Transition tiles will later use mixed edge tags, such as `grass_dirt`, so the resolver can choose a proper edge or corner piece when neighbouring families differ.

`xPlus`, `xMinus`, `yPlus`, and `yMinus` are isometric grid axes. They are not screen-left, screen-right, screen-top, or screen-bottom directions.

Diagonal corners use `xPlusYPlus`, `xPlusYMinus`, `xMinusYPlus`, and `xMinusYMinus`. These are also grid-native directions.

Out-of-bounds terrain neighbours resolve as `water`, which makes island edges behave like shorelines instead of empty void.

Outer corners happen when two adjacent edge neighbours differ from the current tile. Inner corners happen when the diagonal differs but the two adjacent edge neighbours still match the current tile.

Shoreline transitions have higher priority than ordinary grass/dirt/stone transitions. If a tile touches water and dirt, water wins because coastline readability matters more than inland blending.

Flipping is opt-in per tile definition. Decorative grass variants can allow `flipX` or `flipY`; strong-lit dirt and stone tiles should usually not flip unless they are authored for it.

When transition tiles support flipping later, the edge tags must transform with the sprite. A flipped transition cannot keep the same edge metadata if the visual edge changed sides.

Missing transition art must not break the game. Until transition sprites exist, the renderer keeps normal base tiles and can show debug transition lines/dots in build grid mode.

The current spritesheet is useful for full/decorated terrain, but it is not a complete seamless autotile set yet. Smooth terrain edges and corners will need explicit transition art.

Slope definitions exist as placeholders only. Future hills, cliffs, and slopes should add an elevation/height layer to `WorldGrid` instead of hiding height inside terrain family names.
