-- AlterTable
ALTER TABLE "DataService" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "level" "AssetLevel" NOT NULL DEFAULT 'internal',
ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'GET',
ADD COLUMN     "path" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DataService_workspaceId_code_key" ON "DataService"("workspaceId", "code");

