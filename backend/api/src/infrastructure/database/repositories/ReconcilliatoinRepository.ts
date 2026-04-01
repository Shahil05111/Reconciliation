import { injectable } from "inversify";
import { Request as SqlRequest } from "mssql";
import { BaseRepository } from "./BaseRepository";
import { getPool } from "../connection";
import { DatabaseException } from "../../../core/exceptions/BaseException";
import { logger } from "../../logging/logger.services";
import {
  ReconciliationFilters,
  OmsVsDispatchRow,
  OrderVsSettlementRow,
  ReturnVsSettlementRow,
  ReconciliationSummary,
} from "../../../core/entities/Reconciliation.entity";

/**
 * ReconciliationRepository
 *
 * READ-ONLY repository — no INSERT / UPDATE / DELETE anywhere in this file.
 *
 * All user-supplied filter values are passed as named SQL parameters
 * via mssql's request.input() to prevent SQL injection.
 *
 * Cross-database queries use fully-qualified table names:
 *   lib_backup.dbo.<table>      — OMS operational data
 *   partner_data.dbo.<table>    — WMS dispatch / sale data
 *   libdata.dbo.<table>         — WMS return data
 *   partner_portal.dbo.<table>  — Myntra partner portal data
 *
 * All large table references use WITH (NOLOCK) to avoid read locks on
 * tables that are continuously written to by upstream ETL processes.
 * This is acceptable because reconciliation is an analytical read — we
 * tolerate the tiny risk of reading an in-flight row in exchange for
 * eliminating lock-wait timeouts on 10M–20M row tables.
 */
@injectable()
export class ReconciliationRepository extends BaseRepository {
  protected readonly tableName = "reconciliation";

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  /**
   * Builds a fresh mssql Request with all active filter parameters
   * bound as named inputs. Every query in this repo calls this first.
   */
  private async buildRequest(
    filters: ReconciliationFilters,
  ): Promise<SqlRequest> {
    const pool = await getPool();
    const req = pool.request();

    if (filters.dateFrom) req.input("dateFrom", filters.dateFrom);
    if (filters.dateTo) req.input("dateTo", filters.dateTo);
    if (filters.brand) req.input("brand", filters.brand);
    if (filters.salesChannel) req.input("salesChannel", filters.salesChannel);
    if (filters.warehouseName)
      req.input("warehouseName", filters.warehouseName);

    return req;
  }

  /**
   * Appends WHERE clauses shared across all three recon views.
   * Returns a string starting with AND if any filter is active, else "".
   */
  private buildDateBrandChannelClauses(
    filters: ReconciliationFilters,
    opts: {
      dateCol: string;
      brandCol?: string;
      channelCol?: string;
      warehouseCol?: string;
    },
  ): string {
    const parts: string[] = [];

    if (filters.dateFrom) parts.push(`${opts.dateCol} >= @dateFrom`);
    if (filters.dateTo) parts.push(`${opts.dateCol} <= @dateTo`);
    if (filters.brand && opts.brandCol) parts.push(`${opts.brandCol} = @brand`);
    if (filters.salesChannel && opts.channelCol)
      parts.push(`${opts.channelCol} = @salesChannel`);
    if (filters.warehouseName && opts.warehouseCol)
      parts.push(`${opts.warehouseCol} = @warehouseName`);

    return parts.length > 0 ? "AND " + parts.join(" AND ") : "";
  }

  /** Safe integer coercion for pagination */
  private pagination(filters: ReconciliationFilters): {
    offset: number;
    limit: number;
  } {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters.limit ?? 50));
    return { offset: (page - 1) * limit, limit };
  }

  // ───────────────────────────────────────────────────────────
  // RECON A — OMS vs WMS Dispatch
  // lib_backup.dbo.b2c_non_split  LEFT JOIN  partner_data.dbo.b2c_detail
  // ───────────────────────────────────────────────────────────

  async getOmsVsDispatch(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<OmsVsDispatchRow[]> {
    const { offset, limit } = this.pagination(filters);
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "oms.channel_order_time",
      brandCol: "wms.brand",
      channelCol: "oms.Sales_Channel",
      warehouseCol: "wms.warehouse_name",
    });

    const query = `
      SELECT
        oms.Channel_Order_ID          AS channelOrderId,
        oms.Channel_Sub_Order_ID      AS channelSubOrderId,
        oms.Sales_Channel             AS salesChannel,
        oms.Channel_Order_Status      AS channelOrderStatus,
        oms.OMS_Order_Status          AS omsOrderStatus,
        oms.Client_SKU_ID             AS clientSkuId,
        oms.MRP                       AS mrp,
        oms.Unit_Sale_Price           AS unitSalePrice,
        oms.Ordered_Quantity          AS orderedQuantity,
        oms.Cancelled_Quantity        AS cancelledQuantity,
        oms.channel_order_time        AS channelOrderTime,

        wms.warehouse_name            AS warehouseName,
        wms.warehouse_city            AS warehouseCity,
        wms.system_order_id           AS systemOrderId,
        wms.dispatched_quantity       AS dispatchedQuantity,
        wms.payment_type              AS paymentType,
        wms.total_sale_price          AS totalSalePrice,
        wms.outward_awb_no            AS outwardAwbNo,
        wms.transporter               AS transporter,
        wms.order_status              AS orderStatus,
        wms.handover_time             AS handoverTime,
        wms.brand                     AS brand,
        wms.sla_breached              AS slaBreached,

        CASE
          WHEN oms.Channel_Order_Status = 'CANCELLED'
            THEN 'cancelled'
          WHEN wms.channel_order_id IS NULL
            THEN 'not_dispatched'
          WHEN oms.Ordered_Quantity <> ISNULL(wms.dispatched_quantity, 0)
            THEN 'qty_mismatch'
          ELSE 'matched'
        END                           AS reconStatus,

        oms.Ordered_Quantity - ISNULL(wms.dispatched_quantity, 0)
                                      AS qtyGap

      FROM lib_backup.dbo.b2c_non_split oms WITH (NOLOCK)
      LEFT JOIN partner_data.dbo.b2c_detail wms WITH (NOLOCK)
        ON  oms.Channel_Order_ID = wms.channel_order_id

      WHERE 1=1
      ${whereClauses}

      ORDER BY oms.channel_order_time DESC

      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      logger.info("getOmsVsDispatch executed", {
        correlationId,
        rows: result.recordset.length,
      });
      return result.recordset as OmsVsDispatchRow[];
    } catch (error) {
      logger.error("getOmsVsDispatch failed", { error, correlationId });
      throw new DatabaseException(
        "Failed to execute OMS vs dispatch reconciliation",
        correlationId,
        error,
      );
    }
  }

  async countOmsVsDispatch(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<number> {
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "oms.channel_order_time",
      brandCol: "wms.brand",
      channelCol: "oms.Sales_Channel",
      warehouseCol: "wms.warehouse_name",
    });

    const query = `
      SELECT COUNT(1) AS total
      FROM lib_backup.dbo.b2c_non_split oms WITH (NOLOCK)
      LEFT JOIN partner_data.dbo.b2c_detail wms WITH (NOLOCK)
        ON  oms.Channel_Order_ID = wms.channel_order_id
      WHERE 1=1
      ${whereClauses}
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      return result.recordset[0]?.total ?? 0;
    } catch (error) {
      throw new DatabaseException(
        "Failed to count OMS vs dispatch rows",
        correlationId,
        error,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // RECON B — Myntra Order vs Forward Settlement
  // partner_portal.dbo.myntra_seller_order
  //   LEFT JOIN  partner_portal.dbo.myntra_f_settelment
  // ───────────────────────────────────────────────────────────

  async getOrderVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<OrderVsSettlementRow[]> {
    const { offset, limit } = this.pagination(filters);
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "o.created_on",
      brandCol: "o.brand",
    });

    const query = `
      SELECT
        o.order_release_id            AS orderReleaseId,
        o.order_line_id               AS orderLineId,
        o.seller_order_id             AS sellerOrderId,
        o.warehouse_id                AS warehouseId,
        o.brand                       AS brand,
        o.sku_id                      AS skuId,
        o.myntra_sku_code             AS myntraSkuCode,
        o.size                        AS size,
        o.order_status                AS orderStatus,
        o.created_on                  AS createdOn,
        o.delivered_on                AS deliveredOn,
        o.cancelled_on                AS cancelledOn,
        o.final_amount                AS finalAmount,
        o.total_mrp                   AS totalMrp,

        s.customer_paid_amount        AS customerPaidAmount,
        s.total_expected_settlement   AS totalExpectedSettlement,
        s.total_actual_settlement     AS totalActualSettlement,
        s.amount_pending_settlement   AS amountPendingSettlement,
        s.total_commission            AS totalCommission,
        s.total_logistics_deduction   AS totalLogisticsDeduction,
        s.tcs_amount                  AS tcsAmount,
        s.tds_amount                  AS tdsAmount,
        s.shipment_zone_classification AS shipmentZoneClassification,
        s.article_type                AS articleType,

        CASE
          WHEN o.order_status = 'F'
            THEN 'cancelled'
          WHEN s.order_release_id IS NULL
            THEN 'not_settled'
          WHEN s.amount_pending_settlement > 0
            THEN 'partially_settled'
          WHEN s.total_actual_settlement > s.total_expected_settlement
            THEN 'overpaid'
          ELSE 'settled'
        END                           AS reconStatus,

        ISNULL(s.total_expected_settlement, 0)
          - ISNULL(s.total_actual_settlement, 0)
                                      AS settlementGap

      FROM partner_portal.dbo.myntra_seller_order o WITH (NOLOCK)
      LEFT JOIN partner_portal.dbo.myntra_f_settelment s WITH (NOLOCK)
        ON  o.order_line_id = s.order_line_id

      WHERE 1=1
      ${whereClauses}

      ORDER BY o.created_on DESC

      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      logger.info("getOrderVsSettlement executed", {
        correlationId,
        rows: result.recordset.length,
      });
      return result.recordset as OrderVsSettlementRow[];
    } catch (error) {
      logger.error("getOrderVsSettlement failed", { error, correlationId });
      throw new DatabaseException(
        "Failed to execute order vs settlement reconciliation",
        correlationId,
        error,
      );
    }
  }

  async countOrderVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<number> {
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "o.created_on",
      brandCol: "o.brand",
    });

    const query = `
      SELECT COUNT(1) AS total
      FROM partner_portal.dbo.myntra_seller_order o WITH (NOLOCK)
      LEFT JOIN partner_portal.dbo.myntra_f_settelment s WITH (NOLOCK)
        ON  o.order_line_id = s.order_line_id
      WHERE 1=1
      ${whereClauses}
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      return result.recordset[0]?.total ?? 0;
    } catch (error) {
      throw new DatabaseException(
        "Failed to count order vs settlement rows",
        correlationId,
        error,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // RECON C — WMS Return vs Myntra Return vs Return Settlement
  //
  // libdata.dbo.return_order_report_item_level_wms  (wret)
  //   LEFT JOIN  partner_portal.dbo.myntra_rt        (mrt)
  //     ON  wret.channel_return_id = mrt.return_id
  //   LEFT JOIN  partner_portal.dbo.myntra_r_settelment  (rs)
  //     ON  mrt.return_id = rs.order_line_id
  // ───────────────────────────────────────────────────────────

  async getReturnVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<ReturnVsSettlementRow[]> {
    const { offset, limit } = this.pagination(filters);
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "wret.return_gate_entry_time",
      brandCol: "wret.brand",
      channelCol: "wret.sales_channel",
      warehouseCol: "wret.warehouse_name",
    });

    const query = `
      SELECT
        wret.warehouse_name                   AS wmsWarehouseName,
        wret.channel_order_id                 AS channelOrderId,
        wret.channel_parent_order_id          AS channelParentOrderId,
        wret.return_order_type                AS returnOrderType,
        wret.system_return_id                 AS systemReturnId,
        wret.channel_return_id                AS channelReturnId,
        wret.return_gate_entry_time           AS returnGateEntryTime,
        wret.inward_time                      AS inwardTime,
        wret.qc_reason                        AS qcReason,
        wret.reason_for_return                AS reasonForReturn,
        wret.return_order_item_qc_status      AS returnOrderItemQcStatus,
        wret.return_order_status              AS returnOrderStatus,
        wret.final_resolution                 AS finalResolution,
        wret.client_sku_id_ean                AS clientSkuIdEan,
        wret.brand                            AS brand,
        wret.mrp                              AS mrp,
        wret.forward_order_value              AS forwardOrderValue,
        wret.sales_channel                    AS salesChannel,
        wret.forward_awb_number               AS forwardAwbNumber,

        mrt.return_id                         AS myntraReturnId,
        mrt.return_tracking_number            AS myntraReturnTrackingNumber,
        mrt.forward_tracking_number           AS myntraForwardTrackingNumber,
        mrt.type                              AS myntraReturnType,
        mrt.last_modified                     AS myntraLastModified,

        rs.return_type                        AS returnType,
        rs.total_actual_settlement            AS totalActualSettlement,
        rs.amount_pending_settlement          AS amountPendingSettlement,
        rs.return_id                          AS returnId,
        rs.return_date                        AS returnDate,

        CASE
          WHEN rs.return_type = 'exchange'
            THEN 'exchange'
          WHEN rs.order_line_id IS NOT NULL
               AND mrt.return_id IS NOT NULL
            THEN 'fully_settled'
          WHEN mrt.return_id IS NOT NULL
               AND rs.order_line_id IS NULL
            THEN 'pending_settlement'
          WHEN mrt.return_id IS NULL
            THEN 'not_in_myntra'
          ELSE 'pending_settlement'
        END                                   AS reconStatus

      FROM libdata.dbo.return_order_report_item_level_wms wret WITH (NOLOCK)
      LEFT JOIN partner_portal.dbo.myntra_rt mrt WITH (NOLOCK)
        ON  wret.channel_return_id = mrt.return_id

      LEFT JOIN partner_portal.dbo.myntra_r_settelment rs WITH (NOLOCK)
        ON  mrt.return_id = rs.order_line_id

      WHERE 1=1
      ${whereClauses}

      ORDER BY wret.return_gate_entry_time DESC

      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      logger.info("getReturnVsSettlement executed", {
        correlationId,
        rows: result.recordset.length,
      });
      return result.recordset as ReturnVsSettlementRow[];
    } catch (error) {
      logger.error("getReturnVsSettlement failed", { error, correlationId });
      throw new DatabaseException(
        "Failed to execute return vs settlement reconciliation",
        correlationId,
        error,
      );
    }
  }

  async countReturnVsSettlement(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<number> {
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "wret.return_gate_entry_time",
      brandCol: "wret.brand",
      channelCol: "wret.sales_channel",
      warehouseCol: "wret.warehouse_name",
    });

    const query = `
      SELECT COUNT(1) AS total
      FROM libdata.dbo.return_order_report_item_level_wms wret WITH (NOLOCK)
      LEFT JOIN partner_portal.dbo.myntra_rt mrt WITH (NOLOCK)
        ON  wret.channel_return_id = mrt.return_id
      LEFT JOIN partner_portal.dbo.myntra_r_settelment rs WITH (NOLOCK)
        ON  mrt.return_id = rs.order_line_id
      WHERE 1=1
      ${whereClauses}
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      return result.recordset[0]?.total ?? 0;
    } catch (error) {
      throw new DatabaseException(
        "Failed to count return vs settlement rows",
        correlationId,
        error,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // SUMMARY — Aggregated counts across all 3 recon views
  // ───────────────────────────────────────────────────────────

  async getSummary(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<ReconciliationSummary> {
    const [omsAgg, settlementAgg, returnAgg] = await Promise.all([
      this.getOmsSummaryAgg(filters, correlationId),
      this.getSettlementSummaryAgg(filters, correlationId),
      this.getReturnSummaryAgg(filters, correlationId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      filters,
      omsVsDispatch: omsAgg,
      orderVsSettlement: settlementAgg,
      returnVsSettlement: returnAgg,
    };
  }

  private async getOmsSummaryAgg(
    filters: ReconciliationFilters,
    correlationId?: string,
  ) {
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "oms.channel_order_time",
      brandCol: "wms.brand",
      channelCol: "oms.Sales_Channel",
      warehouseCol: "wms.warehouse_name",
    });

    const query = `
      SELECT
        COUNT(1)                                                AS totalOrders,
        SUM(CASE
          WHEN oms.Channel_Order_Status <> 'CANCELLED'
               AND wms.channel_order_id IS NOT NULL
               AND oms.Ordered_Quantity = ISNULL(wms.dispatched_quantity,0)
          THEN 1 ELSE 0 END)                                   AS matched,
        SUM(CASE
          WHEN oms.Channel_Order_Status <> 'CANCELLED'
               AND wms.channel_order_id IS NULL
          THEN 1 ELSE 0 END)                                   AS notDispatched,
        SUM(CASE
          WHEN oms.Channel_Order_Status <> 'CANCELLED'
               AND wms.channel_order_id IS NOT NULL
               AND oms.Ordered_Quantity <> ISNULL(wms.dispatched_quantity,0)
          THEN 1 ELSE 0 END)                                   AS qtyMismatch,
        SUM(CASE
          WHEN oms.Channel_Order_Status = 'CANCELLED'
          THEN 1 ELSE 0 END)                                   AS cancelled
      FROM lib_backup.dbo.b2c_non_split oms WITH (NOLOCK)
      LEFT JOIN partner_data.dbo.b2c_detail wms WITH (NOLOCK)
        ON oms.Channel_Order_ID = wms.channel_order_id
      WHERE 1=1
      ${whereClauses}
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      const row = result.recordset[0];
      return {
        totalOrders: row?.totalOrders ?? 0,
        matched: row?.matched ?? 0,
        notDispatched: row?.notDispatched ?? 0,
        qtyMismatch: row?.qtyMismatch ?? 0,
        cancelled: row?.cancelled ?? 0,
      };
    } catch (error) {
      throw new DatabaseException(
        "Failed to aggregate OMS summary",
        correlationId,
        error,
      );
    }
  }

  private async getSettlementSummaryAgg(
    filters: ReconciliationFilters,
    correlationId?: string,
  ) {
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "o.created_on",
      brandCol: "o.brand",
    });

    const query = `
      SELECT
        COUNT(1)                                               AS totalDeliveredOrders,
        SUM(CASE
          WHEN o.order_status <> 'F'
               AND s.order_release_id IS NOT NULL
               AND ISNULL(s.amount_pending_settlement,0) = 0
               AND s.total_actual_settlement <= s.total_expected_settlement
          THEN 1 ELSE 0 END)                                  AS settled,
        SUM(CASE
          WHEN o.order_status <> 'F'
               AND s.order_release_id IS NOT NULL
               AND ISNULL(s.amount_pending_settlement,0) > 0
          THEN 1 ELSE 0 END)                                  AS partiallySettled,
        SUM(CASE
          WHEN o.order_status <> 'F'
               AND s.order_release_id IS NULL
          THEN 1 ELSE 0 END)                                  AS notSettled,
        SUM(CASE
          WHEN s.total_actual_settlement > s.total_expected_settlement
          THEN 1 ELSE 0 END)                                  AS overpaid,
        ISNULL(SUM(s.amount_pending_settlement), 0)           AS totalPendingAmount
      FROM partner_portal.dbo.myntra_seller_order o WITH (NOLOCK)
      LEFT JOIN partner_portal.dbo.myntra_f_settelment s WITH (NOLOCK)
        ON o.order_line_id = s.order_line_id
      WHERE 1=1
      ${whereClauses}
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      const row = result.recordset[0];
      return {
        totalDeliveredOrders: row?.totalDeliveredOrders ?? 0,
        settled: row?.settled ?? 0,
        partiallySettled: row?.partiallySettled ?? 0,
        notSettled: row?.notSettled ?? 0,
        overpaid: row?.overpaid ?? 0,
        totalPendingAmount: row?.totalPendingAmount ?? 0,
      };
    } catch (error) {
      throw new DatabaseException(
        "Failed to aggregate settlement summary",
        correlationId,
        error,
      );
    }
  }

  private async getReturnSummaryAgg(
    filters: ReconciliationFilters,
    correlationId?: string,
  ) {
    const whereClauses = this.buildDateBrandChannelClauses(filters, {
      dateCol: "wret.return_gate_entry_time",
      brandCol: "wret.brand",
      channelCol: "wret.sales_channel",
      warehouseCol: "wret.warehouse_name",
    });

    const query = `
      SELECT
        COUNT(1)                                               AS totalReturnsReceived,
        SUM(CASE
          WHEN rs.order_line_id IS NOT NULL
               AND mrt.return_id IS NOT NULL
               AND rs.return_type <> 'exchange'
          THEN 1 ELSE 0 END)                                  AS fullySettled,
        SUM(CASE
          WHEN mrt.return_id IS NOT NULL
               AND rs.order_line_id IS NULL
          THEN 1 ELSE 0 END)                                  AS pendingSettlement,
        SUM(CASE
          WHEN mrt.return_id IS NULL
          THEN 1 ELSE 0 END)                                  AS notInMyntra,
        SUM(CASE
          WHEN rs.order_line_id IS NOT NULL
               AND mrt.return_id IS NULL
          THEN 1 ELSE 0 END)                                  AS settlementOnly
      FROM libdata.dbo.return_order_report_item_level_wms wret WITH (NOLOCK)
      LEFT JOIN partner_portal.dbo.myntra_rt mrt WITH (NOLOCK)
        ON wret.channel_return_id = mrt.return_id
      LEFT JOIN partner_portal.dbo.myntra_r_settelment rs WITH (NOLOCK)
        ON mrt.return_id = rs.order_line_id
      WHERE 1=1
      ${whereClauses}
    `;

    try {
      const req = await this.buildRequest(filters);
      const result = await req.query(query);
      const row = result.recordset[0];
      return {
        totalReturnsReceived: row?.totalReturnsReceived ?? 0,
        fullySettled: row?.fullySettled ?? 0,
        pendingSettlement: row?.pendingSettlement ?? 0,
        notInMyntra: row?.notInMyntra ?? 0,
        settlementOnly: row?.settlementOnly ?? 0,
      };
    } catch (error) {
      throw new DatabaseException(
        "Failed to aggregate return summary",
        correlationId,
        error,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // MISMATCHES ONLY — gap rows across all 3 views
  // Used by GET /reconciliation/mismatches
  // ───────────────────────────────────────────────────────────

  async getMismatchedOmsRows(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<OmsVsDispatchRow[]> {
    return this.getOmsVsDispatch({ ...filters }, correlationId).then((rows) =>
      rows.filter(
        (r) =>
          r.reconStatus === "not_dispatched" ||
          r.reconStatus === "qty_mismatch",
      ),
    );
  }

  async getMismatchedSettlementRows(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<OrderVsSettlementRow[]> {
    return this.getOrderVsSettlement({ ...filters }, correlationId).then(
      (rows) =>
        rows.filter(
          (r) =>
            r.reconStatus === "not_settled" ||
            r.reconStatus === "partially_settled",
        ),
    );
  }

  async getMismatchedReturnRows(
    filters: ReconciliationFilters,
    correlationId?: string,
  ): Promise<ReturnVsSettlementRow[]> {
    return this.getReturnVsSettlement({ ...filters }, correlationId).then(
      (rows) =>
        rows.filter(
          (r) =>
            r.reconStatus === "not_in_myntra" ||
            r.reconStatus === "pending_settlement",
        ),
    );
  }
}