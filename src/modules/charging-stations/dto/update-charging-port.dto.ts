import { PartialType } from '@nestjs/swagger';
import { CreateChargingPortDto } from './create-charging-port.dto';

export class UpdateChargingPortDto extends PartialType(CreateChargingPortDto) {}
