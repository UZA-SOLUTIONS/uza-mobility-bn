import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import { imageMulterOptions } from '../../common/uploads/multer.config';
import { multipartPayloadSchema } from '../../common/uploads/swagger-multipart.util';
import { UploadFolder } from '../../common/uploads/upload.constants';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedRequest } from '../../users/users.types';
import { getRequestAuditContext } from '../../common/audit/request-context.util';
import { ChargingStationsService } from './charging-stations.service';
import { CreateChargingPortDto } from './dto/create-charging-port.dto';
import { CreateStationDto } from './dto/create-station.dto';
import { CreateStationPricingDto } from './dto/create-station-pricing.dto';
import { CreateVehicleCompatibilityDto } from './dto/create-vehicle-compatibility.dto';
import { FilterStationsDto } from './dto/filter-stations.dto';
import { UpdateChargingPortDto } from './dto/update-charging-port.dto';
import { UpdateStationDto } from './dto/update-station.dto';

@ApiTags('charging-stations')
@Controller('charging-stations')
export class StationsController {
  constructor(
    private readonly stationsService: ChargingStationsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private requireUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return userId;
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Browse public charging stations' })
  browse(@Query() filters: FilterStationsDto) {
    return this.stationsService.browsePublicStations(filters);
  }

  @Get('nearby')
  @Public()
  @ApiOperation({ summary: 'Nearby charging stations by lat/lng radius' })
  nearby(
    @Query('latitude', ParseFloatPipe) latitude: number,
    @Query('longitude', ParseFloatPipe) longitude: number,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.stationsService.findNearbyPublicStations(
      latitude,
      longitude,
      radiusKm ? Number(radiusKm) : 10,
    );
  }

  @Get('cities')
  @Public()
  @ApiOperation({ summary: 'Cities with active charging stations' })
  cities() {
    return this.stationsService.listCitiesWithActiveStations();
  }

  @Get('stations/my')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:read-own')
  @ApiOperation({ summary: 'My charging stations' })
  myStations(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FilterStationsDto,
  ) {
    return this.stationsService.listMyStations(
      this.requireUserId(request),
      filters,
    );
  }

  @Post('stations')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:create')
  @ApiOperation({ summary: 'Create charging station draft' })
  createStation(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStationDto,
  ) {
    return this.stationsService.createStation(
      this.requireUserId(request),
      dto,
      getRequestAuditContext(request),
    );
  }

  @Patch('stations/:id')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @ApiOperation({ summary: 'Update my station details' })
  updateStation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStationDto,
  ) {
    return this.stationsService.updateStationByOwner(
      this.requireUserId(request),
      id,
      dto,
      getRequestAuditContext(request),
    );
  }

  @Post('stations/:id/submit')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:submit')
  @ApiOperation({ summary: 'Submit station for admin review' })
  submitStation(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.stationsService.submitStationByOwner(
      this.requireUserId(request),
      id,
      getRequestAuditContext(request),
    );
  }

  @Post('stations/:id/ports')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @ApiOperation({ summary: 'Add charging port to my station' })
  addPort(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateChargingPortDto,
  ) {
    return this.stationsService.addPortByOwner(
      this.requireUserId(request),
      id,
      dto,
    );
  }

  @Patch('stations/:id/ports/:portId')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @ApiOperation({ summary: 'Update charging port on my station' })
  updatePort(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('portId') portId: string,
    @Body() dto: UpdateChargingPortDto,
  ) {
    return this.stationsService.updatePortByOwner(
      this.requireUserId(request),
      id,
      portId,
      dto,
    );
  }

  @Delete('stations/:id/ports/:portId')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @ApiOperation({ summary: 'Remove charging port from my station' })
  removePort(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('portId') portId: string,
  ) {
    return this.stationsService.removePortByOwner(
      this.requireUserId(request),
      id,
      portId,
    );
  }

  @Post('stations/:id/pricing')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @ApiOperation({ summary: 'Set station pricing' })
  setPricing(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateStationPricingDto,
  ) {
    return this.stationsService.setPricingByOwner(
      this.requireUserId(request),
      id,
      dto,
    );
  }

  @Post('stations/:id/compatibility')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @ApiOperation({ summary: 'Add station vehicle compatibility tag' })
  addCompatibility(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateVehicleCompatibilityDto,
  ) {
    return this.stationsService.addCompatibilityByOwner(
      this.requireUserId(request),
      id,
      dto,
    );
  }

  @Post('stations/:id/photos')
  @ApiBearerAuth('JWT-access')
  @UseGuards(PermissionsGuard)
  @RequirePermission('stations:update')
  @UseInterceptors(FilesInterceptor('photos', 12, imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: multipartPayloadSchema(
      {
        photos: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      [],
    ),
  })
  @ApiOperation({ summary: 'Upload station photos' })
  async uploadPhotos(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const photoUrls = photos?.length
      ? this.cloudinary.urlsFromAssets(
          await this.cloudinary.uploadImages(photos, UploadFolder.GENERAL),
        )
      : [];
    return this.stationsService.addPhotosByOwner(
      this.requireUserId(request),
      id,
      photoUrls,
    );
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Public station detail by slug' })
  detail(@Param('slug') slug: string) {
    return this.stationsService.findPublicStationBySlug(slug);
  }
}
