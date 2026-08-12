# Approach and implementation — walkthrough

A ~15 minute walkthrough of how this was built and why. Written as speaking
notes for the onsite; readable on its own.

---

## 1. I read the data before I wrote any code

Before the project existed I wrote a throwaway Node script that streamed the
whole file and reported on it. That hour set every decision that followed:

- **The file is truncated.** It ends mid-string inside an image object, with
  ~0.5MB of unparsed tail. `JSON.parse` doesn't merely struggle with this file
  — it *cannot* succeed on it. Any approach that assumed a clean EOF was dead
  on arrival, and I knew that before writing a line of UI.
- **139.8× redundancy.** 75.0MB of the 270MB is description text; 74.5MB of it
  is duplicated. That number chose the data model.
- **`severity` and `cvss` disagree by design** — 227 CVEs score CVSS ≥ 7 while
  labelled low or medium. So the UI must never derive one from the other.
- **`kaiStatus` exists but isn't in the brief's schema** — the scanner's own
  dismissal verdicts, on ~12% of records. That's the field the assignment's
  action buttons are about.

Talking point: the truncation is the detail I'd lead with. It converts "use a
streaming parser because it's faster" into "use one because nothing else
works," and it's the kind of thing you only find by looking.

## 2. Ingestion — the core engineering problem

A Web Worker streams the response through a hand-rolled, string-aware
brace-depth tokenizer that emits each complete image object as its closing
brace arrives. Then, in one pass: normalize → sanitize → intern → dedupe →
aggregate. The main thread gets progress messages and one finished payload; it
never sees a raw record and never computes an aggregate.

Measured: **4.0s** parse, **1.3MB** peak transient memory, **333MB** peak RSS,
and — the number I care about — **zero main-thread long tasks**, verified with
`PerformanceObserver`. The progress bar shows a real percentage from
`Content-Length` because a spinner on a 270MB file is a broken promise.

Why hand-rolled rather than a library: the nested-object shape (`groups` and
`repos` are objects keyed by name, not arrays) defeats simple array streaming,
and the truncated tail needs to be *reported* rather than thrown. Zero parsing
dependencies, and the failure mode is a quantified diagnostic surfaced in the
UI header.

## 3. The data model is the performance story

```
cveCatalog: Map<string, CveMeta>   1,228 entries — descriptions stored once
occurrences: Occurrence[]          171,711 lightweight rows
groupNames / repoNames: string[]   interned; rows hold numeric indices
aggregates: Aggregates             every number the charts need, precomputed
```

Deduplication is what makes it fit in a tab, and it *enables a feature*:
`/cve/:cveId` — every image and package a CVE touches across the estate — is a
cross-cutting query that would be prohibitive without it. The top CVE has
1,787 occurrences and the page renders instantly.

## 4. Architecture: strict layers, one rule

> Raw records exist only in the worker. The main thread receives a finished
> dataset and never computes an aggregate.

Redux holds what Redux is good at — ingestion status, filters, sort,
pagination, preferences, comparison set — and the ~60MB dataset deliberately
lives outside it in a module singleton behind Context. It's immutable after
ingest, so it needs no reducer, and keeping it out means RTK's dev-mode
`serializableCheck` and `immutableCheck` stay *enabled*.

The proof this layering works is what it absorbed later: triage buttons,
comparison, export, search suggestions, a trend chart, dashboard
customization, a peek drawer, and client-side file upload were all added after
the core was done. None required restructuring state or rewriting a component.
File upload was nearly free — a `File.stream()` is the same `ReadableStream`
the fetch path already consumed.

## 5. Design: every element earns its place

The organizing principle is **insight-forward** — each view answers an
analyst's next question (*How bad? What first? Where? Is this real?*), and any
element that doesn't advance one gets cut. Two examples of that principle
biting during a design audit:

- The filter-impact bar used to render at rest, showing a full grey bar that
  said nothing. It now appears only when a toggle is engaged.
- Drill-down severity bars encoded only *composition*, so a 534-finding repo
  looked identical to a 219-finding one. Length now encodes magnitude.

Color is budgeted: severity hues and one primary blue are the only saturated
colors, so anything colored is a signal. Low is blue, not green — green reads
as "safe," and a low-severity vulnerability isn't a passing test. Contrast was
verified programmatically, not eyeballed (worst case 5.38:1). When I added a
light theme, the darkened text-safe palette muddied as large chart fills, so
the tokens split by role — `severity` for text, `severityFill` for areas —
with hues and luminance chosen so the ramp survives colorblindness.

## 6. The creative brief, taken seriously

The assignment says *creative / innovative / original* six times. My reading:
design originality is graded, so each one got a real idea rather than a
control.

The one I'd demo: **manual vs. AI triage overlap**. Tiles show which CVEs each
track dismissed and where they agree; mirrored per-severity bars show where
each is active. The finding lands immediately — the two tracks agree on only
**18 of 1,228 CVEs**, and AI never dismisses a critical. That's a real story
about the scanner, told by the shape of the chart.

Second: **"fix first."** The strip above the grid recomputes the most
dangerous distinct CVEs *in the current view* on every filter change —
exploited first, then severity, then CVSS — with exploited chips pulsing and
matching rows carrying an accent rail. A triage tool should have an opinion
about priority, and that opinion should be traceable back into the data.
Unfiltered, it surfaces Log4Shell.

Full list in [REQUIREMENTS.md](REQUIREMENTS.md#creative-work).

## 7. Customization: the Overview is a default, not a decree

Widgets drag, snap, resize, hide, and restore on a 12-column grid; users
compose their own charts from a builder with a live preview (seven data
dimensions × three chart forms). Everything persists.

Two details I'd point at. First, the builder can only read **precomputed
aggregates** — so user-composed charts can't violate the "no main-thread
aggregation" rule; the customization system is constrained by the same
architecture as everything else. Second, ordered axes (years, CVSS bands)
refuse the donut option, because a donut of years is a chart-literacy failure.
Freedom within rules.

## 8. Responsive: adapt the affordance, keep the capability

Verified at 1920, 1440, 850, and 390px. Below 900px the drag grid is replaced
by explicit reorder arrows — same widget model, same features, different
interaction. The Explorer trades columns for depth: phones show severity, CVE,
CVSS, with the peek drawer one tap away, and saved column preferences are left
untouched because they express intent while the viewport adds its own
constraint. Chart labels truncate *middle*-out, because these labels differ at
the tail — `…S90.44.1` vs `…S90.45.0`.

## 9. What I'd change for production

Client-only against a static file is right for the exercise and wrong for
production. Cursor-based server pagination with the filter predicate pushed
into the query; server-side aggregation so ingest becomes an ETL job rather
than a page load; GraphQL for the groups → repos → images → vulns graph; and
**scan-to-scan diffing**, because "what's new since last week" is the question
security teams actually ask — the current trend chart plots publication years
only because that's what a single scan can show.

## 10. If I had another week

Saved views, a package-centric route (packages are the real remediation unit —
upgrade `spring-web` once, fix 40 images), component tests via Testing Library
to match the coverage the pure layers already have, and a text/fill token
split for the remaining light-mode chart edge cases.

---

### Demo path (5 minutes)

1. **Load** — watch the real progress percentage; note the UI stays responsive.
2. **Overview** — stat cards, then the manual-vs-AI overlap card. Then hit
   *Customize*: drag a widget, resize it, add a "CVSS score bands" column chart
   from the builder, reload to show persistence.
3. **Donut → Explorer** — click a severity slice; land pre-filtered.
4. **Triage buttons** — toggle both; watch counts, glow, and the impact bar.
5. **Fix first** — point out Log4Shell and the accent rails.
6. **Row click** — peek drawer; then *Full details* for blast radius.
7. **Compare** — stage two CVEs, show the struck-through risk-factor diff.
8. **Theme toggle + mobile width** — one palette swap re-skins every chart.
