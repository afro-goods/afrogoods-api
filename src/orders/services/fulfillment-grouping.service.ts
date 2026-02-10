import { Injectable } from '@nestjs/common';
import { FulfillmentType } from '../enums/fulfillment-type.enum';
import { FulfillmentStatus } from '../enums/fulfillment-status.enum';
import { OrderStatus } from '../enums/order-status.enum';
import { DeliveryTimeUnit } from '../../product/enums/delivery-time-unit.enum';
import { Fulfillment } from '../schemas/fulfillment.schema';
import { OrderItem } from '../schemas/orders-item.schema';

@Injectable()
export class FulfillmentGroupingService {
  /**
   * Determines fulfillment type based on delivery time unit.
   * EXPRESS: minutes or hours (same-day delivery)
   * STANDARD: days or undefined (shipped items)
   */
  getFulfillmentType(
    deliveryTimeUnit: DeliveryTimeUnit | undefined,
  ): FulfillmentType {
    if (
      deliveryTimeUnit === DeliveryTimeUnit.MINUTES ||
      deliveryTimeUnit === DeliveryTimeUnit.HOURS
    ) {
      return FulfillmentType.EXPRESS;
    }
    return FulfillmentType.STANDARD;
  }

  /**
   * Groups order items into fulfillments based on their delivery timelines.
   * Items with minutes/hours delivery go to EXPRESS, days/undefined go to STANDARD.
   */
  groupItemsIntoFulfillments(items: OrderItem[]): Fulfillment[] {
    const expressIndices: number[] = [];
    const standardIndices: number[] = [];

    items.forEach((item, index) => {
      const type = this.getFulfillmentType(item.deliveryTimeUnit);
      if (type === FulfillmentType.EXPRESS) {
        expressIndices.push(index);
      } else {
        standardIndices.push(index);
      }
    });

    const fulfillments: Fulfillment[] = [];

    if (expressIndices.length > 0) {
      fulfillments.push(
        this.createFulfillment(FulfillmentType.EXPRESS, expressIndices),
      );
    }

    if (standardIndices.length > 0) {
      fulfillments.push(
        this.createFulfillment(FulfillmentType.STANDARD, standardIndices),
      );
    }

    return fulfillments;
  }

  /**
   * Creates a new fulfillment with initial status and history.
   */
  private createFulfillment(
    type: FulfillmentType,
    itemIndices: number[],
  ): Fulfillment {
    return {
      type,
      status: FulfillmentStatus.PENDING,
      itemIndices,
      statusHistory: [
        {
          status: FulfillmentStatus.PENDING,
          reason: 'Fulfillment created',
          updatedBy: 'system',
          createdAt: new Date(),
        },
      ],
    };
  }

  /**
   * Computes the overall order status from fulfillment statuses.
   * Rules:
   * - All delivered → DELIVERED
   * - All cancelled → CANCELLED
   * - Any in_transit → SHIPPED
   * - Any processing/ready_for_pickup → PROCESSING
   * - Default → PENDING
   */
  computeOrderStatus(fulfillments: Fulfillment[]): OrderStatus {
    if (fulfillments.length === 0) {
      return OrderStatus.PENDING;
    }

    const statuses = fulfillments.map((f) => f.status);

    // All delivered → order delivered
    if (statuses.every((s) => s === FulfillmentStatus.DELIVERED)) {
      return OrderStatus.DELIVERED;
    }

    // All cancelled → order cancelled
    if (statuses.every((s) => s === FulfillmentStatus.CANCELLED)) {
      return OrderStatus.CANCELLED;
    }

    // Any in transit → order shipped
    if (statuses.some((s) => s === FulfillmentStatus.IN_TRANSIT)) {
      return OrderStatus.SHIPPED;
    }

    // Any ready for pickup or processing → order processing
    if (
      statuses.some(
        (s) =>
          s === FulfillmentStatus.READY_FOR_PICKUP ||
          s === FulfillmentStatus.PROCESSING,
      )
    ) {
      return OrderStatus.PROCESSING;
    }

    // Default to pending
    return OrderStatus.PENDING;
  }

  /**
   * Validates fulfillment status transition.
   * Valid transitions:
   * - pending → processing, cancelled
   * - processing → ready_for_pickup, cancelled
   * - ready_for_pickup → in_transit, cancelled
   * - in_transit → delivered
   * - delivered, cancelled → (terminal states, no transitions)
   */
  isValidStatusTransition(
    from: FulfillmentStatus,
    to: FulfillmentStatus,
  ): boolean {
    const validTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
      [FulfillmentStatus.PENDING]: [
        FulfillmentStatus.PROCESSING,
        FulfillmentStatus.CANCELLED,
      ],
      [FulfillmentStatus.PROCESSING]: [
        FulfillmentStatus.READY_FOR_PICKUP,
        FulfillmentStatus.CANCELLED,
      ],
      [FulfillmentStatus.READY_FOR_PICKUP]: [
        FulfillmentStatus.IN_TRANSIT,
        FulfillmentStatus.CANCELLED,
      ],
      [FulfillmentStatus.IN_TRANSIT]: [FulfillmentStatus.DELIVERED],
      [FulfillmentStatus.DELIVERED]: [],
      [FulfillmentStatus.CANCELLED]: [],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}
