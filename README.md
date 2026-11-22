# The World Today — Sunday 22 November 2026

[![make.fun](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/competitions/news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/shim76688/news-image-20261122/rank.svg)](https://make.fun/competitions/news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/shim76688/news-image-20261122/reward.svg)](https://make.fun/competitions/news-image-20261122)

A newspaper front page summing up the world's news of Sunday 22 November 2026,
drawn entirely in code. `main.ts` (Node 22, standard library only) paints the page
pixel by pixel — masthead, headlines, columns and illustration — and writes a
deterministic 1024x1024 PNG to `/output/entry.png`.

Headline: Mexico captures "El Chapo Isidro", the Sinaloa cartel boss, in a deadly
firefight after a US tip. Also inside: COP31 nears a final deal in Antalya, Houthi
strikes on Riyadh, hackers breach the FBI and the US Agriculture Department, Nvidia
faces a US accounting probe, and 24 die as a boat capsizes in Nigeria.

Run it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
