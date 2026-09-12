# Промпт: принять edit-path Goal и подготовить контракт монотонной политики

Работай в `/Users/2am./Projects/Personal/pi-warden`.

Выполни весь переход ниже самостоятельно и остановись до выполнения следующего Goal. Разрешены: документальная фиксация принятия `20260911-edit-path-default-decisions`, один локальный коммит принятого Goal, fast-forward локальной `main`, создание ветки `codex/monotonic-policy-authority-contract` и замена активного `IMPLEMENTATION_HANDOFF.md` на следующий bounded Goal. Не выполняй push, не создавай PR, не удаляй ветки, не начинай следующий Goal и не меняй локальные настройки инструментов.

## 1. Проверь исходное состояние

Прочитай `AGENTS.md`, `STATE.md`, `ARCHITECTURE.md`, `ROADMAP.md` и `IMPLEMENTATION_HANDOFF.md`. Не открывай `.qwen/` и не обращайся к реальным credentials.

Ожидается:

- branch: `codex/edit-path-default-decisions`;
- HEAD и локальная `main`: `be78e2cc3e4f6608b75e4b68cf5c24a248b0ba9d`;
- index пуст;
- `src/policy/decisions.ts` отличается от HEAD только одним аддитивным edit-path хунком в 64 строки после принятой write-функции;
- `test/edit-decisions.test.ts` — единственный новый тестовый файл Goal;
- заранее существующие рабочие изменения: `.gitignore`, `IMPLEMENTATION_HANDOFF.md`, `STATE.md`, `.opencode-permission-canary.txt`, `.qwen/`, `docs/WRITE-PATH-ACCEPTANCE-TRANSITION.md` и этот prompt.

Ожидаемые SHA-256 текущего принятого кандидата:

| File | SHA-256 |
| --- | --- |
| `src/policy/decisions.ts` | `0dabdf33db6a2b3738de3d90173e7b20d302aeb9cccba9b483c94c13b2be28be` |
| `test/edit-decisions.test.ts` | `c5b7e955e72923a53d31bbd3eeca784bdb1352fc4962f30dec8f073cdc4c1eca` |
| `IMPLEMENTATION_HANDOFF.md` | `a24d9cd4e662b8fa78372ad11ba2b827730c7ab3c335787bd931970288293eb0` |

Неизменяемые anchors должны совпасть:

| File | SHA-256 |
| --- | --- |
| `src/policy/paths.ts` | `f8367abe4d381b90f132ffe651aa8e8de26fc629a42a0dcc69c6cd2cce941e02` |
| `src/policy/resources.ts` | `e2c5045bc14fcb3ecfdf935814d48040f63dfb73bea5b71255a973482b75e749` |
| `test/paths.test.ts` | `676e00aaef9f26e70dfad5ea9513a702352d2d707fd5cc0f04f62c0ed3b21398` |
| `test/resources.test.ts` | `f9a03c98a6ee9c01ae9103ede6f87fc37ee656966a14730ffe6e35df31478436` |
| `test/decisions.test.ts` | `a7a25d710e9818ffe85abcaf5b207d6e1481472b2ef7934e51da24fd888b9911` |
| `test/write-decisions.test.ts` | `e0d39598c0cacbab4a2e920b6134d15f9a2fb2c3d39254df712bdc8fa3a58045` |

Принятые read/write части `src/policy/decisions.ts` должны совпадать с HEAD byte-for-byte. Если исходное состояние отличается, появились неизвестные изменения, index не пуст, hash не совпал или переход уже частично выполнен — установи фактическое состояние и остановись с точным отчётом. Не выполняй `reset`, `restore`, `clean`, `stash`, rebase, force-update или реконструкцию по догадке.

## 2. Зафиксируй независимый PASS

Владелец принял результат независимого security review, выполненного напрямую моделью `opencode-go/deepseek-v4.1-flash`, без субагента. Метод: ручная инспекция, 11 мутаций в отдельной временной копии проекта и повторный прогон всех проверок handoff. Репозиторий при мутационном анализе не изменялся.

Проверенная evidence:

- итоговый verdict: PASS, дефектов реализации не обнаружено;
- 11/11 мутаций убиты тестами: provenance guard, loose equality, отключение или инверсия missing- и membership-проверок, `secret`/`sensitive`, пропуск классификатора, лишнее поле результата и нарушение precedence;
- reviewer изменил только `test/edit-decisions.test.ts`, добавив `["edit"]` и `new String("edit")` в невалидные операции; это defense-in-depth проверка запрета coercion и входит в scope Goal;
- `node --test test/edit-decisions.test.ts`: PASS 9/9;
- `node --test test/decisions.test.ts`: PASS 8/8;
- `node --test test/write-decisions.test.ts`: PASS 9/9;
- `npm run check`: typecheck PASS и 137/137 tests;
- `git diff --check`: PASS;
- index пуст;
- семь anchors, кроме намеренно изменённого `src/policy/decisions.ts`, не изменились;
- ошибка классификатора распространяется структурно, потому что `evaluateEditPath` не перехватывает её; runtime-провокация через genuine resolver issuance недостижима и должна быть записана как ограничение проверки, а не как дефект.

Создай `docs/EDIT-PATH-DECISIONS-AUDIT.md`. Запиши туда reviewer/model, метод, verdict, полные hashes, 11/11 mutation evidence, точное defense-in-depth изменение теста, результаты проверок, проверенные precedence/provenance свойства и ограничение classifier-error probe. Не утверждай, что reviewer был read-only: он изменил только тестовый файл указанным образом. Отдельно укажи, что первичная модель после отчёта повторно получила те же focused/full результаты, hashes, anchors, чистые whitespace checks и пустой index.

Явно сохрани ограничения: это синхронное content-blind path-rule решение, а не enforcement, approval, capability, configuration или containment. Оно не проверяет тип объекта, семантику edit-патча, атомарность, permissions, полный набор затрагиваемых ресурсов, TOCTOU, symlink replacement, hard links или mounts. Pi integration, approval flow, configuration, shell/network policy и OS containment отсутствуют.

Минимально обнови:

- `STATE.md`: edit-path Goal принят после независимого PASS; перечисли фактическую evidence; commit пока готовится;
- `ARCHITECTURE.md`: read/write/edit default path primitives реализованы и приняты, но не интегрированы; их `ALLOW` не может обходить будущие более строгие ограничения;
- `ROADMAP.md`: закрой только пункт `Structured ALLOW, ASK, and DENY decisions with reason codes`, поскольку фиксированные решения для трёх поддерживаемых файловых операций `read`, `write`, `edit` приняты. Пункт `Monotonic configuration authority rules` и release gate Phase 1 оставь открытыми. Не закрывай Phase 1 и не меняй другие checkbox.

## 3. Проверь и создай отдельный коммит

До staging выполни по порядку:

```sh
node --test test/edit-decisions.test.ts
node --test test/decisions.test.ts
node --test test/write-decisions.test.ts
npm run check
git diff --check
git status --short --branch
```

При любой ошибке остановись. Не исправляй production code или accepted read/write code в этом задании.

В commit входят ровно семь файлов:

1. `ARCHITECTURE.md`
2. `IMPLEMENTATION_HANDOFF.md`
3. `ROADMAP.md`
4. `STATE.md`
5. `docs/EDIT-PATH-DECISIONS-AUDIT.md`
6. `src/policy/decisions.ts`
7. `test/edit-decisions.test.ts`

Не включай `.gitignore`, `.qwen/`, `.opencode-permission-canary.txt`, `docs/WRITE-PATH-ACCEPTANCE-TRANSITION.md` или `docs/EDIT-PATH-ACCEPTANCE-TRANSITION.md`. Не используй `git add .` или `git add -A`.

После selective staging проверь полный staged diff, точные семь путей, `git diff --cached --check`, staged blob hashes source/test, byte-identical read/write prefix, anchors и отсутствие secret-like/generated noise. Создай один локальный commit:

```text
feat: add default edit-path decisions
```

Не отключай hooks. Запиши полный commit SHA, проверь его фактические семь файлов и пустой index.

## 4. Fast-forward main и создай следующую ветку

Перейди на локальную `main` и выполни только:

```sh
git merge --ff-only codex/edit-path-default-decisions
```

Если fast-forward невозможен, остановись без merge commit, rebase или force-update.

Создай `codex/monotonic-policy-authority-contract` от обновлённой `main`. Сохрани прежние feature-ветки. Проверь, что `main`, `codex/edit-path-default-decisions` и HEAD новой ветки указывают на созданный edit-path commit. Не выполняй push.

## 5. Подготовь следующий bounded Goal

В новой ветке замени `IMPLEMENTATION_HANDOFF.md` на executor-neutral handoff со структурой `Goal`, `Context`, `Scope`, `Acceptance Criteria`, `Verification`, `Constraints`, `Escalate If`:

```text
Task ID: 20260911-monotonic-policy-authority-contract
Baseline: <полный SHA edit-path commit>
```

Goal — создать точный, проверяемый, документационный контракт монотонной конфигурационной иерархии до написания parser/merge/runtime-кода. Результат должен однозначно определять, какие источники имеют authority, как комбинируются ограничения и почему project-controlled configuration никогда не может ослабить built-in/global policy.

Scope следующего Goal:

- создать только `docs/MONOTONIC-POLICY-AUTHORITY.md`;
- не изменять source, tests, package/dependencies, `STATE.md`, `ARCHITECTURE.md`, `ROADMAP.md` или другие документы;
- не реализовывать parser, schema, merge function, approvals, Pi integration или enforcement;
- не stage, commit, push и не переходить к следующему Goal;
- остановиться с готовым документом для независимого review.

Acceptance Criteria документа:

1. Перечислены и разделены built-in defaults, trusted user/global configuration, project-controlled configuration и будущие scoped user approvals; для каждого источника указаны владелец, trust boundary и допустимый эффект.
2. Определён порядок строгости базовых authorization outcomes `ALLOW < ASK < DENY` и операция монотонного объединения, при которой более строгий результат побеждает. `SANDBOX` описан как отдельная containment-ось, а не как способ ослабить `DENY` или заменить authorization outcome.
3. Project-controlled configuration может только сохранить или усилить effective restriction. Попытка заменить `DENY` на `ASK/ALLOW`, `ASK` на `ALLOW`, отключить classification/provenance/canonicalization либо расширить trusted workspace authority недопустима.
4. Trusted user/global configuration не получает неограниченный bypass: документ явно отделяет будущие явно поддерживаемые owner choices от hard security invariants и перечисляет вопросы, которые должны оставаться нерешёнными до отдельного Goal.
5. Future approval может удовлетворить только конкретный `ASK` в явно заданных scope/resource/operation/time boundaries; approval не превращает hard `DENY` в разрешение и не отменяет containment.
6. Для отсутствующего, неизвестного, malformed, неоднозначного или неподдерживаемого security-relevant configuration определено fail-closed поведение. Документ не придумывает file format, path, parser API или migration semantics.
7. Есть полная таблица комбинаций для `ALLOW/ASK/DENY`, включая global/default + project restriction, с итоговым outcome и стабильным объяснением. Приведены adversarial cases: project allow поверх global deny, project allow поверх global ask, unknown values/keys, partial config, duplicate/conflicting rules и попытки отключить secret/provenance/path protections.
8. Описано, как принятые read/write/edit path decisions входят в будущую композицию: это один входной default outcome; никакая конфигурация не должна мутировать genuine `ResolvedPath`, подменять classification или использовать `ALLOW` как capability token.
9. Чётко перечислены deferred решения: schema/API, загрузка файлов, precedence между несколькими trusted global sources, approval storage/UI, Pi integration, sandbox/network, delete/rename/multi-resource policy. Документ не выдаёт их за реализованные.
10. Формулировки согласованы с `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STATE.md`, `THREAT_MODEL.md`, `SECURITY.md`, `docs/DEVELOPMENT.md` и `docs/SECURITY-CHECKLIST.md`; никаких текущих гарантий сверх реализации не добавлено.

Verification следующего Goal:

- проверить только diff нового документа и `git diff --check`;
- проверить ссылки и термины целевыми `rg` запросами;
- подтвердить отсутствие изменений source/tests/config/dependencies и пустой index;
- сообщить неоднозначности как вопросы для review, не выбирать скрытые implementation semantics;
- остановиться для независимого review документа.

В `STATE.md` после commit/transition запиши фактические branch/HEAD, SHA принятого edit-path commit, fast-forward `main`, закрытие только roadmap-пункта structured decisions и статус `20260911-monotonic-policy-authority-contract: HANDOFF PREPARED; NOT STARTED`. Новый `STATE.md` и новый `IMPLEMENTATION_HANDOFF.md` оставь незакоммиченными рабочими изменениями новой ветки.

## 6. Финальная проверка и остановка

Проверь:

- active branch `codex/monotonic-policy-authority-contract`;
- HEAD и локальная `main` равны edit-path commit;
- commit содержит ровно семь разрешённых файлов;
- index пуст;
- committed `src/policy/decisions.ts` и `test/edit-decisions.test.ts` имеют принятые hashes;
- read/write code и все anchors сохранились;
- `docs/MONOTONIC-POLICY-AUTHORITY.md` ещё отсутствует;
- post-transition `STATE.md` и новый handoff согласованы с branch/HEAD;
- `git diff --check` проходит;
- `.gitignore`, `.qwen/`, canary и оба transition prompt сохранены вне commit;
- push/PR не выполнялись.

Закончи отчётом: commit SHA и точные семь файлов, результаты checks, fast-forward, активная ветка, новый Task ID/baseline/scope, сохранённые рабочие изменения и ограничения. На этом остановись.
