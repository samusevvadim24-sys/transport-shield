/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Download, X, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Inspection } from "../../../../types/database.types";
import { CheckRow } from "../components/ui/CheckRow";
import { CheckCard } from "../components/ui/CheckCard";
import DeleteInspectionModal from "../components/ui/DeleteInspectionModal";
import RejectInspectionModal from "../components/ui/RejectInspectionModal";
import { supabase } from "@/lib/supabase";
import * as XLSX from 'xlsx-js-style';
import {
  toISO,
  fromISO,
  formatDisplayDate,
  formatMonthLabel,
  getMonthMatrix,
  isSameDay,
} from "../../../utils/dates";
import { WEEKDAYS_RU } from "../../../utils/constants";
import {
  PAGE_SIZE,
  fetchInspectionsData,
  fetchStatusCounts,
  fetchSingleInspection,
  updateInspectionApprove,
  updateInspectionReject,
  updateInspectionReset,
  deleteInspectionRecord,
  updateInspectionSummon,
} from "../../../../services/customer-tab.service";

interface ChecksTabProps {
  onCustomerClick?: (customer: string) => void;
}

export default function ChecksTab({}: ChecksTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Все");

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Счетчик по каждому статусу
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    "Все": 0,
    "Допущен": 0,
    "Не допущен": 0,
    "Ожидание": 0,
    "Явиться": 0,
  });

  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [activeQuickPeriod, setActiveQuickPeriod] = useState<"today" | "week" | "month" | null>(null);

  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  const [startCursor, setStartCursor] = useState(() => (startDateFilter ? fromISO(startDateFilter) : new Date()));
  const [endCursor, setEndCursor] = useState(() => (endDateFilter ? fromISO(endDateFilter) : new Date()));

  const startPickerRef = useRef<HTMLDivElement>(null);
  const endPickerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      if (startPickerRef.current && !startPickerRef.current.contains(e.target as Node)) {
        setStartPickerOpen(false);
      }
      if (endPickerRef.current && !endPickerRef.current.contains(e.target as Node)) {
        setEndPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startWeeks = useMemo(
    () => getMonthMatrix(startCursor.getFullYear(), startCursor.getMonth()),
    [startCursor]
  );
  const endWeeks = useMemo(
    () => getMonthMatrix(endCursor.getFullYear(), endCursor.getMonth()),
    [endCursor]
  );

  const selectedStartDate = startDateFilter ? fromISO(startDateFilter) : null;
  const selectedEndDate = endDateFilter ? fromISO(endDateFilter) : null;
  const todayDateObj = new Date();

  const handleSelectToday = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    setStartDateFilter(todayStr);
    setEndDateFilter(todayStr);
    setActiveQuickPeriod("today");
    setCurrentPage(1);
    setStartPickerOpen(false);
    setEndPickerOpen(false);
  };

  const handleSelectCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setStartDateFilter(toISO(monday));
    setEndDateFilter(toISO(sunday));
    setActiveQuickPeriod("week");
    setCurrentPage(1);
    setStartPickerOpen(false);
    setEndPickerOpen(false);
  };

  const handleSelectCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    setStartDateFilter(toISO(firstDay));
    setEndDateFilter(toISO(lastDay));
    setActiveQuickPeriod("month");
    setCurrentPage(1);
    setStartPickerOpen(false);
    setEndPickerOpen(false);
  };

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingMechanic, setExportingMechanic] = useState(false);
  const [exportingMedical, setExportingMedical] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<Inspection | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [inspectionToReject, setInspectionToReject] = useState<Inspection | null>(null);
  
  const [rawAlcoholDigits, setRawAlcoholDigits] = useState<string>("015");
  
  const [rejectReasons, setRejectReasons] = useState<{
    firstAidKit: boolean;
    extinguisher: boolean;
    baldTires: boolean;
    bodyDamage: boolean;
    lightsFault: boolean;
  }>({
    firstAidKit: false,
    extinguisher: false,
    baldTires: false,
    bodyDamage: false,
    lightsFault: false,
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { formatted, totalCount } = await fetchInspectionsData({
          currentPage,
          statusFilter,
          startDateFilter,
          endDateFilter,
          search,
        });

        setInspections(formatted);
        setTotalRecords(totalCount);

        const maxPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
        if (currentPage > maxPages) {
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Ошибка загрузки:", err);
        setInspections([]);
        setTotalRecords(0);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentPage, statusFilter, startDateFilter, endDateFilter, search]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      try {
        const counts = await fetchStatusCounts({ 
          startDateFilter, 
          endDateFilter, 
          search 
        });
        setStatusCounts(counts);
      } catch (err) {
        console.error("Ошибка загрузки счетчиков:", err);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [startDateFilter, endDateFilter, search]);

  useEffect(() => {
    const channel = supabase
      .channel("public:inspections")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inspections" },
        async (payload) => {
          const newRecord = payload.new as { id?: string | number } | null;
          const oldRecord = payload.old as { id?: string | number } | null;
          const recordId = newRecord?.id || oldRecord?.id;
          
          if (!recordId) return;

          try {
            const counts = await fetchStatusCounts({ startDateFilter, endDateFilter, search });
            setStatusCounts(counts);
          } catch (err) {
            console.error("Ошибка обновления счетчиков:", err);
          }

          if (payload.eventType === "DELETE") {
            setInspections((prev) => prev.filter((item: any) => item.docId !== String(recordId)));
            setTotalRecords((prev) => Math.max(0, prev - 1));
            return;
          }

          const formattedItem = await fetchSingleInspection(recordId);
          if (!formattedItem) return;

          setInspections((prev) => {
            const filtered = prev.filter((item: any) => item.docId !== formattedItem.docId);

            const matchesStatusFilter = 
              statusFilter === "Все" || 
              formattedItem.status === statusFilter;

            let matchesDateFilter = true;
            const targetStr = (formattedItem as any).dateISO || formattedItem.date;
            const itemDate = new Date(targetStr).getTime();

            if (startDateFilter) {
              const start = new Date(startDateFilter).setHours(0, 0, 0, 0);
              if (itemDate < start) matchesDateFilter = false;
            }

            if (endDateFilter) {
              const end = new Date(endDateFilter).setHours(23, 59, 59, 999);
              if (itemDate > end) matchesDateFilter = false;
            }

            if (!matchesStatusFilter || !matchesDateFilter) {
              setTotalRecords((t) => Math.max(0, t - 1));
              return filtered;
            }

            const isNew = !prev.some((item: any) => item.docId === formattedItem.docId);
            if (isNew) {
              setTotalRecords((t) => t + 1);
            }

            return [formattedItem, ...filtered];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter, startDateFilter, endDateFilter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, startDateFilter, endDateFilter]);

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;

  const handleApprove = async (docId: string) => {
    const now = new Date().toISOString();
    try {
      const { error } = await updateInspectionApprove(docId, now);
      if (error) {
        alert(`Не удалось обновить статус: ${error.message}`);
      }
    } catch (err) {
      console.error("Ошибка:", err);
    }
  };

  const handleSummon = async (docId: string) => {
    const now = new Date().toISOString();
    try {
      const { error } = await updateInspectionSummon(docId, now);
      if (error) {
        alert(`Не удалось установить статус «Явиться»: ${error.message}`);
      }
    } catch (err) {
      console.error("Ошибка:", err);
    }
  };

  const openRejectModal = (item: Inspection) => {
    setInspectionToReject(item);
    setRawAlcoholDigits("015");
    setRejectReasons({
      firstAidKit: false,
      extinguisher: false,
      baldTires: false,
      bodyDamage: false,
      lightsFault: false,
    });
    setRejectModalOpen(true);
  };

  const handleAlcoholKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setRawAlcoholDigits((prev) => {
        const next = prev + e.key;
        if (next.length > 3) return next.slice(1);
        return next;
      });
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setRawAlcoholDigits((prev) => {
        const next = "0" + prev.slice(0, -1);
        return next.slice(-3);
      });
    }
  };

  const getFormattedAlcoholNumber = (): number => {
    const padded = rawAlcoholDigits.padStart(3, "0").slice(-3);
    const parsed = parseInt(padded, 10);
    return parsed / 100;
  };

  const handleRejectExecute = async () => {
    if (!inspectionToReject) return;

    const now = new Date().toISOString();
    const alcoholVal = getFormattedAlcoholNumber();
    
    const issuesList: string[] = [];
    if (rejectReasons.firstAidKit) issuesList.push("Отсутствие аптечки");
    if (rejectReasons.extinguisher) issuesList.push("Отсутствие огнетушителя");
    if (rejectReasons.baldTires) issuesList.push("Лысая резина");
    if (rejectReasons.bodyDamage) issuesList.push("Повреждение кузова или салона");
    if (rejectReasons.lightsFault) issuesList.push("Неисправность световых приборов");

    const medStatus = alcoholVal === 0 ? "Допущен" : "Не допущен";
    const mechStatus = issuesList.length === 0 ? "Допущен" : "Не допущен";
    const overallStatus = (medStatus === "Допущен" && mechStatus === "Допущен") ? "Допущен" : "Не допущен";

    try {
      const { error } = await updateInspectionReject(
        inspectionToReject.docId,
        now,
        alcoholVal,
        issuesList,
        medStatus,
        mechStatus,
        overallStatus
      );

      if (error) {
        alert(`Не удалось обновить статус: ${error.message}`);
      }
    } catch (err) {
      console.error("Ошибка:", err);
    } finally {
      setRejectModalOpen(false);
      setInspectionToReject(null);
    }
  };

  const handleResetStatus = async (docId: string) => {
    try {
      const { error } = await updateInspectionReset(docId);
      if (error) {
        alert(`Не удалось сбросить статус: ${error.message}`);
      }
    } catch (err) {
      console.error("Ошибка:", err);
    }
  };

  const confirmDelete = (check: Inspection) => {
    setInspectionToDelete(check);
    setDeleteModalOpen(true);
  };

  const handleDeleteExecute = async () => {
    if (!inspectionToDelete) return;

    try {
      const { error } = await deleteInspectionRecord(inspectionToDelete.docId);
      if (error) {
        alert(`Не удалось удалить запись: ${error.message}`);
        return;
      }
    } catch (err) {
      console.error("Ошибка:", err);
    } finally {
      setDeleteModalOpen(false);
      setInspectionToDelete(null);
    }
  };

  // Экспорт «Журнал медика»
  const handleExportMedical = async () => {
    if (exportingMedical) return;

    setExportingMedical(true);
    setExportProgress({ current: 0, total: 0 });

    try {
      const allInspections: any[] = [];
      let page = 1;
      let totalCount = 0;

      do {
        const { formatted, totalCount: fetchedTotal } = await fetchInspectionsData({
          currentPage: page,
          statusFilter: "Все",
          startDateFilter,
          endDateFilter,
          search,
        });

        totalCount = fetchedTotal ?? 0;
        allInspections.push(...(formatted ?? []));

        const totalPagesToFetch = Math.ceil(totalCount / PAGE_SIZE) || 1;
        setExportProgress({ current: Math.min(page, totalPagesToFetch), total: totalPagesToFetch });
        page += 1;
      } while (allInspections.length < totalCount);

      if (allInspections.length === 0) {
        alert("Нет данных для экспорта");
        return;
      }

      const filteredInspections = allInspections.filter((item: any) => {
        const medicalStatus = String(item.medicStatus ?? item.medicalStatus ?? "").trim().toLowerCase();
        const fallbackStatus = String(item.status ?? "").trim().toLowerCase();
        const status = medicalStatus || fallbackStatus;
        return status === "допущен" || status === "не допущен";
      });

      if (filteredInspections.length === 0) {
        alert("Нет записей со статусами «Допущен» или «Не допущен» за выбранный период");
        return;
      }

      const sortedInspections = [...filteredInspections].sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.dateTime || 0).getTime();
        const dateB = new Date(b.date || b.dateTime || 0).getTime();
        return dateA - dateB;
      });

      const workbook = XLSX.utils.book_new();

      const headerRow = [
        "№ П/П",
        "Фамилия, собственное имя, Отчество (если таковое имеется) водителя механического транспортного средства",
        "Место работы водителя",
        "Дата и точное время проведения предрейсового и иного медицинского обследования водителя",
        "", 
        "Результаты предрейсового и иного медицинского обследования (наличие/отсутствие паров алкоголя)",
        "кол-во проверок",
        "Решение, принятое по результатам медицинского осмотра",
        "Фамилия, собственное имя, отчество и подпись лица, проводившего медицинский осмотр",
        "ПОДПИСЬ",
        "Гос. Номер",
        "Автомобиль"
      ];

      const rows = sortedInspections.map((item: any, index: number) => {
        const rawDate = String(item.date ?? item.dateTime ?? "").trim();
        const parsedDate = rawDate ? new Date(rawDate.replace(" ", "T")) : null;
        const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
        
        let datePart = "";
        let timePart = "";

        if (isValidDate) {
          const d = String(parsedDate!.getDate()).padStart(2, "0");
          const m = String(parsedDate!.getMonth() + 1).padStart(2, "0");
          const y = parsedDate!.getFullYear();
          datePart = `${d}.${m}.${y}`;

          const hh = String(parsedDate!.getHours()).padStart(2, "0");
          const mm = String(parsedDate!.getMinutes()).padStart(2, "0");
          timePart = `${hh}:${mm}`;
        } else {
          datePart = rawDate.split(/[ T]/)[0]?.replace(/,/g, "") || "";
          timePart = rawDate.split(/[ T]/)[1]?.slice(0, 5) || "";
        }
        
        const medicalStatus = item.medicStatus ?? item.medicalStatus ?? item.status ?? "";
        const alcoholVal = item.alcohol !== null && item.alcohol !== undefined ? item.alcohol : 0.0;
        const carNumber = item.car?.number ?? item.carNumber ?? item.govNumber ?? "";
        const carBrand = item.car?.brand ?? item.carBrand ?? item.brand ?? "";

        return [
          index + 1,
          item.driver ?? "",
          item.customer ?? "",
          datePart,
          timePart,
          alcoholVal,
          1,
          medicalStatus,
          "Медицинский работник",
          "",
          carNumber,
          carBrand
        ];
      });

      const emptyRow = ["", "", "", "", "", "", "", "", "", "", "", ""];
      
      const appRow = [...emptyRow];
      appRow[7] = "Приложение 2";

      const titleRow = [...emptyRow];
      titleRow[7] = "Журнал проведения предрейсовых и иных медицинских обследований водителей";

      const formRow = [...emptyRow];
      formRow[7] = "Форма";

      const startRowData = [...emptyRow];
      startRowData[7] = 'Начат "___" ____________ 2026г.';

      const endRowData = [...emptyRow];
      endRowData[7] = 'Окончен "___" ____________ 2026г.';

      const wsData = [
        appRow,
        titleRow,
        formRow,
        startRowData,
        endRowData,
        [], 
        headerRow,
        ...rows
      ];
      
      const worksheet = XLSX.utils.aoa_to_sheet(wsData);

      worksheet["!cols"] = [
        { wch: 5 },     // 1
        { wch: 16 },    // 2
        { wch: 17.5 },  // 3
        { wch: 9 },     // 4
        { wch: 9 },     // 5
        { wch: 8 },     // 6
        { wch: 8 },     // 7
        { wch: 8.5 },   // 8 (H)
        { wch: 15.5 },  // 9 (I)
        { wch: 6 },     // 10 (J)
        { wch: 8.5 },   // 11 (K)
        { wch: 18 }     // 12 (L)
      ];

      worksheet["!rows"] = [];
      worksheet["!rows"][1] = { hpt: 55 }; 
      worksheet["!rows"][6] = { hpt: 54 }; 

      worksheet["!merges"] = [
        { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } },  
        { s: { r: 1, c: 7 }, e: { r: 1, c: 9 } },  
        { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } },  
        { s: { r: 3, c: 7 }, e: { r: 3, c: 9 } },  
        { s: { r: 4, c: 7 }, e: { r: 4, c: 9 } },  
        { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } }   
      ];

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:L1");
      
      for (let R = 0; R <= range.e.r; ++R) {
        for (let C = 0; C <= 11; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          
          if (!worksheet[cellAddress]) {
            worksheet[cellAddress] = { t: "s", v: "" };
          }
          
          if (R < 6) {
            if (R === 0 && C === 7) {
              worksheet[cellAddress].s = { font: { name: "Calibri", sz: 9 }, alignment: { horizontal: "left", vertical: "center" } };
            } else if (R === 1 && C === 7) {
              worksheet[cellAddress].s = { font: { name: "Calibri", sz: 9, bold: false }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
            } else if ((R === 2 || R === 3 || R === 4) && C === 7) {
              worksheet[cellAddress].s = { font: { name: "Calibri", sz: 9 }, alignment: { horizontal: "center", vertical: "center" } };
            }
          } else if (R >= 6) {
            const fontSize = R === 6 ? 5 : 9;

            worksheet[cellAddress].s = {
              font: { name: "Calibri", sz: fontSize },
              alignment: { vertical: "center", horizontal: "center", wrapText: true },
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
              }
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "Журнал медика");

      const periodPart = startDateFilter || endDateFilter ? `${startDateFilter || "all"}_${endDateFilter || "all"}` : toISO(new Date());
      XLSX.writeFile(workbook, `Medical_Journal_${periodPart}.xlsx`);

    } catch (error) {
      console.error("Ошибка при экспорте:", error);
      alert("Не удалось сформировать журнал медика.");
    } finally {
      setExportingMedical(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  // Экспорт «Журнал механика» (приведен к стилю и структуре журнала медика с сохранением специфики по механике)
  const handleExportMechanic = async () => {
    if (exportingMechanic) return;

    setExportingMechanic(true);
    setExportProgress({ current: 0, total: 0 });

    try {
      const allInspections: any[] = [];
      let page = 1;
      let totalCount = 0;

      do {
        const { formatted, totalCount: fetchedTotal } = await fetchInspectionsData({
          currentPage: page,
          statusFilter: "Все",
          startDateFilter,
          endDateFilter,
          search,
        });

        totalCount = fetchedTotal ?? 0;
        allInspections.push(...(formatted ?? []));

        const totalPagesToFetch = Math.ceil(totalCount / PAGE_SIZE) || 1;
        setExportProgress({ current: Math.min(page, totalPagesToFetch), total: totalPagesToFetch });
        page += 1;
      } while (allInspections.length < totalCount);

      if (allInspections.length === 0) {
        alert("Нет данных для экспорта");
        return;
      }

      const filteredInspections = allInspections.filter((item: any) => {
        const mechanicStatus = String(item.mechanicStatus ?? "").trim().toLowerCase();
        const fallbackStatus = String(item.status ?? "").trim().toLowerCase();
        const status = mechanicStatus || fallbackStatus;
        return status === "допущен" || status === "не допущен";
      });

      if (filteredInspections.length === 0) {
        alert("Нет записей со статусами «Допущен» или «Не допущен» за выбранный период");
        return;
      }

      const sortedInspections = [...filteredInspections].sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.dateTime || 0).getTime();
        const dateB = new Date(b.date || b.dateTime || 0).getTime();
        return dateA - dateB;
      });

      const workbook = XLSX.utils.book_new();

      const headerRow = [
        "№ П/П",
        "Фамилия, собственное имя, Отчество (если таковое имеется) водителя механического транспортного средства",
        "Место работы водителя",
        "Дата и точное время проведения предрейсового и иного осмотра водителя и ТС",
        "", 
        "Результаты осмотра транспортного средства",
        "кол-во проверок",
        "Решение, принятое по результатам осмотра",
        "Фамилия, собственное имя, отчество и подпись лица, проводившего осмотр",
        "ПОДПИСЬ",
        "Гос. Номер",
        "Автомобиль"
      ];

      const rows = sortedInspections.map((item: any, index: number) => {
        const rawDate = String(item.date ?? item.dateTime ?? "").trim();
        const parsedDate = rawDate ? new Date(rawDate.replace(" ", "T")) : null;
        const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
        
        let datePart = "";
        let timePart = "";

        if (isValidDate) {
          const d = String(parsedDate!.getDate()).padStart(2, "0");
          const m = String(parsedDate!.getMonth() + 1).padStart(2, "0");
          const y = parsedDate!.getFullYear();
          datePart = `${d}.${m}.${y}`;

          const hh = String(parsedDate!.getHours()).padStart(2, "0");
          const mm = String(parsedDate!.getMinutes()).padStart(2, "0");
          timePart = `${hh}:${mm}`;
        } else {
          datePart = rawDate.split(/[ T]/)[0]?.replace(/,/g, "") || "";
          timePart = rawDate.split(/[ T]/)[1]?.slice(0, 5) || "";
        }
        
        const mechanicStatus = item.mechanicStatus ?? item.status ?? "";
        const mechanicResult = item.mechanicResult ?? item.mechanicIssues ?? item.mechanicInspectionResult ?? "Исправно";
        const examiner = item.mechanicExaminer ?? item.mechanicInspector ?? item.inspector ?? "Механик";
        const carNumber = item.car?.number ?? item.carNumber ?? item.govNumber ?? "";
        const carBrand = item.car?.brand ?? item.carBrand ?? item.brand ?? "";

        return [
          index + 1,
          item.driver ?? "",
          item.customer ?? "",
          datePart,
          timePart,
          mechanicResult,
          1,
          mechanicStatus,
          examiner,
          "",
          carNumber,
          carBrand
        ];
      });

      const emptyRow = ["", "", "", "", "", "", "", "", "", "", "", ""];
      
      const appRow = [...emptyRow];
      appRow[7] = "Приложение";

      const titleRow = [...emptyRow];
      titleRow[7] = "Журнал проведения предрейсовых и иных осмотров водителей и транспортных средств";

      const formRow = [...emptyRow];
      formRow[7] = "Форма";

      const startRowData = [...emptyRow];
      startRowData[7] = 'Начат "___" ____________ 2026г.';

      const endRowData = [...emptyRow];
      endRowData[7] = 'Окончен "___" ____________ 2026г.';

      const wsData = [
        appRow,
        titleRow,
        formRow,
        startRowData,
        endRowData,
        [], 
        headerRow,
        ...rows
      ];
      
      const worksheet = XLSX.utils.aoa_to_sheet(wsData);

      worksheet["!cols"] = [
        { wch: 5 },     // 1
        { wch: 16 },    // 2
        { wch: 17.5 },  // 3
        { wch: 9 },     // 4
        { wch: 9 },     // 5
        { wch: 14 },    // 6
        { wch: 8 },     // 7
        { wch: 8.5 },   // 8 (H)
        { wch: 15.5 },  // 9 (I)
        { wch: 6 },     // 10 (J)
        { wch: 8.5 },   // 11 (K)
        { wch: 18 }     // 12 (L)
      ];

      worksheet["!rows"] = [];
      worksheet["!rows"][1] = { hpt: 55 }; 
      worksheet["!rows"][6] = { hpt: 54 }; 

      worksheet["!merges"] = [
        { s: { r: 0, c: 7 }, e: { r: 0, c: 9 } },  
        { s: { r: 1, c: 7 }, e: { r: 1, c: 9 } },  
        { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } },  
        { s: { r: 3, c: 7 }, e: { r: 3, c: 9 } },  
        { s: { r: 4, c: 7 }, e: { r: 4, c: 9 } },  
        { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } }   
      ];

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:L1");
      
      for (let R = 0; R <= range.e.r; ++R) {
        for (let C = 0; C <= 11; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          
          if (!worksheet[cellAddress]) {
            worksheet[cellAddress] = { t: "s", v: "" };
          }
          
          if (R < 6) {
            if (R === 0 && C === 7) {
              worksheet[cellAddress].s = { font: { name: "Calibri", sz: 9 }, alignment: { horizontal: "left", vertical: "center" } };
            } else if (R === 1 && C === 7) {
              worksheet[cellAddress].s = { font: { name: "Calibri", sz: 9, bold: false }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
            } else if ((R === 2 || R === 3 || R === 4) && C === 7) {
              worksheet[cellAddress].s = { font: { name: "Calibri", sz: 9 }, alignment: { horizontal: "center", vertical: "center" } };
            }
          } else if (R >= 6) {
            const fontSize = R === 6 ? 5 : 9;

            worksheet[cellAddress].s = {
              font: { name: "Calibri", sz: fontSize },
              alignment: { vertical: "center", horizontal: "center", wrapText: true },
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
              }
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, "Журнал механика");

      const periodPart = startDateFilter || endDateFilter ? `${startDateFilter || "all"}_${endDateFilter || "all"}` : toISO(new Date());
      XLSX.writeFile(workbook, `Mechanic_Journal_${periodPart}.xlsx`);

    } catch (error) {
      console.error("Ошибка при экспорте:", error);
      alert("Не удалось сформировать журнал механика.");
    } finally {
      setExportingMechanic(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const STATUS_FILTERS = [
    { label: "Все", key: "Все" },
    { label: "Допущен", key: "Допущен" },
    { label: "Не допущен", key: "Не допущен" },
    { label: "Ожидание", key: "Ожидание" },
    { label: "Явиться", key: "Явиться" },
  ];

  return (
    <div className="w-full px-2 sm:px-4 md:px-0">
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Журнал осмотров</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">История предрейсовых осмотров водителей</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={handleExportMedical}
              disabled={exportingMedical}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs font-medium text-white shadow-sm transition-colors ${
                exportingMedical ? "cursor-not-allowed bg-[#2B6CB0]/60" : "cursor-pointer bg-[#2B6CB0] hover:bg-[#2C5282]"
              }`}
              title={exportingMedical ? "Формируется журнал медика" : "Выгрузить журнал медика"}
            >
              {exportingMedical ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {exportProgress.total > 0 ? `${exportProgress.current}/${exportProgress.total}` : "Медик..."}
                </>
              ) : (
                <>
                  <Download size={14} className="shrink-0" />
                  <span className="truncate">Журнал медика</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExportMechanic}
              disabled={exportingMechanic}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs font-medium text-white shadow-sm transition-colors ${
                exportingMechanic ? "cursor-not-allowed bg-[#276749]/60" : "cursor-pointer bg-[#2F855A] hover:bg-[#276749]"
              }`}
              title={exportingMechanic ? "Формируется журнал механика" : "Выгрузить журнал механика"}
            >
              {exportingMechanic ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {exportProgress.total > 0 ? `${exportProgress.current}/${exportProgress.total}` : "Механик..."}
                </>
              ) : (
                <>
                  <Download size={14} className="shrink-0" />
                  <span className="truncate">Журнал механика</span>
                </>
              )}
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-500 shadow-sm text-center sm:text-left">
            Страница <strong className="text-slate-900">{currentPage}</strong> из <strong className="text-slate-900">{totalPages}</strong> <span className="text-slate-400">({totalRecords})</span>
          </div>
        </div>
      </div>

      {/* Панель фильтров */}
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        
        {/* ВЕРХНЯЯ СТРОКА: Поиск и Даты */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          
          {/* Поиск */}
          <div className="relative w-full xl:w-80 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по водителю, авто..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-sm outline-none transition-all focus:border-[#042433] focus:bg-white focus:ring-1 focus:ring-[#042433]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Даты */}
          <div className="flex w-full flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-1.5 xl:w-auto overflow-visible relative">
            <div className="flex items-center justify-between sm:justify-start gap-1 shrink-0 relative">
              <div className="relative flex-1 sm:flex-initial" ref={startPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!startPickerOpen) setStartCursor(startDateFilter ? fromISO(startDateFilter) : new Date());
                    setStartPickerOpen((o) => !o);
                  }}
                  className={`w-full sm:w-auto flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-slate-100 border border-slate-200 ${
                    startDateFilter ? "text-[#042433] font-semibold" : "text-slate-500"
                  }`}
                >
                  <CalendarIcon size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{startDateFilter ? formatDisplayDate(startDateFilter) : "Дата с"}</span>
                </button>

                {startPickerOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setStartCursor(new Date(startCursor.getFullYear(), startCursor.getMonth() - 1, 1))}
                        className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-medium text-slate-800">{formatMonthLabel(startCursor)}</span>
                      <button
                        type="button"
                        onClick={() => setStartCursor(new Date(startCursor.getFullYear(), startCursor.getMonth() + 1, 1))}
                        className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-400">
                      {WEEKDAYS_RU.map((d: string) => (
                        <div key={d} className="py-1">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                      {startWeeks.map((week, wi) =>
                        week.map((day, di) => {
                          if (!day) return <div key={`${wi}-${di}`} />;
                          const selected = isSameDay(day, selectedStartDate);
                          const isToday = isSameDay(day, todayDateObj);
                          return (
                            <button
                              type="button"
                              key={`${wi}-${di}`}
                              onClick={() => {
                                setStartDateFilter(toISO(day));
                                setActiveQuickPeriod(null);
                                setStartPickerOpen(false);
                              }}
                              className={`cursor-pointer aspect-square rounded-md text-xs transition-colors ${
                                selected ? "bg-[#042433] font-semibold text-white" : isToday ? "bg-[#042433]/10 text-[#042433]" : "text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-slate-400 text-sm px-0.5">-</span>

              <div className="relative flex-1 sm:flex-initial" ref={endPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!endPickerOpen) setEndCursor(endDateFilter ? fromISO(endDateFilter) : new Date());
                    setEndPickerOpen((o) => !o);
                  }}
                  className={`w-full sm:w-auto flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-slate-100 border border-slate-200 ${
                    endDateFilter ? "text-[#042433] font-semibold" : "text-slate-500"
                  }`}
                >
                  <span className="truncate">{endDateFilter ? formatDisplayDate(endDateFilter) : "Дата по"}</span>
                </button>

                {endPickerOpen && (
                  <div className="absolute right-0 xl:right-auto xl:left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setEndCursor(new Date(endCursor.getFullYear(), endCursor.getMonth() - 1, 1))}
                        className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-medium text-slate-800">{formatMonthLabel(endCursor)}</span>
                      <button
                        type="button"
                        onClick={() => setEndCursor(new Date(endCursor.getFullYear(), endCursor.getMonth() + 1, 1))}
                        className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-400">
                      {WEEKDAYS_RU.map((d: string) => (
                        <div key={d} className="py-1">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0.5">
                      {endWeeks.map((week, wi) =>
                        week.map((day, di) => {
                          if (!day) return <div key={`${wi}-${di}`} />;
                          const selected = isSameDay(day, selectedEndDate);
                          const isToday = isSameDay(day, todayDateObj);
                          return (
                            <button
                              type="button"
                              key={`${wi}-${di}`}
                              onClick={() => {
                                setEndDateFilter(toISO(day));
                                setActiveQuickPeriod(null);
                                setEndPickerOpen(false);
                              }}
                              className={`cursor-pointer aspect-square rounded-md text-xs transition-colors ${
                                selected ? "bg-[#042433] font-semibold text-white" : isToday ? "bg-[#042433]/10 text-[#042433]" : "text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden h-5 w-[1px] bg-slate-200 mx-0.5 sm:block" />

            <div className="flex items-center justify-between sm:justify-start gap-1 shrink-0">
              <button
                type="button"
                onClick={handleSelectToday}
                className={`flex-1 sm:flex-initial cursor-pointer rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors border text-center ${
                  activeQuickPeriod === "today" ? "bg-[#042433] text-white border-[#042433]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={handleSelectCurrentWeek}
                className={`flex-1 sm:flex-initial cursor-pointer rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors border text-center ${
                  activeQuickPeriod === "week" ? "bg-[#042433] text-white border-[#042433]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Неделя
              </button>
              <button
                type="button"
                onClick={handleSelectCurrentMonth}
                className={`flex-1 sm:flex-initial cursor-pointer rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors border text-center ${
                  activeQuickPeriod === "month" ? "bg-[#042433] text-white border-[#042433]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Месяц
              </button>
              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateFilter("");
                    setEndDateFilter("");
                    setActiveQuickPeriod(null);
                  }}
                  className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                  title="Сбросить даты"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* НИЖНЯЯ СТРОКА: Статусы-вкладки */}
        <div className="flex w-full items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`cursor-pointer shrink-0 flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                statusFilter === item.key
                  ? "bg-[#042433] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              <span
                className={`rounded-full px-1.5 sm:px-2 py-0.2 sm:py-0.5 text-[10px] sm:text-xs ${
                  statusFilter === item.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {statusCounts[item.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

      </div>

      {/* Десктопная таблица */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-slate-400">Загрузка данных...</div>
        ) : inspections.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-400">Нет данных для отображения</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-32 px-4 py-4 text-center">ID водителя</th>
                  <th className="w-[220px] px-4 py-4">Водитель / Заказчик</th>
                  <th className="px-4 py-4">Документы и ТС</th>
                  <th className="px-4 py-4">Осмотр</th>
                  <th className="w-[140px] px-4 py-4 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inspections.map((item: any) => (
                  <CheckRow
                    key={item.docId}
                    item={{
                      ...item,
                      id: String(item.driverId ?? item.driver_id ?? item.id ?? "").split('_')[0],
                      driverId: String(item.driverId ?? item.driver_id ?? item.id ?? "").split('_')[0],
                      driver_id: String(item.driverId ?? item.driver_id ?? item.id ?? "").split('_')[0],
                    }}
                    onApprove={() => handleApprove(item.docId)}
                    onSummon={() => handleSummon(item.docId)}
                    onReject={() => openRejectModal(item)}
                    onResetStatus={() => handleResetStatus(item.docId)}
                    onDelete={() => confirmDelete(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Мобильные карточки */}
      <div className="space-y-2.5 sm:space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs sm:text-sm text-slate-400">Загрузка...</div>
        ) : inspections.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs sm:text-sm text-slate-400">Нет данных</div>
        ) : (
          inspections.map((item: any) => (
            <div key={item.docId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all">
              <CheckCard
                item={{
                  ...item,
                  id: String(item.driverId ?? item.driver_id ?? item.id ?? "").split('_')[0],
                  driverId: String(item.driverId ?? item.driver_id ?? item.id ?? "").split('_')[0],
                  driver_id: String(item.driverId ?? item.driver_id ?? item.id ?? "").split('_')[0],
                }}
                onApprove={() => handleApprove(item.docId)}
                onSummon={() => handleSummon(item.docId)}
                onReject={() => openRejectModal(item)}
                onResetStatus={() => handleResetStatus(item.docId)}
                onDelete={() => confirmDelete(item)}
              />
            </div>
          ))
        )}
      </div>

      {/* ПАНЕЛЬ ПАГИНАЦИИ */}
      {totalPages > 1 && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="w-full sm:w-auto flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Назад
          </button>

          <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`cursor-pointer h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-xs sm:text-sm font-medium transition-colors shrink-0 ${
                      currentPage === page
                        ? "bg-[#042433] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              } else if (
                page === currentPage - 2 ||
                page === currentPage + 2
              ) {
                return <span key={page} className="px-0.5 text-slate-400 text-xs">...</span>;
              }
              return null;
            })}
          </div>

          <button
            type="button"
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="w-full sm:w-auto flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Вперед
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div ref={bottomRef} />

      {/* МОДАЛЬНЫЕ ОКНА */}
      <DeleteInspectionModal
        isOpen={deleteModalOpen}
        inspection={inspectionToDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setInspectionToDelete(null);
        }}
        onExecute={handleDeleteExecute}
      />

      <RejectInspectionModal
        isOpen={rejectModalOpen}
        inspection={inspectionToReject}
        rawAlcoholDigits={rawAlcoholDigits}
        rejectReasons={rejectReasons}
        onClose={() => setRejectModalOpen(false)}
        onAlcoholKeyDown={handleAlcoholKeyDown}
        getFormattedAlcoholNumber={getFormattedAlcoholNumber}
        setRejectReasons={setRejectReasons}
        onExecute={handleRejectExecute}
      />
    </div>
  );
}