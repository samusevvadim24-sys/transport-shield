export type DriverStatus =
  | "Допущен"
  | "Ожидание"
  | "Не допущен"
  | "Отстранен"
  | "Явиться"
  | string;

export function getDisplayStatus(status?: string, address?: string): string {
  switch (status) {
    case "Допущен":
      return "Подтверждено";
    case "Не допущен":
      return "Отклонено";
    case "Отстранен":
      return "Отстранен";
    case "Явиться":
      return address
        ? `Необходимо явиться на пункт предрейсового осмотра по адресу: ${address}`
        : "Необходимо явиться на пункт предрейсового осмотра по адресу, указанному администратором";
    case "Ожидание":
      return "Ожидание";
    default:
      return status || "Ожидание";
  }
}

export function getStatusStyle(status?: string): string {
  switch (status) {
    case "Допущен":
      return "bg-[#2F855A]/10 text-[#2F855A] border-[#2F855A]/20";
    case "Ожидание":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Явиться":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Не допущен":
    case "Отстранен":
      return "bg-[#C53030]/10 text-[#C53030] border-[#C53030]/20";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function getStatusDot(status?: string): string {
  switch (status) {
    case "Допущен":
      return "bg-[#2F855A]";
    case "Не допущен":
    case "Отстранен":
      return "bg-[#C53030]";
    case "Ожидание":
    case "Явиться":
      return "bg-amber-500";
    default:
      return "bg-slate-300";
  }
}
