import { app } from "./firebase-init.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import { connectFirebaseEmulators } from "./firebase-local.js?v=3";

const auth = getAuth(app);
const functions = getFunctions(app, 'asia-east1');
connectFirebaseEmulators({ auth, functions });

const state = {
    user: null,
    portal: null,
    distributorId: '',
    selectedDistributorId: '',
    accessibleDistributors: [],
    priceBooks: [],
    orders: [],
    tutors: [],
    settlement: null,
    priceBookFilter: 'all',
    priceBookSearch: '',
    selectedPriceBookId: ''
};

function el(id) {
    return document.getElementById(id);
}

function escapeHtml(value = '') {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toast(message, tone = 'info') {
    const hostId = 'portal-toast-host';
    let host = document.getElementById(hostId);
    if (!host) {
        host = document.createElement('div');
        host.id = hostId;
        host.className = 'fixed top-4 right-4 z-[100000] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(host);
    }

    const toneClass = tone === 'success'
        ? 'bg-emerald-600 border-emerald-700'
        : tone === 'error'
            ? 'bg-rose-600 border-rose-700'
            : 'bg-slate-900 border-slate-800';

    const node = document.createElement('div');
    node.className = `pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold text-white shadow-xl ${toneClass}`;
    node.textContent = message;
    host.appendChild(node);
    window.setTimeout(() => node.remove(), 2400);
}

function formatDateTime(value) {
    if (!value) return '—';
    try {
        if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
        if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toLocaleString();
        if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toLocaleString();
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    } catch (_) {
        return String(value || '—');
    }
}

function getFormValue(id) {
    return el(id)?.value?.trim?.() || '';
}

function setFormValue(id, value) {
    const input = el(id);
    if (!input) return;
    if (input.type === 'checkbox') {
        input.checked = !!value;
    } else {
        input.value = value ?? '';
    }
}

function setText(id, value) {
    const node = el(id);
    if (!node) return;
    node.textContent = value == null ? '—' : String(value);
}

function parseDateMillis(value) {
    if (!value) return 0;
    try {
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (typeof value.seconds === 'number') return value.seconds * 1000;
        if (value instanceof Date) return value.getTime();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    } catch (_) {
        return 0;
    }
}

function isPromoActive(book = {}) {
    if (book.promoPrice == null || book.promoPrice === '') return false;
    const now = Date.now();
    const from = parseDateMillis(book.promoEffectiveFrom);
    const to = parseDateMillis(book.promoEffectiveTo);
    if (from && now < from) return false;
    if (to && now > to) return false;
    return true;
}

function setLoading(loading) {
    el('portal-loading')?.classList.toggle('hidden', !loading);
}

function showDenied(message) {
    setLoading(false);
    el('portal-app')?.classList.add('hidden');
    const denied = el('portal-denied');
    if (denied) {
        denied.classList.remove('hidden');
        const msg = el('portal-denied-message');
        if (msg && message) msg.textContent = message;
    }
}

function showApp() {
    setLoading(false);
    el('portal-denied')?.classList.add('hidden');
    el('portal-app')?.classList.remove('hidden');
}

function formatMoney(value = 0, currency = 'TWD') {
    const amount = Number(value || 0);
    return `${amount.toLocaleString()} ${currency || 'TWD'}`;
}

function distributorLabel(distributor = {}) {
    const name = String(distributor?.name || distributor?.id || '').trim();
    const currency = String(distributor?.defaultCurrency || '').trim();
    const regions = Array.isArray(distributor?.regions) && distributor.regions.length
        ? distributor.regions.join(', ')
        : '';
    const parts = [];
    if (currency) parts.push(currency);
    if (regions) parts.push(regions);
    return parts.length ? `${name} · ${parts.join(' · ')}` : name;
}

function updateSummary(items = []) {
    const activeCount = items.filter((item) => item && item.isActive !== false).length;
    const promoCount = items.filter((item) => item && item.isActive !== false && isPromoActive(item)).length;
    const lastUpdated = state.priceBooks[0]?.updatedAt || state.priceBooks[0]?.createdAt || null;
    setText('portal-pricebook-count-stat', String(items.length));
    setText('portal-pricebook-active-count-stat', String(activeCount));
    setText('portal-pricebook-promo-count-stat', String(promoCount));
    setText('portal-last-updated', items.length ? formatDateTime(lastUpdated) : '—');
    setText('portal-current-version', items[0]?.version || '—');
    const seedableCount = Math.max(0, (state.portal?.seedableProductCount || 0) - state.priceBooks.length);
    setText('portal-seedable-product-count', String(seedableCount));
    setText('portal-seedable-product-count-stat', String(seedableCount));
}

function getFilteredPriceBooks(items = []) {
    const filter = String(state.priceBookFilter || 'all');
    const search = String(state.priceBookSearch || '').trim().toLowerCase();

    return (Array.isArray(items) ? items : []).filter((book) => {
        if (filter === 'active' && book.isActive === false) return false;
        if (filter === 'promo' && !isPromoActive(book)) return false;
        if (search) {
            const haystack = [
                book.id,
                book.priceBookId,
                book.docId,
                book.distributorId,
                book.version,
                book.currency,
                book.salePrice,
                book.promoPrice
            ].map((value) => String(value ?? '')).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

function updatePortalOverview() {
    const orderSummary = state.portal?.orderSummary || {};
    const tutorSummary = state.portal?.tutorSummary || {};
    const settlementSummary = state.portal?.settlement?.summary || {};
    const settlementPeriod = state.portal?.settlement?.period || settlementSummary.period || '—';

    // Calculate physical-only order statistics
    const physicalOrders = state.orders.filter(o => o.hasPhysical);
    const pendingPhysicalCount = physicalOrders.filter(o => {
        const status = String(o.fulfillmentStatus || 'PENDING').toUpperCase();
        return status === 'PENDING';
    }).length;

    setText('portal-order-count', String(physicalOrders.length));
    setText('portal-pending-shipment-count', String(pendingPhysicalCount));
    setText('portal-tutor-count', String(tutorSummary.tutorCount || 0));
    setText('portal-settlement-paid-total', formatMoney(settlementSummary.paidTotal || 0));
    setText('portal-settlement-paid-total-detail', formatMoney(settlementSummary.paidTotal || 0));
    setText('portal-settlement-planned-total', formatMoney(settlementSummary.plannedTotal || 0));
    setText('portal-settlement-blocked-total', formatMoney(settlementSummary.blockedTotal || 0));
    setText('portal-settlement-row-count', String(settlementSummary.rowCount || 0));
    setText('portal-settlement-period', settlementPeriod || '—');

    const orderSummaryEl = el('portal-order-summary');
    if (orderSummaryEl) {
        orderSummaryEl.textContent = physicalOrders.length
            ? window.t('dp_order_summary', '共 {count} 筆實體商品訂單，待出貨 {pendingCount} 筆。').replace('{count}', String(physicalOrders.length)).replace('{pendingCount}', String(pendingPhysicalCount))
            : window.t('dp_order_summary_empty', '目前沒有可顯示的實體商品訂單。');
    }

    const tutorSummaryEl = el('portal-tutor-summary');
    if (tutorSummaryEl) {
        tutorSummaryEl.textContent = tutorSummary.tutorCount
            ? window.t('dp_tutor_summary', '共 {count} 位 Tutor，授權單元 {unitCount} 個。').replace('{count}', String(tutorSummary.tutorCount)).replace('{unitCount}', String(tutorSummary.authorizedUnitCount || 0))
            : window.t('dp_tutor_summary_empty', '目前沒有可顯示的 Tutor 綁定資料。');
    }
}

function renderDistributorTabs(distributors = []) {
    const tabs = el('portal-distributor-tabs');
    const summary = el('portal-distributor-tabs-summary');
    if (!tabs || !summary) return;

    const items = Array.isArray(distributors) ? distributors : [];
    if (!items.length) {
        tabs.innerHTML = `<div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">${window.t('dp_no_distributors_tab', '尚無可切換的經銷商。')}</div>`;
        summary.textContent = window.t('dp_no_distributors_summary', '目前沒有可顯示的經銷商。');
        return;
    }

    summary.textContent = items.length > 1
        ? window.t('dp_distributor_count_multi', '共 {count} 個經銷商，可點擊切換不同價格表。').replace('{count}', String(items.length))
        : window.t('dp_distributor_count_single', '目前只有 {name}。').replace('{name}', distributorLabel(items[0]));

    tabs.innerHTML = items.map((distributor) => {
        const id = String(distributor.id || '').trim();
        const active = id && id === String(state.selectedDistributorId || state.distributorId || '').trim();
        return `
            <button
                onclick="window.distributorPortalSelectDistributor('${escapeHtml(id)}')"
                class="rounded-full border px-4 py-2 text-xs font-bold transition ${active ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
                title="${escapeHtml(distributorLabel(distributor))}"
            >
                ${escapeHtml(distributor.name || distributor.id || '—')}
            </button>
        `;
    }).join('');
}

function renderPriceBooks(items = []) {
    const filteredItems = getFilteredPriceBooks(items);
    const search = String(state.priceBookSearch || '').trim().toLowerCase();
    const searchFiltered = !search ? items : (Array.isArray(items) ? items : []).filter((book) => {
        const haystack = [book.id, book.priceBookId, book.docId, book.distributorId, book.version, book.currency, book.salePrice, book.promoPrice]
            .map((value) => String(value ?? '')).join(' ').toLowerCase();
        return haystack.includes(search);
    });
    updateSummary(searchFiltered);
    updatePriceBookFilterButtons();
    const tbody = el('portal-pricebook-table-body');
    if (!tbody) return;

    if (!filteredItems.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-slate-400 italic">${window.t('dp_empty_pricebook_filtered', '尚未載入或沒有符合條件的價格表')}</td></tr>`;
        const priceBooksSummary = el('portal-pricebook-tabs-summary');
        if (priceBooksSummary) priceBooksSummary.textContent = window.t('dp_no_pricebooks_summary', '目前沒有可顯示的價格表。');
        const title = el('portal-pricebook-tabs-title');
        if (title) title.textContent = window.t('dp_no_pricebook_selected_title', '尚未選擇價格表');
        return;
    }

    const selectedId = String(state.selectedPriceBookId || '').trim();
    const selected = filteredItems.find((book) => String(book.id || book.priceBookId || '').trim() === selectedId) || filteredItems[0];
    state.selectedPriceBookId = String(selected?.id || selected?.priceBookId || '').trim();

    tbody.innerHTML = filteredItems.map((book) => {
        const id = String(book.id || book.priceBookId || '').trim();
        const isActiveRow = id === state.selectedPriceBookId;
        const activeBadge = book.isActive !== false
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200';
        const priceText = `${Number(book.salePrice || 0).toLocaleString()} ${escapeHtml(book.currency || 'TWD')}`;
        const promoText = book.promoPrice != null && book.promoPrice !== ''
            ? `${Number(book.promoPrice || 0).toLocaleString()} ${escapeHtml(book.currency || 'TWD')}`
            : '—';
        const displayText = isPromoActive(book) && book.promoPrice != null && book.promoPrice !== ''
            ? `${Number(book.promoPrice || 0).toLocaleString()} ${escapeHtml(book.currency || 'TWD')}${window.t('dp_promo_suffix', '（促銷）')}`
            : priceText;
        const promoBadge = isPromoActive(book)
            ? `<span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">${window.t('dp_badge_promo_active', '促銷中')}</span>`
            : (book.promoPrice != null && book.promoPrice !== ''
                ? `<span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">${window.t('dp_badge_promo_inactive', '未生效')}</span>`
                : `<span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">${window.t('dp_badge_no_promo', '無促銷')}</span>`);
        return `
            <tr
                class="cursor-pointer transition ${isActiveRow ? 'bg-slate-50/80' : 'hover:bg-slate-50/80'}"
                onclick="window.distributorPortalOpenPriceBookModal('${escapeHtml(id)}')"
            >
                <td class="px-4 py-4 align-top">
                    <div class="font-bold text-slate-900">${escapeHtml(book.docId || '—')}${state.lessonHiddenMap[book.docId || ''] ? `<span class="ml-2 inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">${window.t('dp_badge_hidden', '隱藏中')}</span>` : ''}</div>
                    <div class="mt-1 text-[11px] text-slate-400">${window.t('dp_label_updated', '更新：')}${escapeHtml(formatDateTime(book.updatedAt))}</div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="font-semibold text-slate-900">${escapeHtml(priceText)}</div>
                    <div class="mt-1 text-[11px] text-slate-500">${window.t('dp_label_promo_price_prefix', '活動價：')}${escapeHtml(promoText)}</div>
                    <div class="mt-1 flex items-center gap-2">${promoBadge}</div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="text-sm font-bold text-slate-900">${escapeHtml(book.version || 'v1')}</div>
                    <span class="mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${activeBadge}">
                        ${book.isActive !== false ? window.t('dp_badge_active', '啟用中') : window.t('dp_badge_inactive', '停用')}
                    </span>
                </td>
                <td class="px-4 py-4 align-top text-sm text-slate-600">
                    <div>${window.t('dp_label_main_price_prefix', '主價格：')}${escapeHtml(formatDateTime(book.effectiveFrom))}</div>
                    <div class="mt-1 text-[11px] text-slate-400">${window.t('dp_label_promo_period_prefix', '促銷：')}${escapeHtml(formatDateTime(book.promoEffectiveFrom))} ~ ${escapeHtml(formatDateTime(book.promoEffectiveTo))}</div>
                </td>
                </td>
            </tr>
        `;
    }).join('');

    const priceBooksSummary = el('portal-pricebook-tabs-summary');
    if (priceBooksSummary) {
        priceBooksSummary.textContent = window.t('dp_summary_showing', '目前顯示 {count} 筆價格表，點擊每一列即可開啟 modal 編輯。').replace('{count}', String(filteredItems.length));
    }
    const title = el('portal-pricebook-tabs-title');
    if (title) title.textContent = selected?.docId || selected?.id || window.t('dp_no_pricebook_selected_title', '尚未選擇價格表');
}

function updatePriceBookFilterButtons() {
    const buttons = Array.from(document.querySelectorAll('[data-pricebook-filter]:not(.filter-card)'));
    buttons.forEach((button) => {
        const filter = String(button.dataset.pricebookFilter || 'all');
        const isActive = filter === String(state.priceBookFilter || 'all');
        button.className = isActive
            ? 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-slate-950 text-white shadow-sm'
            : 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-850';
    });
    document.querySelectorAll('.filter-card').forEach((card) => {
        const filter = String(card.dataset.pricebookFilter || 'all');
        card.classList.toggle('active', filter === String(state.priceBookFilter || 'all'));
    });
}

window.distributorPortalSetPriceBookFilter = function(filter = 'all') {
    state.priceBookFilter = String(filter || 'all');
    updatePriceBookFilterButtons();
    renderPriceBooks(state.priceBooks);
};

window.distributorPortalSearchPriceBooks = function() {
    state.priceBookSearch = el('portal-pricebook-search-input')?.value?.trim?.() || '';
    renderPriceBooks(state.priceBooks);
};

window.distributorPortalResolvePriceDisplay = function(book = {}) {
    const base = `${Number(book.salePrice || 0).toLocaleString()} ${book.currency || 'TWD'}`;
    if (isPromoActive(book) && book.promoPrice != null && book.promoPrice !== '') {
        return `${Number(book.promoPrice || 0).toLocaleString()} ${book.currency || 'TWD'}${window.t('dp_promo_suffix', '（促銷）')}`;
    }
    return base;
};

function renderOrders(items = []) {
    const tbody = el('portal-order-table-body');
    if (!tbody) return;

    // Filter to only display orders that contain physical items
    const physicalOrders = items.filter(order => order.hasPhysical);

    if (!physicalOrders.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 italic">${window.t('dp_empty_orders', '目前無實體商品履約訂單')}</td></tr>`;
        return;
    }

    tbody.innerHTML = physicalOrders.map((order) => {
        const fulfillment = String(order.fulfillmentStatus || 'PENDING').toUpperCase();
        const fulfillmentBadge = fulfillment === 'SHIPPED'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : fulfillment === 'PENDING'
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200';
        const productNames = Array.isArray(order.items) && order.items.length ? order.items.join('、') : '—';
        const hasPhysicalBadge = order.hasPhysical
            ? `<span class="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">${window.t('status_physical', '含實體商品')}</span>`
            : `<span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">${window.t('status_digital_only', '純數位')}</span>`;

        return `
            <tr
                class="cursor-pointer transition hover:bg-slate-50/85"
                onclick="window.distributorPortalOpenFulfillmentModal('${escapeHtml(order.id)}')"
                title="${window.t('dp_title_click_edit', '點擊編輯出貨狀態')}"
            >
                <td class="px-4 py-4 align-top">
                    <div class="font-mono text-xs font-bold text-slate-900 break-all">${escapeHtml(order.orderNumber || order.id || '—')}</div>
                    <div class="mt-1 text-[11px] text-slate-400">${window.t('dp_label_order_prefix', '訂單：')}${escapeHtml(order.id || '—')}</div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="font-semibold text-slate-900">${escapeHtml(formatMoney(order.amount || 0, order.currency || 'TWD'))}</div>
                    <div class="mt-1 text-[11px] text-slate-500 break-words">${escapeHtml(productNames)}</div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="text-sm text-slate-700">${window.t('dp_label_payment_prefix', '付款：')}${escapeHtml(formatDateTime(order.paidAt))}</div>
                    <div class="mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${fulfillmentBadge}">
                        ${escapeHtml(fulfillment)}
                    </div>
                    <div class="mt-2">${hasPhysicalBadge}</div>
                </td>
                <td class="px-4 py-4 align-top text-sm text-slate-600">
                    <div>${window.t('dp_label_shipping_recipient_prefix', '收件人：')}${escapeHtml(order.shippingContact?.name || '—')} / ${escapeHtml(order.shippingContact?.phone || '—')}</div>
                    <div class="mt-1 break-words">${window.t('dp_label_shipping_address_prefix', '地址：')}${escapeHtml(order.shippingAddress || '—')}</div>
                    ${order.logistics?.carrier || order.logistics?.trackingNumber ? `
                        <div class="mt-2 rounded-lg bg-slate-100 p-2 text-xs">
                            <div class="font-bold text-slate-700">${window.t('dp_label_logistics_tracking', '物流追蹤')}</div>
                            <div class="mt-0.5">${escapeHtml(order.logistics.carrier || '—')} / ${escapeHtml(order.logistics.trackingNumber || '—')}</div>
                        </div>
                    ` : ''}
                </td>
                <td class="px-4 py-4 align-top text-sm text-slate-600">
                    <div>${window.t('dp_label_pricebook_ref', 'PriceBook：')}${escapeHtml(order.priceBookId || '—')}</div>
                    <div class="mt-1">${window.t('dp_label_version_ref', 'Version：')}${escapeHtml(order.pricingVersion || '—')}</div>
                    <div class="mt-1 text-[11px] text-slate-400">${window.t('dp_label_logistics_prefix', '物流：')}${escapeHtml(order.needsShipment ? window.t('dp_logistics_pending', '待處理') : window.t('dp_logistics_done', '已完成/不需出貨'))}</div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTutors(items = []) {
    const tbody = el('portal-tutor-table-body');
    if (!tbody) return;

    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-slate-400 italic">${window.t('dp_empty_tutors', '尚未載入 Tutor 綁定資料')}</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((tutor) => {
        const status = String(tutor.status || 'ACTIVE').toUpperCase();
        const statusBadge = status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200';
        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="px-4 py-4 align-top">
                    <div class="font-semibold text-slate-900">${escapeHtml(tutor.name || '—')}</div>
                    <div class="mt-1 text-[11px] text-slate-400">${window.t('dp_label_distributor_ref', 'Distributor：')}${escapeHtml(tutor.distributorId || '—')}</div>
                </td>
                <td class="px-4 py-4 align-top">
                    <div class="font-mono text-xs font-bold text-slate-900 break-all">${escapeHtml(tutor.email || '—')}</div>
                    <div class="mt-1 text-[11px] text-slate-500">${window.t('dp_label_payout_prefix', 'Payout：')}${escapeHtml(tutor.payoutAccount || '—')}</div>
                </td>
                <td class="px-4 py-4 align-top text-sm text-slate-700">
                    <div class="font-bold text-slate-900">${escapeHtml(String(tutor.authorizedUnitCount || 0))}</div>
                    <div class="mt-1 text-[11px] text-slate-500">${window.t('dp_authorized_units_format', '授權單元 / {count} 組設定').replace('{count}', escapeHtml(String(tutor.tutorConfigCount || 0)))}</div>
                </td>
                <td class="px-4 py-4 align-top">
                    <span class="inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadge}">
                        ${escapeHtml(status)}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderSettlement(rows = []) {
    const tbody = el('portal-settlement-table-body');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400 italic">${window.t('dp_empty_settlement', '尚未載入月結報表')}</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((row) => {
        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="px-4 py-4 align-top">
                    <div class="font-semibold text-slate-900">${escapeHtml(row.name || row.email || '—')}</div>
                    <div class="mt-1 text-[11px] text-slate-400">${escapeHtml(row.email || '—')}</div>
                </td>
                <td class="px-4 py-4 align-top font-semibold text-emerald-700">${escapeHtml(formatMoney(row.paidTotal || 0))}</td>
                <td class="px-4 py-4 align-top font-semibold text-slate-900">${escapeHtml(formatMoney(row.plannedTotal || 0))}</td>
                <td class="px-4 py-4 align-top font-semibold text-amber-700">${escapeHtml(formatMoney(row.blockedTotal || 0))}</td>
                <td class="px-4 py-4 align-top text-sm text-slate-600">${escapeHtml(String(row.rowCount || 0))}</td>
            </tr>
        `;
    }).join('');
}

function renderPortalData() {
    updatePortalOverview();
    renderOrders(state.orders);
    renderTutors(state.tutors);
    renderSettlement(state.settlement?.rows || []);
}

function clearForm() {
    setFormValue('portal-pricebook-id', '');
    setFormValue('portal-doc-id', '');
    setFormValue('portal-currency', 'TWD');
    setFormValue('portal-sale-price', '');
    setFormValue('portal-promo-price', '');
    setFormValue('portal-version', 'v1');
    setFormValue('portal-promo-effective-from', '');
    setFormValue('portal-promo-effective-to', '');
    setFormValue('portal-active', true);
    const scopeNote = el('portal-scope-note');
    if (scopeNote) scopeNote.textContent = window.t('dp_form_cleared', '表單已清空。');
    const stateEl = el('portal-form-state');
    if (stateEl) stateEl.textContent = window.t('dp_form_new_pricebook', '準備新增價格表。');
}

// 安全格式化日期時間供 datetime-local 輸入欄位使用，防止 _seconds / seconds JSON 解析錯誤
function formatDateForInput(dateVal) {
    if (!dateVal) return '';
    try {
        let ms = 0;
        if (typeof dateVal.toDate === 'function') {
            ms = dateVal.toDate().getTime();
        } else if (typeof dateVal._seconds === 'number') {
            ms = dateVal._seconds * 1000;
        } else if (typeof dateVal.seconds === 'number') {
            ms = dateVal.seconds * 1000;
        } else {
            const parsed = new Date(dateVal).getTime();
            if (Number.isFinite(parsed)) ms = parsed;
        }
        if (ms > 0) {
            return new Date(ms).toISOString().slice(0, 16);
        }
    } catch (e) {
        console.warn('[DistributorPortal] Failed to parse date:', dateVal, e);
    }
    return '';
}

function populateForm(book = {}) {
    setFormValue('portal-pricebook-id', book.id || '');
    setFormValue('portal-distributor-id-input', book.distributorId || state.distributorId || '');
    setFormValue('portal-doc-id', book.docId || '');
    setFormValue('portal-currency', book.currency || 'TWD');
    setFormValue('portal-sale-price', book.salePrice != null ? book.salePrice : '');
    setFormValue('portal-promo-price', book.promoPrice != null ? book.promoPrice : '');
    setFormValue('portal-version', book.version || 'v1');
    setFormValue('portal-promo-effective-from', formatDateForInput(book.promoEffectiveFrom));
    setFormValue('portal-promo-effective-to', formatDateForInput(book.promoEffectiveTo));
    setFormValue('portal-active', book.isActive !== false);
    const stateEl = el('portal-form-state');
    if (stateEl) stateEl.textContent = window.t('dp_title_edit_pricebook', '編輯中：{name}').replace('{name}', book.id || book.docId || window.t('lp_untitled_course', '未命名課程'));
}

function renderDistributorContext() {
    renderDistributorTabs(state.accessibleDistributors);
}

function showPriceBookModal(open = true) {
    const modal = el('portal-pricebook-modal');
    if (!modal) return;
    modal.classList.toggle('hidden', !open);
    modal.style.display = open ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('modal-open', open);

    if (open) {
        setTimeout(() => {
            const handler = (e) => {
                if (e.key === 'Escape') {
                    showPriceBookModal(false);
                    document.removeEventListener('keydown', handler);
                }
            };
            document.addEventListener('keydown', handler);
        }, 0);
    }
}

async function loadPortalData(distributorId = '') {
    const fn = httpsCallable(functions, 'getDistributorPortalData');
    const payload = distributorId ? { distributorId } : {};
    const res = await fn(payload);
    state.portal = res.data || {};
    state.accessibleDistributors = Array.isArray(state.portal?.accessibleDistributors) ? state.portal.accessibleDistributors : [];
    state.selectedDistributorId = String(state.portal?.selectedDistributorId || state.portal?.myDistributorId || distributorId || '').trim();
    state.distributorId = state.selectedDistributorId || String(state.portal?.myDistributorId || '').trim();
    state.orders = Array.isArray(state.portal?.orders) ? state.portal.orders : [];
    state.tutors = Array.isArray(state.portal?.tutors) ? state.portal.tutors : [];
    state.settlement = state.portal?.settlement || null;
    state.lessonHiddenMap = state.portal?.lessonHiddenMap || {};

    const role = String(state.portal?.role || 'user');
    const scopeNote = el('portal-scope-note');
    if (scopeNote) {
        scopeNote.textContent = state.distributorId
            ? window.t('dp_scope_note_distributor', '目前登入帳號所屬經銷商：{id}').replace('{id}', state.distributorId)
            : window.t('dp_scope_note_no_distributor', '尚未設定經銷商歸屬。管理員可手動切換 distributorId。');
    }

    const distributorInput = el('portal-distributor-id-input');
    if (distributorInput) {
        if (state.distributorId) distributorInput.value = state.distributorId;
        distributorInput.readOnly = role !== 'admin' && !!state.distributorId;
    }

    if (!state.portal?.canManagePricing) {
        showDenied(window.t('alert_distributor_not_assigned', '這個帳號沒有可管理的經銷商歸屬，無法進入經銷商入口。'));
        return;
    }

    renderDistributorContext();
    renderPortalData();
    showApp();
}

async function loadPriceBooks() {
    const role = String(state.portal?.role || '').trim().toLowerCase();
    const distributorId = String(
        state.selectedDistributorId
        || state.distributorId
        || getFormValue('portal-distributor-id-input')
        || (role === 'admin' && Array.isArray(state.accessibleDistributors) ? (state.accessibleDistributors[0]?.id || '') : '')
    ).trim();
    if (!distributorId) {
        state.priceBooks = [];
        renderPriceBooks([]);
        el('portal-summary').textContent = role === 'admin'
            ? window.t('dp_summary_no_distributor_admin', '請先點選上方經銷商 tab。')
            : window.t('dp_summary_no_distributor_user', '請先輸入經銷商 ID。');
        return;
    }

    const distributorName = (state.accessibleDistributors || []).find((item) => String(item.id || '').trim() === distributorId)?.name || distributorId;
    el('portal-summary').textContent = window.t('dp_loading_pricebooks_for', '載入經銷商 {name} 的價格表中...').replace('{name}', distributorName);
    try {
        const fn = httpsCallable(functions, 'getDistributorPriceBooks');
        const res = await fn({ distributorId });
        state.distributorId = distributorId;
        state.selectedDistributorId = distributorId;
        state.priceBooks = Array.isArray(res?.data?.items) ? res.data.items : [];
        renderPriceBooks(state.priceBooks);
        setText('portal-summary', window.t('dp_summary_current_distributor', '目前經銷商：{name}，共 {count} 筆價格表。').replace('{name}', distributorName).replace('{count}', String(state.priceBooks.length)));
    } catch (e) {
        console.error('[DistributorPortal] load failed:', e);
        state.priceBooks = [];
        renderPriceBooks([]);
        setText('portal-summary', window.t('load_failed', '載入失敗：{msg}').replace('{msg}', e.message || 'unknown error'));
        toast(window.t('load_failed', '載入失敗：{msg}').replace('{msg}', e.message || 'unknown error'), 'error');
    }
}

window.distributorPortalSeedProducts = async function() {
    const distributorId = state.selectedDistributorId || state.distributorId || '';
    if (!distributorId) {
        toast(window.t('dp_toast_select_distributor_first', '請先選擇經銷商'), 'warning');
        return;
    }
    const seedableCount = Math.max(0, (state.portal?.seedableProductCount || 0) - (state.priceBooks?.length || 0));
    if (seedableCount === 0) {
        toast(window.t('dp_toast_no_products_to_seed', '沒有可匯入的商品'), 'info');
        return;
    }
    if (!confirm(window.t('dp_confirm_seed_products', '將 {count} 筆商品匯入 {distributor} 的價格表（預設售價 0），是否繼續？').replace('{count}', String(seedableCount)).replace('{distributor}', distributorId))) return;
    try {
        const fn = httpsCallable(functions, 'seedDistributorPriceBooksFromLessons');
        const res = await fn({ distributorId, salePrice: 0 });
        const r = res.data || {};
        toast(window.t('dp_toast_seed_result', '已建立 {created} 筆，更新 {updated} 筆，跳過 {skipped} 筆').replace('{created}', String(r.created || 0)).replace('{updated}', String(r.updated || 0)).replace('{skipped}', String(r.skipped || 0)), 'success');
        await loadPriceBooks();
    } catch (e) {
        console.error('[DistributorPortal] seed failed:', e);
        toast(window.t('dp_toast_seed_failed', '匯入失敗：{msg}').replace('{msg}', e.message || 'unknown error'), 'error');
    }
};

async function loadDistributorContext(distributorId = '') {
    const targetDistributorId = String(distributorId || state.selectedDistributorId || state.distributorId || '').trim();
    if (!targetDistributorId && state.accessibleDistributors.length === 0) {
        return loadPortalData('');
    }
    await loadPortalData(targetDistributorId);
    await loadPriceBooks();
}

async function saveForm() {
    const distributorId = getFormValue('portal-distributor-id-input') || state.selectedDistributorId || state.distributorId;
    const priceBookId = getFormValue('portal-pricebook-id');
    const docId = getFormValue('portal-doc-id');
    const currency = getFormValue('portal-currency') || 'TWD';
    const salePrice = Number(getFormValue('portal-sale-price'));
    const promoRaw = getFormValue('portal-promo-price');
    const promoPrice = promoRaw === '' ? null : Number(promoRaw);
    const version = getFormValue('portal-version') || 'v1';
    const promoEffectiveFrom = getFormValue('portal-promo-effective-from');
    const promoEffectiveTo = getFormValue('portal-promo-effective-to');
    const isActive = !!el('portal-active')?.checked;

    if (!distributorId || !docId) {
        toast(window.t('dp_toast_validation_distributor_doc', '請先輸入經銷商 ID 與 Document ID。'), 'error');
        return;
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
        toast(window.t('alert_price_non_negative', '售價必須是非負數字。'), 'error');
        return;
    }
    if (promoPrice != null && (!Number.isFinite(promoPrice) || promoPrice < 0 || promoPrice > salePrice)) {
        toast(window.t('alert_promo_price_invalid', '活動價必須是非負數字，且不可大於售價。'), 'error');
        return;
    }
    if (promoPrice != null && (!promoEffectiveFrom || !promoEffectiveTo)) {
        toast(window.t('dp_toast_validation_promo_dates', '若有促銷價，請同時填寫促銷開始與促銷結束時間。'), 'error');
        return;
    }
    if (promoPrice != null && promoEffectiveFrom && promoEffectiveTo && new Date(promoEffectiveTo).getTime() < new Date(promoEffectiveFrom).getTime()) {
        toast(window.t('dp_toast_validation_promo_dates_order', '促銷結束時間不可早於促銷開始時間。'), 'error');
        return;
    }

    const btn = document.querySelector('button[onclick="window.distributorPortalSaveForm()"]');
    const originalText = btn?.textContent || '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = window.t('btn_saving', '儲存中...');
    }

    try {
        const fn = httpsCallable(functions, 'upsertDistributorPriceBook');
        const payload = {
            distributorId,
            priceBookId,
            docId,
            currency,
            salePrice,
            ...(promoPrice != null ? { promoPrice } : {}),
            version,
            isActive,
            ...(promoPrice != null && promoEffectiveFrom ? { promoEffectiveFrom: new Date(promoEffectiveFrom).toISOString() } : {}),
            ...(promoPrice != null && promoEffectiveTo ? { promoEffectiveTo: new Date(promoEffectiveTo).toISOString() } : {})
        };
        const res = await fn(payload);
        if (!res?.data?.success) {
            throw new Error(res?.data?.message || window.t('dp_toast_save_failed', '儲存失敗：{msg}').replace('{msg}', ''));
        }
        toast(window.t('dp_toast_save_success', '已儲存經銷商價格表：{doc}').replace('{doc}', docId), 'success');
        await loadPriceBooks();
        state.selectedPriceBookId = res.data.priceBookId || priceBookId || '';
        showPriceBookModal(false);
    } catch (e) {
        console.error('[DistributorPortal] save failed:', e);
        toast(window.t('dp_toast_save_failed', '儲存失敗：{msg}').replace('{msg}', e.message), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

window.distributorPortalDeleteForm = async function () {
    const distributorId = getFormValue('portal-distributor-id-input') || state.selectedDistributorId || state.distributorId;
    const priceBookId = getFormValue('portal-pricebook-id');
    const docId = getFormValue('portal-doc-id');
    if (!priceBookId && !docId) {
        toast(window.t('dp_toast_no_delete_id', '沒有可刪除的價格表 ID。'), 'error');
        return;
    }
    if (!confirm(window.t('dp_confirm_delete_pricebook', '確定刪除價格表{id}？此動作無法復原。').replace('{id}', priceBookId || docId))) return;
    try {
        const fn = httpsCallable(functions, 'deleteDistributorPriceBook');
        await fn({ distributorId, priceBookId, docId });
        toast(window.t('dp_toast_delete_success', '價格表已刪除'), 'success');
        showPriceBookModal(false);
        await loadPriceBooks();
    } catch (e) {
        console.error('[DistributorPortal] delete failed:', e);
        toast(window.t('dp_toast_delete_failed', '刪除失敗：{msg}').replace('{msg}', e.message || 'unknown error'), 'error');
    }
};
window.distributorPortalLoadPriceBooks = loadPriceBooks;
window.distributorPortalSaveForm = saveForm;
window.distributorPortalSelectDistributor = async function (distributorId = '') {
    const target = String(distributorId || '').trim();
    if (!target) return;
    state.selectedDistributorId = target;
    state.distributorId = target;
    const input = el('portal-distributor-id-input');
    if (input) input.value = target;
    await loadDistributorContext(target);
};
window.distributorPortalOpenPriceBookModal = function (priceBookId = '') {
    const normalizedId = String(priceBookId || '').trim();
    const cached = normalizedId
        ? state.priceBooks.find((book) => String(book.id || book.priceBookId || '').trim() === normalizedId) || null
        : null;
    if (cached) {
        state.selectedPriceBookId = normalizedId;
        populateForm(cached);
    } else {
        state.selectedPriceBookId = '';
        clearForm();
    }
    showPriceBookModal(true);
    const input = el('portal-doc-id');
    input?.focus?.();
};
window.distributorPortalClosePriceBookModal = function () {
    showPriceBookModal(false);
};
window.distributorPortalPopulateById = function (priceBookId) {
    const normalizedId = String(priceBookId || '').trim();
    const cached = state.priceBooks.find((book) => String(book.id || book.priceBookId || '').trim() === normalizedId);
    if (!cached) {
        toast(window.t('toast_no_pricebook_found', '找不到這筆價格表，請重新載入後再試。'), 'error');
        return;
    }
    state.selectedPriceBookId = normalizedId;
    populateForm(cached);
    setText('portal-form-state', window.t('status_loaded_pricebook', '已載入：{msg}').replace('{msg}', cached.id || cached.docId || '未命名價格表'));
    showPriceBookModal(true);
    document.getElementById('portal-doc-id')?.focus?.();
};

function showFulfillmentModal(open = true) {
    const modal = el('portal-fulfillment-modal');
    if (!modal) return;
    modal.classList.toggle('hidden', !open);
    modal.style.display = open ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('modal-open', open);
}

window.distributorPortalOpenFulfillmentModal = function (orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) {
        toast(window.t('toast_order_not_found', '找不到該筆訂單資訊。'), 'error');
        return;
    }
    state.selectedOrderId = orderId;
    
    setText('portal-fulfill-order-number', order.orderNumber || order.id || '—');
    const productNames = Array.isArray(order.items) && order.items.length ? order.items.join('、') : '—';
    setText('portal-fulfill-products', productNames);
    
    const shippingName = order.shippingContact?.name || '—';
    const shippingPhone = order.shippingContact?.phone || '—';
    const shippingAddr = order.shippingAddress || '—';
    setText('portal-fulfill-shipping', window.t('dp_fulfillment_shipping', '{name} / {phone}\n地址：{address}').replace('{name}', shippingName).replace('{phone}', shippingPhone).replace('{address}', shippingAddr));

    const status = String(order.fulfillmentStatus || 'PENDING').toUpperCase();
    setFormValue('portal-fulfill-status', status);
    setFormValue('portal-fulfill-carrier', order.logistics?.carrier || '');
    setFormValue('portal-fulfill-tracking-number', order.logistics?.trackingNumber || '');

    showFulfillmentModal(true);
};

window.distributorPortalCloseFulfillmentModal = function () {
    showFulfillmentModal(false);
};

window.distributorPortalSaveFulfillment = async function () {
    const orderId = state.selectedOrderId;
    if (!orderId) {
        toast(window.t('toast_select_order_first', '請選擇要維護的訂單。'), 'error');
        return;
    }

    const fulfillmentStatus = getFormValue('portal-fulfill-status') || 'PENDING';
    const carrier = getFormValue('portal-fulfill-carrier');
    const trackingNumber = getFormValue('portal-fulfill-tracking-number');

    const btn = el('portal-fulfill-save-btn');
    const originalText = btn?.textContent || '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = window.t('status_updating_tutor', '正在更新導師指派...'); // Let's use generic status
    }

    try {
        const fn = httpsCallable(functions, 'updateOrderFulfillmentStatus');
        const res = await fn({
            orderId,
            fulfillmentStatus,
            carrier,
            trackingNumber
        });
        if (!res?.data?.success) {
            throw new Error(res?.data?.message || window.t('toast_update_shipment_failed', '更新出貨狀態失敗'));
        }
        toast(window.t('toast_update_shipment_success', '出貨狀態更新成功！'), 'success');
        showFulfillmentModal(false);
        setLoading(true);
        await loadPortalData(state.selectedDistributorId || state.distributorId);
    } catch (e) {
        console.error('[DistributorPortal] save fulfillment failed:', e);
        toast(window.t('alert_update_failed', '更新失敗：{msg}').replace('{msg}', e.message || 'unknown error'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

onAuthStateChanged(auth, async (user) => {
    state.user = user || null;
    if (!user) {
        showDenied(window.t('alert_login_distributor_first', '請先登入後再使用 Distributor Portal。'));
        return;
    }

    setLoading(true);
    try {
        await loadPortalData();
        if (state.distributorId) await loadPriceBooks();
    } catch (e) {
        console.error('[DistributorPortal] bootstrap failed:', e);
        showDenied(window.t('alert_load_portal_failed', '無法載入經銷商入口：{msg}').replace('{msg}', e.message || 'unknown error'));
    }
});
