/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DatabaseCustomer } from "@/types/database.types";
import { fetchSystemSettings, SystemSettings } from "../../../../../../services/settings.service";

function formatDate(value: string | null | undefined) {
  if (!value) return "__________";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ru-RU");
}

function money(value: number | undefined) {
  return Number(value || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerContractPage() {
  const params = useParams();
  const customerId = Number(params.id);
  const [customer, setCustomer] = useState<DatabaseCustomer | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!customerId || Number.isNaN(customerId)) return setLoading(false);
      const [customerResult, settingsResult] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        fetchSystemSettings(),
      ]);
      if (customerResult.data) setCustomer(customerResult.data as DatabaseCustomer);
      setSettings(settingsResult);
      setLoading(false);
    }
    load().catch((e) => { setError(e instanceof Error ? e.message : "Не удалось загрузить настройки организации"); setLoading(false); });
  }, [customerId]);

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;

  const executor = {
    name: settings?.organization_name || "________________________",
    address: settings?.organization_address || "________________________",
    bankAccount: settings?.organization_bank_account || "________________________",
    unp: settings?.organization_unp || "__________",
    phone: settings?.organization_phone || "________________________",
    email: settings?.organization_email || "________________________",
    director: settings?.organization_director_name || "________________________",
  };

  const contractNumber = customer?.contract_number || String(customer?.id || "_____");
  const contractDate = formatDate(customer?.contract_date);
  const customerType = (customer as any)?.type || "";
  const customerName = customer?.name || "________________________";
  const customerAddress = customer?.address || "________________________";
  const customerUnp = customer?.unp || "__________";
  const customerAccount = customer?.bank_account || "________________________";
  const customerBank = customer?.bank_name || "________________________";
  const customerPhone = customer?.phone || "________________________";
  const customerContactPerson = (customer as any)?.contact_person || "________________________";
  const fullCustomerName = customerType ? `${customerType} ${customerName}` : customerName;

  return (
    <>
      <div className="contract-toolbar print:hidden">
        <button onClick={() => window.close()} className="toolbar-button"><ArrowLeft size={16} /> Назад</button>
        <div className="toolbar-title">Договор №{contractNumber}</div>
        <button onClick={() => window.print()} className="toolbar-button toolbar-print"><Printer size={16} /> Печать / PDF</button>
      </div>
      {error && <div className="print:hidden p-3 text-center text-sm text-red-600">{error}</div>}

      <main className="contract-wrapper">
        <article className="contract-document">
          <div className="text-center font-bold text-lg mb-2">ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ</div>
          <div className="text-center font-bold mb-6">№ {contractNumber} от {contractDate}</div>
          <div className="flex justify-between mb-6"><span>г. Минск</span><span>{contractDate}</span></div>

          <p className="text-justify mb-4"><strong>{fullCustomerName}</strong>, в лице директора {customerContactPerson}, действующего на основании Устава, именуемое в дальнейшем «Заказчик» с одной стороны, и <strong>{executor.name}</strong>, в лице директора {executor.director}, действующего на основании Устава, именуемое в дальнейшем «Исполнитель» с другой стороны, именуемые в дальнейшем «Стороны», а по отдельности «Сторона», заключили настоящий договор, именуемый в дальнейшем «Договор», о нижеследующем.</p>

          <h3 className="font-bold mt-6 mb-2">1. ПРЕДМЕТ ДОГОВОРА</h3>
          <p className="text-justify mb-2">1.1. По настоящему договору Исполнитель предоставляет Заказчику услуги по медицинскому освидетельствованию на допуск к работе и (или) документально-визуальный контроль соответствия документов и транспортного средства к выезду на линию, а Заказчик обязуется оплатить оказанные ему услуги в соответствии с условиями договора по тарифам приложения №2 к договору.</p>
          <p className="text-justify mb-2">1.2. Соглашаясь с условиями и принимая условия настоящего договора, Заказчик заверяет и гарантирует Исполнителю, что:<br/>- Заказчик обладает всеми правами и полномочиями, необходимыми для заключения и исполнения Договора;<br/>- Заказчик заключает Договор добровольно, при этом Заказчик: а) полностью ознакомился с условиями Договора, б) полностью понимает предмет Договора, в) полностью понимает значение и последствия своих действий в отношении заключения и исполнения Договора;<br/>- Заказчик указал достоверные данные, в том числе персональные данные, Заказчика и достоверные данные при оформлении платежных документов по оплате Услуг.</p>
          <p className="text-justify mb-2">1.3. Оказание услуг, поименованных в п. 1.2.1. Договора, осуществляется по следующим адресам: {executor.address}.</p>
          <p className="text-justify mb-2">1.4. Исполнитель вправе отказать Заказчику в заключении Договора на любом этапе переговоров, если Заказчик не удовлетворяет требованиям законодательства либо критериям добросовестности и благонадежности, установленным Исполнителем. Исполнитель вправе не раскрывать Заказчику причины, по которым Исполнитель относит его к контрагентам, которые не удовлетворяют критериям добросовестности и благонадежности.</p>
          <p className="text-justify mb-4">1.5. Стороны пришли к согласию о возможности использования факсимиле для подписания договора, дополнительных соглашений к нему, а также актов приемки оказанных услуг. Стороны гарантируют друг другу, что факсимиле подписей руководителей, которыми подписаны документы, проставлены ими собственноручно либо по их указанию уполномоченными лицами. Стороны обязуются исключить доступ и использование клише факсимильной подписи посторонних и не уполномоченных лиц.</p>

          <h3 className="font-bold mt-6 mb-2">2. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h3>
          <p className="text-justify font-bold mb-1">2.1. Исполнитель обязуется:</p>
          <p className="text-justify mb-2">2.1.1. Организовывать и проводить медицинское освидетельствование на допуск к работе водителей Заказчика, который представляет собой: идентификацию личности водителя, опрос о состоянии здоровья, измерение при медицинских показаниях температуры тела, пульса и артериального давления, проведение пробы на наличие/отсутствие паров абсолютного этилового спирта, принятие решения о допуске или не допуске водителя, с последующей отметкой в журнале предрейсовых медицинских осмотров, с отстранением от работы лиц, находящихся в нетрезвом или болезненном состоянии, с направлением их в случае необходимости на дополнительное медицинское освидетельствование.</p>
          <p className="text-justify mb-2">2.1.2. Организовывать и проводить предрейсовый осмотр автотранспортных средств Заказчика, который представляет собой документально-визуальный контроль готовности транспортного средства к выезду на линию и включает в себя: проверку наличия, сроков действия и соответствия страховки на автомобиль и государственного технического осмотра транспортного средства, проверку исправности светового оборудования, проверку соответствия величины протектора шин, проверку целостности остекления транспортного средства, а также его укомплектованность действующей автомобильной аптечкой, огнетушителем, светоотражающим жилетом, принятие решения о допуске или не допуске транспортного средства, с последующей отметкой в журнале предрейсовых осмотров, с отстранением от рейса транспортных средств, находящихся в неисправном состоянии.</p>
          <p className="text-justify mb-2">2.1.3. Регистрировать в журнале и отмечать в путевом листе, выданном Заказчиком: а) Информацию о проводимом осмотре, с отметкой о допуске или не допуске водителя. б) Информацию о проводимом осмотре, с отметкой о допуске или не допуске транспортного средства. в) При необходимости, по запросу Заказчика, предоставить доступ к данным предрейсовых осмотров и их результатам.</p>
          <p className="text-justify mb-2">2.1.4. Ежемесячно в срок до 5-го числа предоставлять посредством направления на электронную почту Заказчика акты по оказанным услугам за истекший отчетный период (месяц) с указанием количества, стоимости и других необходимых сведений.</p>
          <p className="text-justify font-bold mb-1">2.2. Исполнитель вправе:</p>
          <p className="text-justify mb-2">2.2.1. Предъявлять к сотрудникам Заказчика требования и давать указания, необходимость которых возникает в связи с оказанием услуг по предмету настоящего договора с целью их наиболее полного и качественного выполнения.</p>
          <p className="text-justify mb-2">2.2.2. Приостанавливать исполнение своих обязательств по отношению к Заказчику в случае невыполнения им требований, а также в случае отсутствия денежных средств на счёте организации, внесенных в качестве предоплаты за оказание услуг.</p>
          <p className="text-justify mb-2">2.2.3. В одностороннем порядке изменять плату (тарифы), условия Договора с уведомлением Заказчика посредством размещения соответствующей информации путем отправки извещения (уведомления) на адрес электронной почты и/или путем направления SMS-сообщений на номер мобильного телефона или сообщений на мобильное приложение-мессенджер VIBER, указанный Заказчиком при заключении Договора, не позднее чем за 1 (один) месяц до даты вступления в силу изменений.</p>
          <p className="text-justify font-bold mb-1">2.3. Заказчик обязуется:</p>
          <p className="text-justify mb-2">2.3.1. В случае изменении реквизитов, не позднее 30 дней сообщить Исполнителю об изменении своих реквизитов (наименование, фактический адрес, адрес места нахождения, банковские реквизиты и т.п.) путем направления скан-копии официального письма на адрес электронной почты, указанный в разделе 8.</p>
          <p className="text-justify mb-2">2.3.2. Организовывать своевременное прибытие водителей и автотранспортных средств на пункты прохождения предрейсовых медицинских осмотров в согласованное с Исполнителем время.</p>
          <p className="text-justify mb-2">2.3.3. Не направлять на прохождение предрейсового осмотра транспортные средства, заведомо находящиеся в технически неисправном состоянии.</p>
          <p className="text-justify mb-2">2.3.4. После получения актов оказанных услуг Заказчик обязан произвести их оплату в срок, предусмотренный п. 3 настоящего Договора.</p>
          <p className="text-justify mb-2">2.3.5. Проинструктировать своих сотрудников о правилах посещения кабинета предрейсовых осмотров в соответствии с пунктами 2.3.6–2.3.11 настоящего договора.</p>
          <p className="text-justify mb-2">2.3.6. Сотрудник Заказчика обязан по требованию медицинского работника предъявить документ удостоверяющий личность.</p>
          <p className="text-justify mb-2">2.3.7. Сотрудник Заказчика обязан по требованию медицинского работника предъявить документы на транспортное средство: технический паспорт автомобиля, талон гостехосмотра и страховое свидетельство.</p>
          <p className="text-justify mb-2">2.3.8. В момент посещения кабинета осмотра не разговаривать по мобильному телефону.</p>
          <p className="text-justify mb-2">2.3.9. НЕ входить в кабинет осмотра с жвачкой, едой и напитками.</p>
          <p className="text-justify mb-2">2.3.10. НЕ входить в кабинет осмотра в солнцезащитных очках.</p>
          <p className="text-justify mb-4">2.3.11. По требованию медицинского работника выполнять все необходимые процедуры, связанные с освидетельствованием и предметом настоящего договора.</p>
          <p className="text-justify font-bold mb-1">2.4. Заказчик вправе:</p>
          <p className="text-justify mb-2">2.4.1. Предъявлять к оказываемым услугам разумные и обоснованные требования, не вмешиваясь в деятельность Исполнителя.</p>
          <p className="text-justify mb-4">2.4.2. Отказаться от договора, если Исполнитель допускает его очевидные нарушения.</p>

          <h3 className="font-bold mt-6 mb-2">3. Порядок сдачи-приемки оказанных услуг, порядок расчетов</h3>
          <p className="text-justify mb-2">3.1. Стороны договорились, что стоимость Услуг, оказанных за Отчетный период, фиксируется и подтверждается Сторонами в Акте об оказанных Услугах.</p>
          <p className="text-justify mb-2">3.2. Исполнитель обязан подготовить проект Акта на последний день Отчетного периода и направить его Заказчику по электронной почте в течение 5 (пяти) рабочих дней после окончания Отчетного периода.</p>
          <p className="text-justify mb-2">3.3. Датой получения Акта, направленного Исполнителем Заказчику по электронной почте, считается рабочий день, следующий за днем отправки.</p>
          <p className="text-justify mb-2">3.4. Стороны установили, что, если в течение 7 (семи) календарных дней с даты получения Заказчиком проекта Акта Исполнитель не получил обоснованных письменных возражений, считается, что Заказчик согласен с данными в Акте.</p>
          <p className="text-justify mb-2">3.5. Оплата услуг Исполнителя осуществляется в безналичном порядке на его расчетный счет. Валюта расчетов — белорусские рубли.</p>
          <p className="text-justify mb-2">3.6. Днем осуществления платежа считается дата зачисления денежных средств на расчетный счет Исполнителя.</p>
          <p className="text-justify mb-2">3.7. Все расходы по осуществлению переводов денежных средств на счет Исполнителя несет Заказчик.</p>
          <p className="text-justify mb-4">3.8. В соответствии с постановлением Минфина от 12.02.2018 N 13 Заказчик подтверждает и соглашается с тем, что акт составляется Исполнителем единолично и направляется на электронную почту.</p>

          <h3 className="font-bold mt-6 mb-2">4. Ответственность сторон</h3>
          <p className="text-justify mb-2">4.1. Исполнитель за некачественно предоставленные услуги, за просрочку их предоставления утрачивает право на их оплату, а если они уже оплачены — обязан возвратить полученную сумму.</p>
          <p className="text-justify mb-2">4.2. Заказчик за невыполнение обязательств, предусмотренных п. 2.3. договора утрачивает право на предоставление соответствующих услуг.</p>
          <p className="text-justify mb-2">4.3. В случае ненадлежащего исполнения Стороной своих обязательств, другая Сторона имеет право в одностороннем порядке отказаться от исполнения Договора.</p>
          <p className="text-justify mb-2">4.4. В случае нарушения Заказчиком сроков оплаты Услуг, Исполнитель вправе потребовать уплаты штрафной неустойки в размере 0,01% от суммы просроченного платежа за каждый день просрочки.</p>
          <p className="text-justify mb-2">4.5. Стороны освобождаются от ответственности за неисполнение обязательств при наступлении обстоятельств непреодолимой силы (форс-мажор).</p>
          <p className="text-justify mb-2">4.6. Исполнитель не предоставляет никаких иных прямых или подразумеваемых гарантий по Договору, кроме прямо указанных.</p>
          <p className="text-justify mb-2">4.7. Исполнитель не несет ответственности и не возмещает убытки (упущенную выгоду), причиненные в результате использования или невозможности использования Услуги.</p>
          <p className="text-justify mb-4">4.8. Во всем остальном Стороны руководствуются действующим законодательством Республики Беларусь.</p>

          <h3 className="font-bold mt-6 mb-2">5. Срок действия, изменения и расторжение Договора</h3>
          <p className="text-justify mb-2">5.1. Договор вступает в силу с момента подписания и действует до полного исполнения обязательств. Автоматически прекращается, если Заказчик не пользовался Услугами в течение 12 месяцев.</p>
          <p className="text-justify mb-4">5.2. Договор может быть расторгнут по соглашению Сторон, либо по инициативе любой из Сторон с предварительным письменным уведомлением за 30 календарных дней.</p>

          <h3 className="font-bold mt-6 mb-2">6. Порядок обмена документами</h3>
          <p className="text-justify mb-2">6.1. Переписка ведется путем обмена сообщениями по электронной почте и/или SMS.</p>
          <p className="text-justify mb-2">6.2. Все сообщения и уведомления считаются доставленными в надлежащей форме.</p>
          <p className="text-justify mb-2">6.3. Документы, связанные с исполнением Договора по электронной почте, имеют юридическую силу.</p>
          <p className="text-justify mb-2">6.4. Стороны обязаны не реже раза в неделю проверять почту и входящие SMS.</p>
          <p className="text-justify mb-2">6.5. Email Исполнителя: {executor.email}. Email и телефон Заказчика указываются при заключении.</p>
          <p className="text-justify mb-4">6.6. Документы и акты, переданные по электронной почте, признаются официальными и могут приниматься как доказательства в суде.</p>

          <h3 className="font-bold mt-6 mb-2">7. Прочие условия</h3>
          <p className="text-justify mb-2">7.1. Договору присваивается внутренний номер для оформления первичных документов.</p>
          <p className="text-justify mb-2">7.2. Исполнитель вправе использовать контакты Заказчика для рассылки информационных сообщений.</p>
          <p className="text-justify mb-2">7.3. Договор заключается в письменной форме.</p>
          <p className="text-justify mb-2">7.4. Споры разрешаются путем переговоров или направления претензий (срок рассмотрения — 10 календарных дней).</p>
          <p className="text-justify mb-2">7.5. Неразрешенные споры подлежат рассмотрению в суде по месту нахождения Исполнителя.</p>
          <p className="text-justify mb-2">7.6–7.8. Стороны обязуются соблюдать конфиденциальность и обеспечивать правомерную обработку персональных данных в соответствии с законодательством РБ.</p>
          <p className="text-justify mb-6">7.9. Признание недействительным какого-либо положения не влечет недействительности остальных положений.</p>

          <h3 className="font-bold mt-6 mb-4">8. АДРЕСА И РЕКВИЗИТЫ СТОРОН</h3>
          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div>
              <p className="font-bold mb-1">Исполнитель:</p>
              <p><strong>{executor.name}</strong></p>
              <p>{executor.address}</p>
              <p>р/с: {executor.bankAccount}</p>
              <p>УНП {executor.unp}</p>
              <p>Тел: {executor.phone}</p>
              <p>e-mail: {executor.email}</p>
              <div className="mt-6">Директор _______________ / {executor.director}</div>
            </div>
            <div>
              <p className="font-bold mb-1">Заказчик:</p>
              <p><strong>{fullCustomerName}</strong></p>
              <p>{customerAddress}</p>
              <p>р/с: {customerAccount}</p>
              <p>в {customerBank}</p>
              <p>УНП {customerUnp}</p>
              <p>Тел: {customerPhone}</p>
              <div className="mt-6">Директор _______________ / {customerContactPerson}</div>
            </div>
          </div>

          <div className="border-t pt-6 mt-8">
            <div className="text-center font-bold mb-2">Приложение № 2 к договору № {contractNumber} от {contractDate}</div>
            <div className="text-center text-sm mb-4">(вступает в действие с {contractDate})</div>
            <div className="text-center font-bold mb-4">ПРОТОКОЛ согласования отпускной цены</div>
            <p className="text-sm mb-2"><strong>Исполнитель:</strong> {executor.name}</p>
            <p className="text-sm mb-4"><strong>Заказчик:</strong> {fullCustomerName}</p>
            <p className="font-bold text-sm mb-2">Абонентское обслуживание:</p>
            <table className="w-full border-collapse border border-black text-sm mb-4">
              <thead><tr><th className="border border-black p-1">№</th><th className="border border-black p-1">Наименование товара / услуги</th><th className="border border-black p-1">Ед. изм.</th><th className="border border-black p-1">Цена</th><th className="border border-black p-1">Ставка НДС</th><th className="border border-black p-1">Всего рублей</th></tr></thead>
              <tbody>
                <tr><td className="border border-black p-1 text-center">1</td><td className="border border-black p-1">Предрейсовое медицинское обследование водителей</td><td className="border border-black p-1 text-center">Освидетельствование</td><td className="border border-black p-1 text-right">{money(settings?.medical_exam_price)}</td><td className="border border-black p-1 text-center">Без НДС</td><td className="border border-black p-1 text-right">{money(settings?.medical_exam_price)} руб.</td></tr>
                <tr><td className="border border-black p-1 text-center">2</td><td className="border border-black p-1">Документально-визуальный контроль готовности транспортного средства</td><td className="border border-black p-1 text-center">Осмотр</td><td className="border border-black p-1 text-right">{money(settings?.mechanic_exam_price)}</td><td className="border border-black p-1 text-center">Без НДС</td><td className="border border-black p-1 text-right">{money(settings?.mechanic_exam_price)} руб.</td></tr>
              </tbody>
            </table>
            <p className="text-xs italic mb-6">Без НДС на основании абз. 4 п. 6 ст. 130 Налогового кодекса РБ.</p>
            <div className="grid grid-cols-2 gap-8 text-sm mt-4">
              <div><p className="font-bold">Исполнитель:</p><p>{executor.name}</p><p className="mt-4">Директор _______________ / (подпись)</p></div>
              <div><p className="font-bold">Заказчик:</p><p>{fullCustomerName}</p><p className="mt-4">Директор _______________ / (подпись)</p></div>
            </div>
          </div>
        </article>
      </main>

      <style jsx global>{`
        .contract-toolbar { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: #fff; border-bottom: 1px solid #ccc; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .toolbar-title { font-weight: bold; font-size: 16px; color: #333; }
        .toolbar-button { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; background: #fff; font-size: 14px; }
        .toolbar-print { background: #042433; color: white; border-color: #042433; }
        .contract-wrapper { padding: 40px 20px; background: #f3f4f6; min-height: 100vh; }
        .contract-document { width: 210mm; margin: 0 auto; padding: 20mm; background: white; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.4; color: black; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        @media print { .contract-toolbar { display: none; } .contract-wrapper { padding: 0; background: none; } .contract-document { width: 100%; box-shadow: none; padding: 10mm; } }
      `}</style>
    </>
  );
}
