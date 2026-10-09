# Decisions log

Design ambiguities resolved during the build, with the option the plan or lore supports. Newest last.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-10-09 | **Greybox skipped (owner).** Phase 1 renders the Colony and Village eras with procedural stand-in sprites in the art bible style and ships a phone-playable build. | Owner instruction. |
| 2 | 2026-10-09 | The rules port follows `sim-test.js` with `RULES=build` and its default env values (seal gate, 12-day lien, salvage 0.3, rebuild at half price, keep 0.25+0.2n, upgrade XP 1+stage, boats, Great Dial, tier levels 1/3/7/11, City raid scale ×1.12). | It is the only rule set the gates have been run on. |
| 3 | 2026-10-09 | Unsimulated §3 tuning items (surprise raid nights, jobs/posts/hunger timers, pity, catch-up, new-shore breather, first Long Dusk ×0.7, trust seals) are not in the Phase 1 rules unless listed below as landed. | Prove parity first; add each later behind the gates. |
| 4 | 2026-10-09 | Dusk shows the lore hint (kind + light/even/heavy band) and the defence of each choice, not the raiders' number. | Plan §3 "Raids are a surprise": the hint never gives a number. Presentation only, so the gates are unaffected. |
| 5 | 2026-10-09 | The pure rules live in `src/core`. The Phase 0 stress scene keeps `src/sim` (scene data) and stays reachable at `?stress=1`. | Avoids breaking the Phase 0 device test. |
| 6 | 2026-10-09 | **Phase 1 balance pass.** The first full gate run on the ported rules failed four gates (Colony win rate 97%, City 70%, leverage dominant in Village and Town). Changed three knobs only: Colony raid scale 1.00 → 1.06, City 1.12 → 1.20, and the Long Dusk's appetite for debt 0.55 → 0.80 with a per-tier multiplier ×1 / ×1.25 / ×1.75 / ×1.25. All gates pass after (docs/SIM_GATES.md). `useRuleset("prototype")` restores the baseline, so parity with the prototype is still tested bit for bit. Rules version `v2-build.2`. | Lore: the Long Dusk "feeds on what is owed" and a bigger ledger casts a longer shadow, so heavy borrowers pay at the season's end instead of winning everything; the first shore is not safe either. The no-dominant gate needs borrowing to trade safety for growth, which is the game's whole bet. |
