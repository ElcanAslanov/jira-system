import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ================= AUTH ================= */

async function getRequestUser(req:Request){

 const authHeader = req.headers.get("authorization")

 if(!authHeader) throw new Error("Unauthorized")

 const token = authHeader.replace("Bearer ","")

 const { data: authData } =
 await supabaseAdmin.auth.getUser(token)

 if(!authData?.user) throw new Error("Unauthorized")

 const { data: employee, error: empErr } =
await supabaseAdmin
.from("employees")
.select(`
  id,
  roles(name)
`)
.eq("user_id", authData.user.id)
.single()

if (empErr || !employee) {
  throw new Error("Employee not found")
}

let role: string | null = null

const roles = employee.roles as any

if (Array.isArray(roles)) {
  role = roles[0]?.name ?? null
} else if (roles) {
  role = roles.name ?? null
}

return {
  id: employee.id,
  role
}

}

/* ================= DASHBOARD ================= */

export async function GET(req:Request){

try{

const user = await getRequestUser(req)

/* ================= GET TASK IDS ================= */

let taskIds:string[] = []

/* ===== ADMIN / BOSS ===== */

/* ===== ADMIN / BOSS ===== */

if (user.role && ["ADMIN","BOSS"].includes(user.role)) {

 const { data } = await supabaseAdmin
 .from("tasks")
 .select("id")

 taskIds = data?.map(t=>t.id) ?? []

}

/* ===== EMPLOYEE / REHBER ===== */

else if (user.role === "EMPLOYEE" || user.role === "REHBER") {

  // mənə assign olunan tasklar
  const { data: assigned } =
  await supabaseAdmin
  .from("task_assignees")
  .select("task_id")
  .eq("employee_id", user.id)

  const assignedIds =
  assigned?.map(t => t.task_id) ?? []

  // mənim yaratdığım tasklar
  const { data: created } =
  await supabaseAdmin
  .from("tasks")
  .select("id")
  .eq("created_by", user.id)

  const createdIds =
  created?.map(t => t.id) ?? []

  // ikisini birləşdir
  taskIds = [...assignedIds, ...createdIds]

}

taskIds = [...new Set(taskIds)]

if(taskIds.length === 0){
 return NextResponse.json({
   total:0,
   todo:0,
   progress:0,
   done:0,
   cancelled:0,
   overdue:0,
   priorityStats:{
     LOW:0,
     MEDIUM:0,
     HIGH:0,
     URGENT:0
   },
   overdueUsers:[],
   productivity:[],
   overdueList:[]
 })
}

/* ================= TASKS ================= */

const { data: tasks, error } = await supabaseAdmin
.from("tasks")
.select(`
 id,
 title,
 status,
 priority,
 due_date,
 created_at,
 created_by
`)
.in("id",taskIds)

if(error) throw error

/* ================= ASSIGNEES ================= */

const { data: assignees } = await supabaseAdmin
.from("task_assignees")
.select(`
 task_id,
 employee_id,
 employees (
   ad,
   soyad
 )
`)
.in("task_id",taskIds)

/* ================= MY TASK STATS ================= */

const assignedToMe =
assignees?.filter(a => a.employee_id === user.id)
.map(a => a.task_id) ?? []

const assignedToMeCount =
tasks?.filter(t => assignedToMe.includes(t.id)).length ?? 0

const createdByMe =
tasks?.filter(t => t.created_by === user.id).length ?? 0

/* ================= BASIC STATS ================= */

const total = tasks?.length ?? 0

const todo =
tasks?.filter(t => t.status === "TODO").length ?? 0

const progress =
tasks?.filter(t => t.status === "IN_PROGRESS").length ?? 0

const done =
tasks?.filter(t => t.status === "DONE").length ?? 0

const cancelled =
tasks?.filter(t => t.status === "CANCELLED").length ?? 0

/* ================= OVERDUE ================= */

const overdueTasks =
tasks?.filter(t =>
 t.due_date &&
 new Date(t.due_date) < new Date() &&
 t.status !== "DONE"
) ?? []

const overdue = overdueTasks.length

/* ================= PRIORITY ================= */

const priorityStats = {

LOW: tasks?.filter(t => t.priority === "LOW").length ?? 0,

MEDIUM: tasks?.filter(t => t.priority === "MEDIUM").length ?? 0,

HIGH: tasks?.filter(t => t.priority === "HIGH").length ?? 0,

URGENT: tasks?.filter(t => t.priority === "URGENT").length ?? 0

}

/* ================= OVERDUE USERS ================= */

const overdueUserMap:Record<string,number> = {}

overdueTasks.forEach(task => {

const related =
assignees?.filter(a => a.task_id === task.id) ?? []

related.forEach(a => {

const emp = Array.isArray(a.employees)
 ? a.employees[0]
 : a.employees

const name =
`${emp?.ad ?? ""} ${emp?.soyad ?? ""}`.trim()

if(!overdueUserMap[name]){
 overdueUserMap[name] = 0
}

overdueUserMap[name]++

})

})

const overdueUsers =
Object.entries(overdueUserMap)
.map(([name,count]) => ({ name,count }))
.sort((a,b)=>b.count-a.count)
.slice(0,5)

/* ================= PRODUCTIVITY ================= */

const productivityMap:Record<string,number> = {}

tasks
?.filter(t => t.status === "DONE")
.forEach(task => {

const related =
assignees?.filter(a => a.task_id === task.id) ?? []

related.forEach(a => {

const emp = Array.isArray(a.employees)
 ? a.employees[0]
 : a.employees

const name =
`${emp?.ad ?? ""} ${emp?.soyad ?? ""}`.trim()

if(!productivityMap[name]){
 productivityMap[name] = 0
}

productivityMap[name]++

})

})

const productivity =
Object.entries(productivityMap)
.map(([name,done]) => ({ name,done }))
.sort((a,b)=>b.done-a.done)
.slice(0,5)

/* ================= OVERDUE LIST ================= */

const overdueList = overdueTasks
.map(task => {

const related =
assignees?.filter(a => a.task_id === task.id) ?? []

const names =
related.map(a => {

const emp = Array.isArray(a.employees)
 ? a.employees[0]
 : a.employees

return `${emp?.ad ?? ""} ${emp?.soyad ?? ""}`.trim()

})

const daysLate = Math.floor(
 (Date.now() - new Date(task.due_date).getTime()) /
 (1000*60*60*24)
)

return{
 title: task.title,
 assignees: names,
 daysLate
}

})
.sort((a,b)=>b.daysLate-a.daysLate)
.slice(0,5)

/* ================= RESPONSE ================= */

return NextResponse.json({

total,
assignedToMe: assignedToMeCount,
createdByMe,
todo,
progress,
done,
cancelled,
overdue,

priorityStats,

overdueUsers,

productivity,

overdueList

})

}catch(e:any){

return NextResponse.json(
{ error:e.message },
{ status:401 }
)

}

}