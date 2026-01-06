
## This runtime orchestrates multiple systems as a cohesive platform:

```mermaid
┌─────────────────────────────────────────────┐
│              Runtime Core                   │
│  - Lifecycle management                     │
│  - Event bus                                │
│  - Plugin orchestration                     │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐  ┌─────▼────────┐
│   Build     │  │     Dev      │
│  - esbuild  │  │  - Server    │
│  - assets   │  │  - HMR       │
│  - manifest │  │  - Watch     │
└─────────────┘  └──────────────┘
```