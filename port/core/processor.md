# Processor port plan

- Define lightweight process descriptors mirroring the C++ `Process` template and the concrete structs from `processor_unit.h`, keeping the `needs_answer` flag and a `step` counter.
- Build a reusable processor queue manager that owns the `units` and `subunits` lists and dispatches work through field-specific handlers.
- Implement a visitor-style `process()` entry point that mirrors `processor_visit.cpp` behavior, returning duel status flags based on completion and whether a prompt is waiting for an answer.
- Add field integration that instantiates the processor queue, exposes helper methods to enqueue work, and falls back to default handlers that immediately finish tasks until richer logic is ported.
- Document the JS port and exports in `processor.js` and `processor_visit.js` with full JSDoc coverage while respecting the linting rules (no `else`, single quotes, explicit semicolons).
