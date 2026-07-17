"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getRole, assertAdminRole, assertDistributorScope, getLessonsForAdmin, getSeedableDistributorProducts, normalizeLessonMetadataPatch, resolveAdminRole } = require("./admin-utils");
const { normalizeText, normalizeEmail } = require("../dashboard-utils");
const { assertAuthenticated, assertRequiredValue } = require("vibe-functions-core/access-utils-core");
const { findLessonByDocumentId, normalizePriceBookDoc, listDistributorPriceBooks } = require("./distributor-pricing");

const db = admin.firestore();

const upsertLessonPricing = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(resolveAdminRole(userData, request.auth?.token?.email || ""));

    const { courseId, pricing } = data || {};
    assertRequiredValue(courseId, "missing-course-id");
    assertRequiredValue(pricing && typeof pricing === "object", "missing-pricing");

    const cleanProductId = String(courseId).trim();
    let targetDoc = null;
    const docSnap = await db.collection("metadata_lessons").doc(cleanProductId).get();
    if (docSnap.exists) {
        targetDoc = docSnap;
    } else {
        const lessonsSnap = await db.collection("metadata_lessons")
            .where("courseId", "==", cleanProductId)
            .limit(1)
            .get();
        if (lessonsSnap.empty) {
            throw new HttpsError("not-found", `lesson-not-found: ${cleanProductId}`);
        }
        targetDoc = lessonsSnap.docs[0];
    }

    const normalizePriceEntry = (entry, fallbackCurrency) => {
        const rawAmount = Number(entry?.amount ?? entry?.price ?? entry?.value ?? 0);
        const amount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;
        const rawCurrency = normalizeText(entry?.currency || entry?.currencyCode || fallbackCurrency || "");
        const currency = rawCurrency ? rawCurrency.toUpperCase() : fallbackCurrency;
        return { amount, currency };
    };

    const tw = normalizePriceEntry(pricing.tw, "TWD");
    const en = normalizePriceEntry(pricing.en, "USD");
    const buildPriceBookId = (distributorId, docId) => `${distributorId}_${docId}`.toLowerCase().replace(/[^a-z0-9_-]/gi, "-");
    const twPriceBookId = buildPriceBookId("default-twd", cleanProductId);
    const enPriceBookId = buildPriceBookId("default-usd", cleanProductId);
    const twRef = db.collection("dealer_price_books").doc(twPriceBookId);
    const enRef = db.collection("dealer_price_books").doc(enPriceBookId);
    const [twSnap, enSnap] = await Promise.all([twRef.get(), enRef.get()]);
    const docId = targetDoc.id;
    const twCreatedAt = twSnap.exists && twSnap.data()?.createdAt ? twSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp();
    const enCreatedAt = enSnap.exists && enSnap.data()?.createdAt ? enSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp();

    await Promise.all([
        twRef.set({
            docId,
            sourceDocId: docId,
            distributorId: "default-twd",
            currency: "TWD",
            salePrice: tw.amount,
            isActive: true,
            version: "v1",
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: twCreatedAt
        }, { merge: true }),
        enRef.set({
            docId,
            sourceDocId: docId,
            distributorId: "default-usd",
            currency: "USD",
            salePrice: en.amount,
            isActive: true,
            version: "v1",
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: enCreatedAt
        }, { merge: true })
    ]);

    logger.info(`[upsertLessonPricing] Updated default price books for docId=${cleanProductId} by uid=${auth.uid}`);
    return {
        success: true,
        courseId: cleanProductId,
        pricing: { tw, en }
    };
});

async function enrichPriceBooksWithHiddenStatus(db, items) {
    const lessonsSnap = await db.collection("metadata_lessons").get();
    const allLessons = [];
    lessonsSnap.forEach((ds) => {
        const d = ds.data() || {};
        allLessons.push({ ...d, docId: d.docId || ds.id, id: ds.id });
    });
    return items.map((item) => {
        const docId = item.docId || item.sourceDocId || "";
        const lesson = findLessonByDocumentId(allLessons, docId);
        return { ...item, hiddenFromCatalog: lesson ? lesson.hiddenFromCatalog === true : false };
    });
}

async function getDistributorPriceBooksCore(auth, data) {
    assertAuthenticated(auth);

    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const requesterRole = await getRole(auth.uid, auth.token?.email || "");
    const distributorId = normalizeText(data?.distributorId || userData.distributorId || userData.commercial?.distributorId || "");

    if (requesterRole !== "admin") {
        assertRequiredValue(distributorId, "missing-distributor-id");
        assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員查看價格表", auth.token?.email || "");
        const items = await listDistributorPriceBooks(db, distributorId);
        const enriched = await enrichPriceBooksWithHiddenStatus(db, items);
        return { success: true, distributorId, items: enriched };
    }

    if (distributorId) {
        assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員查看價格表", auth.token?.email || "");
        const items = await listDistributorPriceBooks(db, distributorId);
        const enriched = await enrichPriceBooksWithHiddenStatus(db, items);
        return { success: true, distributorId, items: enriched };
    }

    const snap = await db.collection("dealer_price_books").get();
    const items = [];
    snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...normalizePriceBookDoc(docSnap.data() || {}) });
    });
    items.sort((a, b) => {
        const aKey = `${normalizeText(a.distributorId)}::${normalizeText(a.docId || a.sourceDocId)}::${normalizeText(a.id)}`;
        const bKey = `${normalizeText(b.distributorId)}::${normalizeText(b.docId || b.sourceDocId)}::${normalizeText(b.id)}`;
        return aKey.localeCompare(bKey);
    });
    const enriched = await enrichPriceBooksWithHiddenStatus(db, items);
    return { success: true, distributorId: "", items: enriched };
}

const getDistributorPriceBooks = onCall(async (request) => getDistributorPriceBooksCore(request.auth, request.data));

async function upsertDistributorPriceBookCore(auth, data) {
    assertAuthenticated(auth);

    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    const docId = normalizeText(payload.docId || payload.courseId || payload.itemId || "");
    const currency = normalizeText(payload.currency || "TWD").toUpperCase() || "TWD";

    assertRequiredValue(distributorId, "missing-distributor-id");
    assertRequiredValue(docId, "missing-doc-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員編輯價格表", auth.token?.email || "");

    const salePrice = Number(payload.salePrice);
    const promoPriceRaw = payload.promoPrice;
    const promoPrice = promoPriceRaw == null || promoPriceRaw === "" ? null : Number(promoPriceRaw);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
        throw new HttpsError("invalid-argument", "salePrice must be a non-negative number.");
    }
    if (promoPrice != null && (!Number.isFinite(promoPrice) || promoPrice < 0 || promoPrice > salePrice)) {
        throw new HttpsError("invalid-argument", "promoPrice must be a non-negative number not greater than salePrice.");
    }

    const effectiveFrom = payload.effectiveFrom || null;
    const effectiveTo = payload.effectiveTo || null;
    const promoEffectiveFrom = payload.promoEffectiveFrom || null;
    const promoEffectiveTo = payload.promoEffectiveTo || null;
    if (promoPrice != null && (!promoEffectiveFrom || !promoEffectiveTo)) {
        throw new HttpsError("invalid-argument", "promoEffectiveFrom and promoEffectiveTo are required when promoPrice is set.");
    }
    if (promoPrice != null && promoEffectiveFrom && promoEffectiveTo) {
        const promoFromMs = new Date(promoEffectiveFrom).getTime();
        const promoToMs = new Date(promoEffectiveTo).getTime();
        if (!Number.isFinite(promoFromMs) || !Number.isFinite(promoToMs) || promoToMs < promoFromMs) {
            throw new HttpsError("invalid-argument", "promoEffectiveTo must be greater than or equal to promoEffectiveFrom.");
        }
    }
    const isActive = payload.isActive !== false;
    const priceBookId = normalizeText(payload.priceBookId || payload.id || `${distributorId}_${docId}`.toLowerCase().replace(/[^a-z0-9_-]/gi, "-"));
    const existingDoc = await db.collection("dealer_price_books").doc(priceBookId).get();
    const createdAt = existingDoc.exists && existingDoc.data()?.createdAt
        ? existingDoc.data().createdAt
        : admin.firestore.FieldValue.serverTimestamp();

    await db.collection("dealer_price_books").doc(priceBookId).set({
        distributorId,
        docId,
        sourceDocId: docId,
        currency,
        salePrice,
        ...(promoPrice != null ? { promoPrice } : {}),
        ...(effectiveFrom ? { effectiveFrom } : {}),
        ...(effectiveTo ? { effectiveTo } : {}),
        ...(promoPrice != null && promoEffectiveFrom ? { promoEffectiveFrom } : {}),
        ...(promoPrice != null && promoEffectiveTo ? { promoEffectiveTo } : {}),
        isActive,
        version: normalizeText(payload.version || payload.pricingVersion || "v1") || "v1",
        updatedBy: auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt
    }, { merge: true });

    return { success: true, priceBookId, distributorId, docId };
}

const upsertDistributorPriceBook = onCall(async (request) => upsertDistributorPriceBookCore(request.auth, request.data));

const deleteDistributorPriceBook = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    const priceBookId = normalizeText(payload.priceBookId || "");
    const docId = normalizeText(payload.docId || "");

    assertRequiredValue(distributorId, "missing-distributor-id");
    assertRequiredValue(priceBookId || docId, "missing-pricebook-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員刪除價格表", auth.token?.email || "");

    const targetId = priceBookId || `${distributorId}_${docId}`.toLowerCase().replace(/[^a-z0-9_-]/gi, "-");
    await db.collection("dealer_price_books").doc(targetId).delete();

    return { success: true, priceBookId: targetId };
});

const getLessonPriceBooks = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const role = await getRole(auth.uid);
    assertAdminRole(role);

    const dbRef = admin.firestore();
    const docId = normalizeText(data?.docId || data?.courseId || data?.itemId || "");
    const distributorId = normalizeText(data?.distributorId || "");

    const targetKeys = new Set([
        docId,
        docId ? `${docId}.html` : "",
    ].filter(Boolean));

    const snap = await dbRef.collection("dealer_price_books").get();
    const items = [];
    snap.forEach((doc) => {
        const book = { id: doc.id, ...(doc.data() || {}) };
        if (distributorId && normalizeText(book.distributorId) !== distributorId) return;

        const bookKeys = [
            book.id,
            book.priceBookId,
            book.docId,
            book.sourceDocId
        ].map((value) => normalizeText(value)).filter(Boolean);

        const matches = targetKeys.size === 0 || bookKeys.some((value) => targetKeys.has(value));
        if (!matches) return;
        items.push(book);
    });

    items.sort((a, b) => {
        const aKey = `${normalizeText(a.distributorId)}::${normalizeText(a.docId || a.sourceDocId)}::${normalizeText(a.id)}`;
        const bKey = `${normalizeText(b.distributorId)}::${normalizeText(b.docId || b.sourceDocId)}::${normalizeText(b.id)}`;
        return aKey.localeCompare(bKey);
    });

    return {
        success: true,
        docId,
        distributorId,
        items
    };
});

const seedDistributorPriceBooksFromLessons = onCall(async (request) => {
    const { auth, data } = request;
    assertAuthenticated(auth);

    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const distributorId = normalizeText(payload.distributorId || userData.distributorId || userData.commercial?.distributorId || "");
    assertRequiredValue(distributorId, "missing-distributor-id");
    assertDistributorScope(userData, distributorId, "僅限該經銷商或管理員套用商品價格", auth.token?.email || "");

    const distributorDoc = await db.collection("distributors").doc(distributorId).get();
    const distributorData = distributorDoc.exists ? (distributorDoc.data() || {}) : {};
    const distributorCurrency = normalizeText(payload.currency || distributorData.defaultCurrency || userData.defaultCurrency || "TWD").toUpperCase() || "TWD";
    const overwrite = payload.overwrite === true;
    const defaultSalePrice = payload.salePrice != null ? Number(payload.salePrice) : undefined;

    const lessons = await getLessonsForAdmin(distributorId);
    let products = getSeedableDistributorProducts(lessons, distributorCurrency);

    const requestedDocIds = Array.isArray(payload.docIds) ? payload.docIds.map((d) => normalizeText(d)).filter(Boolean) : [];
    if (requestedDocIds.length > 0) {
        products = products.filter((p) => {
            const normalized = normalizeText(p.docId || "");
            return normalized && requestedDocIds.includes(normalized);
        });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of products) {
        const priceBookId = normalizeText(
            payload.priceBookPrefix
                ? `${payload.priceBookPrefix}_${item.docId}`
                : `${distributorId}_${item.docId}`
        ).toLowerCase().replace(/[^a-z0-9_-]/gi, "-");
        const docRef = db.collection("dealer_price_books").doc(priceBookId);
        const existing = await docRef.get();

        if (existing.exists && !overwrite) {
            skipped += 1;
            continue;
        }

        const existingData = existing.exists ? (existing.data() || {}) : {};
        await docRef.set({
            docId: item.docId,
            sourceDocId: item.docId,
            distributorId,
            currency: item.currency || distributorCurrency,
            salePrice: defaultSalePrice ?? item.salePrice,
            ...(existingData.promoPrice != null && !overwrite ? { promoPrice: existingData.promoPrice } : {}),
            ...(existingData.promoEffectiveFrom != null && !overwrite ? { promoEffectiveFrom: existingData.promoEffectiveFrom } : {}),
            ...(existingData.promoEffectiveTo != null && !overwrite ? { promoEffectiveTo: existingData.promoEffectiveTo } : {}),
            isActive: existingData.isActive !== false,
            version: normalizeText(existingData.version || item.pricingVersion || "v1") || "v1",
            sourceDocId: item.docId,
            sourceLessonTitle: item.title,
            sourceIsPhysical: item.isPhysical === true,
            updatedBy: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: existing.exists && existingData.createdAt
                ? existingData.createdAt
                : admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (existing.exists) updated += 1;
        else created += 1;
    }

    return {
        success: true,
        distributorId,
        currency: distributorCurrency,
        totalProducts: products.length,
        created,
        updated,
        skipped,
        requested: requestedDocIds.length > 0 ? requestedDocIds.length : "all"
    };
});

module.exports = {
    upsertLessonPricing,
    getDistributorPriceBooks,
    getDistributorPriceBooksCore,
    upsertDistributorPriceBook,
    upsertDistributorPriceBookCore,
    deleteDistributorPriceBook,
    getLessonPriceBooks,
    seedDistributorPriceBooksFromLessons,
    enrichPriceBooksWithHiddenStatus
};
