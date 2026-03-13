"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { useLang } from "@/context/LanguageContext"
import { translations } from "@/lib/translations"

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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COLORS = ["#94a3b8", "#3b82f6", "#22c55e", "#ef4444"]

export default function DashboardPage() {

    const { lang } = useLang()
    const t = translations[lang]

    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {

        async function load() {

            try {

                const { data } = await supabase.auth.getSession()

                const token = data.session?.access_token

                const res = await fetch("/api/dashboard", {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                const json = await res.json()

                if (!res.ok) {
                    throw new Error(json?.error || t.serverError)
                }

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

            {/* KPI */}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">

                <KpiCard title={t.assignedToMe} value={stats?.assignedToMe ?? 0} color="text-indigo-600" />
                <KpiCard title={t.createdByMe} value={stats?.createdByMe ?? 0} color="text-purple-600" />
                <KpiCard title={t.todo} value={stats?.todo ?? 0} color="text-blue-600" />
                <KpiCard title={t.inProgress} value={stats?.progress ?? 0} color="text-yellow-500" />
                <KpiCard title={t.taskDone} value={stats?.done ?? 0} color="text-green-600" />
                <KpiCard title={t.cancelled} value={stats?.cancelled ?? 0} color="text-red-500" />
                <KpiCard title={t.overdue} value={stats?.overdue ?? 0} color="text-red-700" />

            </div>

            {/* CHARTS */}

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


            {/* ANALYTICS */}

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


            {/* OVERDUE TASKS */}

            <div className="bg-white rounded-2xl shadow border p-4 md:p-6">

                <h2 className="font-bold mb-4 text-red-600">
                    {t.overdueTasks}
                </h2>

                {/* MOBILE CARDS */}

                <div className="md:hidden space-y-3">

                    {stats?.overdueList?.map((t: any, i: number) => (
                        <div
                            key={i}
                            className="border rounded-xl p-4 shadow-sm bg-gray-50 flex flex-col gap-2"
                        >

                            <div className="font-semibold text-gray-900">
                                {t.title}
                            </div>

                            <div className="text-sm text-gray-600">
                                <span className="font-medium">{t.assignees}:</span>{" "}
                                {t.assignees?.join(", ")}
                            </div>

                            <div className="text-sm text-red-600 font-bold">
                               {t.daysLate}: {t.daysLate}
                            </div>

                        </div>
                    ))}

                </div>


                {/* DESKTOP TABLE */}

                <div className="hidden md:block overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead className="text-gray-500 border-b">

                            <tr>
                                <th className="text-left py-2">{t.task}</th>
                                <th className="text-left py-2">{t.assignees}</th>
                                <th className="text-left py-2">{t.daysLate}</th>
                            </tr>

                        </thead>

                        <tbody>

                            {stats?.overdueList?.map((t: any, i: number) => (

                                <tr key={i} className="border-b">

                                    <td className="py-2 font-medium">
                                        {t.title}
                                    </td>

                                    <td className="py-2">
                                        {t.assignees?.join(", ")}
                                    </td>

                                    <td className="py-2 text-red-600 font-bold">
                                        {t.daysLate}
                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

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