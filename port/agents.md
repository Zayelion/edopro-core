Javascript goes in this folder.
Do not edit code outside of this folder.
Do not ever edit code outside of the folder.
Do not ever create files outside of this folder.

Never use null, if it can not be helped try to dispose of it, or replace it with an appropriately blank object created from a class.
All functions must have JSDocs, no exceptions.

The port leverages the `lua-state` package to host the scripting runtime. The `StateEngine` wrapper in `core/state_engine.js`
constructs a Lua instance via the exposed factory helpers and executes loaded buffers through `doString` or `execute` when
present.

## Linting & code style (`.eslintrc.js`)
- **Never use `else`:** `no-else/no-else` and `no-else-return` enforce early returns / guard clauses.
- **Syntax preferences:** single quotes, required semicolons, 2-space indentation, template literals over concatenation, `const`/`let` (no `var`).
- **Forbidden patterns:** `++`/`--`, bitwise ops, nested ternaries, extending natives, `eval`/`new Function`/implicit evals, `with`, and unused vars.
- **Best practices:** Always use strict equality (`eqeqeq`), avoid lonely `if`s, and keep spacing consistent (`keyword-spacing`, `object-curly-spacing`, etc.).
- **Documentation:** Every function must include a JSDoc comment that explains its purpose, parameters, and return value.



## Corrisponding files
| C/C++ File              | Maps To                         |
| ----------------------- | ------------------------------- |
| bit.h                   | `core/bit.js`                   |
| card.cpp                | `core/card.js`                  |
| card.h                  | `core/card.js`                  |
| common.h                | `core/common.js`                |
| containers_fwd.h        | `core/containers_fwd.js`        |
| duel.cpp                | `core/duel.js`                  |
| duel.h                  | `core/duel.js`                  |
| effect.cpp              | `core/effect.js`                |
| effect.h                | `core/effect.js`                |
| effect_constants.h      | `core/effect.js`      |
| field.cpp               | `core/field.js`                 |
| field.h                 | `core/field.js`                 |
| function_array_helper.h | `core/function_array_helper.js` |
| group.h                 | `core/group.js`                 |
| interpreter.cpp         | `core/interpreter.js`           |
| interpreter.h           | `core/interpreter.js`           |
| libcard.cpp             | `core/libcard.js`               |
| libdebug.cpp            | `core/libdebug.js`              |
| libduel.cpp             | `core/libduel.js`               |
| libeffect.cpp           | `core/libeffect.js`             |
| libgroup.cpp            | `core/libgroup.js`              |
| lua_obj.h               | `core/lua_obj.js`               |
| ocgapi.cpp              | `core/ocgapi.js`                |
| ocgapi.h                | `core/ocgapi.js`                |
| ocgapi_constants.h      | `core/ocgapi.js`      |
| ocgapi_types.h          | `core/ocgapi.js`          |
| operations.cpp          | `core/operations.js`            |
| playerop.cpp            | `core/playerop.js`              |
| processor.cpp           | `core/processor.js`             |
| processor_unit.h        | `core/processor.js`        |
| processor_visit.cpp     | `core/processor.js`       |
| progressivebuffer.h     | `core/progressivebuffer.js`     |
| scriptlib.cpp           | `core/scriptlib.js`             |
| scriptlib.h             | `core/scriptlib.js`             |
