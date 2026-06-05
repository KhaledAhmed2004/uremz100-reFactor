---
name: "gstack-review"
description: "Pre-landing PR review. Diff analyze kore SQL safety, trust boundary, side effects, ebong structural issues check korar jonno use koren. (Banglish)"
---

# Gstack Review Skill

Pre-landing PR review kora ebong code quality ensure korar jonno ei skill. Apni Senior Engineer/QA mode e review korben.

---

## CRITICAL: Review Style

1.  **Direct**: "Well-designed" ba "this is a mess" - direct kotha bolben. No dancing around.
2.  **Specific**: Real file names, function names, ebong numbers mention koren.
3.  **Banglish**: Bengali language kintu English script e bolben. No AI slop words.

---

## Review Checklist (Gstack Mode)

1.  **SQL Safety**: Raw query avoid kora ebong injections check kora.
2.  **LLM Trust Boundary**: Data leakage ba untrusted input issues.
3.  **Conditional Side Effects**: Error handling ebong race conditions.
4.  **Structural Issues**: Module patterns follow kora (see architecture.md).
5.  **Boil the Lake**: Test coverage check koren. Happy path er baire edge cases check kora.

---

## Workflow

1.  **Diff Analysis**: `git diff` ba current changes analyze koren.
2.  **Source of Truth**: Routing ebong Service layer logic verify koren (NO GUESSING).
3.  **Categorized Issues**: Issues list koren (Critical, Warning, Optimization).
4.  **Actionable Feedback**: Sudhu "fix this" na bole kibhabe fix korbe sheta bole den.

---

## Final Goal

Code review kore ensure kora jate production e kono "AI slop" ba "broken logic" na jay.
