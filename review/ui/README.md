# review/ui: the navigator

*web components in the shape coding.sgit.ai documents; no framework, no bundler, no build step · CC BY 4.0 for this file, Apache-2.0 for the code*

One visualiser per file shape, one to one, and a component is not finished until `review/self/` shows its methods. `index.html` is the only document: it loads `tokens.css`, the components and `shell.js`, holds the layout (the ladder, the tree, the graph and the node), shows the version, and does nothing else; its `data-review-shell` attribute is what lets the store mirror the route into the URL, so a site page that embeds a component never has its hash rewritten. `tokens.css` is the only file under `ui/` where a colour is written, and each one is the fallback of a site token (`--sg-*`, valued per theme in `/assets/themes.css`, which the shell loads with `/assets/theme.js`): on the site the navigator follows the theme the reader picked from the four in `data/themes.json`, and on its own it keeps the family palette. The top bar carries the same picker as the site nav.

| Component | Renders | From |
|---|---|---|
| `review-base` | nothing; the base class the others extend: self-location (`static jsUrl = import.meta.url`), loading its `.html` and `.css` into the shadow root, the shared store that reads the JSON files by path (with the inlined bundle as fallback), the node index, the event bus, the route held in a variable | every file |
| `review-crumb` | the path walked so far, each step a way back | the selected node's ancestors |
| `review-tree` | story > rule > example; flow > step; component tree; environment > resource and pipeline > job; one component, every tree shape | `intent/stories.json`, `intent/flows.json`, `intent/components.json`, `intent/deploy.json`, and from step 2 the derived trees |
| `review-node` | one node: name, type, layer, source link into the rendered brief, properties, edges in and out, children, parent | any node |
| `review-ladder` | the layers as a rail, in the brief's order, with counts; the layers that do not exist yet named with the step that brings them; red where a selected change moved them, from step 4 | every layer file |
| `review-graph` | the node in focus and its neighbours as an SVG graph laid out by a small force simulation, no library; follows the selection, or draws the nodes a page names when given `nodes="id,id"` (the reader's column on every site page embeds it that way) | the store |
| `review-set` (step 2) | the switch between `review/` and `review/self/` | the store |
| `review-join` (step 3) | matched, derived only, projected only, the coverage figure | `join/` |
| `review-change` (step 4) | one commit read upwards | `changes/<hash>.json` |
| `review-source` (step 5) | code with line numbers, the node's lines marked | the source resolver |
| `review-reach` (step 5) | who reaches this, by hop, with counts | the call graph and the surface map |
| `review-stream` (step 5) | the code on one path in call order | `streams/<entry>.json` |
| `review-checks` (step 6) | rules, violations, trend | `checks/` |
| `review-search` (step 5) | find a node by name across layers | the node index |

## Events

All through `document`, `bubbles` and `composed` set, namespaced `review:`: `review:select` (a node id), `review:route` (a view), `review:set` (project or self), `review:loaded` (the store finished reading a set).

## The route

Held in the store, never in `location.hash` by assignment: inside the vault host a hash router is dead (the evidence vault shipped with that bug). When the shell runs on its own the base component mirrors the route into the URL with `history.replaceState` so a view survives a reload, and reads it back on load.

## Where it runs

From the repository on a local static server (`python3 -m http.server 8000`, then `/review/ui/`), from GitHub Pages at `/review/ui/`, and from step 7 inside a vault through `dist/index.html`, which `bundle.py` makes by inlining the components and the data while the source stays split.
