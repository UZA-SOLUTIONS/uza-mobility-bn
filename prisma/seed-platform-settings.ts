import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_SETTING_KEYS,
} from '../src/modules/platform-settings/platform-settings.constants';

export async function seedPlatformSettings(prisma: PrismaClient) {
  await Promise.all(
    (Object.keys(DEFAULT_PLATFORM_SETTINGS) as Array<
      keyof typeof DEFAULT_PLATFORM_SETTINGS
    >).map((key) =>
      prisma.platformSetting.upsert({
        where: { key: PLATFORM_SETTING_KEYS[key] },
        update: {},
        create: {
          key: PLATFORM_SETTING_KEYS[key],
          value: DEFAULT_PLATFORM_SETTINGS[key],
        },
      }),
    ),
  );
}
