# Bible Timeline

An interactive, visual Bible timeline for personal and church study. Explore the whole biblical story from Creation to Revelation: when things happened, who was involved, and where. Two linked views, a **Timeline** and a **Map**, share the same data and the same "current moment in time."

See [key_features.md](key_features.md) for the full feature vision.

## Getting started

Built with React, TypeScript, Vite, Tailwind CSS and MapLibre GL. It's a static site: all content lives as JSON/GeoJSON in `src/data/`.

Requires [Node.js](https://nodejs.org/) 22 or later.

```sh
npm install      # once
npm run dev      # start the dev server at http://localhost:5173
npm test         # run tests (date math + data integrity)
npm run build    # type-check and build static files into dist/
```
