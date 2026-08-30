# Compiler strictness

`strict` is on. So are `noImplicitAny`, `strictNullChecks`, `strictBindCallApply`,
`noImplicitOverride` and `noFallthroughCasesInSwitch`.

That was not always true. Until 30 August 2026 the config had `strict` unset,
`noImplicitAny: false` and `strictBindCallApply: false` — the defaults `nest new`
produces, left as they were.

Turning them all on produced **zero errors**. The code had been written to a standard
the compiler was never told to enforce, which is the worst of both worlds: the
discipline was being paid for and none of it was being checked.

## The one flag still off

`noUncheckedIndexedAccess` is `false`. Enabling it produces **26 errors**.

It makes `array[i]` and `record[key]` return `T | undefined`, which is the truth —
indexing past the end of an array is not a type error today, it is a runtime
`undefined` that surfaces three frames away. Every one of those 26 is a place that
could throw on unexpected input.

They are not fixed yet because each needs a decision, not a mechanical edit: is the
right answer a guard, a default, or an assertion that the index is known-good? Making
that call wrong converts a crash into silently wrong data, which is worse.

**This is a ratchet, not a permanent exemption.** Fix them in small batches, and when
the count reaches zero set the flag to `true` so it can never come back. If this
document still says 26 in six months, that is the finding.

The sibling repository `uza-nexus` has this flag on already, so the pattern to copy
exists.
