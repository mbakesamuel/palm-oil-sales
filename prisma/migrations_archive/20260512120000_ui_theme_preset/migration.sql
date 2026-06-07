-- CreateEnum
CREATE TYPE "UiThemePreset" AS ENUM ('default', 'agro');

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "uiThemePreset" "UiThemePreset" NOT NULL DEFAULT 'default';
