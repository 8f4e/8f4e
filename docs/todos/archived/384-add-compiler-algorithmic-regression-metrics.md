---
title: 'TODO: Add compiler algorithmic regression metrics'
priority: Medium
effort: 1-2 days
created: 2026-04-28
issue: https://github.com/8f4e/8f4e/issues/647
status: Completed
completed: 2026-06-14
---

# TODO: Add compiler algorithmic regression metrics

## Completion Decision

The maintainer confirmed on 2026-10-14 that this TODO is complete. The existing release-level compiler execution
counters and metrics dashboard satisfy the accepted scope. The original size-scaling proposal below is retained
as historical context and is not outstanding work under this TODO.

## Problem Description

The original goal was to complement compiler snapshots with release-level signals for algorithmic regressions.

Raw compile duration is a weak primary metric because it varies by machine, runner load, CPU governor, and Node/V8 version. What we need instead is a way to detect when compiler cost grows faster than input size for representative compiler workloads.

This should catch cases such as:

- a lookup path accidentally becoming quadratic
- semantic normalization doing repeated full-program scans
- memory or function resolution retaining more data than expected
- a helper suddenly dominating V8 CPU profile samples

## Original Proposed Solution

Add a compiler complexity benchmark script that runs deterministic generated fixtures at multiple sizes and records curve-shape metrics.

Use machine-independent or mostly machine-independent signals as the primary dashboard inputs:

- peak heap used
- heap used delta
- sampled allocation size from V8 heap profiling, if practical
- GC count
- CPU profile sample counts and top sampled functions

Timing can be captured as secondary context, but the dashboard should focus on ratios across input sizes in the same run rather than absolute milliseconds.

## Fixture Families

Start with generated fixtures that stress different compiler paths:

- `linear-instructions` - many independent instructions for baseline throughput
- `many-locals` - many local declarations and reads to catch local lookup regressions
- `many-functions` - many functions and calls to catch function resolution regressions
- `nested-functions` - call/function metadata pressure
- `memory-heavy` - many memory declarations and accesses
- `large-real-example` - one real project fixture to keep synthetic coverage grounded

Each generated fixture should run at multiple sizes, for example `100`, `1_000`, `10_000`, and `50_000` instructions or declarations where practical.

## Implementation Plan

### Step 1: Add deterministic fixture generators

- Create fixture generators under a compiler benchmark or scripts folder.
- Keep generated source deterministic and small enough to run in CI.
- Use named fixture families so historical logs remain stable.

### Step 2: Add an isolated benchmark runner

- Run each fixture size in a fresh Node process.
- Prefer `--expose-gc` so the runner can collect before/after heap baselines.
- Capture `process.memoryUsage()` and `v8.getHeapStatistics()` around the compile call.
- Optionally collect V8 CPU profiles with `--cpu-prof` for top sampled functions.

### Step 3: Log release metrics

- Append records to `logs/compiler-complexity/@8f4e/compiler.json`.
- Store only graph-oriented numeric data plus stable fixture names.
- Include commit, version, recorded timestamp, Node version, and V8 version for interpretation.

Suggested record shape:

```json
{
	"schemaVersion": 1,
	"recordedAt": "2026-04-28T00:00:00.000Z",
	"commit": "abc123",
	"packageName": "@8f4e/compiler",
	"version": "0.1.4",
	"node": "v22.15.1",
	"v8": "12.4.254.21-node.24",
	"fixtures": [
		{
			"name": "many-locals",
			"size": 10000,
			"inputBytes": 420000,
			"peakHeapUsedBytes": 18000000,
			"heapUsedDeltaBytes": 6500000,
			"gcCount": 3,
			"cpuProfileSamples": 1250
		}
	]
}
```

### Step 4: Add derived dashboard signals

- Graph raw per-size metrics per fixture family.
- Graph ratios between adjacent fixture sizes.
- Highlight regressions where input doubles but memory, allocation, or sample count grows far beyond `2x`.
- Keep wall-clock timing separate and clearly labeled as CI-environment dependent if added.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:build`
- `node --expose-gc scripts/<compiler-complexity-script>.mjs`
- Verify the same fixture family produces stable size labels across runs.
- Verify ratio calculations are based on metrics within the same run, not across different machines.

## Accepted Success Criteria

- [x] Release automation records compiler range-execution and function-entry counts for real-project benchmarks.
- [x] Historical compiler execution metrics are available in `logs/compiler-coverage-counts/`.
- [x] The metrics dashboard displays compiler execution counts across releases and compiler pipeline components.
- [x] The maintainer accepts the implemented metrics as completion of this TODO.

## Affected Components

- `packages/compiler` - benchmarked compiler entry points and fixture source shapes
- `scripts/log-compiler-coverage-counts.mjs` - compiler benchmark execution counters and log appender
- `logs/compiler-coverage-counts/` - historical release metrics
- `packages/metrics-dashboard` - compiler execution-count charts
- `.github/workflows/release.yml` - release-time collection

## Risks & Considerations

- **Runner noise**: use ratios across fixture sizes in the same run instead of absolute duration as the main signal.
- **V8 drift**: Node/V8 upgrades can change heap behavior and profiler sampling; log versions with every record.
- **Profiler overhead**: CPU and heap profiling can perturb execution. Treat profile data as diagnostic context, not the only regression signal.
- **CI cost**: large generated fixtures should be sized so release runs stay reasonable.
- **False confidence**: synthetic fixture families should be complemented by at least one real project fixture.

## Related Items

- **Related**: `docs/todos/archived/054-benchmark-unrolled-vs-normal-loop-audio-buffer-filler.md`
- **Related**: `305` Reuse WASM instance across incremental compiles
- **Related**: `383` Extend CLI `run` with tracing and derived debug signals

## References

- [Node.js V8 API](https://nodejs.org/api/v8.html)
- [Node.js CPU and heap profiling CLI flags](https://nodejs.org/download/release/v22.12.0/docs/api/cli.html)
- [Node.js perf_hooks API](https://nodejs.org/api/perf_hooks.html)

## Notes

- Completion was recorded in the 2026-06-14 archiving commit `e2c2a674c` and reaffirmed by the maintainer on
  2026-10-14. The brief reopening during the issue audit was reversed following that clarification.
- Compiler coverage logging was introduced in [commit f79b6392a](https://github.com/8f4e/8f4e/commit/f79b6392ae005a4a4a438bcb442f490e3126be49).
- Pipeline-component tracking and dashboard support were extended in [commit a6bb1484f](https://github.com/8f4e/8f4e/commit/a6bb1484f4a972575e85094071c35bd593b88215).
- No associated PR was returned for either implementation commit.
