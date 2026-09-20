import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import type { ReactNode } from 'react'
import { useColors } from '../lib/colors'

export function ChartCard({ title, sub, children, right, className = '' }: { title: string; sub?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function useAxis() {
  const C = useColors()
  return {
    C,
    axis: { stroke: C('line'), tick: { fill: C('muted'), fontSize: 11 }, tickLine: false, axisLine: false },
    grid: <CartesianGrid stroke={C('line')} strokeDasharray="3 4" vertical={false} />,
    tip: {
      contentStyle: { background: C('surface'), border: `1px solid ${C('line')}`, borderRadius: 12, fontSize: 12, color: C('ink') },
      labelStyle: { color: C('muted') }, itemStyle: { color: C('ink') }, cursor: { fill: C('sunken') },
    },
  }
}

export function TrendChart({ data, h = 220 }: { data: { label: string; reports: number }[]; h?: number }) {
  const { C, axis, grid, tip } = useAxis()
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={C('brand')} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C('brand')} stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="label" {...axis} interval={6} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ stroke: C('line') }} />
        <Area type="monotone" dataKey="reports" name="Reports" stroke={C('brand')} strokeWidth={2} fill="url(#trendFill)" dot={false}
          activeDot={{ r: 4, fill: C('brand'), stroke: C('surface'), strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function HBarChart({ data, h, color = 'brand', highlight }: { data: { name: string; value: number }[]; h?: number; color?: 'brand' | 'signal' | 'info'; highlight?: string }) {
  const { C, axis, tip } = useAxis()
  return (
    <ResponsiveContainer width="100%" height={h ?? data.length * 30 + 10}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" {...axis} width={122} />
        <Tooltip {...tip} />
        <Bar dataKey="value" name="Reports" radius={[0, 6, 6, 0]} label={{ position: 'right', fill: C('muted'), fontSize: 11 }}>
          {data.map((d) => <Cell key={d.name} fill={highlight && d.name === highlight ? C('risk') : C(color)} fillOpacity={highlight && d.name !== highlight ? 0.55 : 1} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ColumnChart({ data, h = 200, color = 'info', peakFrom }: { data: { name: string; value: number }[]; h?: number; color?: 'brand' | 'signal' | 'info'; peakFrom?: number }) {
  const { C, axis, grid, tip } = useAxis()
  const max = Math.max(...data.map((d) => d.value))
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} />
        <Bar dataKey="value" name="Reports" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.value === max || (peakFrom != null && d.value >= peakFrom) ? C('signal') : C(color)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DayBars({ data, h = 180 }: { data: { day: string; count: number }[]; h?: number }) {
  const { C, axis, grid, tip } = useAxis()
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 16, right: 4, left: -26, bottom: 0 }}>
        {grid}
        <XAxis dataKey="day" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} />
        <Bar dataKey="count" name="Reports" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: C('muted'), fontSize: 11 }}>
          {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? C('risk') : C('signal')} fillOpacity={0.45 + (i / Math.max(data.length - 1, 1)) * 0.55} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PatternTrendChart({ data }: { data: { name: string; detected: number; resolved: number }[] }) {
  const { C, axis, grid, tip } = useAxis()
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ stroke: C('line') }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: C('muted') }} />
        <Line type="monotone" dataKey="detected" name="Patterns detected" stroke={C('signal')} strokeWidth={2.2} dot={{ r: 3, fill: C('signal') }} />
        <Line type="monotone" dataKey="resolved" name="Patterns closed" stroke={C('ok')} strokeWidth={2.2} dot={{ r: 3, fill: C('ok') }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function LagChart({ data }: { data: { name: string; days: number }[] }) {
  const { C, axis, grid, tip } = useAxis()
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="lagFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={C('ok')} stopOpacity={0.25} />
            <stop offset="100%" stopColor={C('ok')} stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} unit="d" />
        <Tooltip {...tip} cursor={{ stroke: C('line') }} formatter={(v) => [`${v} days`, 'Avg. time to detection']} />
        <Area type="monotone" dataKey="days" stroke={C('ok')} strokeWidth={2.2} fill="url(#lagFill)" dot={{ r: 3, fill: C('ok') }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Spark({ values, color = 'brand' }: { values: number[]; color?: 'brand' | 'signal' | 'risk' | 'info' | 'ok' }) {
  const C = useColors()
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 24}`)
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,30 ${pts.join(' ')} 100,30`} fill={C(color)} fillOpacity={0.12} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={C(color)} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
