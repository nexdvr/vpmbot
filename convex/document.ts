import { v } from "convex/values";
import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { guessMimeTypeFromExtension, guessMimeTypeFromContents, vEntryId, } from "@convex-dev/rag"
import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { rag } from "./rag";


// Get upload URL for direct file upload
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

// Store file after upload and process it
export const storeFile = action({
    args: {
        adminSecret: v.string(),

        storageId: v.id("_storage"),
        filename: v.string(),
        category: v.union(v.literal("Exams"), v.literal("Admission"), v.literal("about-VPM")),
        text: v.string(),
        validTill: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<{ docsId: string; entryId: string }> => {
        if (args.adminSecret !== process.env.ADMIN_SECRET) {
            throw new Error("Unauthorized");
        }
        const createdAt = Date.now();
        console.log("calling rag.add");
        // Ingest text into RAG
        const { entryId } = await rag.add(ctx, {
            namespace: args.category,
            text: args.text,
            metadata: {
                filename: args.filename,
                storageId: args.storageId,
                ...(args.category && { category: args.category })
            }
        });
        console.log("rag.add completed with entryId =", entryId);

        // Save document reference
        const docsId = await ctx.runMutation(internal.document.saveDocReference, {
            entryId,
            storageId: args.storageId,
            filename: args.filename,
            category: args.category,
            validTill: args.validTill,
            createdAt,
            isActive: true,
        });

        return { docsId, entryId };
    },
});


export const saveDocReference = internalMutation({
    args: {
        entryId: vEntryId,
        storageId: v.id("_storage"),
        filename: v.string(),
        category: v.optional(v.string()),
        isActive: v.boolean(),
        validTill: v.optional(v.number()),
        createdAt: v.number(),
    },
    handler: async (ctx, args) => {
        const docsId = await ctx.db.insert("documents", {
            entryId: args.entryId,
            validTill: args.validTill,
            storageId: args.storageId,
            isActive: args.isActive,
            createdAt: args.createdAt,
            filename: args.filename,
            category: args.category,
        });

        console.log("document inserted in document table where docsId =", docsId);
        return docsId;
    },
});

export const removeDocReference = internalMutation({
    args: {
        docsId: v.id("documents"),
    },
    handler: async (ctx, { docsId }) => {
        const response = await ctx.db.delete(docsId);
        return response;
    },

});


export const getDocById = internalQuery({
    args: {
        docsId: v.id("documents")
    },
    handler: async (ctx, { docsId }) => {
        const doc = await ctx.db.get(docsId);
        if (!doc) {
            throw new Error("Document not found");
        }
        return doc;
    },
})



export const listDocuments = query({
    args: {},
    handler: async (ctx) => {
        const docs = await ctx.db
            .query("documents")
            .withIndex("by_isActive", (q) => q.eq("isActive", true))
            .order("desc")
            .collect();

        const docsWithUrls = await Promise.all(
            docs.map(async (doc) => {
                const downloadUrl = await ctx.storage.getUrl(doc.storageId);
                return {
                    ...doc,
                    downloadUrl,
                };
            })
        );

        return docsWithUrls;
    },
});



export const getDownloadUrl = query({
    args: {
        storageId: v.id("_storage"),
    },
    handler: async (ctx, { storageId }) => {
        return await ctx.storage.getUrl(storageId);
    },
});

export const deleteOldPdf = action({
    args: {
        docsId: v.id("documents"),
        adminSecret: v.string(),
    },
    handler: async (ctx, { docsId, adminSecret }) => {
        if (adminSecret !== process.env.ADMIN_SECRET) {
            throw new Error("Unauthorized");
        }
        const doc = await ctx.runQuery(internal.document.getDocById,
            { docsId });
        console.log("document to be deleted is ", doc);
        const delRag = await rag.delete(ctx, { entryId: doc.entryId })
        const delStorage = await ctx.storage.delete(doc.storageId);
        const rmDbRef = await ctx.runMutation(internal.document.removeDocReference, {
            docsId
        });

        console.log("response of delete rag is,", delRag);
        console.log("response of delete delete storage is,", delStorage)
        console.log("response of delete rmDbRef is,", rmDbRef)


    },
});




// function guessMimeType(filename: string, bytes: ArrayBuffer) {
//     return (
//         guessMimeTypeFromExtension(filename) || guessMimeTypeFromContents(bytes)
//     );
// }