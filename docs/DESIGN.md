# Design rationale

Every visual decision in this dashboard answers one question: **what does a
security analyst need to see next?** This document records the reasoning so
the choices can be defended — or challenged — on their merits.

## The organizing principle: insight-forward

A vulnerability dashboard is a triage tool, not a report. The user's questions
arrive in a predictable order: *How bad is it overall? What do I fix first?
Where is it concentrated? Is this specific finding real?* Each view is built
around one of those questions, and every element must earn its place by
advancing one of them. Two consequences of taking that seriously:

- The Explorer's filter-impact bar only renders while a triage toggle is
  engaged. At rest it showed a full grey bar — technically "100% visible,"
  actually just noise. An element that carries no information in its resting
  state shouldn't have a resting state.
- The drill-down pages' severity bars scale their **length** to the worst item
  in the list and their **segments** to severity composition. The earlier
  full-width version encoded only composition, so a 534-finding repo and a
  219-finding repo looked equally bad. Magnitude is the primary insight;
  it belongs in the strongest visual channel.

## Dark security-console aesthetic

Dark base (`#0e1218` / `#151b24` surfaces) with restrained borders instead of
elevation shadows. Three reasons: it's the native idiom of the domain (SOC
tooling, terminals — the environment this tool would live in); it lets the
severity palette carry all the color meaning without competing chrome; and it
keeps long analyst sessions comfortable. Color is budgeted: severity hues and
one primary blue are the only saturated colors on screen, so anything colored
*is* a signal.

## The severity scale

```
critical #ff4d6d   high #ff9e57   medium #f2c94c   low #5fa8f5   unknown #8b97a5
```

Not stock red/yellow/green. **Low is blue, not green** — green reads as
"safe/passing," and a low-severity vulnerability is not a passing test.
The four hues form a temperature ramp (hot pink-red → amber → yellow → cool
blue) so a stacked bar reads as a heat gradient even for colorblind users the
lightness ramp assists. Every combination was verified programmatically at
≥ 4.5:1 contrast on both background tones (worst case 5.38:1).

The scale is installed in the MUI theme palette (`palette.severity`), so
charts, chips, and badges all read from one source. No component hardcodes a
severity color.

## Severity vs. CVSS: shown, not resolved

The data disagrees with itself by design — `CVE-2016-1000027` is labelled
"medium" with CVSS 9.8. The UI never derives one from the other. Both are
displayed everywhere (badge + score bar side by side), and the disagreement
itself is promoted to a chart: the scatter's shaded quadrant shows 208 CVEs
whose label understates their score. A dashboard that silently "fixed" this
would be lying about the scanner's output.

## Typography and density

Inter, with a deliberately flat scale (h1 1.5rem → body2 0.83rem). Analysts
compare numbers; numbers get `tabular-nums` everywhere so columns of counts
align. Density is high by default (compact grid rows) because the primary
loop is scanning; a persisted density preference exists for users who
disagree. Uppercase letter-spaced captions label stat cards so the values —
the actual content — dominate.

## Layout grammar

One card pattern everywhere: title, muted single-line subtitle that states
the chart's *claim* ("actionable factors highlighted", "the shaded region is
where the label understates the score"), then content. Subtitles double as
captions — a reviewer should understand each chart without hovering anything.
Six stat cards cap the Overview; each is a headline number with one line of
context, and the two severity cards borrow their accent color from the scale.

## Interaction model

- **Charts are filter entry points, not pictures.** Donut slices, risk-factor
  bars, and legend rows all navigate into the pre-filtered Explorer. The
  Overview is a menu of questions; the Explorer answers them.
- **Peek before commit.** Clicking an Explorer row slides in a summary drawer
  (blast radius, percentile, top packages) without losing filter or scroll
  state. Full navigation is an explicit second step. Triage is a loop —
  the UI never throws away loop state for a glance.
- **The two triage buttons look like what they do.** Analysis (amber,
  fact-check icon) and AI Analysis (blue, robot icon) are stateful toggles
  with a glow when engaged, live "hiding N" counts computed within the
  current filter context, and an animated impact bar. Their effect on the
  dataset is watched, not inferred.
- **"Fix first" is opinionated.** The strip above the grid ranks the current
  view by exploited > severity > CVSS and pulses actively-exploited chips.
  A triage tool should have an opinion about priority; matching rows carry
  an accent rail so the opinion is traceable in the data.

## Responsive strategy

Three verified targets (1920/1440/834). The sidebar is permanent ≥900px and
a drawer below; the filter panel is sticky-left on wide screens and collapses
behind a button on tablet; toolbar controls wrap as a single group so no
control ever strands on its own row. Phone is explicitly out of scope — this
is a workstation tool.

## The light "enterprise" theme

A persisted toggle offers a second idiom: white surfaces, near-black text,
hairline borders, blue links — the document-portal language of tools like the
Red Hat customer portal, where many security teams already live. Dark remains
the default (the console rationale above stands); light exists for bright
offices, printing, and portal-native users.

Two things about it matter more than its looks. First, it cost ~60 lines,
because no component hardcodes color — everything reads
`theme.palette.severity` or semantic tokens, so the entire app (including
every D3 chart) re-skins from one palette swap. The theme toggle is the
proof of the design system. Second, light mode splits the severity tokens by
role — the first version used one darkened set for everything, and dark red /
brown / olive smeared together as large chart areas. `palette.severity` is
the text-safe set (≥5.2:1 on white, for chips, labels, colored numbers);
`palette.severityFill` is the chart-area set, a vivid ramp chosen by
geometry, not eye: hues 352°/27°/45°/211°, luminance strictly monotonic
across the warm ramp so colorblind users still read an ordered progression,
every adjacent pair ≥1.67:1 apart, blue hue-isolated. Stacked segments gain
hairline surface-colored strokes so adjacency never blurs. In dark mode one
palette serves both roles — the split exists only where physics demands it.

## Accessibility as design, not compliance

Global `:focus-visible` outlines (including inside SVG charts), keyboard
activation on every chart target, a skip link, `aria-label`s that summarize
each chart's finding in a sentence, and live-region announcements for filter
impact. The scatter's ~1,200 points are deliberately *not* tab stops — a
keyboard user gets the summary and the Explorer path instead of a focus trap.
Empty, loading, and error states exist for every async surface, and the
ingest gate shows a real percentage because a spinner on a 270MB file is a
broken promise.
