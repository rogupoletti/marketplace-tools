import "server-only";

import {
    isReturnChannel,
    isReturnStatus,
    isReturnType,
    ReturnFormData,
    ReturnUpdateData,
} from "@/lib/returns";

function cleanString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function cleanDate(value: unknown): string | undefined {
    const cleaned = cleanString(value);
    if (!cleaned) return undefined;
    return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : undefined;
}

export function parseReturnCreatePayload(payload: unknown): ReturnFormData {
    const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};

    const orderNumber = cleanString(data.orderNumber);
    const customerName = cleanString(data.customerName);
    const returnDate = cleanDate(data.returnDate);

    if (!orderNumber) throw new Error("Numero do pedido e obrigatorio");
    if (!customerName) throw new Error("Cliente e obrigatorio");
    if (!isReturnChannel(data.channel)) throw new Error("Canal invalido");
    if (!isReturnType(data.returnType)) throw new Error("Tipo de devolucao invalido");
    if (!returnDate) throw new Error("Data da devolucao invalida");

    return {
        orderNumber,
        customerName,
        channel: data.channel,
        returnType: data.returnType,
        returnDate,
        invoiceNumber: cleanString(data.invoiceNumber),
        expectedArrivalDate: cleanDate(data.expectedArrivalDate),
        notes: cleanString(data.notes),
    };
}

export function parseReturnUpdatePayload(payload: unknown): ReturnUpdateData {
    const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    const update: ReturnUpdateData = {};

    if ("orderNumber" in data) {
        const orderNumber = cleanString(data.orderNumber);
        if (!orderNumber) throw new Error("Numero do pedido e obrigatorio");
        update.orderNumber = orderNumber;
    }

    if ("customerName" in data) {
        const customerName = cleanString(data.customerName);
        if (!customerName) throw new Error("Cliente e obrigatorio");
        update.customerName = customerName;
    }

    if ("channel" in data) {
        if (!isReturnChannel(data.channel)) throw new Error("Canal invalido");
        update.channel = data.channel;
    }

    if ("returnType" in data) {
        if (!isReturnType(data.returnType)) throw new Error("Tipo de devolucao invalido");
        update.returnType = data.returnType;
    }

    if ("status" in data) {
        if (!isReturnStatus(data.status)) throw new Error("Status invalido");
        update.status = data.status;
    }

    if ("returnDate" in data) {
        const returnDate = cleanDate(data.returnDate);
        if (!returnDate) throw new Error("Data da devolucao invalida");
        update.returnDate = returnDate;
    }

    if ("invoiceNumber" in data) update.invoiceNumber = cleanString(data.invoiceNumber) || "";
    if ("expectedArrivalDate" in data) update.expectedArrivalDate = cleanDate(data.expectedArrivalDate) || "";
    if ("notes" in data) update.notes = cleanString(data.notes) || "";
    if ("pendingIssue" in data) update.pendingIssue = cleanString(data.pendingIssue) || "";

    return update;
}
