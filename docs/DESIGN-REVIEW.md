# Restie: design review (lead designer pass, Nov 15 2026)

The question this review answers: what keeps Restie from being an app people open every day and tell their friends
about? Restie's promise is *make time for your hobbies without guilt, with a cat who's doing it too*. Everything
below is judged against that.

## Fixed in this pass

| # | Problem | What changed |
| - | ------- | ------------ |
| 1 | "Mark milestone done" and "Add another step" sat side by side, squeezed in a narrow column, touching the step list below. | They're stacked full-width, primary first, with space above and below the card. |
| 1 | Spacing was ad hoc: 63 hard-coded gaps (2, 6, 10, 14, 18…). | One rhythm, all from the theme scale: 4 between a title and its subtitle, 8 between items in a card, 12 for padding inside controls, 16 between sections. |
| 2 | Promises you made never showed on Home. Steps added from a hobby page have no day, so Home ignored them. Dated ones hid in a sideways-scrolling chip strip behind older items. To-dos never appeared at all. | Home's panel is now **Up next**, your go-to list. It shows anything late or due today (promises and to-dos), then the rest of the week, then each hobby's next step marked "Anytime". The top two rows are on Home, "See all" opens To-dos, and tapping a row opens it. |
| 3 | Pale fringe around Rusty's whiskers and tail (cream paper left in the edges). | The cut-out now gives edge pixels partial transparency and removes the paper from them. Every puppet frame and every move was rebuilt. |
| 3 | Hobby objects in the room did nothing. | Tap one and Rusty tells you about his own version, at your stage ("I set up an easel like you! the canvas is still blank. blank is brave."). |
| 4 | Rusty changed activity every 15–35 s, so he looked like he was wandering for no reason. | He has a **planned day**. Activities last minutes (sitting 3–7, window 3–6, hobbies 8–18, naps 12–30), shaped by the time of day, the weather, a daily mood and his favorite hobby that day. Small moments still happen every 25–50 s, so the room is never frozen. Open the app and he's mid-activity, not starting over. |
| 4 | He never left the room. | **Trips**: about one day in six he's out for 3–5 hours. A sign hangs on his door ("Out exploring · back around 3:30"); tap it for his note, or for his check-in if he left one. He comes back through the door with a souvenir, which becomes his keepsake. Demo: Settings → Make Rusty… → Go on a trip. Settings → Demo speed runs his day 10× faster. |

## The gaps that matter most

Ordered by impact on whether someone is still using Restie in week 3.

### P0: before the next usability test

1. **Home must answer "what now?" in one glance.** Up next fixes the list. Missing: a one-tap *done* from Home. Today that takes three taps: open, mark done, back. Add a check circle on each row (with the existing Undo toast). When nothing is planned, Rusty should suggest one tiny thing for tonight instead of showing an empty "+ Promise a step" chip.
2. **First promise inside the first minute.** Onboarding should end with a paw promise that is visibly sitting in Up next when the room appears. Measure time-to-first-promise in the test.
3. **The transition art.** The moves are now aligned and morphed, but Shirley's sheets still change his face between frames. New sheets made with `art/sprites/PROMPT.md` remove the last visible "different drawing" moments.
4. **Real phone check.** Sprites take about 104 MB of texture memory, and the room uses filters and blend modes. Test on the oldest phone the team has.

### P1: before real users

5. **Accounts.** Anonymous sign-in means reinstalling or switching phones loses everything. Add "Save your room" (Sign in with Apple / email code) that links the anonymous account. See `docs/BACKEND-PROMPT.md`.
6. **Notifications with a personality and a budget.** At most one Rusty-voiced nudge a day, plus check-ins at promised times. Never at night, never guilt. "Rusty is back from the creek and brought you something" is the kind of notification people *want*.
7. **AI that's safe, fast and affordable.** Rate limits per person, time-outs with offline lines, a crisis-language path, no personal data in logs. See `docs/BACKEND-PROMPT.md`.
8. **Accessibility in the room.** Labels on the wall are small over a busy painting. Support Dynamic Type for the notes and labels. Reduced Motion should also slow Rusty's day, and every hotspot needs a 44 pt target.

### P2: growth (what makes it "the app everyone uses")

9. **A reason to open it that isn't a reminder.** Rusty's life is the hook (Neko Atsume, Finch). Next:
   - **Postcards** mid-trip: one illustrated scene sent to your keepsakes.
   - A **souvenir shelf** in the room that fills up over the months.
   - **Seasonal moments**: first snow, a birthday hat, autumn leaves on the sill.

   All of it gentle and none of it time-limited: no FOMO, in line with "progress without guilt".
10. **Rusty mirrors you.** Plan his hobby time around when *you* usually do yours ("he practices guitar at 7 because you do"). His room grows when you reach milestones (already true); his skills should visibly grow too. The painting on his easel gets better.
11. **Widgets.** Rusty and your next step on the home and lock screen are the biggest retention lever for companion apps. This needs a development build: plan the switch from Expo Go after the class demo.
12. **Shareable moments.** Export a keepsake, a postcard or a monthly "what we made together" page as an image card. Sharing a cute cat plus a real hobby milestone is organic growth that doesn't feel like marketing.
13. **Monthly recap from Rusty.** A short diary page from Rusty: what you both worked on, kept as a keepsake. It makes progress legible without numbers.

## Principles to hold the line on

- **One place for "now".** Home's Up next. Everything else is a drill-down.
- **Rusty never pressures.** No streaks, no scores, no "you missed". Trips and postcards are gifts, not obligations.
- **The room is the progress bar.** If you did something, the room should look different.
- **Calm motion.** Something should change every few minutes, and something small should move every half minute, but nothing should look busy.
- **One spacing scale, one vocabulary** (`src/theme/tokens.ts`, `src/copy.ts`).

> A8 note: the team's own UI-revision plans and reflections should be written in your own words. Use this as input,
> not as the write-up.
