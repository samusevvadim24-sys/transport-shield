# 🔐 Fix: Password Hashing Implementation

## Описание

Критическое исправление безопасности: реализована система хеширования паролей с использованием bcryptjs вместо хранения паролей в открытом виде.

## Проблема

В исходном коде пароли хранились в открытом виде (plain text) в базе данных Supabase:

```typescript
// ❌ ДО: Небезопасное сравнение паролей
if (user.password !== cleanPassword) {
  throw new Error('Неверный пароль');
}
```

**Риски:**
- Взлом БД приводит к компрометации всех паролей
- Не соответствует стандартам безопасности (OWASP, GDPR)
- Критическая уязвимость для production-систем

## Решение

### 1. Добавлена зависимость bcryptjs

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

### 2. Реализованы функции хеширования в `auth.service.ts`

```typescript
/**
 * Хеширует пароль с использованием bcryptjs
 * @param password - исходный пароль
 * @returns хешированный пароль
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Проверяет соответствие пароля с его хешем
 * @param password - исходный пароль
 * @param passwordHash - хеш пароля из БД
 * @returns true если пароли совпадают
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await bcryptjs.compare(password, passwordHash);
  } catch {
    return false;
  }
}
```

### 3. Обновлен `AuthService.login()`

```typescript
// ✅ ПОСЛЕ: Безопасное сравнение с использованием bcrypt
const isPasswordValid = await verifyPassword(cleanPassword, user.password);
if (!isPasswordValid) throw new Error('Неверный пароль');
```

### 4. Обновлены сервисы создания пользователей

#### `drivers-admin.service.ts` - `createDriver()`
```typescript
// Хешируем пароль перед сохранением
const hashedPassword = await hashPassword(formData.password);

const { data: userData, error: userError } = await supabase
  .from("users")
  .insert({
    login: formData.login,
    password: hashedPassword,  // ✅ Хешированный пароль
    role: "driver",
  })
```

#### `drivers-admin.service.ts` - `updateDriver()`
```typescript
if (formData.password && formData.password.trim() !== "") {
  // Хешируем новый пароль перед сохранением
  userUpdates.password = await hashPassword(formData.password);
}
```

#### `customers-admin.service.ts` - `createCustomer()`
```typescript
// Хешируем пароль (по умолчанию = номер заказчика)
const passwordToHash = String(newCustomer.number).trim();
const hashedPassword = await hashPassword(passwordToHash);

const { data, error } = await supabase.rpc("create_customer_with_user", {
  p_number: newCustomer.number,
  p_name: newCustomer.name,
  p_password: hashedPassword,  // ✅ Хешированный пароль
  // ... остальные параметры
});
```

## Параметры bcryptjs

- **Salt rounds: 10** - оптимальный баланс между безопасностью и производительностью
  - Меньше (5-8): быстрее, но менее безопасно
  - Больше (12+): более безопасно, но медленнее (может замедлить вход)
  - 10 рекомендуется OWASP

## Миграция существующих паролей

⚠️ **Важно:** Существующие пароли в БД остаются в открытом виде и должны быть перехеширован при следующем входе пользователя или через миграцию:

```sql
-- Миграция: перехеширование старых паролей
-- Это должно быть выполнено в БД вручную или через скрипт миграции
UPDATE users 
SET password = crypt(password, gen_salt('bf')) 
WHERE password NOT LIKE '$2a$%' AND password NOT LIKE '$2b$%' AND password NOT LIKE '$2x$%' AND password NOT LIKE '$2y$%';
```

Или через Node.js скрипт миграции (лучше).

## Тестирование

```typescript
// Тест: Создание пользователя с хешированием пароля
const hashedPwd = await hashPassword("test123");
console.log(hashedPwd); // $2a$10$...

// Тест: Проверка пароля
const isValid = await verifyPassword("test123", hashedPwd);
console.log(isValid); // true

const isInvalid = await verifyPassword("wrong", hashedPwd);
console.log(isInvalid); // false
```

## Совместимость

- ✅ Next.js 16.3.0
- ✅ React 19.2.8
- ✅ TypeScript 5
- ✅ Node.js >= 20.9.0

## Безопасность

- ✅ Пароли хешируются перед сохранением
- ✅ Используется bcryptjs с 10 salt rounds
- ✅ Хеши необратимы (even if DB is compromised)
- ✅ OWASP рекомендуемый подход
- ✅ Защита от timing attacks (bcryptjs.compare)

## Следующие шаги

1. ✅ Реализовано: Хеширование паролей при создании пользователей
2. ✅ Реализовано: Проверка пароля при входе
3. ⏳ TODO: Миграция существующих паролей в БД
4. ⏳ TODO: Добавить middleware для проверки авторизации
5. ⏳ TODO: Использовать httpOnly cookies вместо localStorage
6. ⏳ TODO: Добавить JWT токены с expiry

## Файлы, измененные в этом PR

```
✅ package.json                          - добавлены зависимости bcryptjs
✅ src/services/auth.service.ts          - добавлены hashPassword() и verifyPassword()
✅ src/services/drivers-admin.service.ts - применено хеширование при создании/обновлении
✅ src/services/customers-admin.service.ts - применено хеширование при создании
```

## Связанные issues

- Fixes: #1 (Хранение пароля в открытом виде)

## Рецензенты

- @samusevvadim24-sys
