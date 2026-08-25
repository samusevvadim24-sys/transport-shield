"use client";

import { useEffect, useState } from "react";
import { DatabaseCustomer } from "../../../../../types/database.types";
import { findCustomerForHistory } from "../../../../../services/customer-balance-history.service";
import CustomerBalanceHistoryModal from "./CustomerBalanceHistoryModal";

export default function CustomerHistoryBridge() {
  const [customer, setCustomer] = useState<DatabaseCustomer | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("button, a, input, textarea, select")) return;

      const desktopCell = event.target.closest("tbody tr td:first-child");
      const mobileCard = event.target.closest("article");
      const source = desktopCell || mobileCard;
      if (!source) return;

      let name = "";
      let number: string | null = null;

      if (desktopCell) {
        const nameContainer = desktopCell.querySelector("div.font-semibold.text-slate-900");
        const spans = nameContainer ? Array.from(nameContainer.querySelectorAll("span")) : [];
        name = spans.length ? spans[spans.length - 1]?.textContent?.trim() || "" : "";
        const numberText = desktopCell.querySelector("span.font-mono")?.textContent?.trim() || "";
        number = numberText.replace(/^№/, "") || null;
      } else if (mobileCard) {
        name = mobileCard.querySelector("h3")?.textContent?.trim() || "";
        const numberText = Array.from(mobileCard.querySelectorAll("span")).find((span) => /^№/.test(span.textContent?.trim() || ""))?.textContent?.trim() || "";
        number = numberText.replace(/^№/, "") || null;
      }

      if (!name) return;

      const result = await findCustomerForHistory(name, number);
      if (result.error || !result.customer) return;
      setCustomer(result.customer);
      setOpen(true);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <CustomerBalanceHistoryModal
      isOpen={open}
      customer={customer}
      onClose={() => { setOpen(false); setCustomer(null); }}
    />
  );
}
