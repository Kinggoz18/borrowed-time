/** Who made what we did not make. Shown in Settings > Credits and mirrored in docs/CREDITS.md. */
export interface Credit {
  use: string;
  title: string;
  artist: string;
  source: "Pixabay";
}

/** Track titles were not supplied with the files; they are listed by the order the owner gave them. */
export const CREDITS: readonly Credit[] = [
  { use: "Daytime music", title: "Music 1", artist: "Ribhav Agrawal", source: "Pixabay" },
  { use: "Night music", title: "Music 2", artist: "Bryan Jesus De Los Santos Breton", source: "Pixabay" },
];
