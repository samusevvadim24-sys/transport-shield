// Преобразование Date в строку ISO (YYYY-MM-DD) по местному времени
export function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Создание объекта Date из строки вида YYYY-MM-DD
export function fromISO(isoString: string): Date {
  const [year, month, day] = isoString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Красивый вывод даты для кнопки (например, "15 авг. 2026")
export function formatDisplayDate(isoString: string): string {
  if (!isoString) return "";
  const date = fromISO(isoString);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Название месяца и года для шапки календаря (например, "Август 2026")
export function formatMonthLabel(date: Date): string {
  const label = date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Проверка, являются ли две даты одним и тем же днем
export function isSameDay(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// Генерация матрицы дней для месяца (сетка календаря по неделям)
export function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const matrix: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Воскресенье

  for (let i = 0; i < startingDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));

    if (currentWeek.length === 7) {
      matrix.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    matrix.push(currentWeek);
  }

  return matrix;
}