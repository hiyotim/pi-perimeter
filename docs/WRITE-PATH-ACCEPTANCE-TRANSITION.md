# Промпт: принять write-path Goal и подготовить edit-path Goal

Работай в `/Users/2am./Projects/Personal/pi-warden`.

Выполни весь переход ниже самостоятельно и остановись до реализации следующего Goal. Разрешены: документационная фиксация принятия `20260911-write-path-default-decisions`, один локальный коммит принятого Goal, fast-forward локальной `main`, создание ветки `codex/edit-path-default-decisions` и замена активного `IMPLEMENTATION_HANDOFF.md` на следующий bounded Goal. Не выполняй push, не создавай PR, не удаляй ветки, не начинай edit-path реализацию и не меняй локальные настройки Paseo.

## 1. Проверь исходное состояние

Прочитай `AGENTS.md`, `STATE.md`, `ARCHITECTURE.md` и `IMPLEMENTATION_HANDOFF.md`. Не открывай `.qwen/` и не обращайся к реальным credentials.

Ожидается:

- branch: `codex/write-path-default-decisions`;
- HEAD и локальная `main`: `d5b4a189fc49183416dd3d0f62be1a09c5ab8eda`;
- index пуст;
- `src/policy/decisions.ts` изменён только одним аддитивным write-path хунком;
- `test/write-decisions.test.ts` — единственный новый тестовый файл Goal;
- заранее существующие рабочие изменения: `.gitignore`, `IMPLEMENTATION_HANDOFF.md`, `STATE.md`, `.opencode-permission-canary.txt`, `.qwen/` и этот prompt.

Ожидаемые SHA-256 реализации:

| File | SHA-256 |
| --- | --- |
| `src/policy/decisions.ts` | `26066ff31d4c99f5e3b4b252bfd68d718823e3078db971cc038ec4e4676bc8ed` |
| `test/write-decisions.test.ts` | `e0d39598c0cacbab4a2e920b6134d15f9a2fb2c3d39254df712bdc8fa3a58045` |
| `IMPLEMENTATION_HANDOFF.md` | `6799ba6f50554ba6312840aef20e7bf3b3495bf628c2b4852eda897eed4a9715` |

Пять неизменяемых anchors из handoff также должны совпасть: `paths.ts f8367abe…941e02`, `resources.ts e2c5045b…75e749`, `test/paths.test.ts 676e00aa…b21398`, `test/resources.test.ts f9a03c98…478436`, `test/decisions.test.ts a7a25d71…b9911`. Принятая read-часть `src/policy/decisions.ts` должна совпадать с HEAD byte-for-byte; write diff должен быть только добавлением 59 строк после неё.

Если исходное состояние отличается, появились неизвестные изменения, index не пуст, hash не совпал или переход уже частично выполнен — установи фактическое состояние и остановись с точным отчётом. Не reset, restore, clean, stash, force или реконструкция по догадке.

## 2. Зафиксируй независимый PASS

Goal прошёл независимый read-only security review без findings. Проверенная evidence:

- `node --test test/write-decisions.test.ts`: PASS 9/9;
- `node --test test/decisions.test.ts`: PASS 8/8;
- `npm run check`: typecheck PASS и 128/128 tests;
- `git diff --check` и `git diff --cached --check`: PASS;
- независимые временные probes: PASS 11/11;
- scope: только `src/policy/decisions.ts` +59 строк и новый `test/write-decisions.test.ts`;
- proxy/getter probes подтвердили ноль обращений к свойствам до `INVALID_RESOURCE`;
- invalid resource имеет приоритет над invalid operation; сравнение operation не выполняет coercion;
- ordinary inside existing/missing → `ALLOW/WORKSPACE_WRITE`; ordinary external existing/missing → `ASK/EXTERNAL_WRITE`; secret/sensitive deny везде;
- read source/test и пять anchors не изменились.

Создай `docs/WRITE-PATH-DECISIONS-AUDIT.md` с этим verdict, evidence, полными hashes, проверенными precedence/provenance свойствами и ограничениями. Явно укажи: результат является только path-rule, не enforcement/approval/capability; object type, overwrite semantics, permissions, atomicity, TOCTOU, symlink replacement, hard links, mounts и полный набор ресурсов операции не покрыты; Pi integration, config и containment отсутствуют. Не приписывай reviewer изменения файлов.

Минимально обнови:

- `STATE.md`: Goal accepted after independent PASS; roadmap decision checkbox остаётся открытым; commit пока готовится.
- `ARCHITECTURE.md`: read и write default path primitives реализованы и приняты, но не интегрированы; `ALLOW` не может обходить будущие ограничения.

Не закрывай roadmap checkbox и не изменяй `ROADMAP.md`.

## 3. Проверь и создай отдельный коммит

До staging выполни в порядке:

```sh
node --test test/write-decisions.test.ts
node --test test/decisions.test.ts
npm run check
git diff --check
git status --short --branch
```

При любой ошибке остановись; не исправляй scope или accepted read code в этом задании.

В commit входят ровно шесть файлов:

1. `ARCHITECTURE.md`
2. `IMPLEMENTATION_HANDOFF.md`
3. `STATE.md`
4. `docs/WRITE-PATH-DECISIONS-AUDIT.md`
5. `src/policy/decisions.ts`
6. `test/write-decisions.test.ts`

Не включай `.gitignore`, `.qwen/`, `.opencode-permission-canary.txt` и `docs/WRITE-PATH-ACCEPTANCE-TRANSITION.md`. Не используй `git add .` или `git add -A`.

После selective staging проверь полный staged diff, точные шесть путей, `git diff --cached --check`, hashes staged source/test и отсутствие secrets/generated noise. Создай один локальный commit:

```text
feat: add default write-path decisions
```

Не отключай hooks. Запиши полный commit SHA, проверь его фактические шесть файлов и пустой index.

## 4. Fast-forward main и создай следующую ветку

Перейди на локальную `main` и выполни только `git merge --ff-only codex/write-path-default-decisions`. Если fast-forward невозможен, остановись без merge commit, rebase или force-update.

Создай `codex/edit-path-default-decisions` от обновлённой `main`. Сохрани старые feature-ветки. Проверь, что `main`, `codex/write-path-default-decisions` и HEAD новой ветки указывают на созданный write-path commit. Не выполняй push.

## 5. Подготовь следующий bounded Goal

В новой ветке замени `IMPLEMENTATION_HANDOFF.md` на executor-neutral handoff:

```text
Task ID: 20260911-edit-path-default-decisions
Baseline: <полный SHA write-path commit>
```

Goal: добавить отдельный `evaluateEditPath(operation: "edit", resource: ResolvedPath)` в `src/policy/decisions.ts`, сохранив принятые read/write функции byte-identical, и создать `test/edit-decisions.test.ts`.

Фиксированная таблица, в порядке precedence:

| Condition | decision | reason |
| --- | --- | --- |
| resource не genuine resolver-issued | `DENY` | `INVALID_RESOURCE` |
| operation не точная строка `edit` | `DENY` | `UNSUPPORTED_OPERATION` |
| internal classification `secret` | `DENY` | `SECRET_RESOURCE` |
| internal classification `sensitive` | `DENY` | `SENSITIVE_RESOURCE` |
| ordinary resource с `targetExists === false` | `DENY` | `EDIT_TARGET_MISSING` |
| ordinary existing canonical inside workspace | `ALLOW` | `WORKSPACE_EDIT` |
| ordinary existing external | `ASK` | `EXTERNAL_EDIT` |

Handoff должен сохранить те же security boundaries: issuance до property access; invalid resource раньше invalid operation; exact noncoercing operation; classification только внутренняя и без fallback; secret/sensitive раньше missing/membership; canonical workspace relation; полные литеральные результаты; forged/proxy/getter attacks; обе стороны symlink boundary; broken-link и ENOTDIR chain; compile-time readonly/exact-pair checks; только temporary fake fixtures.

Scope следующей реализации — только изменение `src/policy/decisions.ts` и создание `test/edit-decisions.test.ts`. Запрети изменение существующих тестов, документации, dependencies, Pi integration, config, approval, shell/network/sandbox, staging/commit/push и переход к следующему Goal. Verification: focused edit test, принятые read и write tests отдельно, `npm run check`, `git diff --check`, status, anchors и пустой index. Stop после реализации для независимого review.

В `STATE.md` после commit/transition запиши фактические branch/HEAD, SHA принятого write-path commit, fast-forward `main` и `20260911-edit-path-default-decisions: HANDOFF PREPARED; NOT IMPLEMENTED`. Не меняй roadmap checkbox. Эти post-commit `STATE.md` и новый handoff оставь незакоммиченными рабочими изменениями новой ветки.

## 6. Финальная проверка и остановка

Проверь:

- active branch `codex/edit-path-default-decisions`;
- HEAD и `main` равны write-path commit;
- index пуст;
- read/write production и tests совпадают с принятым commit;
- `test/edit-decisions.test.ts` отсутствует;
- `STATE.md` и новый handoff согласованы с branch/HEAD;
- `git diff --check` проходит;
- `.gitignore`, `.qwen/`, canary и этот prompt сохранены вне commit;
- push/PR не выполнялись.

Закончи отчётом: commit SHA и точные файлы, результаты checks, fast-forward, активная ветка, новый Task ID/baseline/scope, сохранённые рабочие изменения и ограничения. На этом остановись.
