---
name: "superpowers-tdd"
description: "Test-Driven Development (TDD). Red-Green-Refactor cycle. (Banglish)"
---

# Superpowers TDD Skill

Superpowers methodology follow kore Red-Green-Refactor TDD cycle implement korar jonno ei skill.

---

## CRITICAL: TDD Philosophy

1.  **Red-Green-Refactor**: Failing test likhen (Red), minimum code likhen test pass korar jonno (Green), tarpor code clean koren (Refactor).
2.  **YAGNI**: You Aren't Gonna Need It. Proyojon chara unnecessary feature ba complexity add korben na.
3.  **Banglish**: Test failure explanation ebong refactoring notes Bengali language e English script e bolben.

---

## TDD Workflow

1.  **Write Failing Test**: Requirement onujayi ekta test likhen.
2.  **Run and Watch Fail**: Confirm koren test ta fail korche.
3.  **Write Minimal Code**: Sudhu test pass korar jonno minimum logic likhen.
4.  **Refactor**: Logic clean koren tests pass thaka obosthay.

---

## Final Goal

Testing-er maddhome bug-free ebong high-quality code implement kora.

---

## API Testing Best Practices (Lessons Learned)

1. **Simulate Real Frontend Payload**: E2E ebong API tests lekhar shomoy, frontend theke jemon data ashe (e.g., partial update e shudhu changed field na pathiye puro form state pathano), thik temon real-world payload simulate kora uchit. Nole duplicate unique key er moto bug backend e dhara porbe na.
2. **Unique Field Updates**: Partial update (PATCH) er shomoy jodi payload e kono unique field (jemon `title`, `slug`) theke thake ebong sheta change na hoye thake, tahole backend e unique constraint collision avoid korar jonno exclude/ignore logic implement kora o test kora mandatory.
3. **Proper API Log Design (`logApi`)**: Test e `logApi` bebohar korar shomoy dynamic path (jemon `/:id` ba `/:slug`) thakle shekhan e string interpolation (e.g. `` `/api/users/${id}` ``) bebohar korben na. Er poriborte original route pattern ta url hishebe pass korben (e.g. `'/api/users/:id'`) ebong actual dynamic value ta `requestData.params` object e pathaben (e.g. `params: { id: targetId }`). Eta korle logger automatically RESTful endpoint design maintain kore sundor output dibe.
