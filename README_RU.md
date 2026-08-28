<p align="right">
  <a href="./README.md">English</a> · Русский
</p>

# GitMiner ⛏️

GitMiner превращает график активности GitHub в пиксельную анимацию с шахтёром.

Шахтёр перемещается между активными ячейками, добывает блоки разной ценности, разбивает их на частицы и показывает экран `MINING COMPLETE`, после чего анимация начинается заново.

![Пример GitMiner](./examples/git-miner.svg)

## Как это работает

- GitMiner получает календарь активности через GitHub API.
- Уровни активности превращаются в каменные, медные, золотые или алмазные блоки.
- Для разрушения более ценных блоков требуется больше ударов киркой.
- Шахтёр перемещается по линиям календарной сетки, а разные типы руды имеют собственные эффекты разрушения.
- Готовый SVG не использует JavaScript и внешние ресурсы и работает прямо в README профиля GitHub.
- При включённом системном режиме уменьшения движения отображается статичная версия.

## Добавление GitMiner в профиль

Репозиторий профиля должен называться так же, как ваш GitHub-аккаунт. Например, для пользователя `octocat` это репозиторий `octocat/octocat`.

### 1. Создайте workflow

Создайте в репозитории профиля файл:

```text
.github/workflows/git-miner.yml
```

Добавьте в него следующий workflow:

```yaml
name: Generate GitMiner

on:
  schedule:
    - cron: "0 */12 * * *"
  workflow_dispatch:

concurrency:
  group: git-miner-${{ github.repository }}
  cancel-in-progress: true

jobs:
  generate:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: JustTheMercer/GitMiner@v1
        with:
          github_user_name: ${{ github.repository_owner }}
          outputs: |
            dist/git-miner.svg
            dist/git-miner-dark.svg?theme=github-dark

      - name: Publish generated SVGs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd dist
          git init
          git checkout -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "Update GitMiner [skip ci]"
          git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
          git push --force origin output
```

Готовый пример находится в файле [`examples/profile-workflow.yml`](./examples/profile-workflow.yml).

#### Приватная активность (необязательно)

По умолчанию учитывается только публичная активность. Чтобы добавить приватную активность:

1. Откройте GitHub `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`.
2. Создайте токен только с разрешением `read:user`.
3. В репозитории профиля откройте `Settings` → `Secrets and variables` → `Actions` и создайте секрет `GH_PAT`.
4. Добавьте `github_token` в шаг GitMiner:

```yaml
- uses: JustTheMercer/GitMiner@v1
  with:
    github_user_name: ${{ github.repository_owner }}
    github_token: ${{ secrets.GH_PAT }}
    outputs: |
      dist/git-miner.svg
      dist/git-miner-dark.svg?theme=github-dark
```

Никогда не вставляйте токен напрямую в workflow или README. GitMiner использует только количество вкладов и не отображает названия приватных репозиториев.

### 2. Запустите workflow

Откройте вкладку `Actions` в репозитории профиля, выберите `Generate GitMiner` и нажмите `Run workflow`.

Workflow создаст ветку `output` со светлой и тёмной версиями SVG. Затем файлы будут автоматически обновляться каждые 12 часов.

### 3. Добавьте анимацию в README профиля

Замените `USERNAME` на имя своего GitHub-аккаунта и вставьте код в профильный `README.md`:

```html
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="
      https://raw.githubusercontent.com/USERNAME/USERNAME/output/git-miner-dark.svg
    "
  />
  <source
    media="(prefers-color-scheme: light)"
    srcset="
      https://raw.githubusercontent.com/USERNAME/USERNAME/output/git-miner.svg
    "
  />
  <img
    alt="Анимация GitMiner"
    src="https://raw.githubusercontent.com/USERNAME/USERNAME/output/git-miner.svg"
  />
</picture>
```

## Параметры

Параметры можно указывать после пути к выходному файлу:

```yaml
outputs: |
  dist/git-miner.svg?theme=github-light&speed=1.2
  dist/git-miner-dark.svg?theme=github-dark&speed=1.2&effects=high
```

Доступные параметры:

- `theme`: тема `github-light` или `github-dark`
- `speed`: `slow`, `normal`, `fast` или множитель от `0.4` до `3` (`1` — обычная скорость, `2` — вдвое быстрее)
- `effects`: количество визуальных эффектов — `low`, `normal` или `high`
- `show_stats`: показывать итоговый экран — `true` или `false`

Пресеты сохранены для совместимости, а числовое значение позволяет точно настроить скорость:

```yaml
outputs: |
  dist/git-miner-slow.svg?speed=0.65
  dist/git-miner-normal.svg?speed=1
  dist/git-miner-fast.svg?speed=1.75&show_stats=false
```

## Локальная разработка

Требуются Node.js 24+ и pnpm 11.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm generate --fixture
```

## Лицензия

[MIT](./LICENSE)
