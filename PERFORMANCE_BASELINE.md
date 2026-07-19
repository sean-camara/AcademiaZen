# Frontend performance baseline

Measured 2026-07-19 on Windows Node 22.19.0/npm 10.9.3 and the production VPS.

| Measure | Baseline |
|---|---:|
| Vite production build | passed in 6.70 s |
| transformed modules | 80 |
| HTML | 3.35 kB / 1.35 kB gzip |
| CSS | 92.09 kB / 14.76 kB gzip |
| initial JS | 761.49 kB / 193.18 kB gzip |
| public frontend server response | 200, 0.421 s total from VPS |
| public API health | 200, 0.430 s total from VPS |

The build warns that the sole JS chunk exceeds 500 kB and that `utils/api.ts` cannot be split because it is both static and dynamic. Browser capture loaded the auth page with no console errors; one autocomplete warning was observed.

## Budgets

- Public landing critical JS <= 120 kB gzip; optional 3D excluded and lazy.
- Authenticated shell <= 150 kB gzip; each major route <= 100 kB gzip unless justified.
- Initial CSS <= 35 kB gzip.
- LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at p75 on mobile field data.
- No unbounded PDF/model work on the main thread; cancel obsolete requests.

## Measurement plan

Record Lighthouse mobile/desktop on public, auth, and representative authenticated routes; bundle visualization; slow-4G route transitions; long-list rendering; PDF memory; SSE first-token latency; and service-worker cold/update loads. Compare on the same tool/device profile after each performance phase.
