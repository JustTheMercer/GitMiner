<p align="right">
  English · <a href="./README_RU.md">Русский</a>
</p>

# GitMiner ⛏️

GitMiner turns your GitHub contribution graph into an animated pixel-art mining scene.

The miner walks between active contribution cells, mines different ore blocks, breaks them into particles, and shows a `MINING COMPLETE` screen before the animation starts again.

![GitMiner example](./examples/git-miner.svg)

## How it works

- GitMiner reads your public contribution calendar through the GitHub API.
- Contribution levels become stone, copper, gold, or diamond blocks.
- Harder blocks require more pickaxe hits.
- The generated SVG is self-contained, uses no JavaScript or external assets, and works directly in a GitHub Profile README.

## Add GitMiner to your profile

Your profile repository must have the same name as your GitHub username. For example, the profile repository for `octocat` is `octocat/octocat`.

### 1. Create the workflow

In your profile repository, create:

```text
.github/workflows/git-miner.yml
```

Add the following workflow:

```yaml
name: Generate GitMiner

on:
  schedule:
    - cron: "0 */12 * * *"
  workflow_dispatch:

jobs:
  generate:
    permissions:
      contents: write
    runs-on: ubuntu-latest

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

A ready-to-copy version is available in [`examples/profile-workflow.yml`](./examples/profile-workflow.yml).

#### Include private contributions (optional)

The workflow above includes public contributions. To include private contribution counts as well:

1. Open GitHub `Settings` → `Developer settings` → `Personal access tokens` → `Tokens (classic)`.
2. Create a token with only the `read:user` scope.
3. In your profile repository, open `Settings` → `Secrets and variables` → `Actions` and create a repository secret named `GH_PAT`.
4. Add `github_token` to the GitMiner step:

```yaml
- uses: JustTheMercer/GitMiner@v1
  with:
    github_user_name: ${{ github.repository_owner }}
    github_token: ${{ secrets.GH_PAT }}
    outputs: |
      dist/git-miner.svg
      dist/git-miner-dark.svg?theme=github-dark
```

Never paste the token directly into the workflow or README. GitMiner uses contribution counts only and does not display private repository names.

### 2. Run it

Open the `Actions` tab in your profile repository, select `Generate GitMiner`, and click `Run workflow`.

The workflow creates an `output` branch containing light and dark SVG files. It then refreshes them automatically every 12 hours.

### 3. Add it to your profile README

Replace `USERNAME` with your GitHub username and paste this into the profile `README.md`:

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
    alt="GitMiner contribution animation"
    src="https://raw.githubusercontent.com/USERNAME/USERNAME/output/git-miner.svg"
  />
</picture>
```

## Options

Options can be added after an output path:

```yaml
outputs: |
  dist/git-miner.svg?theme=github-light&speed=normal
  dist/git-miner-dark.svg?theme=github-dark&speed=normal
```

Available options:

- `theme`: `github-light` or `github-dark`
- `speed`: `slow`, `normal`, or `fast`
- `show_stats`: `true` or `false`

## Local development

Requires Node.js 24+ and pnpm 11.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm generate --fixture
```

## License

[MIT](./LICENSE)
