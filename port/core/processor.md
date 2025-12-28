# Processor port plan

- Map every `field::process` overload in `processor.cpp` to a dedicated handler in `processor_stubs.js`, preserving control flow, coroutine handling, and side effects (shuffle flags, solving event management, and `reason_*` bookkeeping).
- Port coroutine invocation patterns by wrapping `StateEngine` helpers to mirror `pduel->lua->call_coroutine` semantics, including parameter staging, yield value capture, and `core.check_level` bookkeeping in `field.js`.
- Recreate the event stack mechanics used by `core.solving_event` and `core.sub_solving_event`, ensuring the JS port splices events, sets `returns` equivalents, and restores shuffle checks exactly as `processor.cpp` does for cost, target, and operation processors.
- Implement branch-specific processors (phase, point, quick effects, commands, battle flow, continuous solving, adjust, startup, deck sort, hand discard, etc.) by translating decision gates, priority ordering, and recursive enqueue patterns straight from `processor.cpp` into the corresponding stubs.
- Expand `processor.js` and `processor_visit.js` to orchestrate the stub map with richer routing: type-guard incoming units, detect completion signals, and enqueue follow-up processors in the same order as the native visitor.
- Add comprehensive JSDoc across new helpers to satisfy lint rules while documenting coroutine parameters, expected `ProcessDescriptor` shapes, and return semantics.
