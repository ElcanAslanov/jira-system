"use client"

import { useEffect, useState } from "react"
import { useLang } from "@/context/LanguageContext"
import { translations } from "@/lib/translations"
import { supabase } from "@/lib/supabaseClient"

import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from "recharts"

const COLORS = ["#94a3b8", "#3b82f6", "#22c55e", "#ef4444"]

export default function DashboardPage() {

    const { lang } = useLang()

    const t =
        translations[lang as keyof typeof translations] ??
        translations.az

    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {

        async function load() {

            try {

                let session = null

for (let i = 0; i < 10; i++) {
  const { data } = await supabase.auth.getSession()
  session = data.session

  if (session) break

  await new Promise(r => setTimeout(r, 50))
}

const token = session?.access_token

if (!token) {
  setError("Session not ready")
  setLoading(false)
  return
}
              const res = await fetch(`/api/dashboard?t=${Date.now()}`, {
 headers: {
  Authorization: `Bearer ${token}`
 }
})

                if (!res.ok) {
                    throw new Error("Dashboard API error")
                }

                const json = await res.json()

                setStats(json)

            } catch (e: any) {

                console.error(e)
                setError(e.message)

            } finally {
                setLoading(false)
            }

        }

        load()

    }, [])

    if (loading) {
        return <div className="p-6">{t.loading}</div>
    }

    if (error) {
        return <div className="p-6 text-red-600">{error}</div>
    }

    if (!stats) {
        return <div className="p-6">{t.notFound}</div>
    }

    const statusData = [
        { name: t.todo, value: stats?.todo ?? 0 },
        { name: t.inProgress, value: stats?.progress ?? 0 },
        { name: t.taskDone, value: stats?.done ?? 0 },
        { name: t.cancelled, value: stats?.cancelled ?? 0 }
    ]

    const priorityData = [
        { name: t.low, value: stats?.priorityStats?.LOW ?? 0 },
        { name: t.medium, value: stats?.priorityStats?.MEDIUM ?? 0 },
        { name: t.high, value: stats?.priorityStats?.HIGH ?? 0 },
        { name: t.urgent, value: stats?.priorityStats?.URGENT ?? 0 }
    ]

    return (

        <div className="p-4 md:p-6 lg:p-8 space-y-8 bg-gray-50 min-h-screen">

            <h1 className="text-2xl md:text-3xl font-bold">
                {t.dashboard}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">

                <KpiCard title={t.assignedToMe} value={stats?.assignedToMe ?? 0} color="text-indigo-600" />
                <KpiCard title={t.createdByMe} value={stats?.createdByMe ?? 0} color="text-purple-600" />
                <KpiCard title={t.todo} value={stats?.todo ?? 0} color="text-blue-600" />
                <KpiCard title={t.inProgress} value={stats?.progress ?? 0} color="text-yellow-500" />
                <KpiCard title={t.taskDone} value={stats?.done ?? 0} color="text-green-600" />
                <KpiCard title={t.cancelled} value={stats?.cancelled ?? 0} color="text-red-500" />
                <KpiCard title={t.overdue} value={stats?.overdue ?? 0} color="text-red-700" />

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="bg-white rounded-2xl shadow border p-4 md:p-6">

                    <h2 className="font-bold mb-4">
                        {t.tasksByStatus}
                    </h2>

                    <ResponsiveContainer width="100%" height={260}>

                        <PieChart>

                            <Pie
                                data={statusData}
                                dataKey="value"
                                nameKey="name"
                                outerRadius={90}
                            >

                                {statusData.map((entry, index) => (
                                    <Cell key={index} fill={COLORS[index]} />
                                ))}

                            </Pie>

                            <Tooltip />

                        </PieChart>

                    </ResponsiveContainer>

                </div>


                <div className="bg-white rounded-2xl shadow border p-4 md:p-6">

                    <h2 className="font-bold mb-4">
                        {t.tasksByPriority}
                    </h2>

                    <ResponsiveContainer width="100%" height={260}>

                        <BarChart data={priorityData}>

                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis dataKey="name" />

                            <YAxis />

                            <Tooltip />

                            <Bar
                                dataKey="value"
                                fill="#6366f1"
                                radius={[8, 8, 0, 0]}
                            />

                        </BarChart>

                    </ResponsiveContainer>

                </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="bg-white rounded-2xl shadow border p-4 md:p-6">

                    <h2 className="font-bold mb-4">
                        {t.mostOverdueEmployees}
                    </h2>

                    <ResponsiveContainer width="100%" height={260}>

                        <BarChart data={stats?.overdueUsers ?? []}>

                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis dataKey="name" />

                            <YAxis />

                            <Tooltip />

                            <Bar
                                dataKey="count"
                                fill="#ef4444"
                                radius={[8, 8, 0, 0]}
                            />

                        </BarChart>

                    </ResponsiveContainer>

                </div>


                <div className="bg-white rounded-2xl shadow border p-4 md:p-6">

                    <h2 className="font-bold mb-4">
                        {t.employeeProductivity}
                    </h2>

                    <ResponsiveContainer width="100%" height={260}>

                        <BarChart data={stats?.productivity ?? []}>

                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis dataKey="name" />

                            <YAxis />

                            <Tooltip />

                            <Bar
                                dataKey="done"
                                fill="#22c55e"
                                radius={[8, 8, 0, 0]}
                            />

                        </BarChart>

                    </ResponsiveContainer>

                </div>

            </div>

        </div>

    )

}

function KpiCard({
    title,
    value,
    color = "text-gray-900"
}: { title: string, value: number, color?: string }) {

    return (

        <div className="bg-white border shadow rounded-xl p-4 flex flex-col gap-1">

            <div className="text-xs md:text-sm text-gray-500">
                {title}
            </div>

            <div className={`text-2xl md:text-3xl font-bold ${color}`}>
                {value}
            </div>

        </div>

    )

}