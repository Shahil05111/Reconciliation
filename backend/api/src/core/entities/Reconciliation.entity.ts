/**
 * Reconciliation entities
 *
 * Covers three reconciliation views:
 *   A — OMS order (b2c_non_split) vs WMS dispatch (b2c_detail)
 *   B — Myntra order (myntra_seller_oder) vs forward settlement (myntra_f_settelment)
 *   C — WMS return receipt (return_order_report_item_level_wms)
 *        vs Myntra return tracker (myntra_rt)
 *        vs return settlement (myntra_r_settelment)
 *
 * All queries are READ-ONLY (authorize view mode).
 */

// ─────────────────────────────────────────────────────────────
// Shared filter input — applies to every endpoint
// ─────────────────────────────────────────────────────────────

export interface ReconciliationFilters {
  dateFrom?: string; // ISO date string  e.g. "2025-01-01"
  dateTo?: string; // ISO date string  e.g. "2025-03-31"
  brand?: string; // e.g. "Libas", "Gerua By Libas"
  salesChannel?: string; // e.g. "MYNTRAV4_ZIVORE", "FLIPKARTV3_ZIVORE"
  warehouseName?: string; // e.g. "wms_noida", "wms_ekart_blr"
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// RECON A — OMS vs WMS Dispatch
// lib_backup.dbo.b2c_non_split  vs  dbo.b2c_detail
// Join key: channel_order_id / channel_parent_order_id
// ─────────────────────────────────────────────────────────────

export type OmsDispatchStatus =
  | "matched" // order exists in both OMS and WMS, qty matches
  | "not_dispatched" // in OMS (COMPLETED) but no WMS dispatch record
  | "qty_mismatch" // dispatched_quantity != ordered_quantity
  | "cancelled"; // Channel_Order_Status = CANCELLED in OMS

export interface OmsVsDispatchRow {
  // from b2c_non_split (OMS)
  channelOrderId: string;
  channelSubOrderId: string;
  salesChannel: string;
  channelOrderStatus: string;
  omsOrderStatus: string;
  clientSkuId: string;
  mrp: number;
  unitSalePrice: number;
  orderedQuantity: number;
  cancelledQuantity: number;
  channelOrderTime: Date | null;

  // from b2c_detail (WMS) — null when not dispatched
  warehouseName: string | null;
  warehouseCity: string | null;
  systemOrderId: number | null;
  dispatchedQuantity: number | null;
  paymentType: string | null;
  totalSalePrice: number | null;
  outwardAwbNo: string | null;
  transporter: string | null;
  orderStatus: string | null;
  handoverTime: Date | null;
  brand: string | null;
  slaBreached: string | null;

  // computed
  reconStatus: OmsDispatchStatus;
  qtyGap: number; // orderedQuantity - dispatchedQuantity (0 when matched)
}

// ─────────────────────────────────────────────────────────────
// RECON B — Myntra Order vs Forward Settlement
// dbo.myntra_seller_oder  vs  dbo.myntra_f_settelment
// Join key: order_line_id / order_release_id
// ─────────────────────────────────────────────────────────────

export type ForwardSettlementStatus =
  | "settled" // actual = expected, pending = 0
  | "partially_settled" // actual < expected, pending > 0
  | "not_settled" // no record in f_settelment at all
  | "overpaid" // actual > expected (rare, but real)
  | "cancelled"; // order_status = "F" (failed/cancelled)

export interface OrderVsSettlementRow {
  // from myntra_seller_oder
  orderReleaseId: string;
  orderLineId: string;
  sellerOrderId: string;
  warehouseId: string;
  brand: string;
  skuId: string;
  myntraSkuCode: string;
  size: string;
  orderStatus: string;
  createdOn: Date | null;
  deliveredOn: Date | null;
  cancelledOn: Date | null;
  finalAmount: number;
  totalMrp: number;

  // from myntra_f_settelment — null when not settled
  customerPaidAmount: number | null;
  totalExpectedSettlement: number | null;
  totalActualSettlement: number | null;
  amountPendingSettlement: number | null;
  totalCommission: number | null;
  totalLogisticsDeduction: number | null;
  tcsAmount: number | null;
  tdsAmount: number | null;
  shipmentZoneClassification: string | null;
  articleType: string | null;

  // computed
  reconStatus: ForwardSettlementStatus;
  settlementGap: number; // expectedSettlement - actualSettlement
}

// ─────────────────────────────────────────────────────────────
// RECON C — WMS Return Receipt vs Myntra Return Settlement
// return_order_report_item_level_wms  (WMS physical receipt)
//   vs  dbo.myntra_rt                 (Myntra return tracker)
//   vs  dbo.myntra_r_settelment       (return financial settlement)
// Join key: channel_order_id → order_line_id → return_id
// ─────────────────────────────────────────────────────────────

export type ReturnSettlementStatus =
  | "fully_settled" // WMS received + in myntra_rt + in r_settelment
  | "pending_settlement" // WMS received + in myntra_rt, no r_settelment yet
  | "not_in_myntra" // WMS received, missing from myntra_rt entirely
  | "settlement_only" // in r_settelment but no WMS inward record
  | "exchange"; // return_type = "exchange" in r_settelment

export interface ReturnVsSettlementRow {
  // from return_order_report_item_level_wms (WMS)
  wmsWarehouseName: string;
  channelOrderId: string;
  channelParentOrderId: string;
  returnOrderType: string;
  systemReturnId: number | null;
  channelReturnId: string | null;
  returnGateEntryTime: Date | null;
  inwardTime: Date | null;
  qcReason: string | null;
  reasonForReturn: string | null;
  returnOrderItemQcStatus: string | null;
  returnOrderStatus: string | null;
  finalResolution: string | null;
  clientSkuIdEan: string | null;
  brand: string | null;
  mrp: string | null;
  forwardOrderValue: string | null;
  salesChannel: string | null;
  forwardAwbNumber: string | null;

  // from myntra_rt — null if not matched
  myntraReturnCreationDate: Date | null;
  myntraReturnTrackingNumber: string | null;
  myntraOrderRtoDate: Date | null;

  // from myntra_r_settelment — null if not settled
  returnType: string | null;
  totalActualSettlement: number | null;
  amountPendingSettlement: number | null;
  returnId: string | null;
  returnDate: Date | null;

  // computed
  reconStatus: ReturnSettlementStatus;
}

// ─────────────────────────────────────────────────────────────
// Summary — aggregated counts across all 3 recon views
// Returned by GET /reconciliation/summary
// ─────────────────────────────────────────────────────────────

export interface ReconciliationSummary {
  generatedAt: string;
  filters: ReconciliationFilters;

  omsVsDispatch: {
    totalOrders: number;
    matched: number;
    notDispatched: number;
    qtyMismatch: number;
    cancelled: number;
  };

  orderVsSettlement: {
    totalDeliveredOrders: number;
    settled: number;
    partiallySettled: number;
    notSettled: number;
    overpaid: number;
    totalPendingAmount: number;
  };

  returnVsSettlement: {
    totalReturnsReceived: number;
    fullySettled: number;
    pendingSettlement: number;
    notInMyntra: number;
    settlementOnly: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Paginated response wrapper
// ─────────────────────────────────────────────────────────────

export interface PaginatedReconResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: "database" | "cache";
}
