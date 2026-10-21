# brain-pane

A Claude Code mod that draws `brain/next/`, `brain/todo/` and the STATUS.md
headline in a pane beside the transcript. It is `ls brain/` with colours and a
timer. It writes nothing.

Any repo with a `brain/` directory gets the pane. No `brain/`, no pane.

## Install

Windows: download or clone this repo and double-click `install.bat`. It runs
`install.ps1`, which installs the plugin at user scope and sets the TUI to
fullscreen.

Any OS, from a shell:

```
claude plugin install brain-pane --marketplace aweussom/brain-pane
```

Answer `y` to "Add marketplace?", then Enter for user scope. Then set the TUI
once, inside Claude Code:

```
/tui fullscreen
```

Without it the pane opens inline above the prompt with a few rows and cuts the
list; the mod says so in yellow when that happens.

Updates:

```
claude plugin update brain-pane
```

or `/reload-plugins` in a running session after a `claude plugin marketplace
update brain-pane`.

## What it shows

- The STATUS.md headline (the first bold sentence) and its last commit date.
- Every non-empty bucket, `next/1-now` through `todo/3-someday`, with its item
  count. A `1-now` above five items is marked red.
- One line per item: ID, cost, slug cut to the pane width. Age is the colour of
  the line, from `git log -1 --format=%as` on the file: green up to a day, teal
  to 3, blue to 7, purple to 14, red after. An item past its bucket's limit
  (`1-now` 14 days, `doing/` 7) is red and bold whatever its age. A legend is
  at the bottom.
- The `brain/proposed/` count.

It rescans every minute and after any tool call that names `brain/` or
`STATUS.md`, so a `git mv` shows at once.

## Commands

- `/brain` toggles the pane. It opens by itself at session start in a repo with
  `brain/`.
- The pane asks for 44 columns; a width you drag the dock to wins.

## The brain/ convention it expects

```
brain/
  next/1-now  2-soon  3-someday  waiting  waiting-on-time
  todo/doing  1-now   2-soon     3-someday
  proposed/
```

One markdown file per item, named `NNN-<cost>-<slug>.md`, for example
`047-4h-quality-over-turns-benchmark.md`. The ID shown is `N-047` or `T-047`
by tree. Moving a file between
buckets is the state change. The pane reads directory names and file names; it
does not parse the files.

## Changing it

Edit `hooks/register.tsx`, then `/reload-plugins`. Breakpoints, the colour
steps and the width are constants at the top of the file.
`claude plugin validate <folder>` checks it before a session loads it.
