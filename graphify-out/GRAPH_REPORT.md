# Graph Report - Legal Hub  (2026-09-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 268 nodes · 1105 edges · 13 communities (7 shown, 6 thin omitted)
- Extraction: 76% EXTRACTED · 24% INFERRED · 0% AMBIGUOUS · INFERRED: 260 edges (avg confidence: 0.85)
- Token cost: 29,229 input · 1,463 output

## Graph Freshness
- Built from commit: `87ddf54f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Minified Bundle Internals
- Hub App Core Logic
- Minified Bundle Core
- HTML2PDF Bundle Library
- Minified Bundle Helpers
- Minified Bundle Utilities
- Python Test/Export Driver

## God Nodes (most connected - your core abstractions)
1. `e()` - 132 edges
2. `h()` - 111 edges
3. `Qe()` - 49 edges
4. `t()` - 46 edges
5. `o()` - 41 edges
6. `s()` - 36 edges
7. `n()` - 32 edges
8. `i()` - 30 edges
9. `o()` - 26 edges
10. `xe()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `drawChecks()` --indirect_call--> `c()`  [INFERRED]
  hub.js → assets/html2pdf.bundle.min.js
- `refresh()` --indirect_call--> `c()`  [INFERRED]
  hub.js → assets/html2pdf.bundle.min.js

## Import Cycles
- None detected.

## Communities (13 total, 6 thin omitted)

### Community 0 - "Minified Bundle Internals"
Cohesion: 0.09
Nodes (51): e(), at(), br(), bt(), cr(), ct(), dr(), dt() (+43 more)

### Community 1 - "Hub App Core Logic"
Cohesion: 0.12
Nodes (46): ago(), applyLang(), buildExportPageEls(), checks(), closeModal(), create(), createProject(), deleteProject() (+38 more)

### Community 2 - "Minified Bundle Core"
Cohesion: 0.15
Nodes (46): a(), C(), Dr(), a(), c(), E(), fr(), gr() (+38 more)

### Community 3 - "HTML2PDF Bundle Library"
Cohesion: 0.08
Nodes (27): Cr(), d(), ae(), ce(), f(), g(), h(), l() (+19 more)

### Community 4 - "Minified Bundle Helpers"
Cohesion: 0.13
Nodes (34): be(), Ce(), De(), de(), ee(), fe(), ge(), he() (+26 more)

### Community 5 - "Minified Bundle Utilities"
Cohesion: 0.20
Nodes (21): B(), ar(), b(), be(), j(), lr(), mr(), ue() (+13 more)

### Community 6 - "Python Test/Export Driver"
Cohesion: 0.20
Nodes (9): export_a4(), get_browser(), Driver for Legal Hub (static index.html, no build step). Usage: python3…, smoke(), os, subprocess, sys, time (+1 more)

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `c()` connect `Minified Bundle Core` to `Minified Bundle Internals`, `Hub App Core Logic`, `HTML2PDF Bundle Library`, `Minified Bundle Helpers`, `Minified Bundle Utilities`?**
  _High betweenness centrality (0.286) - this node is a cross-community bridge._
- **Why does `e()` connect `Minified Bundle Internals` to `Minified Bundle Core`, `HTML2PDF Bundle Library`, `Minified Bundle Helpers`, `Minified Bundle Utilities`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Why does `h()` connect `Minified Bundle Internals` to `Minified Bundle Core`, `HTML2PDF Bundle Library`, `Minified Bundle Helpers`, `Minified Bundle Utilities`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **Are the 39 inferred relationships involving `e()` (e.g. with `html2pdf.bundle.min.js` and `Dr()`) actually correct?**
  _`e()` has 39 INFERRED edges - model-reasoned connections that need verification._
- **Are the 33 inferred relationships involving `h()` (e.g. with `br()` and `bt()`) actually correct?**
  _`h()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `Qe()` (e.g. with `d()` and `e()`) actually correct?**
  _`Qe()` has 34 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `t()` (e.g. with `html2pdf.bundle.min.js` and `a()`) actually correct?**
  _`t()` has 10 INFERRED edges - model-reasoned connections that need verification._