import { BadRequestException } from '@nestjs/common';
import type { ConditionLevel, EvSpec } from '@prisma/client';
import type { CreateEvSpecDto } from './dto/create-ev-spec.dto';

function evSpecRecordToDto(row: EvSpec): CreateEvSpecDto {
  return {
    batteryCapacityKwh: row.batteryCapacityKwh ?? undefined,
    batteryHealthPercent: row.batteryHealthPercent ?? undefined,
    batteryHealthReport: row.batteryHealthReport,
    rangeKm: row.rangeKm ?? undefined,
    chargingType: row.chargingType ?? undefined,
    fastChargingSupported: row.fastChargingSupported,
    chargingTimeHours: row.chargingTimeHours ?? undefined,
    motorPowerKw: row.motorPowerKw ?? undefined,
    topSpeedKmh: row.topSpeedKmh ?? undefined,
    payloadCapacityKg: row.payloadCapacityKg ?? undefined,
    grossVehicleWeightKg: row.grossVehicleWeightKg ?? undefined,
    seatingCapacity: row.seatingCapacity ?? undefined,
  };
}

/** Merge partial DTO updates with an existing DB row for validation/upsert. */
export function mergeListingEvSpecInput(
  partial?: CreateEvSpecDto,
  existing?: EvSpec | null,
): CreateEvSpecDto | undefined {
  if (!partial && !existing) {
    return undefined;
  }

  const base = existing ? evSpecRecordToDto(existing) : {};
  return partial ? { ...base, ...partial } : base;
}

export function assertListingEvSpecs(input: {
  condition: ConditionLevel;
  evSpecs?: CreateEvSpecDto;
}): void {
  if (input.evSpecs?.rangeKm == null) {
    throw new BadRequestException('Electric range (km) is required');
  }

  if (
    input.condition !== 'NEW' &&
    input.evSpecs?.batteryHealthPercent == null
  ) {
    throw new BadRequestException(
      'Battery health (%) is required when condition is not New',
    );
  }
}
