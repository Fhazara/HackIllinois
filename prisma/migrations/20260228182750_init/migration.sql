-- CreateEnum
CREATE TYPE "SearchRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budget" DOUBLE PRECISION,
    "status" "SearchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "search_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_results" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "url" TEXT NOT NULL,
    "image_url" TEXT,
    "source" TEXT,
    "match_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_request_id" TEXT NOT NULL,

    CONSTRAINT "product_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "search_requests_user_id_idx" ON "search_requests"("user_id");

-- CreateIndex
CREATE INDEX "search_requests_status_idx" ON "search_requests"("status");

-- CreateIndex
CREATE INDEX "product_results_search_request_id_idx" ON "product_results"("search_request_id");

-- AddForeignKey
ALTER TABLE "search_requests" ADD CONSTRAINT "search_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_results" ADD CONSTRAINT "product_results_search_request_id_fkey" FOREIGN KEY ("search_request_id") REFERENCES "search_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
