import { Assets, Spritesheet, Texture } from "pixi.js";

export interface LoadedAtlases {
  textures: Map<string, Texture>;
  grain: Texture;
  sheets: Spritesheet[];
}

/** Loads the stand-in atlas set for a tier (public/standin/<folder>/). */
export async function loadAtlases(folder: "high" | "low"): Promise<LoadedAtlases> {
  const base = `${import.meta.env.BASE_URL}standin/${folder}/`;
  const index = (await (await fetch(`${base}index.json`)).json()) as { atlases: Record<string, string[]>; grain: string };
  const files = Object.values(index.atlases).flat();
  const sheets = (await Promise.all(files.map((f) => Assets.load<Spritesheet>(`${base}${f}`)))) as Spritesheet[];
  const textures = new Map<string, Texture>();
  for (const sheet of sheets) {
    const meta = sheet.data.meta as { mipmaps?: boolean };
    if (meta.mipmaps) {
      // Mipmaps only where zoom needs them (terrain and buildings).
      sheet.textureSource.autoGenerateMipmaps = true;
      sheet.textureSource.style.mipmapFilter = "linear";
      sheet.textureSource.updateMipmaps();
    }
    for (const [name, tex] of Object.entries(sheet.textures)) textures.set(name, tex);
  }
  const grain = await Assets.load<Texture>(`${base}${index.grain}`);
  grain.source.style.addressMode = "repeat";
  return { textures, grain, sheets };
}
