import type { ReactNode } from 'react'
import {
  type TooltipContentProps,
  type TooltipValueType,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate } from '../../lib/format'
import type { ExercisePoint, WeekBucket } from '../../lib/stats'
import { SERIES_1, SERIES_2 } from './chartColors'

const GRID = '#ececf0'
const AXIS = '#8e8e93'
const SURFACE = '#ffffff'

const axisProps = {
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#d1d1d6' },
} as const

function TooltipBox({ title, rows }: { title: string; rows: { color?: string; label: string; value: ReactNode }[] }) {
  return (
    <div className="min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg shadow-black/5">
      <p className="mb-1 font-medium text-ink-800">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-ink-600">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="tabular font-medium text-ink-900">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: i.color, height: 3 }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

const kgTick = (v: number) => `${v}`
const volTick = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : `${v}`)

/** Adapts a row renderer to Recharts' tooltip `content` prop. */
function tip<T>(render: (row: T) => ReactNode) {
  return function TooltipContent({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
    const row = payload?.[0]?.payload as T | undefined
    return active && row ? render(row) : null
  }
}

export function ExerciseProgressChart({ points, showE1RM }: { points: ExercisePoint[]; showE1RM: boolean }) {
  const rows = points.map((p) => ({ ...p, label: formatDate(p.date) }))
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} axisLine={false} tickFormatter={kgTick} domain={['auto', 'auto']} width={48} unit="" />
          <Tooltip
            cursor={{ stroke: '#d1d1d6', strokeWidth: 1 }}
            content={tip<(typeof rows)[number]>((r) => (
                <TooltipBox
                  title={formatDate(r.date, { year: true, weekday: true })}
                  rows={[
                    { color: SERIES_1, label: '最重組（實際）', value: `${r.topWeight} kg × ${r.topReps}` },
                    ...(showE1RM && r.e1rm != null
                      ? [{ color: SERIES_2, label: '估算 1RM', value: `${r.e1rm} kg` }]
                      : []),
                  ]}
                />
            ))}
          />
          <Line
            type="monotone"
            dataKey="topWeight"
            name="最重組（實際）"
            stroke={SERIES_1}
            strokeWidth={2}
            dot={{ r: 3, fill: SERIES_1, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: SERIES_1, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          {showE1RM && (
            <Line
              type="monotone"
              dataKey="e1rm"
              name="估算 1RM"
              stroke={SERIES_2}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: SERIES_2, stroke: SURFACE, strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WeeklyVolumeChart({ buckets }: { buckets: WeekBucket[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={12} />
          <YAxis {...axisProps} axisLine={false} tickFormatter={volTick} width={48} />
          <Tooltip
            cursor={{ fill: 'rgba(17,24,39,0.04)' }}
            content={tip<WeekBucket>((r) => (
                <TooltipBox
                  title={`${r.label} 當週`}
                  rows={[{ color: SERIES_1, label: '訓練量', value: `${Math.round(r.volume).toLocaleString('zh-TW')} kg` }]}
                />
            ))}
          />
          <Bar dataKey="volume" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function FrequencyChart({ buckets }: { buckets: WeekBucket[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={12} />
          <YAxis {...axisProps} axisLine={false} allowDecimals={false} width={48} />
          <Tooltip
            cursor={{ fill: 'rgba(17,24,39,0.04)' }}
            content={tip<WeekBucket>((r) => (
                <TooltipBox
                  title={`${r.label} 當週`}
                  rows={[
                    { color: SERIES_1, label: '教練課', value: `${r.coached} 次` },
                    { color: SERIES_2, label: '自主訓練', value: `${r.independent} 次` },
                  ]}
                />
            ))}
          />
          <Bar dataKey="coached" stackId="f" fill={SERIES_1} stroke={SURFACE} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="independent" stackId="f" fill={SERIES_2} stroke={SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BodyweightChart({ points }: { points: { date: string; value: number }[] }) {
  const rows = points.map((p) => ({ ...p, label: formatDate(p.date) }))
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} axisLine={false} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} width={48} />
          <Tooltip
            cursor={{ stroke: '#d1d1d6', strokeWidth: 1 }}
            content={tip<(typeof rows)[number]>((r) => (
                <TooltipBox title={formatDate(r.date, { year: true })} rows={[{ color: SERIES_1, label: '體重', value: `${r.value} kg` }]} />
            ))}
          />
          <Line type="monotone" dataKey="value" stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: SERIES_1, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
