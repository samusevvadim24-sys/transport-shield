/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { Inspection } from "../types/database.types";

export const PAGE_SIZE = 30;
const BP_OK = (s: number | null, d: number | null) => s != null && d != null && s >= 90 && s <= 140 && d >= 60 && d <= 90;
const names = (v: any) => { const s = String(v ?? "").trim(); return s && !/^\d+$/.test(s) ? s : ""; };
const baseSelect = `*, drivers!inspections_driver_id_fkey (id,driver_id,name,license_number,license_expiry,medical_expiry,tech_inspection_expiry,car_brand,car_number,inspection_scope,is_blacklisted,inspection_point_id,customers(name)), medical_examiner:users!inspections_medical_examiner_id_fkey(id,login), mechanic_examiner:users!inspections_mechanic_examiner_id_fkey(id,login)`;

export const formatInspectionItem = (item: any): Inspection => {
  const fmt = (v: any, year = false) => v ? new Date(v).toLocaleDateString("ru-RU", year ? {day:"2-digit",month:"2-digit",year:"numeric"} : {day:"2-digit",month:"2-digit"}) + ", " + new Date(v).toLocaleTimeString("ru-RU", {hour:"2-digit",minute:"2-digit"}) : "—";
  const medDone = !!item.medical_date && ["Допущен","Не допущен"].includes(item.medical_status);
  const mechDone = !!item.mechanic_date && ["Допущен","Не допущен"].includes(item.mechanic_status);
  return { docId:String(item.id), id:item.drivers?.driver_id ? `${item.drivers.driver_id}_${item.id}` : item.id, driver:item.drivers?.name || "Не указан", customer:item.drivers?.customers?.name || "Не указан", date:fmt(item.requested_at || item.created_at,true), dateISO:item.requested_at || item.created_at, status:item.overall_status || "Ожидание", documents:{license:item.drivers?.license_number || "—",licenseExpires:item.drivers?.license_expiry || "—",medical:item.drivers?.medical_expiry || "—",inspection:item.drivers?.tech_inspection_expiry || "—"}, car:{number:item.drivers?.car_number || "—",brand:item.drivers?.car_brand || "—"}, medic:medDone ? (names(item.medical_examiner_name)||names(item.medical_examiner?.login)||"Медик") : "—", medicTime:fmt(item.medical_date), medicStatus:item.medical_status || "Ожидание", alcohol:item.breathalyzer_value ?? null,bloodPressureSystolic:item.blood_pressure_systolic ?? null,bloodPressureDiastolic:item.blood_pressure_diastolic ?? null,drugIntoxication:Boolean(item.drug_intoxication), mechanic:mechDone ? (names(item.mechanic_examiner_name)||names(item.mechanic_examiner?.login)||"Механик") : "—", mechanicTime:fmt(item.mechanic_date), mechanicStatus:item.mechanic_status || "Ожидание", inspectionScope:item.inspection_scope || "both",isBlacklisted:item.drivers?.is_blacklisted === true,mechanicReasons:item.mechanic_issues || [],medicalExaminerId:item.medical_examiner_id ?? null,mechanicExaminerId:item.mechanic_examiner_id ?? null,inspectionPointId:item.inspection_point_id ?? null };
};

function dates(a:string,b:string){ let startIso=null,endIso=null; if(a){const[y,m,d]=a.split("-").map(Number);startIso=new Date(y,m-1,d).toISOString();} if(b){const[y,m,d]=b.split("-").map(Number);endIso=new Date(y,m-1,d+1).toISOString();} return{startIso,endIso}; }
function journal(q:any,status:string,startIso:string|null,endIso:string|null){ if(["Допущен","Не допущен","Явиться"].includes(status)){q=q.eq("overall_status",status);if(startIso)q=q.gte("completed_at",startIso);if(endIso)q=q.lt("completed_at",endIso);return q;} if(status==="Ожидание"){q=q.eq("overall_status","Ожидание");if(startIso)q=q.gte("requested_at",startIso);if(endIso)q=q.lt("requested_at",endIso);return q;} if(startIso&&endIso)return q.or(`and(completed_at.gte."${startIso}",completed_at.lt."${endIso}"),and(overall_status.eq.Ожидание,requested_at.gte."${startIso}",requested_at.lt."${endIso}")`); if(startIso)return q.or(`completed_at.gte."${startIso}",and(overall_status.eq.Ожидание,requested_at.gte."${startIso}")`); if(endIso)return q.or(`completed_at.lt."${endIso}",and(overall_status.eq.Ожидание,requested_at.lt."${endIso}")`); return q; }
function searchFilter(q:any,s:string){if(!s.trim())return q;const x=s.trim();return q.not("drivers","is",null).or(`name.ilike.%${x}%,car_number.ilike.%${x}%,driver_id.ilike.%${x}%,license_number.ilike.%${x}%`,{foreignTable:"drivers"});}

export async function fetchInspectionsData({currentPage,statusFilter,startDateFilter,endDateFilter,search}:{currentPage:number;statusFilter:string;startDateFilter:string;endDateFilter:string;search:string}){const {startIso,endIso}=dates(startDateFilter,endDateFilter);let q=supabase.from("inspections").select(baseSelect,{count:"exact"});q=journal(q,statusFilter,startIso,endIso);q=searchFilter(q,search).order("completed_at",{ascending:false,nullsFirst:true}).order("created_at",{ascending:false}).range((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE-1);const{data,error,count}=await q;if(error){console.error("fetchInspectionsData:",error);return{formatted:[],totalCount:count??0};}return{formatted:(data||[]).map(formatInspectionItem),totalCount:count??0};}

export async function fetchStatusCounts({startDateFilter,endDateFilter,search}:{startDateFilter:string;endDateFilter:string;search:string}){const{startIso,endIso}=dates(startDateFilter,endDateFilter);let ids:null|(string|number)[]=null;if(search.trim()){const{data,error}=await supabase.from("drivers").select("id").or(`name.ilike.%${search.trim()}%,car_number.ilike.%${search.trim()}%,driver_id.ilike.%${search.trim()}%,license_number.ilike.%${search.trim()}%`);if(error)return{"Все":0,"Допущен":0,"Ожидание":0,"Не допущен":0,"Явиться":0};ids=(data||[]).map((x:any)=>x.id);if(!ids.length)return{"Все":0,"Допущен":0,"Ожидание":0,"Не допущен":0,"Явиться":0};}const get=async(s:string|null)=>{let q=supabase.from("inspections").select("id",{count:"exact",head:true});q=journal(q,s??"Все",startIso,endIso);if(ids)q=q.in("driver_id",ids);const{count}=await q;return count??0;};const[a,b,c,d,e]=await Promise.all([get(null),get("Допущен"),get("Ожидание"),get("Не допущен"),get("Явиться")]);return{"Все":a,"Допущен":b,"Ожидание":c,"Не допущен":d,"Явиться":e};}

export async function fetchSingleInspection(id:string|number){const{data,error}=await supabase.from("inspections").select(baseSelect).eq("id",id).maybeSingle();return error||!data?null:formatInspectionItem(data);}

async function action(id:string, actionName:string, extra:Record<string,unknown> = {}) {
  try {
    const response = await fetch("/api/admin/inspections/actions", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body:JSON.stringify({id, action:actionName, ...extra}) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { data:null, error:new Error(body?.error || "Не удалось выполнить операцию") };
    return { data:body?.data ?? null, error:null };
  } catch (error) { return { data:null, error:error instanceof Error ? error : new Error("Ошибка сети") }; }
}

export async function updateInspectionMedical(docId:string,now:string,alcoholVal:number,systolic:number|null,diastolic:number|null,drugIntoxication:boolean){return action(docId,"medical",{now,alcoholVal,systolic,diastolic,drugIntoxication});}
export async function updateInspectionApprove(docId:string,now:string){return action(docId,"approve",{now});}
export async function updateInspectionReject(docId:string,now:string,_alcoholVal:number,issuesList:string[],_medStatus:string,_mechStatus:string,_overallStatus:string){return action(docId,"reject",{now,issuesList});}
export async function updateInspectionReset(docId:string){return action(docId,"reset");}
export async function deleteInspectionRecord(docId:string){return action(docId,"delete");}
export async function updateInspectionSummon(docId:string,now:string){return action(docId,"summon",{now});}
