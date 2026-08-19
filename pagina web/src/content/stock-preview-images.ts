// TEMPORARY preview-only content — not part of the real Home v1 design.
// Free-tier Unsplash photos used purely to preview how the page looks with
// real photography instead of MediaCard placeholders. None of these are
// Elefitness's own photos; swap them for real assets before this ever
// ships (see pagina web/CLAUDE.md 9 and 37).

function unsplash(id: string, width: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
}

export const stockPreviewImages = {
  gymAction: (width: number) => unsplash("photo-1556817411-92f5ec899a55", width),
  yogaStudio: (width: number) => unsplash("photo-1761035190790-aa1a3472f7fc", width),
  groupFitness: (width: number) => unsplash("photo-1658314755811-73c806249f31", width),
  gymInterior: (width: number) => unsplash("photo-1758957646695-ec8bce3df462", width),
  womanPortrait: (width: number) => unsplash("photo-1663550910669-e338f90daf02", width),
  manPortrait: (width: number) => unsplash("photo-1551043415-175e1af5dbdd", width),
};
