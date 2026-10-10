/**
 * Ada's voice. Every entry kind has at least three variants, picked by (seed + seq) so one save
 * always reads the same. Written to the UX spec's guidelines: "we" for the colony, third person for
 * everyone else, one concrete image, no "you", no exclamation marks, no engine words, under 240
 * characters. Tokens in braces are filled from real game data.
 */
export type Vars = Record<string, string | number>;

export const VOICE: Record<string, readonly string[]> = {
  // raid, held (token: {boat})
  held: [
    "They wanted the hours. Tobias sat on the wall and would not be moved, and the skiffs turned for home.",
    "The lamps were lit before the oars came close. Nell counted the boats going back and got the same number twice.",
    "Nobody slept, and nobody was hurt. By morning there was rope on the beach that was not ours.",
  ],
  // raid, held by a hair
  nearMiss: [
    "It was nearer than anyone will say aloud. The wall held on the last post, and Ada's hands shook for an hour after.",
    "One more oar and we would have lost it. Tobias sat down on the step and did not get up until the bell.",
    "We held by a rope's width. Nell sat with the lantern until the last boat was a smudge.",
  ],
  // raid, lost, with people lost (tokens: {people}, {them})
  lostPeople: [
    "They came over the wall before the lamps were lit. We lost {people} and kept the rest. Nell counted twice.",
    "The wall gave at the eastern post. {People} did not come home, and the rest of us worked through the dark.",
    "It was fast and it was cold. We lost {people}, and Tobias would not say their names until morning.",
  ],
  // raid, lost, nobody hurt
  lostLight: [
    "They came over the wall before the lamps were lit. Nobody was hurt, but the larder was lighter by morning.",
    "The boats left as quickly as they came. We counted heads, found all of them, and then counted the sacks.",
    "They took what they could carry and were gone before the bell. Nell swept the step and said nothing.",
  ],
  // the Long Dusk, held
  bossHeld: [
    "It rose the height of everything we owed, and went home hungry. Hesper watched from the shore and wrote something very small.",
    "The shadow stood over the island all night and then sank back into the water. We were still standing when the sun came.",
    "The tide-bell rang once and the dark came in. It found the wall whole and left without a word.",
  ],
  // the Long Dusk, lost
  bossLost: [
    "It rose, and we were not tall enough. Hesper took what was nearest and the dawn came anyway.",
    "The shadow came over the wall and took its time. By morning the lamps were out and the ledger was longer.",
    "We stood as long as we could. The Long Dusk does not hurry, and it does not forget.",
  ],
  // Hesper takes a building (token: {building})
  seized: [
    "We ended the night over the limit, and Hesper took the {building}. She thanked us for it. Ada says the thanks was the worst of it.",
    "Hesper came at dusk with a clean page and a soft voice. By morning the {building} had her name on it.",
    "Nobody argued when the {building} went. She was polite, and that was the whole horror of it.",
  ],
  // first borrowing (token: {hours}, {short})
  firstBorrow: [
    "We were starving, so Hesper lent us tomorrow. The fire was lit before dark. Tobias said grace, then asked about interest.",
    "Hesper counted out the hours with two fingers and smiled the whole time. Nell ate first and cried a little.",
    "It was a small sum and a big night. We lit the fire, ate, and did not look at the tent on the east shore.",
  ],
  // a borrowing close to the limit
  nearLimit: [
    "Hesper looked at the page, then at us. Nearly all of it was hers now, and she was kind about it.",
    "The ledger had more of her ink than ours. Ada closed it gently, as if it might wake.",
    "We borrowed again and the page was nearly full. Hesper said it was a formality, and Tobias went to check the wall.",
  ],
  // debt cleared
  paid: [
    "We paid it all. Hesper looked at the page for a while, then closed the book very gently.",
    "The last hours went across the table. Hesper counted them twice and said nothing, which was new.",
    "For one evening nobody owed anyone. Nell hung the lantern up, and it burned the colour of lamp oil.",
  ],
  // research (token: {tech}, {effect})
  research: [
    "Ada worked by one candle and came down at dawn with ink to the elbow. The {tech} were done.",
    "It took a night and three candles. When the bell rang, Ada put down the pen and the {tech} were ours.",
    "Ada does not say how she does it. By morning there were new marks in the ledger, and the {tech} worked.",
  ],
  // new age, by era entered (1 = Village, 2 = Town, 3 = City)
  age1: [
    "The tents had turned to thatch and the shore stood further out. Nobody remembers building the mill, but the bell rings at dusk.",
    "We slept in canvas and woke in timber. Ada says the island aged in the night, and it was not asking permission.",
    "A century went by while we slept. The bell is rung by someone, and nobody has asked who.",
  ],
  age2: [
    "Brick where there was thatch, and a clock in the square. Ada wept when it struck, then took it apart to see how.",
    "The streets grew straight overnight. Lamplight on brick, and a school bell where the mill used to be.",
    "We woke to the sound of an hour being kept. It was not our hour, and it was exact.",
  ],
  age3: [
    "Brass on every roof and steam on the hour-lines. It looks more like Aster every season, and nobody says so.",
    "The glass came first, then the trams. Ada stood at the window of the new clock tower and counted what we had become.",
    "We woke in a city. The old tent is still on the east shore, and it has not changed at all.",
  ],
  // level milestone
  level: [
    "The island learned something. Ada marked the wall with chalk, as she does when the numbers move.",
    "It was a good week. Tobias said so twice, which is how we knew.",
    "Something in the island loosened and let us through. Nell was the first to feel it.",
  ],
  // reached the level the next age waits on
  levelCap: [
    "Ada says the island has learned all it can from this age. She doesn't sound happy about it.",
    "There was nothing more to learn here. Ada looked at the horizon and said the next age was already on its way.",
    "We were as good as this age allows. The island felt like a coat we had outgrown.",
  ],
  // first of a building (token: {building}, {a})
  built: [
    "We raised {a} {building}. It smelled of new timber for a week.",
    "The {building} went up in a day. Tobias leaned on it to test it and nothing happened, which was the test.",
    "Nell walked round the new {building} three times and then went in.",
  ],
  builtCottage: [
    "The first roof that wasn't canvas. Nell slept under it for an hour, then claimed the corner.",
    "A real roof, at last. Nell slept under it for an hour, then claimed the corner.",
    "Timber over our heads for the first time. Nobody mentioned the rain, because it did not get in.",
  ],
  // season closed, held (token: {n})
  seasonHeld: [
    "The season closed with the wall standing. Ada ruled a line under it and began a clean page.",
    "Another season behind us, and the Long Dusk went home empty. Hesper turned a leaf.",
    "The season ended on our feet. Tobias rang the bell once, and nobody told him to stop.",
  ],
  seasonLost: [
    "The season closed with the Long Dusk inside the wall. Ada ruled the line anyway and began again.",
    "We did not hold the last night, and the season ended all the same. The calendar does not wait for anyone.",
    "It ended badly. Ada turned the page and wrote the next date at the top, because someone had to.",
  ],
  // the island showed something (landmarks arriving with an age; token: {first}, {rest})
  landmark: [
    "{first} was simply there at dawn, as if it had always been. Ada wrote it down and drew a small circle round it.",
    "Something old came up out of the ground overnight. Tobias looked at {first} for a long time, then went back to work.",
    "{first} stands where nothing stood yesterday. Nobody built it, and nobody has asked who did.",
  ],
};

export const TITLES: Record<string, readonly string[]> = {
  held: ["Grey sails", "A night held", "The skiffs turn home"],
  nearMiss: ["By a rope's width", "The last post", "Nearer than we say"],
  lostPeople: ["A night lost", "The wall gave", "Over the wall"],
  lostLight: ["A night lost", "A lighter larder", "They came and went"],
  bossHeld: ["The Long Dusk", "The Long Dusk, held", "It went home hungry"],
  bossLost: ["The Long Dusk", "The Long Dusk, lost", "It did not hurry"],
  seized: ["Hesper took the {building}", "Gently, as always", "A name on the lintel"],
  firstBorrow: ["On borrowed time", "Tomorrow, lent", "Hesper's smile"],
  nearLimit: ["The page, nearly full", "Her ink, not ours", "A formality"],
  paid: ["Paid in full", "A quiet evening", "Nothing owed"],
  research: ["Ada's long night", "Three candles", "New marks in the ledger"],
  age1: ["We woke a century later", "Timber and thatch", "The bell rings at dusk"],
  age2: ["The clock struck", "Brick and lamplight", "An hour that was not ours"],
  age3: ["Brass and steam", "A city, all at once", "The glass came first"],
  level: ["The island learned something", "A good week", "The island loosened"],
  levelCap: ["All this age can teach", "A coat outgrown", "The next age, waiting"],
  built: ["We raised a {building}", "The {building} stands", "Round the {building}"],
  builtCottage: ["The first roof", "Timber overhead", "Nell's corner"],
  seasonHeld: ["Season {n} closed", "A line under season {n}", "Season {n}, standing"],
  seasonLost: ["Season {n} closed", "A page turned, badly", "Season {n}, over"],
  landmark: ["Something old, found", "Where nothing stood", "Not built by us"],
};

/** Hesper's stock lines: soft, short, always quoted. */
export const HESPER_LINES = ["“Gently, as always.”", "“Tomorrow's light, lent today.”", "“Only a formality.”", "“Nearly all of it is mine now. Gently, but soon.”"] as const;

export const TAG_WORDS = {
  held: "Held",
  lost: "Lost",
  taken: "Taken",
  borrowed: "Borrowed",
  repaid: "Repaid",
  learned: "Learned",
  age: "New age",
  built: "Built",
  season: "Season",
  found: "Found",
} as const;

export const J_FILTERS = [
  { id: "all", label: "All", icon: "journal" },
  { id: "nights", label: "Nights", icon: "moon" },
  { id: "hesper", label: "Hesper", icon: "owed" },
  { id: "growth", label: "Growth", icon: "build" },
] as const;

export const J_EMPTY = { title: "The first page is blank.", text: "Raise a roof, hold a night, borrow an hour. Ada writes it all down." };
export const J_NONE = { title: "Nothing here yet.", text: "Ada hasn't written about that." };
export const J_ERROR = { title: "The book won't open.", text: "Something got smudged. Try again." };

export const fill = (s: string, v: Vars): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
