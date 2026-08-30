import { supabase } from "@/lib/supabase";
import { hashPassword } from "./auth.service";
import { DatabaseCustomer } from "../types/database.types";

export const CUSTOMERS_PAGE_SIZE = 10;

interface FetchCustomersParams {
  currentPage: number;
  search?: string;
}

/**
 * Экранирует символы, которые в фильтре PostgREST (`.or(...)`) имеют
 * служебное значение — запятая, точка, двоеточие и скобки. Без этого
 * поиск по строке вроде "ООО «Ромашка», филиал" ломает синтаксис
 * запроса и fetchCustomers падает с ошибкой.
 */
function escapeForOrFilter(value: string): string {
  return value.replace(/[,.:()]/g, "\\$&");
}

// Получение списка заказчиков с пагинацией и поиском
export async function fetchCustomers({
  currentPage,
  search = "",
}: FetchCustomersParams) {
  const from = (currentPage - 1) * CUSTOMERS_PAGE_SIZE;
  const to = from + CUSTOMERS_PAGE_SIZE - 1;

  let query = supabase.from("customers").select("*", { count: "exact" });

  if (search.trim()) {
    const cleanSearch = escapeForOrFilter(search.trim());

    // number — текстовое поле (см. DatabaseCustomer), поэтому для него
    // можно использовать обычный ilike без приведения типа — так
    // находится и частичное совпадение (например, "10" найдёт "№100")
    const conditions =
      `name.ilike.%${cleanSearch}%,` +
      `unp.ilike.%${cleanSearch}%,` +
      `contract_number.ilike.%${cleanSearch}%,` +
      `number.ilike.%${cleanSearch}%`;

    query = query.or(conditions);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Ошибка при получении заказчиков:", error);
    throw error;
  }

  return {
    customers: (data as DatabaseCustomer[]) || [],
    totalCount: count || 0,
  };
}

/**
 * Создание нового заказчика вместе с пользователем.
 *
 * В БД вызывается PostgreSQL RPC:
 *
 * create_customer_with_user
 *
 * Она:
 * 1. Создаёт запись в users.
 * 2. login = number.
 * 3. password = number (хеш создаётся на уровне RPC или в этой функции).
 * 4. role = customer.
 * 5. Получает users.id.
 * 6. Создаёт customers с user_id.
 *
 * Если второй INSERT завершается ошибкой,
 * PostgreSQL откатывает транзакцию целиком.
 */
export async function createCustomer(
  newCustomer: Omit<DatabaseCustomer, "id" | "created_at">
) {
  // .trim() важен: поле "Номер" технически можно отправить строкой
  // из одних пробелов, и голая проверка на falsy это пропустит
  if (!String(newCustomer.number ?? "").trim()) {
    return {
      data: null,
      error: {
        message: "Номер заказчика обязателен.",
      },
    };
  }

  if (!String(newCustomer.name ?? "").trim()) {
    return {
      data: null,
      error: {
        message: "Название заказчика обязательно.",
      },
    };
  }

  // Хешируем пароль (по умолчанию = номер заказчика)
  const passwordToHash = String(newCustomer.number).trim();
  const hashedPassword = await hashPassword(passwordToHash);

  const { data, error } = await supabase.rpc("create_customer_with_user", {
    p_number: newCustomer.number,
    p_name: newCustomer.name,
    p_password: hashedPassword,

    p_type: newCustomer.type ?? null,
    p_unp: newCustomer.unp ?? null,
    p_address: newCustomer.address ?? null,
    p_phone: newCustomer.phone ?? null,
    p_email: newCustomer.email ?? null,
    p_contact_person: newCustomer.contact_person ?? null,

    p_bank_name: newCustomer.bank_name ?? null,
    p_bank_account: newCustomer.bank_account ?? null,
    p_bank_bic: newCustomer.bank_bic ?? null,

    p_contract_number: newCustomer.contract_number ?? null,
    p_contract_date: newCustomer.contract_date ?? null,

    p_registration_number: newCustomer.registration_number ?? null,
    p_registration_date: newCustomer.registration_date ?? null,

    p_director_name: newCustomer.director_name ?? null,
  });

  if (error) {
    console.error("Ошибка при создании заказчика:", error);

    return {
      data: null,
      error,
    };
  }

  return {
    data: data as DatabaseCustomer,
    error: null,
  };
}

// Обновление заказчика
export async function updateCustomer(
  id: number,
  updates: Partial<DatabaseCustomer>
) {
  // Если поля "Номер" и "Название" присутствуют в обновлении (форма
  // всегда их отправляет), не даём сохранить их пустыми — иначе
  // запись в БД останется без обязательных данных
  if ("number" in updates && !String(updates.number ?? "").trim()) {
    return {
      data: null,
      error: { message: "Номер заказчика обязателен." },
    };
  }

  if ("name" in updates && !String(updates.name ?? "").trim()) {
    return {
      data: null,
      error: { message: "Название заказчика обязательно." },
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Ошибка при обновлении заказчика:", error);

    return {
      data: null,
      error,
    };
  }

  return {
    data: data as DatabaseCustomer,
    error: null,
  };
}

/**
 * Удаление заказчика.
 *
 * RPC create_customer_with_user при создании заказчика заводит
 * связанного пользователя (login = number, пароль = хеш number).
 * На практике удаление строки из "customers" не приводит к
 * автоматическому удалению соответствующей записи в "users"
 * (даже если предполагался каскад/триггер на уровне БД — он не
 * отрабатывает), поэтому запись в "users" остаётся висеть, и её
 * login больше нельзя использовать для нового заказчика, хотя в
 * customers такого номера уже нет. Поэтому удаляем обе записи явно.
 */
export async function deleteCustomerRecord(
  id: number,
  userId?: number | null
) {
  // Сначала удаляем заказчика, чтобы не упереться в внешний ключ
  // customers.user_id -> users.id
  const { error: customerError } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);

  if (customerError) {
    console.error("Ошибка при удалении заказчика:", customerError);

    return {
      error: customerError,
    };
  }

  // Затем удаляем связанного пользователя, если он есть.
  // Если пользователь уже был удалён (например, каким-то будущим
  // db-триггером), delete по несуществующей строке не вызовет
  // ошибку — Supabase просто ничего не удалит.
  if (userId) {
    const { error: userError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (userError) {
      console.error(
        "Ошибка при удалении связанного пользователя:",
        userError
      );

      return {
        error: userError,
      };
    }
  }

  return {
    error: null,
  };
}
