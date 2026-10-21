// brain-pane: `ls brain/next brain/todo` drawn in a pane, ages from git.
// Doctrine §3.3 says ls is the view; this is ls with a renderer and a timer.
// It reads the directories and runs `git log`; it writes nothing.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BrainItem, BrainSnapshot } from '../types'

const PANE = 'brain'

const BUCKETS = [
  'next/1-now',
  'next/2-soon',
  'next/3-someday',
  'next/waiting',
  'next/waiting-on-time',
  'todo/doing',
  'todo/1-now',
  'todo/2-soon',
  'todo/3-someday',
]

// §3.3 and premise-sweep check 6: 1-now 14 days, doing/ 7, more than five in a 1-now.
const AGE_LIMIT_DAYS: Record<string, number> = {
  'next/1-now': 14,
  'todo/1-now': 14,
  'todo/doing': 7,
}
const NOW_LIMIT_COUNT = 5

// Age as colour, green through blue to red; the step is the upper bound in days.
// An uncommitted item (no git date) is the newest there is and takes the first step.
const AGE_STEPS: { upTo: number; color: string; label: string }[] = [
  { upTo: 1, color: '#4caf50', label: '≤1d' },
  { upTo: 3, color: '#26a69a', label: '≤3d' },
  { upTo: 7, color: '#42a5f5', label: '≤7d' },
  { upTo: 14, color: '#ab47bc', label: '≤14d' },
  { upTo: Infinity, color: '#ef5350', label: 'older' },
]

function ageColor(ageDays: number | null): string {
  const days = ageDays ?? 0
  for (const step of AGE_STEPS) {
    if (days <= step.upTo) return step.color
  }
  return AGE_STEPS[AGE_STEPS.length - 1]!.color
}
// The dock width asked for; a width the person drags to wins over it.
const PANE_COLUMNS = 44

const LAYOUT_REMINDER =
  'brain-pane: inline layout cuts the list. Type /tui fullscreen to dock the pane.'

const EMPTY: BrainSnapshot = {
  scannedAt: 0,
  statusDate: '',
  statusHeadline: '',
  proposedCount: 0,
  items: [],
  error: '',
}

const snapshot = atom({ plugin: 'brain-pane', key: 'snapshot' } as const, EMPTY)

/**
 * Reads brain/ and STATUS.md into one snapshot. Age is `git log -1 --format=%as`
 * per item, as the triage skill computes it; an uncommitted item has no age.
 */
async function scan($: EngineInterface): Promise<BrainSnapshot> {
  const today = await $.clock.now()
  const items: BrainItem[] = []

  for (const bucket of BUCKETS) {
    const dir = `brain/${bucket}`
    const isThere = await $.fs.exists(dir)
    if (!isThere) continue
    const entries = await $.fs.list(dir)
    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
      const match = /^(\d{3})-([0-9a-z]+)-(.+)\.md$/.exec(entry.name)
      if (!match) continue
      const number = match[1] ?? ''
      const cost = match[2] ?? ''
      const slug = match[3] ?? ''
      const letter = bucket.startsWith('next/') ? 'N' : 'T'
      const path = `${dir}/${entry.name}`
      const log = await $.process.run(['git', 'log', '-1', '--format=%as', '--', path])
      const dateText = log.stdout.trim()
      let ageDays: number | null = null
      if (dateText !== '') {
        const committedAt = Date.parse(dateText)
        ageDays = Math.floor((today - committedAt) / 86_400_000)
      }
      items.push({ bucket, id: `${letter}-${number}`, cost, slug, ageDays })
    }
  }

  let proposedCount = 0
  if (await $.fs.exists('brain/proposed')) {
    const proposed = await $.fs.list('brain/proposed')
    proposedCount = proposed.filter(entry => entry.kind === 'file' && entry.name.endsWith('.md')).length
  }

  let statusDate = ''
  let statusHeadline = ''
  if (await $.fs.exists('STATUS.md')) {
    const statusLog = await $.process.run(['git', 'log', '-1', '--format=%as', '--', 'STATUS.md'])
    statusDate = statusLog.stdout.trim()
    const text = await $.fs.read('STATUS.md')
    const bold = /\*\*([^*]+)\*\*/.exec(text)
    statusHeadline = bold?.[1] ?? text.split('\n')[0] ?? ''
  }

  return { scannedAt: today, statusDate, statusHeadline, proposedCount, items, error: '' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'brain', description: 'Toggle the brain/ pane: buckets, items, ages' })
    // Unasked only where there is a brain/ to show; /brain opens it anywhere.
    const hasBrain = await $.fs.exists('brain')
    if (hasBrain) void $.ui.open({ id: PANE, title: 'brain/', columns: PANE_COLUMNS })

    // The pane docks beside the transcript only in the fullscreen layout; inline it gets
    // a few rows and cuts the list. User settings do not travel between machines, so say so.
    if (hasBrain) {
      const settings = await $.settings.read()
      const tui = (settings as { tui?: unknown }).tui
      if (tui !== 'fullscreen') $.ui.toast(LAYOUT_REMINDER)
    }

    const rescan = async () => {
      try {
        const fresh = await scan($)
        await update($, snapshot, () => fresh)
      } catch (error) {
        await update($, snapshot, old => ({ ...old, error: String(error) }))
      }
    }
    void rescan()
    $.clock.every(60_000, () => void rescan())

    return next(e)
  })

  // /brain toggles: the engine's own record of open panes decides, so it is right after a reload too.
  on('command.run', { command: 'brain' }, async $ => {
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isUp) {
      await $.ui.close({ id: PANE })

      return { text: 'brain/ pane closed. /brain opens it again.' }
    }
    await $.ui.open({ id: PANE, title: 'brain/', columns: PANE_COLUMNS })

    return { text: 'brain/ pane opened. /brain closes it.' }
  })

  // A git mv, a new item or a STATUS.md rewrite shows up at once, not at the next minute.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    // The event is the tool's own fields, not an `input` object; one string of all of them.
    const fields = JSON.stringify(e)
    const touchesBrain = fields.includes('brain/') || fields.includes('STATUS.md')
    if (touchesBrain) {
      try {
        const fresh = await scan($)
        await update($, snapshot, () => fresh)
      } catch (error) {
        await update($, snapshot, old => ({ ...old, error: String(error) }))
      }
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const width = Math.max(30, e.props.bodyColumns ?? e.viewport?.columns ?? 80)

    if (snap.scannedAt === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Scanning brain/ …</Text>
          {snap.error !== '' && <Text color="red">{snap.error}</Text>}
        </Box>
      )
    }

    const scanned = new Date(snap.scannedAt).toISOString().slice(11, 16)

    // The headline gets two lines, then [..]; the rest is in STATUS.md itself.
    const headlineRoom = width * 2 - 16
    const isHeadlineCut = snap.statusHeadline.length > headlineRoom
    const headline = isHeadlineCut
      ? snap.statusHeadline.slice(0, headlineRoom).trimEnd() + ' [..]'
      : snap.statusHeadline

    const isInline = e.viewport?.isFullscreen === false

    return (
      <Box flexDirection="column">
        {isInline && <Text color="yellow">{LAYOUT_REMINDER}</Text>}
        <Text bold>STATUS.md</Text>
        <Text>
          <Text dimColor>{snap.statusDate} </Text>
          {headline}
        </Text>
        <Text> </Text>
        {BUCKETS.map(bucket => {
          const rows = snap.items.filter(item => item.bucket === bucket)
          if (rows.length === 0) return null
          const ageLimit = AGE_LIMIT_DAYS[bucket]
          const isCrowded = bucket.endsWith('1-now') && rows.length > NOW_LIMIT_COUNT
          const header = (
            <Text>
              <Text bold color={isCrowded ? 'red' : undefined}>{bucket}</Text>
              <Text dimColor> ({rows.length}){isCrowded ? ' above five' : ''}</Text>
            </Text>
          )
          // One line per item: id, cost, the slug cut to the room with ...; age is the colour.
          // Past the bucket's own limit (1-now 14 d, doing 7 d) the line is red and bold.
          // A reminder of what waits, not the item; the markdown is one open away.
          return (
            <Box flexDirection="column" key={bucket}>
              {header}
              {rows.map(item => {
                const isOverLimit = ageLimit !== undefined && item.ageDays !== null && item.ageDays > ageLimit
                const color = isOverLimit ? AGE_STEPS[AGE_STEPS.length - 1]!.color : ageColor(item.ageDays)
                const words = item.slug.replaceAll('-', ' ')
                const room = width - 2 - item.id.length - 1 - item.cost.length - 1
                const isCut = words.length > room
                const shown = isCut ? words.slice(0, Math.max(0, room - 3)).trimEnd() + '...' : words
                return (
                  <Text key={item.id} wrap="truncate-end" color={color} bold={isOverLimit}>
                    {'  '}
                    {item.id}
                    <Text dimColor> {item.cost} </Text>
                    {shown}
                  </Text>
                )
              })}
            </Box>
          )
        })}
        <Text> </Text>
        <Text>
          <Text bold>proposed/</Text>
          <Text dimColor> {snap.proposedCount} untriaged</Text>
        </Text>
        <Text>
          <Text dimColor>age </Text>
          {AGE_STEPS.map(step => (
            <Text key={step.label} color={step.color}>{step.label} </Text>
          ))}
        </Text>
        <Text dimColor>scanned {scanned}Z · /brain toggles · ages from git log</Text>
        {snap.error !== '' && <Text color="red">{snap.error}</Text>}
      </Box>
    )
  })
}
