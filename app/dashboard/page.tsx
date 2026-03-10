"use client"

import { useEffect,useState } from "react"
import { createClient } from "@supabase/supabase-js"

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

const COLORS = ["#94a3b8","#3b82f6","#22c55e","#ef4444"]

export default function DashboardPage(){

 const [stats,setStats] = useState<any>(null)
 const [loading,setLoading] = useState(true)
 const [error,setError] = useState<string | null>(null)

 useEffect(()=>{

 async function load(){

 try{

 const { data } = await supabase.auth.getSession()

 const token = data.session?.access_token

 const res = await fetch("/api/dashboard",{
  headers:{
   Authorization:`Bearer ${token}`
  }
 })

 const json = await res.json()

 if(!res.ok){
  throw new Error(json?.error || "Dashboard error")
 }

 setStats(json)

 }catch(e:any){

 console.error(e)
 setError(e.message)

 }finally{
 setLoading(false)
 }

 }

 load()

 },[])

 if(loading){
  return <div className="p-10">Loading dashboard...</div>
 }

 if(error){
  return <div className="p-10 text-red-600">{error}</div>
 }

 if(!stats){
  return <div className="p-10">No data</div>
 }

 const statusData = [
  { name:"TODO", value:stats?.todo ?? 0 },
  { name:"IN_PROGRESS", value:stats?.progress ?? 0 },
  { name:"DONE", value:stats?.done ?? 0 },
  { name:"CANCELLED", value:stats?.cancelled ?? 0 }
 ]

 const priorityData = [
  { name:"LOW", value:stats?.priorityStats?.LOW ?? 0 },
  { name:"MEDIUM", value:stats?.priorityStats?.MEDIUM ?? 0 },
  { name:"HIGH", value:stats?.priorityStats?.HIGH ?? 0 },
  { name:"URGENT", value:stats?.priorityStats?.URGENT ?? 0 }
 ]

 return (

<div className="p-8 space-y-10 bg-gray-50 min-h-screen">

<h1 className="text-3xl font-bold">
Dashboard
</h1>

{/* KPI */}

<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">

<KpiCard title="Assigned To Me" value={stats?.assignedToMe ?? 0} color="text-indigo-600"/>
<KpiCard title="Created By Me" value={stats?.createdByMe ?? 0} color="text-purple-600"/>
<KpiCard title="Todo" value={stats?.todo ?? 0} color="text-blue-600"/>
<KpiCard title="In Progress" value={stats?.progress ?? 0} color="text-yellow-500"/>
<KpiCard title="Done" value={stats?.done ?? 0} color="text-green-600"/>
<KpiCard title="Cancelled" value={stats?.cancelled ?? 0} color="text-red-500"/>
<KpiCard title="Overdue" value={stats?.overdue ?? 0} color="text-red-700"/>

</div>

{/* CHARTS */}

<div className="grid lg:grid-cols-2 gap-6">

<div className="bg-white rounded-2xl shadow border p-6">

<h2 className="font-bold mb-4">
Tasks by Status
</h2>

<ResponsiveContainer width="100%" height={320}>

<PieChart>

<Pie
data={statusData}
dataKey="value"
nameKey="name"
outerRadius={110}
>

{statusData.map((entry,index)=>(
<Cell key={index} fill={COLORS[index]}/>
))}

</Pie>

<Tooltip/>

</PieChart>

</ResponsiveContainer>

</div>


<div className="bg-white rounded-2xl shadow border p-6">

<h2 className="font-bold mb-4">
Tasks by Priority
</h2>

<ResponsiveContainer width="100%" height={320}>

<BarChart data={priorityData}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="name"/>

<YAxis/>

<Tooltip/>

<Bar
dataKey="value"
fill="#6366f1"
radius={[8,8,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>


{/* ANALYTICS */}

<div className="grid lg:grid-cols-2 gap-6">

<div className="bg-white rounded-2xl shadow border p-6">

<h2 className="font-bold mb-4">
Most Overdue Employees
</h2>

<ResponsiveContainer width="100%" height={320}>

<BarChart data={stats?.overdueUsers ?? []}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="name"/>

<YAxis/>

<Tooltip/>

<Bar
dataKey="count"
fill="#ef4444"
radius={[8,8,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>


<div className="bg-white rounded-2xl shadow border p-6">

<h2 className="font-bold mb-4">
Employee Productivity
</h2>

<ResponsiveContainer width="100%" height={320}>

<BarChart data={stats?.productivity ?? []}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="name"/>

<YAxis/>

<Tooltip/>

<Bar
dataKey="done"
fill="#22c55e"
radius={[8,8,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>


{/* OVERDUE TASKS */}

<div className="bg-white rounded-2xl shadow border p-6">

<h2 className="font-bold mb-4 text-red-600">
Overdue Tasks
</h2>

<table className="w-full text-sm">

<thead className="text-gray-500 border-b">

<tr>
<th className="text-left py-2">Task</th>
<th className="text-left py-2">Assignees</th>
<th className="text-left py-2">Days Late</th>
</tr>

</thead>

<tbody>

{stats?.overdueList?.map((t:any,i:number)=>(
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

 )

}


function KpiCard({
 title,
 value,
 color="text-gray-900"
}:{title:string,value:number,color?:string}){

 return (

<div className="bg-white border shadow rounded-xl p-5 flex flex-col gap-2">

<div className="text-sm text-gray-500">
{title}
</div>

<div className={`text-3xl font-bold ${color}`}>
{value}
</div>

</div>

 )

}