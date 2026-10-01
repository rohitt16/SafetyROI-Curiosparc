import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const weatherColors = ["#ef4444", "#f59e0b", "#22c55e"];

const buildHistorySeries = (history = []) => {
  if (typeof window === "undefined") {
    return [
      { day: "Mon", risk: 72 },
      { day: "Tue", risk: 58 },
      { day: "Wed", risk: 64 },
      { day: "Thu", risk: 71 },
      { day: "Fri", risk: 81 },
      { day: "Sat", risk: 68 },
    ];
  }

  try {
    const history = JSON.parse(localStorage.getItem("roadshield-history") || "[]");
    if (Array.isArray(history) && history.length) {
      return history.slice(0, 6).map((item, index) => ({
        day: new Date(item.timestamp).toLocaleDateString([], { weekday: "short" }),
        risk: item.score || 40 + index * 5,
      }));
    }
  } catch {
    // Ignore storage parse errors and fall back to demo data.
  }

  return [
    { day: "Mon", risk: 72 },
    { day: "Tue", risk: 58 },
    { day: "Wed", risk: 64 },
    { day: "Thu", risk: 71 },
    { day: "Fri", risk: 81 },
    { day: "Sat", risk: 68 },
  ];
};

const cityData = [
  { city: "Delhi", risk: 82 },
  { city: "Mumbai", risk: 65 },
  { city: "Bangalore", risk: 78 },
  { city: "Chennai", risk: 45 },
  { city: "Pune", risk: 62 },
];

const weatherData = [
  { name: "Rain", value: 40 },
  { name: "Fog", value: 35 },
  { name: "Clear", value: 25 },
];

const trafficData = [
  { name: "High", value: 48 },
  { name: "Medium", value: 32 },
  { name: "Low", value: 20 },
];

const timeData = [
  { time: "06:00", risk: 35 },
  { time: "10:00", risk: 47 },
  { time: "14:00", risk: 62 },
  { time: "18:00", risk: 81 },
  { time: "22:00", risk: 74 },
];

const factorData = [
  { name: "Visibility", value: 30 },
  { name: "Traffic", value: 28 },
  { name: "Weather", value: 23 },
  { name: "Peak Hour", value: 8 },
  { name: "Other", value: 11 },
];

export default function RiskAnalytics({ history = [], summary = null, stateInsight = null }) {
  const weeklyTrend = buildHistorySeries(history);

  const cityData = useMemo(() => {
    if (summary?.top_risk_state) {
      return [
        {
          city: summary.top_risk_state,
          risk: Math.min(100, Math.round((summary.top_risk_score || 0) * 100)),
        },
        { city: "Delhi", risk: 82 },
        { city: "Mumbai", risk: 65 },
        { city: "Bangalore", risk: 78 },
        { city: "Chennai", risk: 45 },
        { city: "Pune", risk: 62 },
      ];
    }
    return [
      { city: "Delhi", risk: 82 },
      { city: "Mumbai", risk: 65 },
      { city: "Bangalore", risk: 78 },
      { city: "Chennai", risk: 45 },
      { city: "Pune", risk: 62 },
    ];
  }, [summary]);

  const weatherData = useMemo(() => {
    if (!stateInsight?.riskDrivers?.length) {
      return [
        { name: "Rain", value: 40 },
        { name: "Fog", value: 35 },
        { name: "Clear", value: 25 },
      ];
    }

    return stateInsight.riskDrivers.map((entry, index) => ({
      name: entry.name,
      value: entry.value,
      color: weatherColors[index % weatherColors.length],
    }));
  }, [stateInsight]);

  const factorData = useMemo(() => {
    if (!stateInsight?.causeBreakdown?.length) {
      return [
        { name: "Visibility", value: 30 },
        { name: "Traffic", value: 28 },
        { name: "Weather", value: 23 },
        { name: "Peak Hour", value: 8 },
        { name: "Other", value: 11 },
      ];
    }

    return stateInsight.causeBreakdown.slice(0, 5).map((entry) => ({
      name: entry.cause,
      value: entry.share_pct,
    }));
  }, [stateInsight]);

  return (
    <div className="analytics-shell">
      <div className="panel-header analytics-header">
        <div>
          <div className="eyebrow">Decision Intelligence</div>
          <h2>Priority risk patterns and intervention signals</h2>
        </div>
        <span className="demo-badge">Operational view</span>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Priority corridor risk</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="city" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="risk" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Primary risk drivers</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={weatherData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={3}>
                {weatherData.map((entry, index) => (
                  <Cell key={index} fill={entry.color || weatherColors[index % weatherColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Traffic exposure mix</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Time-of-day risk surge</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="risk" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card wide">
          <h3>Recent intervention trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weeklyTrend}>
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="risk" stroke="#38bdf8" fill="url(#riskFill)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Highest-impact causal factors</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={factorData} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}