import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Clean existing data
    await prisma.productResult.deleteMany();
    await prisma.searchRequest.deleteMany();
    await prisma.user.deleteMany();

    // Create users
    const alice = await prisma.user.create({
        data: {
            email: "alice@example.com",
            name: "Alice Johnson",
        },
    });

    const bob = await prisma.user.create({
        data: {
            email: "bob@example.com",
            name: "Bob Smith",
        },
    });

    // Create search requests
    const jeansRequest = await prisma.searchRequest.create({
        data: {
            title: "Vintage Levi 501 Jeans",
            description:
                "Looking for 90s Levi 501 jeans, size 32x30, medium wash. Prefer minimal distressing.",
            budget: 75.0,
            status: "IN_PROGRESS",
            userId: alice.id,
        },
    });

    const cameraRequest = await prisma.searchRequest.create({
        data: {
            title: "Canon AE-1 Film Camera",
            description:
                "Want a working Canon AE-1 film camera with a 50mm f/1.8 lens. Must be in good mechanical condition.",
            budget: 200.0,
            status: "COMPLETED",
            userId: alice.id,
        },
    });

    const chairRequest = await prisma.searchRequest.create({
        data: {
            title: "Herman Miller Aeron Chair",
            description:
                "Looking for a used Herman Miller Aeron chair, size B, in good condition. Any color.",
            budget: 500.0,
            status: "PENDING",
            userId: bob.id,
        },
    });

    // Add results to the camera request
    await prisma.productResult.createMany({
        data: [
            {
                name: "Canon AE-1 Program w/ 50mm f/1.8",
                price: 175.0,
                url: "https://example.com/camera-1",
                imageUrl: "https://placehold.co/400x300?text=Canon+AE-1",
                source: "eBay",
                matchNotes:
                    "Excellent condition, recently CLA'd. Comes with original strap and lens cap.",
                searchRequestId: cameraRequest.id,
            },
            {
                name: "Canon AE-1 Body + FD 50mm 1.8",
                price: 145.0,
                url: "https://example.com/camera-2",
                imageUrl: "https://placehold.co/400x300?text=Canon+AE-1+Bundle",
                source: "Facebook Marketplace",
                matchNotes:
                    "Working condition, light meter accurate. Minor cosmetic wear on body.",
                searchRequestId: cameraRequest.id,
            },
        ],
    });

    // Add results to the jeans request
    await prisma.productResult.createMany({
        data: [
            {
                name: "Levi's 501 Original Fit - Medium Stonewash",
                price: 45.0,
                url: "https://example.com/jeans-1",
                imageUrl: "https://placehold.co/400x300?text=Levis+501",
                source: "ThredUp",
                matchNotes:
                    "Vintage 1994 pair, 32x30, medium wash. Minimal wear, no holes.",
                searchRequestId: jeansRequest.id,
            },
            {
                name: "90s Levi 501 Button Fly Jeans",
                price: 62.0,
                url: "https://example.com/jeans-2",
                imageUrl: "https://placehold.co/400x300?text=Vintage+501",
                source: "Depop",
                matchNotes:
                    "True vintage 501s, measured 32x30. Great fade pattern, zero distressing.",
                searchRequestId: jeansRequest.id,
            },
            {
                name: "Levi's 501 XX Vintage - Med Wash",
                price: 55.0,
                url: "https://example.com/jeans-3",
                source: "eBay",
                matchNotes:
                    "Made in USA, tagged 33x30 but measures 32x30. Classic medium indigo wash.",
                searchRequestId: jeansRequest.id,
            },
        ],
    });

    console.log("✅ Seed data created:");
    console.log(`   - ${2} users`);
    console.log(`   - ${3} search requests`);
    console.log(`   - ${5} product results`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
