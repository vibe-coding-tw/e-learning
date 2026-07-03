import { app } from "./firebase-init.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { connectFirebaseEmulators } from "./firebase-local.js?v=3";

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-east1');
connectFirebaseEmulators({ auth, db, functions });

if (typeof window.notify !== 'function') {
    window.notify = function (message, variant = 'info') {
        const text = String(message || '').trim();
        const toneMap = {
            success: { bg: 'bg-emerald-600', border: 'border-emerald-700', label: '成功' },
            warning: { bg: 'bg-amber-500', border: 'border-amber-600', label: '提醒' },
            error: { bg: 'bg-rose-600', border: 'border-rose-700', label: '錯誤' },
            info: { bg: 'bg-slate-900', border: 'border-slate-800', label: '資訊' }
        };
        const tone = toneMap[String(variant || 'info').toLowerCase()] || toneMap.info;

        if (!text) return;

        let host = document.getElementById('vibe-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'vibe-toast-host';
            host.className = 'fixed top-4 right-4 z-[10000001] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(host);
        }

        const el = document.createElement('div');
        el.className = `pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold text-white shadow-xl ${tone.bg} ${tone.border}`;
        el.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="mt-0.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">${tone.label}</div>
                <div class="min-w-0 flex-1 leading-6">${escapeHtml(text)}</div>
            </div>
        `;
        host.appendChild(el);

        window.setTimeout(() => {
            el.classList.add('opacity-0', 'translate-y-1');
            el.style.transition = 'opacity 180ms ease, transform 180ms ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(4px)';
            window.setTimeout(() => el.remove(), 220);
        }, 2800);
    };
}

window.vibeShowToast = window.vibeShowToast || window.notify;
window.showToast = window.showToast || window.notify;

window.escapeHtml = window.escapeHtml || function(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeEmail(email) {
    if (!email) return "";
    return String(email).trim().toLowerCase();
}

const isAdminEmail = window.vibeRoleUtils?.isAdminEmail || function (value = "") {
    return String(value || "").trim().toLowerCase() === "rover.k.chen@gmail.com";
};

function parseInvestorLedgerDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object') {
        if (typeof value.seconds === 'number') {
            const nanos = Number(value.nanoseconds || value._nanoseconds || 0);
            return new Date((value.seconds * 1000) + Math.floor(nanos / 1e6));
        }
        if (typeof value._seconds === 'number') {
            const nanos = Number(value._nanoseconds || 0);
            return new Date((value._seconds * 1000) + Math.floor(nanos / 1e6));
        }
    }
    return null;
}

function formatInvestorLedgerDate(value, fallback = '—') {
    const parsed = parseInvestorLedgerDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) {
        if (typeof value === 'string' && value) return value;
        return fallback;
    }
    return parsed.toISOString().slice(0, 10);
}

function getCurrentLedgerPeriod() {
    return new Date().toISOString().slice(0, 7);
}

function triggerDownloadFile({ fileName, content, contentType = 'text/plain;charset=utf-8' } = {}) {
    const safeFileName = String(fileName || 'ledger-export.txt');
    const blob = new Blob([String(content ?? '')], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
        URL.revokeObjectURL(url);
        anchor.remove();
    }, 250);
}

function buildInvestorProfileRow(profile = {}) {
    const id = String(profile.investorId || profile.id || '').trim();
    const safeId = id.replace(/[^a-z0-9_-]/gi, '-');
    const balance = Number(profile.currentBalance || 0);
    const balanceClass = balance > 0 ? 'text-emerald-700' : (balance < 0 ? 'text-rose-700' : 'text-slate-500');
    const balanceLabel = balance > 0 ? '累積應發' : (balance < 0 ? '累積虧損' : '零餘額');
    const shareUnits = Number(profile.shareUnits || 0);
    const equityShares = Number(profile.equityShares || profile.shareUnits || 0);
    const ownershipPct = Number(profile.ownershipPct || 0);
    return `
        <tr class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition">
            <td class="py-4 px-6 align-top">
                <div class="font-black text-slate-900">${escapeHtml(profile.investorName || id || '未命名投資人')}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-1 break-all">${escapeHtml(id)}</div>
            </td>
            <td class="py-4 px-6 align-top">
                <input id="investor-name-${safeId}" type="text" value="${escapeHtml(profile.investorName || '')}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <input id="investor-email-${safeId}" type="email" value="${escapeHtml(profile.investorEmail || '')}" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="investor@example.com">
                <label class="mt-2 block text-[11px] font-bold text-slate-500">身份</label>
                <select id="investor-participant-${safeId}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <option value="founder" ${profile.participantType === 'founder' ? 'selected' : ''}>原始股東 / Founder</option>
                    <option value="investor" ${profile.participantType === 'investor' || !profile.participantType ? 'selected' : ''}>外部投資者</option>
                    <option value="employee" ${profile.participantType === 'employee' ? 'selected' : ''}>員工折抵</option>
                    <option value="consultant" ${profile.participantType === 'consultant' ? 'selected' : ''}>顧問折抵</option>
                    <option value="advisor" ${profile.participantType === 'advisor' ? 'selected' : ''}>顧問 / Advisor</option>
                </select>
            </td>
            <td class="py-4 px-6 align-top">
                <div class="grid grid-cols-1 gap-2">
                    <label class="text-[11px] font-bold text-slate-500">份額單位</label>
                    <input id="investor-share-${safeId}" type="number" min="0" step="1" value="${shareUnits}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    <div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                        <div>已發股數：<span class="font-mono font-bold text-slate-700">${equityShares.toLocaleString()}</span></div>
                        <div class="mt-1">持股比例：<span class="font-mono font-bold text-slate-700">${ownershipPct.toFixed(2)}%</span></div>
                        <div class="mt-1">估值 ID：<span class="font-mono font-bold text-slate-700">${escapeHtml(profile.valuationId || '—')}</span></div>
                    </div>
                    <label class="text-[11px] font-bold text-slate-500 mt-2">股利帳號</label>
                    <input id="investor-payout-${safeId}" type="text" value="${escapeHtml(profile.payoutAccount || '')}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="銀行帳號 / Wallet / 轉帳資訊">
                </div>
            </td>
            <td class="py-4 px-6 align-top">
                <div class="text-sm font-black ${balanceClass}">NT$ ${balance.toLocaleString()}</div>
                <div class="mt-1 text-[11px] text-slate-400">${escapeHtml(balanceLabel)}</div>
                <div class="mt-3 text-[11px] text-slate-500">最近結算年：${profile.lastSettlementYear || '—'}</div>
            </td>
            <td class="py-4 px-6 align-top">
                <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input id="investor-enabled-${safeId}" type="checkbox" ${profile.enabled !== false ? 'checked' : ''} class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                    啟用
                </label>
                <textarea id="investor-notes-${safeId}" rows="2" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="備註">${escapeHtml(profile.notes || '')}</textarea>
            </td>
            <td class="py-4 px-6 align-top text-right">
                <button id="btn-save-investor-${safeId}" onclick="window.saveInvestorProfile('${escapeHtml(id)}')" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95">儲存</button>
            </td>
        </tr>
    `;
}

function buildValuationSnapshotCard(snapshot = {}) {
    const valuationId = String(snapshot.valuationId || '').trim();
    const sharePrice = Number(snapshot.sharePrice || 0);
    const basis = Number(snapshot.shareBasis || 0);
    return `
        <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div class="font-black text-slate-900">${escapeHtml(snapshot.roundName || valuationId || '未命名估值')}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(valuationId || '—')}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold ${snapshot.locked !== false ? 'text-emerald-600' : 'text-amber-600'}">${snapshot.locked !== false ? '鎖定中' : '可編輯'}</div>
                    <div class="text-[11px] text-slate-400">${escapeHtml(snapshot.valuationType || 'pre-money')}</div>
                </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div class="rounded-lg bg-slate-50 px-3 py-2">股本基準：<span class="font-mono font-bold text-slate-700">${basis.toLocaleString()}</span></div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">單價：<span class="font-mono font-bold text-slate-700">${sharePrice.toLocaleString()}</span></div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">前估值：<span class="font-mono font-bold text-slate-700">${Number(snapshot.preMoneyValuation || 0).toLocaleString()}</span></div>
                <div class="rounded-lg bg-slate-50 px-3 py-2">後估值：<span class="font-mono font-bold text-slate-700">${Number(snapshot.postMoneyValuation || 0).toLocaleString()}</span></div>
            </div>
            <div class="mt-3 text-[11px] text-slate-500">
                有效期間：${escapeHtml(formatInvestorLedgerDate(snapshot.effectiveFrom))}
                ~
                ${escapeHtml(formatInvestorLedgerDate(snapshot.effectiveTo))}
            </div>
            ${snapshot.notes ? `<div class="mt-2 text-[11px] text-slate-500 leading-5">${escapeHtml(snapshot.notes)}</div>` : ''}
        </div>
    `;
}

function buildBalanceSheetSnapshotCard(snapshot = {}) {
    const snapshotId = String(snapshot.snapshotId || '').trim();
    const nav = Number(snapshot.netAssetValue || 0);
    const navPerShare = Number(snapshot.navPerIssuedShare || 0);
    const issuedShares = Number(snapshot.issuedShares || 0);
    const totalAssets = Number(snapshot.totalAssets || 0);
    const totalLiabilities = Number(snapshot.totalLiabilities || 0);
    const isAutoManaged = snapshot.autoManaged === true || snapshotId === 'auto-current';
    return `
        <div class="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div class="font-black text-slate-900">${escapeHtml(snapshotId || '未命名財務快照')}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(formatInvestorLedgerDate(snapshot.snapshotDate) || '—')}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold ${isAutoManaged ? 'text-blue-600' : (snapshot.locked !== false ? 'text-violet-600' : 'text-amber-600')}">${isAutoManaged ? '系統自動追蹤' : (snapshot.locked !== false ? '鎖定中' : '可編輯')}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(snapshot.currency || 'TWD')}</div>
                </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">總資產：<span class="font-mono font-bold text-slate-700">${totalAssets.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">總負債：<span class="font-mono font-bold text-slate-700">${totalLiabilities.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">NAV：<span class="font-mono font-bold text-slate-700">${nav.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">每股淨值：<span class="font-mono font-bold text-slate-700">${navPerShare.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">已發股數：<span class="font-mono font-bold text-slate-700">${issuedShares.toLocaleString()}</span></div>
                <div class="rounded-lg bg-white px-3 py-2 border border-violet-100">現金：<span class="font-mono font-bold text-slate-700">${Number(snapshot.cash || 0).toLocaleString()}</span></div>
            </div>
            <div class="mt-3 text-[11px] text-slate-500 leading-5">
                資產負債快照會和估值快照並排保存，作為帳面淨值與每股淨值的依據。若是系統自動追蹤的 current snapshot，收入 / 支出事件會直接推動現金與 NAV。
            </div>
            ${snapshot.notes ? `<div class="mt-2 text-[11px] text-slate-500 leading-5">${escapeHtml(snapshot.notes)}</div>` : ''}
        </div>
    `;
}

function buildEquityIssuanceRow(issuance = {}) {
    return `
        <tr class="border-b border-slate-100 last:border-b-0">
            <td class="py-3 px-4 align-top">
                <div class="font-bold text-slate-900">${escapeHtml(issuance.investorName || issuance.investorId || '—')}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-1">${escapeHtml(issuance.investorId || '')}</div>
            </td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${escapeHtml(issuance.participantType || 'investor')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600 font-mono">${escapeHtml(issuance.valuationId || '—')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(issuance.considerationAmount || 0).toLocaleString()}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(issuance.issuedShares || 0).toLocaleString()}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(issuance.ownershipPct || 0).toFixed(2)}%</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${escapeHtml(issuance.sourceType || 'manual')}</td>
        </tr>
    `;
}

function buildInvestorEquityPositionRow(position = {}) {
    return `
        <tr class="border-b border-slate-100 last:border-b-0">
            <td class="py-3 px-4 align-top">
                <div class="font-bold text-slate-900">${escapeHtml(position.investorName || position.investorId || '—')}</div>
                <div class="text-[11px] text-slate-400 font-mono mt-1">${escapeHtml(position.investorId || '')}</div>
            </td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${escapeHtml(position.participantType || 'investor')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(position.totalIssuedShares || 0).toLocaleString()}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(position.ownershipPct || 0).toFixed(2)}%</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600 font-mono">${escapeHtml(position.valuationId || '—')}</td>
            <td class="py-3 px-4 align-top text-xs text-slate-600">${Number(position.sharePrice || 0).toLocaleString()}</td>
        </tr>
    `;
}

window.buildInvestorPlanHtml = window.buildInvestorPlanHtml || function() {
    const profiles = Array.isArray(window.__loadedInvestorProfiles) ? window.__loadedInvestorProfiles : [];
    const snapshots = Array.isArray(window.__loadedValuationSnapshots) ? window.__loadedValuationSnapshots : [];
    const activeSnapshot = window.__loadedActiveValuationSnapshot || snapshots.find((item) => item && item.locked !== false) || snapshots[0] || null;
    const balanceSheetSnapshots = Array.isArray(window.__loadedBalanceSheetSnapshots) ? window.__loadedBalanceSheetSnapshots : [];
    const activeBalanceSheetSnapshot = window.__loadedActiveBalanceSheetSnapshot || balanceSheetSnapshots.find((item) => item && item.locked !== false) || balanceSheetSnapshots[0] || null;
    const recentIssuances = Array.isArray(window.__loadedRecentIssuances) ? window.__loadedRecentIssuances : [];
    const equityPositions = Array.isArray(window.__loadedInvestorEquityPositions) ? window.__loadedInvestorEquityPositions : [];
    const totalShareUnits = profiles.reduce((sum, p) => sum + Number(p.shareUnits || 0), 0);
    const totalBalance = profiles.reduce((sum, p) => sum + Number(p.currentBalance || 0), 0);
    const totalIssuedShares = equityPositions.reduce((sum, p) => sum + Number(p.totalIssuedShares || 0), 0) || profiles.reduce((sum, p) => sum + Number(p.equityShares || p.shareUnits || 0), 0);
    const activeSnapshotOptions = snapshots.filter(Boolean).map((snapshot) => {
        const selected = activeSnapshot && snapshot.valuationId === activeSnapshot.valuationId ? 'selected' : '';
        return `<option value="${escapeHtml(snapshot.valuationId)}" ${selected}>${escapeHtml(snapshot.roundName || snapshot.valuationId)}</option>`;
    }).join('');
    const activeBalanceSnapshotOptions = balanceSheetSnapshots.filter(Boolean).map((snapshot) => {
        const selected = activeBalanceSheetSnapshot && snapshot.snapshotId === activeBalanceSheetSnapshot.snapshotId ? 'selected' : '';
        return `<option value="${escapeHtml(snapshot.snapshotId)}" ${selected}>${escapeHtml(snapshot.snapshotId || '未命名快照')}</option>`;
    }).join('');
    const latestNav = Number(activeBalanceSheetSnapshot?.netAssetValue || 0);
    const latestNavPerShare = Number(activeBalanceSheetSnapshot?.navPerIssuedShare || 0);
    return `
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div class="text-sm font-black text-slate-900">損益表 / 資產負債表</div>
                            <div class="text-[11px] text-slate-500 mt-1">先從這裡匯出 P&L 與 Balance Sheet，再往下看投資人名單與發股明細。</div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <input id="ledger-report-period" type="month" value="${getCurrentLedgerPeriod()}" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100">
                            <select id="ledger-report-type" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100">
                                <option value="profit_and_loss">損益表 (Profit & Loss)</option>
                                <option value="balance_sheet">資產負債表 (Balance Sheet)</option>
                                <option value="trial_balance">試算表 (Trial Balance)</option>
                            </select>
                            <select id="ledger-report-format" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100">
                                <option value="csv">CSV</option>
                                <option value="json">JSON</option>
                            </select>
                            <button onclick="window.exportLedgerReportFromForm()" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95">匯出報表</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h4 class="text-sm font-black text-slate-900">投資人權益與年度股利</h4>
                    <p class="text-xs text-slate-500 mt-1">每筆收入 / 支出都會依份額轉成 credit，年結時再發放股利並保留最後餘額。</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button onclick="window.loadInvestorProfiles()" class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">重新整理</button>
                    <button onclick="window.settleInvestorYear()" class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">執行年結</button>
                </div>
            </div>

            <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div class="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
                        <label class="lg:col-span-1">
                            <div class="text-[11px] font-bold text-slate-500 mb-1">退款訂單 ID</div>
                            <input id="ledger-refund-order-id" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" placeholder="order-123">
                        </label>
                        <label class="lg:col-span-1">
                            <div class="text-[11px] font-bold text-slate-500 mb-1">退款金額</div>
                            <input id="ledger-refund-amount" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" placeholder="0">
                        </label>
                        <label class="lg:col-span-1">
                            <div class="text-[11px] font-bold text-slate-500 mb-1">退款日期</div>
                            <input id="ledger-refund-date" type="date" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100">
                        </label>
                        <label class="lg:col-span-1">
                            <div class="text-[11px] font-bold text-slate-500 mb-1">原因 / 備註</div>
                            <input id="ledger-refund-reason" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" placeholder="客戶取消 / 退款協議">
                        </label>
                    </div>

                    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div class="text-[11px] text-slate-500 leading-5">退款會寫入 <code class="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-slate-700">order.refunded</code> ledger event，並同步影響總帳與報表快照。</div>
                        <div class="flex gap-2">
                            <button onclick="window.recordOrderRefundEventFromForm()" class="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-95">登記退款 / 沖回</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/60">
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400">投資人數</div>
                    <div class="mt-1 text-2xl font-black text-slate-900" id="business-stat-investor-count">${profiles.length}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-blue-500">份額總和</div>
                    <div class="mt-1 text-2xl font-black text-blue-600" id="business-stat-investor-units">${totalShareUnits.toLocaleString()}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-emerald-500">目前總餘額</div>
                    <div class="mt-1 text-2xl font-black text-emerald-600" id="business-stat-investor-balance">NT$ ${totalBalance.toLocaleString()}</div>
                </div>
                <div class="rounded-xl bg-white border border-slate-200 p-4">
                    <div class="text-[11px] uppercase tracking-widest font-bold text-violet-500">帳面淨值</div>
                    <div class="mt-1 text-2xl font-black text-violet-600">${activeBalanceSheetSnapshot ? `NT$ ${latestNav.toLocaleString()}` : '—'}</div>
                    <div class="mt-1 text-[11px] text-slate-400 font-mono">${activeBalanceSheetSnapshot ? `每股 NT$ ${latestNavPerShare.toLocaleString()} / ${totalIssuedShares.toLocaleString()} 股` : '尚未建立資產負債快照'}</div>
                </div>
            </div>

            <div class="p-6 space-y-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">財務快照 / Balance Sheet</h5>
                                <p class="text-[11px] text-slate-500 mt-1">資產負債快照會計算 NAV，作為估值與每股淨值的參考，但不會覆蓋發股估值。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-violet-600">當前快照</div>
                                <div class="text-xs font-mono text-slate-600">${escapeHtml(activeBalanceSheetSnapshot?.snapshotId || '未設定')}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">快照 ID</div>
                                <input id="balance-snapshot-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="bs-2026-q2">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">快照日期</div>
                                <input id="balance-snapshot-date" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">幣別</div>
                                <input id="balance-currency" type="text" value="TWD" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">已發股數</div>
                                <input id="balance-issued-shares" type="number" min="0" step="1" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="${totalIssuedShares || 10000000}">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">現金</div>
                                <input id="balance-cash" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="500000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">應收帳款</div>
                                <input id="balance-receivable" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="120000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">其他資產</div>
                                <input id="balance-other-assets" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">固定資產</div>
                                <input id="balance-fixed-assets" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">無形資產</div>
                                <input id="balance-intangible-assets" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">預付費用</div>
                                <input id="balance-prepaid-expenses" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">應付帳款</div>
                                <input id="balance-payable" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="80000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">短期借款</div>
                                <input id="balance-short-debt" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">長期借款</div>
                                <input id="balance-long-debt" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">其他負債</div>
                                <input id="balance-other-liabilities" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="0">
                            </label>
                            <label class="md:col-span-2">
                                <div class="text-[11px] font-bold text-slate-500 mb-1">說明</div>
                                <textarea id="balance-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" placeholder="例如：月底財務快照 / 董事會審閱用"></textarea>
                            </label>
                        </div>
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                <input id="balance-locked" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500">
                                鎖定此快照
                            </label>
                            <div class="flex gap-2">
                                <button onclick="window.saveBalanceSheetSnapshot()" class="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700 active:scale-95">儲存財務快照</button>
                                <button onclick="window.syncInvestorManagementDefaults()" class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">套用快照預設</button>
                                <button onclick="window.fillBalanceSheetSampleData()" class="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 active:scale-95">載入範例</button>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-violet-100 bg-white p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">快照摘要</h5>
                                <p class="text-[11px] text-slate-500 mt-1">按時間保存的資產負債快照，可直接拿來比較 NAV 與每股淨值。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-violet-600">NAV</div>
                                <div class="text-xs font-mono text-slate-600">${activeBalanceSheetSnapshot ? `NT$ ${latestNav.toLocaleString()}` : '—'}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <div class="rounded-lg bg-slate-50 px-3 py-2">總資產：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.totalAssets || 0).toLocaleString() : '—'}</span></div>
                            <div class="rounded-lg bg-slate-50 px-3 py-2">總負債：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.totalLiabilities || 0).toLocaleString() : '—'}</span></div>
                            <div class="rounded-lg bg-slate-50 px-3 py-2">已發股數：<span class="font-mono font-bold text-slate-700">${totalIssuedShares.toLocaleString()}</span></div>
                            <div class="rounded-lg bg-slate-50 px-3 py-2">每股淨值：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? latestNavPerShare.toLocaleString() : '—'}</span></div>
                        </div>
                        <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                            <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-2">資產 / Assets</div>
                            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                <div>現金：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.cash || 0).toLocaleString() : '—'}</span></div>
                                <div>應收：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.accountsReceivable || 0).toLocaleString() : '—'}</span></div>
                                <div>其他資產：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.otherAssets || 0).toLocaleString() : '—'}</span></div>
                                <div>固定資產：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.fixedAssets || 0).toLocaleString() : '—'}</span></div>
                            </div>
                        </div>
                        <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                            <div class="text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-2">負債 / Liabilities</div>
                            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                <div>應付：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.accountsPayable || 0).toLocaleString() : '—'}</span></div>
                                <div>短借：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.shortTermDebt || 0).toLocaleString() : '—'}</span></div>
                                <div>長借：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.longTermDebt || 0).toLocaleString() : '—'}</span></div>
                                <div>其他負債：<span class="font-mono font-bold text-slate-700">${activeBalanceSheetSnapshot ? Number(activeBalanceSheetSnapshot.otherLiabilities || 0).toLocaleString() : '—'}</span></div>
                            </div>
                        </div>
                        <div class="rounded-xl border border-slate-200 bg-white p-4">
                            <div class="text-sm font-black text-slate-900 mb-2">資產負債快照清單</div>
                            <select id="balance-sheet-snapshot-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" onchange="window.loadBalanceSheetSnapshotToForm(this.value)">
                                <option value="">選擇一筆快照</option>
                                ${activeBalanceSnapshotOptions}
                            </select>
                            <div class="mt-3 max-h-64 overflow-auto space-y-2">
                                ${balanceSheetSnapshots.length ? balanceSheetSnapshots.map(buildBalanceSheetSnapshotCard).join('') : '<div class="text-sm text-slate-400">尚未有資產負債快照</div>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">估值快照</h5>
                                <p class="text-[11px] text-slate-500 mt-1">發股時只讀取這裡鎖定的估值，不會被之後的估值覆蓋。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-blue-600">當前快照</div>
                                <div class="text-xs font-mono text-slate-600">${escapeHtml(activeSnapshot?.valuationId || '未設定')}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">估值 ID</div>
                                <input id="valuation-snapshot-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="seed-2026-q2">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">輪次名稱</div>
                                <input id="valuation-round-name" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Pre-Seed Round">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">估值類型</div>
                                <select id="valuation-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                    <option value="pre-money">Pre-money</option>
                                    <option value="post-money">Post-money</option>
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">幣別</div>
                                <input id="valuation-currency" type="text" value="TWD" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">前估值</div>
                                <input id="valuation-pre-money" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="10000000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">後估值</div>
                                <input id="valuation-post-money" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="12000000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">股本基準</div>
                                <input id="valuation-share-basis" type="number" min="1" step="1" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="1000000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">每股價格</div>
                                <input id="valuation-share-price" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="12.5">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">生效日</div>
                                <input id="valuation-effective-from" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">失效日</div>
                                <input id="valuation-effective-to" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            </label>
                            <label class="md:col-span-2">
                                <div class="text-[11px] font-bold text-slate-500 mb-1">說明</div>
                                <textarea id="valuation-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：以董事會核准的 pre-money 估值作為本輪發股基準。"></textarea>
                            </label>
                        </div>
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                <input id="valuation-locked" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                                鎖定此估值
                            </label>
                            <div class="flex gap-2">
                                <button onclick="window.saveValuationSnapshot()" class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 active:scale-95">儲存估值</button>
                                <button onclick="window.syncInvestorManagementDefaults()" class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">套用當前估值</button>
                                <button onclick="window.fillInvestorLedgerSampleData()" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95">載入範例</button>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${activeSnapshot ? buildValuationSnapshotCard(activeSnapshot) : '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">尚未建立估值快照。請先建立一筆估值，之後發股才會鎖定使用。</div>'}
                            <div class="rounded-xl border border-slate-200 bg-white p-4">
                                <div class="text-sm font-black text-slate-900 mb-2">估值清單</div>
                                <select id="valuation-snapshot-select" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" onchange="window.loadValuationSnapshotToForm(this.value)">
                                    <option value="">選擇一筆估值</option>
                                    ${activeSnapshotOptions}
                                </select>
                                <div class="mt-3 max-h-64 overflow-auto space-y-2">
                                    ${snapshots.length ? snapshots.map(buildValuationSnapshotCard).join('') : '<div class="text-sm text-slate-400">尚未有估值資料</div>'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <h5 class="text-sm font-black text-slate-900">股權發行</h5>
                                <p class="text-[11px] text-slate-500 mt-1">外部投資者、員工折抵與顧問折抵，都在這裡依估值換算成持股。</p>
                            </div>
                            <div class="text-right">
                                <div class="text-[11px] font-bold text-emerald-600">預設估值</div>
                                <div class="text-xs font-mono text-slate-600">${escapeHtml(activeSnapshot?.valuationId || '未設定')}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">投資人 ID</div>
                                <input id="issue-investor-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="investor-001">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">投資人名稱</div>
                                <input id="issue-investor-name" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="王小明">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">Email</div>
                                <input id="issue-investor-email" type="email" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="investor@example.com">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">身份</div>
                                <select id="issue-participant-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                    <option value="investor">外部投資者</option>
                                    <option value="employee">員工折抵</option>
                                    <option value="consultant">顧問折抵</option>
                                    <option value="advisor">顧問 / Advisor</option>
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">使用估值</div>
                                <select id="issue-valuation-id" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                    <option value="">自動使用當前估值</option>
                                    ${activeSnapshotOptions}
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">對價類型</div>
                                <select id="issue-consideration-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                    <option value="cash">現金</option>
                                    <option value="service">服務折抵</option>
                                    <option value="offset">債務/成本折抵</option>
                                </select>
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">對價金額</div>
                                <input id="issue-consideration-amount" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="100000">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">來源類型</div>
                                <input id="issue-source-type" type="text" value="manual" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="manual / payroll / contract">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">來源 ID</div>
                                <input id="issue-source-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="PO-2026-001 / payroll-05">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">來源標籤</div>
                                <input id="issue-source-label" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="本輪募資 / 顧問服務折抵">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">Vesting（月）</div>
                                <input id="issue-vesting-months" type="number" min="0" step="1" value="0" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">Cliff（月）</div>
                                <input id="issue-cliff-months" type="number" min="0" step="1" value="0" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                            </label>
                            <label>
                                <div class="text-[11px] font-bold text-slate-500 mb-1">起算日</div>
                                <input id="issue-start-date" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                            </label>
                            <label class="md:col-span-2">
                                <div class="text-[11px] font-bold text-slate-500 mb-1">說明</div>
                                <textarea id="issue-note" rows="2" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="例如：顧問服務折抵換股，按本輪估值計算。"></textarea>
                            </label>
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <div class="text-[11px] text-slate-500 leading-5">
                                這裡會直接依估值快照計算 considerationAmount / sharePrice，並同步更新持股位置。
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.fillInvestorLedgerSampleData()" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95">範例</button>
                                <button onclick="window.issueInvestorEquityFromForm()" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95">發行股權</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div class="text-sm font-black text-slate-900">新增原始股東 / 投資人</div>
                            <div class="text-[11px] text-slate-500 mt-1">先把公司最初的股東、創辦人、員工折抵或外部投資者建檔，再用上方表格維護股數與收款帳號。</div>
                        </div>
                        <div class="text-[11px] text-slate-400">這裡建立的是 investor_profiles 的初始資料</div>
                    </div>
                    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">代號 / ID</div>
                            <input id="new-investor-id" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="founder-001 / investor-001">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">名稱</div>
                            <input id="new-investor-name" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="王小明">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">Email</div>
                            <input id="new-investor-email" type="email" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="founder@example.com">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">身份</div>
                            <select id="new-investor-participant" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                <option value="founder">原始股東 / Founder</option>
                                <option value="investor">外部投資者</option>
                                <option value="employee">員工折抵</option>
                                <option value="consultant">顧問折抵</option>
                                <option value="advisor">顧問 / Advisor</option>
                            </select>
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">初始股數</div>
                            <input id="new-investor-share" type="number" min="0" step="1" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="1000000">
                        </label>
                        <label>
                            <div class="text-[11px] font-bold text-slate-500 mb-1">股利帳號</div>
                            <input id="new-investor-payout" type="text" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="銀行帳號 / Wallet / 轉帳資訊">
                        </label>
                        <label class="md:col-span-2">
                            <div class="text-[11px] font-bold text-slate-500 mb-1">備註</div>
                            <textarea id="new-investor-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：創辦人初始持股 / 員工認股 / 顧問折抵"></textarea>
                        </label>
                    </div>
                    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div class="text-[11px] text-slate-500">如果是原始股東，建議把身份設成 founder，並直接輸入初始股數。</div>
                        <button onclick="window.createInvestorProfileFromForm()" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95">新增股東 / 投資人</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-5 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">事件類型</div>
                        <select id="investor-event-type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                            <option value="income">收入</option>
                            <option value="expense">支出</option>
                        </select>
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">金額</div>
                        <input id="investor-event-amount" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="10000">
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">來源類型</div>
                        <input id="investor-event-source-type" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="manual" placeholder="order / manual / expense">
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">來源 ID</div>
                        <input id="investor-event-source-id" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="order-123 / exp-2026-001">
                    </label>
                    <label class="md:col-span-1">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">發生日期</div>
                        <input id="investor-event-date" type="date" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    </label>
                    <label class="md:col-span-4">
                        <div class="text-[11px] font-bold text-slate-500 mb-1">備註</div>
                        <input id="investor-event-note" type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="例如：月租費 / 行銷費 / 新訂單收入">
                    </label>
                    <div class="md:col-span-1 flex items-end">
                        <button onclick="window.submitInvestorFinanceEvent()" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95">新增事件</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <div class="text-sm font-black text-slate-900">最近發股紀錄</div>
                                <div class="text-[11px] text-slate-500 mt-1">所有換股事件都會保留，不會被之後估值回寫。</div>
                            </div>
                            <div class="text-[11px] font-bold text-slate-400">${recentIssuances.length} 筆</div>
                        </div>
                        <div class="overflow-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th class="py-2 px-4">投資人</th>
                                        <th class="py-2 px-4">身份</th>
                                        <th class="py-2 px-4">估值</th>
                                        <th class="py-2 px-4">對價</th>
                                        <th class="py-2 px-4">股數</th>
                                        <th class="py-2 px-4">比例</th>
                                        <th class="py-2 px-4">來源</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentIssuances.length ? recentIssuances.map(buildEquityIssuanceRow).join('') : '<tr><td colspan="7" class="py-8 text-center text-slate-400">尚無發股紀錄</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <div class="text-sm font-black text-slate-900">持股位置</div>
                                <div class="text-[11px] text-slate-500 mt-1">依最新累計股數與估值基準顯示。</div>
                            </div>
                            <div class="text-[11px] font-bold text-slate-400">${equityPositions.length} 筆</div>
                        </div>
                        <div class="overflow-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th class="py-2 px-4">投資人</th>
                                        <th class="py-2 px-4">身份</th>
                                        <th class="py-2 px-4">股數</th>
                                        <th class="py-2 px-4">比例</th>
                                        <th class="py-2 px-4">估值</th>
                                        <th class="py-2 px-4">單價</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${equityPositions.length ? equityPositions.map(buildInvestorEquityPositionRow).join('') : '<tr><td colspan="6" class="py-8 text-center text-slate-400">尚無持股位置</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto rounded-2xl border border-slate-200">
                    <table class="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr class="bg-slate-50 text-slate-500 border-b border-slate-100">
                                <th class="py-3 px-6">投資人</th>
                                <th class="py-3 px-6">基本資料</th>
                                <th class="py-3 px-6">份額 / 帳號</th>
                                <th class="py-3 px-6">餘額</th>
                                <th class="py-3 px-6">備註</th>
                                <th class="py-3 px-6 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody id="business-investor-table-body" class="divide-y divide-slate-100">
                            ${profiles.length ? profiles.map(buildInvestorProfileRow).join('') : '<tr><td colspan="6" class="py-10 text-center text-slate-400">尚未設定投資人</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

window.buildRevenueSimulatorHtml = window.buildRevenueSimulatorHtml || function() {
    return `
        <div class="mb-10 bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                <h4 class="text-sm font-black text-blue-900 flex items-center gap-2">
                    📊 分潤模擬器（唯讀）
                </h4>
                <span class="text-[11px] text-blue-500 font-semibold">不寫入資料庫</span>
            </div>
            <div class="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <label class="text-xs font-bold text-gray-600">訂單金額
                    <input id="sim-amount" type="number" min="0" step="1" value="1200" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">有效期(月)
                    <input id="sim-months" type="number" min="1" step="1" value="12" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Tutor Rate
                    <input id="sim-tutor-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Tutor Upline Rate
                    <input id="sim-tutor-upline-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Agent Rate
                    <input id="sim-agent-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">Agent Upline Rate
                    <input id="sim-agent-upline-rate" type="number" min="0" max="1" step="0.01" value="0.1" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">CourseDev Rate
                    <input id="sim-course-rate" type="number" min="0" max="1" step="0.01" value="0.2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
                <label class="text-xs font-bold text-gray-600">CourseDev Upline Rate
                    <input id="sim-course-upline-rate" type="number" min="0" max="1" step="0.01" value="0.1" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                </label>
            </div>
            <div class="px-6 pb-6">
                <button onclick="window.runRevenueSimulation()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                    重新模擬
                </button>
            </div>
            <div id="revenue-sim-result" class="px-6 pb-6"></div>
        </div>
    `;
};

function policyRateInput(id, key, value, title, description) {
    const valPercent = Math.round((Number.isFinite(Number(value)) ? Number(value) : 0) * 100);
    return `
        <label class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="text-sm font-black text-slate-900">${escapeHtml(title)}</div>
                    <div class="mt-1 text-[11px] leading-5 text-slate-500">${escapeHtml(description)}</div>
                </div>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(key.replace('policy-', ''))}</span>
            </div>
            <div class="flex items-center gap-2">
                <input id="${key}-${id}" type="number" min="0" max="100" step="1" value="${valPercent}" oninput="window.markPolicyModified('${escapeHtml(id)}')" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
                <span class="text-xs font-black text-slate-400">%</span>
            </div>
        </label>
    `;
}

window.buildRevenuePolicyHtml = window.buildRevenuePolicyHtml || function() {
    return `
        <div class="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div id="revenue-policy-body" class="p-6">
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    載入中...
                </div>
            </div>
        </div>
    `;
};

window.runRevenueSimulation = function () {
    const val = (id, fallback = 0) => {
        const el = document.getElementById(id);
        const n = Number(el?.value);
        return Number.isFinite(n) ? n : fallback;
    };
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const buildLevels = (amount, rate, uplineRate, maxLevels = 6) => {
        const out = [];
        let share = amount * rate;
        let level = 1;
        while (level <= maxLevels && share >= 0.01) {
            out.push(round2(share));
            share = share * uplineRate;
            level += 1;
        }
        return out;
    };

    const amount = Math.max(0, val('sim-amount', 0));
    const months = Math.max(1, Math.floor(val('sim-months', 12)));
    const tutorLevels = buildLevels(amount, val('sim-tutor-rate', 0.2), val('sim-tutor-upline-rate', 0.2));
    const agentLevels = buildLevels(amount, val('sim-agent-rate', 0.2), val('sim-agent-upline-rate', 0.1));
    const courseLevels = buildLevels(amount, val('sim-course-rate', 0.2), val('sim-course-upline-rate', 0.1));

    const sum = (arr) => round2(arr.reduce((a, b) => a + b, 0));
    const tutorTotal = sum(tutorLevels);
    const agentTotal = sum(agentLevels);
    const courseTotal = sum(courseLevels);
    const totalCredit = round2(tutorTotal + agentTotal + courseTotal);
    const monthlyPay = round2(totalCredit / months);

    const resultEl = document.getElementById('revenue-sim-result');
    if (!resultEl) return;
    const fmt = (arr) => arr.length ? arr.map((v, i) => `L${i + 1}: ${v}`).join(' / ') : '0';
    resultEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">總 Credit</div><div class="text-xl font-black text-gray-800">TWD ${totalCredit}</div></div>
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">月攤提</div><div class="text-xl font-black text-blue-700">TWD ${monthlyPay}</div></div>
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">有效期</div><div class="text-xl font-black text-gray-800">${months} 月</div></div>
            <div class="bg-white rounded-xl border p-3"><div class="text-xs text-gray-500">訂單金額</div><div class="text-xl font-black text-gray-800">TWD ${round2(amount)}</div></div>
        </div>
        <div class="bg-white rounded-xl border p-4 text-sm text-gray-700 space-y-2">
            <div><span class="font-bold text-indigo-700">Tutor:</span> ${fmt(tutorLevels)}（合計 ${tutorTotal}）</div>
            <div><span class="font-bold text-emerald-700">Agent:</span> ${fmt(agentLevels)}（合計 ${agentTotal}）</div>
            <div><span class="font-bold text-amber-700">CourseDev:</span> ${fmt(courseLevels)}（合計 ${courseTotal}）</div>
        </div>
    `;
};

window.loadRevenuePolicies = async function () {
    const body = document.getElementById('revenue-policy-body');
    if (!body) return;
    body.innerHTML = '<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">載入中...</div>';
    try {
        const fn = httpsCallable(functions, 'getRevenueSharePolicies');
        const res = await fn({});
        const policies = Array.isArray(res?.data?.policies) ? res.data.policies : [];
        window.__loadedRevenuePolicies = policies;
        const policyCountEl = document.getElementById('business-stat-policy-count');
        if (policyCountEl) {
            policyCountEl.textContent = String(policies.some(p => p && p.enabled !== false) ? 1 : 0);
        }
        if (!policies.length) {
            body.innerHTML = '<div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">找不到固定分潤設定，請直接儲存以建立預設值。</div>';
            return;
        }

        const policy = policies.find((p) => p && p.enabled !== false) || policies[0];
        const id = 'fixed-policy';
        const tutorRate = Number(policy.tutorRate ?? 0.2);
        const tutorUplineRate = Number(policy.tutorUplineRate ?? 0.2);
        const agentRate = Number(policy.agentRate ?? 0.2);
        const agentUplineRate = Number(policy.agentUplineRate ?? 0);
        const courseDevRate = Number(policy.courseDevRate ?? 0.2);
        const courseDevUplineRate = Number(policy.courseDevUplineRate ?? 0.1);

        const policySummary = (label, directRate, uplineRate, accent, note) => `
            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="flex-grow">
                    <div class="text-sm font-black text-slate-900">${escapeHtml(label)}</div>
                    <div class="mt-1 text-[12px] leading-5 text-slate-500">${escapeHtml(note)}</div>
                </div>
                <div class="flex-shrink-0 flex items-center justify-between sm:justify-end gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 sm:py-2">
                    <div class="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">分潤比例</div>
                    <div class="rounded-full px-3 py-1.5 text-[11px] font-black ${accent.bg} ${accent.fg} whitespace-nowrap">
                        直推 ${Math.round(directRate * 100)}% / 上線 ${Math.round(uplineRate * 100)}%
                    </div>
                </div>
            </div>
        `;

        body.innerHTML = `
            <div class="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div class="space-y-6">
                    <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
                        <div class="font-black">使用說明</div>
                        <ul class="mt-2 space-y-1.5 text-[13px] leading-6">
                            <li>• 這組設定會套用到所有訂單與月結，不再區分直銷、代理等多套策略。</li>
                            <li>• 「直推」是第一層分潤；「上線」是往上一層遞迴分潤比例。</li>
                            <li>• 若某個角色不需要分潤，直接把該欄位設為 <code>0</code> 即可。</li>
                        </ul>
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        ${policyRateInput(id, 'policy-tutorRate', tutorRate, '導師直推分潤', '訂單成交時，第一層導師可拿到的比例。')}
                        ${policyRateInput(id, 'policy-tutorUplineRate', tutorUplineRate, '導師上線分潤', '導師的上線會依這個比例繼續遞迴分潤。')}
                        ${policyRateInput(id, 'policy-agentRate', agentRate, '管道直推分潤', '若訂單有對應的推廣或代理角色，第一層的比例。')}
                        ${policyRateInput(id, 'policy-agentUplineRate', agentUplineRate, '管道上線分潤', '代理角色的上線遞迴比例。設為 0 即停止往上分。')}
                        ${policyRateInput(id, 'policy-courseDevRate', courseDevRate, '開發直推分潤', '課程開發者的第一層分潤比例。')}
                        ${policyRateInput(id, 'policy-courseDevUplineRate', courseDevUplineRate, '開發上線分潤', '開發者上線的遞迴比例。通常設定得比直推更低。')}
                    </div>

                </div>

                <div class="space-y-4">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <div class="text-sm font-black text-slate-900">快速檢查</div>
                        <div class="mt-4 space-y-3 text-sm text-slate-600">
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">1</span>
                                <span>若只想保留單一固定分潤，所有欄位都在這裡調整即可。</span>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">2</span>
                                <span>把某個欄位設成 <code>0</code>，就等於關閉該角色的分潤。</span>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">3</span>
                                <span>目前系統不再使用其他策略名稱，舊資料也會自動回落到固定設定。</span>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div class="text-sm font-black text-slate-900">設定提醒</div>
                        <div class="mt-1 text-xs leading-6 text-slate-500">這裡是三個角色的固定分潤摘要，先看用途，再看比例。</div>
                        <div class="mt-4 flex flex-col gap-3">
                            ${policySummary('導師', tutorRate, tutorUplineRate, { bg: 'bg-blue-50', fg: 'text-blue-700' }, '最常使用的主分潤，建議先確認這一組。')}
                            ${policySummary('管道 / Agent', agentRate, agentUplineRate, { bg: 'bg-emerald-50', fg: 'text-emerald-700' }, '如果沒有代理通路，兩個欄位都可以保持 0。')}
                            ${policySummary('課程開發', courseDevRate, courseDevUplineRate, { bg: 'bg-amber-50', fg: 'text-amber-700' }, '適合用來分配內容提供者或課程作者。')}
                        </div>
                    </div>

                    <button id="btn-save-policy-${id}" onclick="window.saveRevenuePolicy('${escapeHtml(id)}')" class="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95">
                        儲存固定設定
                    </button>
                </div>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">載入失敗：${escapeHtml(e.message || 'unknown')}</div>`;
    }
};

window.markPolicyModified = function(id) {
    const btn = document.getElementById(`btn-save-policy-${id}`);
    if (btn) {
        btn.classList.remove('bg-slate-900', 'hover:bg-slate-700');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        btn.textContent = '儲存變更';
    }
};

window.saveRevenuePolicy = async function (policyId) {
    const g = (id) => document.getElementById(`${id}-${policyId}`);
    const payload = {
        policyId: 'default-v1',
        policyName: 'Default Sharing Policy',
        tutorRate: Number(g('policy-tutorRate')?.value || 0) / 100,
        tutorUplineRate: Number(g('policy-tutorUplineRate')?.value || 0) / 100,
        agentRate: Number(g('policy-agentRate')?.value || 0) / 100,
        agentUplineRate: Number(g('policy-agentUplineRate')?.value || 0) / 100,
        courseDevRate: Number(g('policy-courseDevRate')?.value || 0) / 100,
        courseDevUplineRate: Number(g('policy-courseDevUplineRate')?.value || 0) / 100,
        enabled: true
    };

    const btn = document.getElementById(`btn-save-policy-${policyId}`);
    const originalText = btn ? btn.textContent : '儲存';
    if (btn) {
        btn.disabled = true;
        btn.textContent = "儲存中...";
    }

    try {
        const fn = httpsCallable(functions, 'upsertRevenueSharePolicy');
        await fn(payload);
        notify('已成功儲存固定分潤設定', 'success');

        if (btn) {
            btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
            btn.classList.add('bg-slate-900', 'hover:bg-slate-700');
            btn.textContent = '儲存';
        }

        await window.loadRevenuePolicies();
    } catch (e) {
        console.error('[InvestorPortal] Failed to save policy:', e);
        alert(`更新失敗：${e.message}`);
        if (btn) {
            btn.textContent = originalText;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
        }
    }
};

window.loadInvestorProfiles = async function () {
    const container = document.getElementById('business-investor-container');
    if (!container) return;
    container.innerHTML = '<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">載入投資人資料中...</div>';
    try {
        const fn = httpsCallable(functions, 'getInvestorProfiles');
        const res = await fn({});
        const profiles = Array.isArray(res?.data?.profiles) ? res.data.profiles : [];
        window.__loadedInvestorProfiles = profiles;
        const config = res?.data?.config || {};
        const valuationSnapshots = Array.isArray(res?.data?.valuationSnapshots) ? res.data.valuationSnapshots : [];
        const activeValuationSnapshot = res?.data?.activeValuationSnapshot || null;
        const balanceSheetSnapshots = Array.isArray(res?.data?.balanceSheetSnapshots) ? res.data.balanceSheetSnapshots : [];
        const activeBalanceSheetSnapshot = res?.data?.activeBalanceSheetSnapshot || null;
        const recentIssuances = Array.isArray(res?.data?.recentIssuances) ? res.data.recentIssuances : [];
        const equityPositions = Array.isArray(res?.data?.equityPositions) ? res.data.equityPositions : [];
        window.__loadedValuationSnapshots = valuationSnapshots;
        window.__loadedActiveValuationSnapshot = activeValuationSnapshot;
        window.__loadedBalanceSheetSnapshots = balanceSheetSnapshots;
        window.__loadedActiveBalanceSheetSnapshot = activeBalanceSheetSnapshot;
        window.__loadedRecentIssuances = recentIssuances;
        window.__loadedInvestorEquityPositions = equityPositions;
        window.__loadedInvestorConfig = config;
        container.classList.remove('hidden');
        container.innerHTML = window.buildInvestorPlanHtml ? window.buildInvestorPlanHtml() : '';
        window.syncInvestorManagementDefaults?.();

        const dateInput = document.getElementById('investor-event-date');
        if (dateInput && !dateInput.value) {
            const now = new Date();
            dateInput.value = now.toISOString().slice(0, 10);
        }
        const refundDateInput = document.getElementById('ledger-refund-date');
        if (refundDateInput && !refundDateInput.value) {
            refundDateInput.value = new Date().toISOString().slice(0, 10);
        }
    } catch (e) {
        container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">載入投資人資料失敗：${escapeHtml(e.message || 'unknown')}</div>`;
    }
};

window.syncInvestorManagementDefaults = function () {
    const active = window.__loadedActiveValuationSnapshot || null;
    const snapshots = Array.isArray(window.__loadedValuationSnapshots) ? window.__loadedValuationSnapshots : [];
    const snapshot = active || snapshots[0] || null;
    if (snapshot) {
        window.loadValuationSnapshotToForm(snapshot.valuationId);
    }

    const issueValuation = document.getElementById('issue-valuation-id');
    if (issueValuation && !issueValuation.value) {
        issueValuation.value = snapshot?.valuationId || '';
    }
    const issueDate = document.getElementById('issue-start-date');
    if (issueDate && !issueDate.value) {
        issueDate.value = new Date().toISOString().slice(0, 10);
    }

    const balanceSnapshot = window.__loadedActiveBalanceSheetSnapshot || (Array.isArray(window.__loadedBalanceSheetSnapshots) ? window.__loadedBalanceSheetSnapshots[0] : null) || null;
    if (balanceSnapshot) {
        window.loadBalanceSheetSnapshotToForm(balanceSnapshot.snapshotId);
    }
    const balanceDate = document.getElementById('balance-snapshot-date');
    if (balanceDate && !balanceDate.value) {
        balanceDate.value = new Date().toISOString().slice(0, 10);
    }
    const balanceIssuedShares = document.getElementById('balance-issued-shares');
    if (balanceIssuedShares && !balanceIssuedShares.value) {
        const totalIssuedShares = (Array.isArray(window.__loadedInvestorEquityPositions) ? window.__loadedInvestorEquityPositions : [])
            .reduce((sum, p) => sum + Number(p.totalIssuedShares || 0), 0)
            || (Array.isArray(window.__loadedInvestorProfiles) ? window.__loadedInvestorProfiles.reduce((sum, p) => sum + Number(p.equityShares || p.shareUnits || 0), 0) : 0);
        if (totalIssuedShares > 0) balanceIssuedShares.value = String(totalIssuedShares);
    }
};

window.createInvestorProfileFromForm = async function () {
    const payload = {
        investorId: document.getElementById('new-investor-id')?.value || '',
        investorName: document.getElementById('new-investor-name')?.value || '',
        investorEmail: document.getElementById('new-investor-email')?.value || '',
        participantType: document.getElementById('new-investor-participant')?.value || 'founder',
        shareUnits: Number(document.getElementById('new-investor-share')?.value || 0),
        payoutAccount: document.getElementById('new-investor-payout')?.value || '',
        notes: document.getElementById('new-investor-notes')?.value || '',
        enabled: true
    };

    if (!payload.investorId) {
        alert('請輸入代號 / ID');
        return;
    }

    if (!Number.isFinite(payload.shareUnits) || payload.shareUnits < 0) {
        alert('請輸入有效的初始股數');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'upsertInvestorProfile');
        await fn(payload);
        notify('原始股東 / 投資人已建立', 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`新增失敗：${e.message}`);
    }
};

window.saveInvestorProfile = async function (investorId) {
    const safeId = String(investorId || '').trim().replace(/[^a-z0-9_-]/gi, '-');
    const g = (suffix) => document.getElementById(`investor-${suffix}-${safeId}`);
    const payload = {
        investorId,
        investorName: g('name')?.value || investorId,
        investorEmail: g('email')?.value || '',
        participantType: g('participant')?.value || 'investor',
        shareUnits: Number(g('share')?.value || 0),
        payoutAccount: g('payout')?.value || '',
        notes: g('notes')?.value || '',
        enabled: !!g('enabled')?.checked
    };

    const btn = document.getElementById(`btn-save-investor-${safeId}`);
    const originalText = btn ? btn.textContent : '儲存';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    try {
        const fn = httpsCallable(functions, 'upsertInvestorProfile');
        await fn(payload);
        notify(`已儲存投資人：${investorId}`, 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`儲存投資人失敗：${e.message}`);
        if (btn) btn.textContent = originalText;
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.submitInvestorFinanceEvent = async function () {
    const eventType = document.getElementById('investor-event-type')?.value || 'income';
    const amount = Number(document.getElementById('investor-event-amount')?.value || 0);
    const sourceType = document.getElementById('investor-event-source-type')?.value || 'manual';
    const sourceId = document.getElementById('investor-event-source-id')?.value || '';
    const note = document.getElementById('investor-event-note')?.value || '';
    const dateValue = document.getElementById('investor-event-date')?.value || '';
    if (!Number.isFinite(amount) || amount <= 0) {
        alert('請輸入有效金額');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'recordInvestorFinanceEvent');
        await fn({
            eventType,
            amount,
            sourceType,
            sourceId,
            note,
            occurredAtDate: dateValue ? new Date(`${dateValue}T00:00:00`) : new Date()
        });
        notify('投資人事件已新增', 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`新增事件失敗：${e.message}`);
    }
};

window.settleInvestorYear = async function () {
    const yearValue = prompt('請輸入要結算的年度（預設前一年）', String((new Date()).getFullYear() - 1));
    if (yearValue === null) return;
    const year = Number(yearValue || 0);
    if (!Number.isFinite(year) || year < 2000) {
        alert('請輸入有效年份');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'settleAnnualInvestorDividends');
        const res = await fn({ year });
        notify(`年度結算完成：${res.data?.settlementCount || 0} 位投資人`, 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`年度結算失敗：${e.message}`);
    }
};

window.exportLedgerReportFromForm = async function () {
    const period = document.getElementById('ledger-report-period')?.value || getCurrentLedgerPeriod();
    const reportType = document.getElementById('ledger-report-type')?.value || 'trial_balance';
    const format = document.getElementById('ledger-report-format')?.value || 'csv';

    try {
        const fn = httpsCallable(functions, 'exportLedgerReport');
        const res = await fn({ period, reportType, format });
        const data = res?.data || {};
        if (!data.content) {
            throw new Error('報表內容為空');
        }
        triggerDownloadFile({
            fileName: data.fileName || `ledger_${reportType}_${period}.${format}`,
            content: data.content,
            contentType: data.contentType || (format === 'json' ? 'application/json' : 'text/csv')
        });
        notify(`已匯出 ${reportType}（${period}）`, 'success');
    } catch (e) {
        alert(`匯出報表失敗：${e.message}`);
    }
};

window.recordOrderRefundEventFromForm = async function () {
    const orderId = document.getElementById('ledger-refund-order-id')?.value || '';
    const amount = Number(document.getElementById('ledger-refund-amount')?.value || 0);
    const refundAtDate = document.getElementById('ledger-refund-date')?.value || '';
    const reason = document.getElementById('ledger-refund-reason')?.value || '';

    if (!orderId.trim()) {
        alert('請輸入退款訂單 ID');
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        alert('請輸入有效退款金額');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'recordOrderRefundEvent');
        await fn({
            orderId: orderId.trim(),
            amount,
            refundAtDate,
            reason,
            note: reason
        });
        notify(`已登記退款：${orderId.trim()}`, 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`登記退款失敗：${e.message}`);
    }
};

window.loadBalanceSheetSnapshotToForm = function (snapshotId) {
    const snapshots = Array.isArray(window.__loadedBalanceSheetSnapshots) ? window.__loadedBalanceSheetSnapshots : [];
    const snapshot = snapshots.find((item) => item && item.snapshotId === snapshotId);
    if (!snapshot) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };

    setValue('balance-snapshot-id', snapshot.snapshotId || '');
    setValue('balance-snapshot-date', formatInvestorLedgerDate(snapshot.snapshotDate, '') || '');
    setValue('balance-currency', snapshot.currency || 'TWD');
    setValue('balance-issued-shares', Number(snapshot.issuedShares || 0));
    setValue('balance-cash', Number(snapshot.cash || 0));
    setValue('balance-receivable', Number(snapshot.accountsReceivable || 0));
    setValue('balance-other-assets', Number(snapshot.otherAssets || 0));
    setValue('balance-fixed-assets', Number(snapshot.fixedAssets || 0));
    setValue('balance-intangible-assets', Number(snapshot.intangibleAssets || 0));
    setValue('balance-prepaid-expenses', Number(snapshot.prepaidExpenses || 0));
    setValue('balance-payable', Number(snapshot.accountsPayable || 0));
    setValue('balance-short-debt', Number(snapshot.shortTermDebt || 0));
    setValue('balance-long-debt', Number(snapshot.longTermDebt || 0));
    setValue('balance-other-liabilities', Number(snapshot.otherLiabilities || 0));
    setValue('balance-notes', snapshot.notes || '');
    const locked = document.getElementById('balance-locked');
    if (locked) locked.checked = snapshot.locked !== false;
};

window.saveBalanceSheetSnapshot = async function () {
    const payload = {
        snapshotId: document.getElementById('balance-snapshot-id')?.value || '',
        snapshotDate: document.getElementById('balance-snapshot-date')?.value || '',
        currency: document.getElementById('balance-currency')?.value || 'TWD',
        issuedShares: Number(document.getElementById('balance-issued-shares')?.value || 0),
        cash: Number(document.getElementById('balance-cash')?.value || 0),
        accountsReceivable: Number(document.getElementById('balance-receivable')?.value || 0),
        otherAssets: Number(document.getElementById('balance-other-assets')?.value || 0),
        fixedAssets: Number(document.getElementById('balance-fixed-assets')?.value || 0),
        intangibleAssets: Number(document.getElementById('balance-intangible-assets')?.value || 0),
        prepaidExpenses: Number(document.getElementById('balance-prepaid-expenses')?.value || 0),
        accountsPayable: Number(document.getElementById('balance-payable')?.value || 0),
        shortTermDebt: Number(document.getElementById('balance-short-debt')?.value || 0),
        longTermDebt: Number(document.getElementById('balance-long-debt')?.value || 0),
        otherLiabilities: Number(document.getElementById('balance-other-liabilities')?.value || 0),
        notes: document.getElementById('balance-notes')?.value || '',
        locked: !!document.getElementById('balance-locked')?.checked
    };

    if (!payload.snapshotId) {
        alert('請輸入財務快照 ID');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'upsertBalanceSheetSnapshot');
        await fn(payload);
        notify('財務快照已儲存', 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`儲存財務快照失敗：${e.message}`);
    }
};

window.loadValuationSnapshotToForm = function (valuationId) {
    const snapshots = Array.isArray(window.__loadedValuationSnapshots) ? window.__loadedValuationSnapshots : [];
    const snapshot = snapshots.find((item) => item && item.valuationId === valuationId);
    if (!snapshot) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };

    setValue('valuation-snapshot-id', snapshot.valuationId || '');
    setValue('valuation-round-name', snapshot.roundName || '');
    setValue('valuation-type', snapshot.valuationType || 'pre-money');
    setValue('valuation-currency', snapshot.currency || 'TWD');
    setValue('valuation-pre-money', Number(snapshot.preMoneyValuation || 0));
    setValue('valuation-post-money', Number(snapshot.postMoneyValuation || 0));
    setValue('valuation-share-basis', Number(snapshot.shareBasis || 0));
    setValue('valuation-share-price', Number(snapshot.sharePrice || 0));
    setValue('valuation-notes', snapshot.notes || '');
    const locked = document.getElementById('valuation-locked');
    if (locked) locked.checked = snapshot.locked !== false;
    const activeFrom = formatInvestorLedgerDate(snapshot.effectiveFrom, '');
    const activeTo = formatInvestorLedgerDate(snapshot.effectiveTo, '');
    setValue('valuation-effective-from', activeFrom || '');
    setValue('valuation-effective-to', activeTo || '');
    const issueValuation = document.getElementById('issue-valuation-id');
    if (issueValuation) {
        issueValuation.value = snapshot.valuationId || '';
    }
};

window.saveValuationSnapshot = async function () {
    const payload = {
        valuationId: document.getElementById('valuation-snapshot-id')?.value || '',
        roundName: document.getElementById('valuation-round-name')?.value || '',
        valuationType: document.getElementById('valuation-type')?.value || 'pre-money',
        currency: document.getElementById('valuation-currency')?.value || 'TWD',
        preMoneyValuation: Number(document.getElementById('valuation-pre-money')?.value || 0),
        postMoneyValuation: Number(document.getElementById('valuation-post-money')?.value || 0),
        shareBasis: Number(document.getElementById('valuation-share-basis')?.value || 0),
        sharePrice: Number(document.getElementById('valuation-share-price')?.value || 0),
        effectiveFrom: document.getElementById('valuation-effective-from')?.value || '',
        effectiveTo: document.getElementById('valuation-effective-to')?.value || '',
        notes: document.getElementById('valuation-notes')?.value || '',
        locked: !!document.getElementById('valuation-locked')?.checked
    };

    if (!payload.valuationId) {
        alert('請輸入估值 ID');
        return;
    }
    if (!Number.isFinite(payload.shareBasis) || payload.shareBasis <= 0) {
        alert('請輸入有效的股本基準');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'upsertValuationSnapshot');
        await fn(payload);
        notify('估值快照已儲存', 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`儲存估值失敗：${e.message}`);
    }
};

window.issueInvestorEquityFromForm = async function () {
    const payload = {
        investorId: document.getElementById('issue-investor-id')?.value || '',
        investorName: document.getElementById('issue-investor-name')?.value || '',
        investorEmail: document.getElementById('issue-investor-email')?.value || '',
        participantType: document.getElementById('issue-participant-type')?.value || 'investor',
        valuationId: document.getElementById('issue-valuation-id')?.value || '',
        considerationType: document.getElementById('issue-consideration-type')?.value || 'cash',
        considerationAmount: Number(document.getElementById('issue-consideration-amount')?.value || 0),
        sourceType: document.getElementById('issue-source-type')?.value || 'manual',
        sourceId: document.getElementById('issue-source-id')?.value || '',
        sourceLabel: document.getElementById('issue-source-label')?.value || '',
        vestingMonths: Number(document.getElementById('issue-vesting-months')?.value || 0),
        cliffMonths: Number(document.getElementById('issue-cliff-months')?.value || 0),
        startDate: document.getElementById('issue-start-date')?.value || '',
        note: document.getElementById('issue-note')?.value || ''
    };

    if (!payload.investorId) {
        alert('請輸入投資人 ID');
        return;
    }
    if (!Number.isFinite(payload.considerationAmount) || payload.considerationAmount <= 0) {
        alert('請輸入有效對價金額');
        return;
    }

    try {
        const fn = httpsCallable(functions, 'issueInvestorEquity');
        await fn(payload);
        notify('股權已發行', 'success');
        await window.loadInvestorProfiles();
    } catch (e) {
        alert(`發行股權失敗：${e.message}`);
    }
};

window.fillInvestorLedgerSampleData = function () {
    const today = new Date().toISOString().slice(0, 10);
    const fields = {
        'balance-snapshot-id': 'bs-2026-q2',
        'balance-snapshot-date': today,
        'balance-currency': 'TWD',
        'balance-issued-shares': '10000000',
        'balance-cash': '500000',
        'balance-receivable': '120000',
        'balance-other-assets': '0',
        'balance-fixed-assets': '0',
        'balance-intangible-assets': '0',
        'balance-prepaid-expenses': '0',
        'balance-payable': '80000',
        'balance-short-debt': '0',
        'balance-long-debt': '0',
        'balance-other-liabilities': '0',
        'balance-notes': '示範：月底資產負債快照，供 NAV / 每股淨值測試。',
        'valuation-snapshot-id': 'pre-seed-2026-q2',
        'valuation-round-name': 'Pre-Seed 2026 Q2',
        'valuation-type': 'pre-money',
        'valuation-currency': 'TWD',
        'valuation-pre-money': '12000000',
        'valuation-post-money': '15000000',
        'valuation-share-basis': '1000000',
        'valuation-share-price': '12',
        'valuation-effective-from': today,
        'valuation-notes': '董事會核准的預設示範估值，供外部投資與服務折抵換股測試。',
        'issue-investor-id': 'investor-demo-001',
        'issue-investor-name': 'Demo Investor',
        'issue-investor-email': 'demo@example.com',
        'issue-participant-type': 'consultant',
        'issue-valuation-id': 'pre-seed-2026-q2',
        'issue-consideration-type': 'service',
        'issue-consideration-amount': '60000',
        'issue-source-type': 'contract',
        'issue-source-id': 'contract-2026-001',
        'issue-source-label': '顧問服務折抵',
        'issue-vesting-months': '12',
        'issue-cliff-months': '3',
        'issue-start-date': today,
        'issue-note': '示範：顧問服務折抵換股，按鎖定估值計算。'
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });

    const locked = document.getElementById('valuation-locked');
    if (locked) locked.checked = true;
    notify('已載入範例資料', 'success');
};

window.fillBalanceSheetSampleData = function () {
    const today = new Date().toISOString().slice(0, 10);
    const fields = {
        'balance-snapshot-id': 'bs-2026-q2',
        'balance-snapshot-date': today,
        'balance-currency': 'TWD',
        'balance-issued-shares': '10000000',
        'balance-cash': '500000',
        'balance-receivable': '120000',
        'balance-other-assets': '0',
        'balance-fixed-assets': '0',
        'balance-intangible-assets': '0',
        'balance-prepaid-expenses': '0',
        'balance-payable': '80000',
        'balance-short-debt': '0',
        'balance-long-debt': '0',
        'balance-other-liabilities': '0',
        'balance-notes': '示範：月底資產負債快照，供 NAV / 每股淨值測試。'
    };

    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });

    const locked = document.getElementById('balance-locked');
    if (locked) locked.checked = true;
    notify('已載入財務快照範例', 'success');
};

function renderFinanceStatements(data) {
    const plPlaceholder = document.getElementById('investor-pl-statement');
    const bsPlaceholder = document.getElementById('investor-balance-sheet');
    if (!plPlaceholder || !bsPlaceholder) return;

    const uniqueOrders = new Map();
    const allStudents = data.students || [];
    allStudents.forEach(student => {
        (student.orderRecords || []).forEach(order => {
            if (order.id && (order.status === 'SUCCESS' || order.paidAt)) {
                uniqueOrders.set(order.id, { ...order, email: student.email || '未提供' });
            }
        });
    });
    const ordersList = Array.from(uniqueOrders.values());

    const tutorRate = 0.20;
    const tutorUplineRate = 0.20;
    const gatewayFeeRate = 0.032;
    const hardwareCOGSPercent = 0.62;

    const userByEmail = {};
    allStudents.forEach(s => { if (s.email) userByEmail[s.email.toLowerCase().trim()] = s; });

    function getTutorUpline(email) {
        const normalized = String(email || '').trim().toLowerCase();
        const tutorUser = userByEmail[normalized];
        return (tutorUser && tutorUser.tutorEmail) ? tutorUser.tutorEmail.toLowerCase().trim() : 'info@vibe-coding.tw';
    }

    let courseRevenue = 0, hardwareRevenue = 0, totalTutorShare = 0, totalHardwareCOGS = 0;
    ordersList.forEach(order => {
        const items = order.items || {};
        Object.entries(items).forEach(([itemKey, itemValue]) => {
            const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
            const price = parseFloat(itemValue?.price || 0) || 0;
            const amount = price * quantity;
            if (amount <= 0) return;
            const isPhysical = itemValue?.isPhysical === true || itemKey === 'esp32-c3' || itemKey === 'esp32-s3';
            if (isPhysical) { hardwareRevenue += amount; totalHardwareCOGS += amount * hardwareCOGSPercent; }
            else { courseRevenue += amount; }
            const initialTutor = String(itemValue?.referredTutorEmail || itemValue?.referralTutor || 'info@vibe-coding.tw').trim().toLowerCase();
            let currentTutor = initialTutor;
            let currentShare = amount * tutorRate;
            while (currentTutor && currentShare >= 0.01) {
                totalTutorShare += currentShare;
                if (currentTutor === 'info@vibe-coding.tw') break;
                currentTutor = getTutorUpline(currentTutor);
                currentShare *= tutorUplineRate;
            }
        });
    });

    courseRevenue = Math.round(courseRevenue * 100) / 100;
    hardwareRevenue = Math.round(hardwareRevenue * 100) / 100;
    const totalRevenue = courseRevenue + hardwareRevenue;
    totalTutorShare = Math.round(totalTutorShare * 100) / 100;
    const totalGatewayFees = Math.round(totalRevenue * gatewayFeeRate * 100) / 100;
    totalHardwareCOGS = Math.round(totalHardwareCOGS * 100) / 100;
    const totalCOGS = totalTutorShare + totalGatewayFees + totalHardwareCOGS;
    const grossProfit = totalRevenue - totalCOGS;
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netOperatingIncome = grossProfit;

    const totalAssets = totalRevenue;
    const tutorPayable = totalTutorShare;
    const gatewayPayable = totalGatewayFees;
    const hardwarePayable = totalHardwareCOGS;
    const totalLiabilities = tutorPayable + gatewayPayable + hardwarePayable;
    const retainedEarnings = netOperatingIncome;
    const totalEquity = retainedEarnings;
    const issuedShares = 10000000;
    const navPerShare = issuedShares > 0 ? totalEquity / issuedShares : 0;

    plPlaceholder.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                    <tr class="border-b text-gray-500 font-medium">
                        <th class="py-2">${window.t('financial_items')}</th>
                        <th class="py-2 text-right">${window.t('amount_twd')}</th>
                        <th class="py-2 text-right">${window.t('ratio')}</th>
                    </tr>
                </thead>
                <tbody class="divide-y text-gray-700">
                    <tr>
                        <td class="py-2 font-semibold">${window.t('total_revenue')}</td>
                        <td class="py-2 text-right font-semibold">$${totalRevenue.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2 text-right font-semibold">100.00%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">├ ${window.t('digital_course')}</td>
                        <td class="py-1.5 text-right">$${courseRevenue.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalRevenue > 0 ? ((courseRevenue / totalRevenue) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">└ ${window.t('physical_hardware')}</td>
                        <td class="py-1.5 text-right">$${hardwareRevenue.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalRevenue > 0 ? ((hardwareRevenue / totalRevenue) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr>
                        <td class="py-2 font-semibold">${window.t('total_cogs')}</td>
                        <td class="py-2 text-right font-semibold">$${totalCOGS.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2 text-right font-semibold">${totalRevenue > 0 ? ((totalCOGS / totalRevenue) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">├ ${window.t('tutor_share')}</td>
                        <td class="py-1.5 text-right">$${totalTutorShare.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalRevenue > 0 ? ((totalTutorShare / totalRevenue) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">├ ${window.t('gateway_fees')}</td>
                        <td class="py-1.5 text-right">$${totalGatewayFees.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalRevenue > 0 ? ((totalGatewayFees / totalRevenue) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">└ ${window.t('hardware_cogs')}</td>
                        <td class="py-1.5 text-right">$${totalHardwareCOGS.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalRevenue > 0 ? ((totalHardwareCOGS / totalRevenue) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="bg-blue-50/50 font-bold text-blue-900">
                        <td class="py-2">${window.t('gross_profit')}</td>
                        <td class="py-2 text-right">$${grossProfit.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2 text-right">${grossMarginPct.toFixed(2)}%</td>
                    </tr>
                    <tr>
                        <td class="py-2 font-semibold">${window.t('total_opex')}</td>
                        <td class="py-2 text-right font-semibold">$0.00</td>
                        <td class="py-2 text-right font-semibold">0.00%</td>
                    </tr>
                    <tr class="bg-blue-50/70 font-bold text-blue-950 border-t-2 border-blue-200">
                        <td class="py-2.5">${window.t('net_income')}</td>
                        <td class="py-2.5 text-right">$${netOperatingIncome.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2.5 text-right">${grossMarginPct.toFixed(2)}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    bsPlaceholder.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                    <tr class="border-b text-gray-500 font-medium">
                        <th class="py-2">${window.t('accounting_items')}</th>
                        <th class="py-2 text-right">${window.t('amount_twd')}</th>
                        <th class="py-2 text-right">${window.t('ratio')}</th>
                    </tr>
                </thead>
                <tbody class="divide-y text-gray-700">
                    <tr class="bg-gray-50/50 font-bold"><td class="py-2" colspan="3">【${window.t('assets')}】</td></tr>
                    <tr>
                        <td class="py-1.5 pl-4">${window.t('cash')}</td>
                        <td class="py-1.5 text-right">$${totalAssets.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">100.00%</td>
                    </tr>
                    <tr class="font-semibold text-gray-900">
                        <td class="py-2">${window.t('total_assets')}</td>
                        <td class="py-2 text-right">$${totalAssets.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2 text-right">100.00%</td>
                    </tr>
                    <tr class="bg-gray-50/50 font-bold"><td class="py-2" colspan="3">【${window.t('liabilities')}】</td></tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">├ ${window.t('tutor_payable')}</td>
                        <td class="py-1.5 text-right">$${tutorPayable.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalAssets > 0 ? ((tutorPayable / totalAssets) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">├ ${window.t('gateway_payable')}</td>
                        <td class="py-1.5 text-right">$${gatewayPayable.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalAssets > 0 ? ((gatewayPayable / totalAssets) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">└ ${window.t('hardware_payable')}</td>
                        <td class="py-1.5 text-right">$${hardwarePayable.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalAssets > 0 ? ((hardwarePayable / totalAssets) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="font-semibold text-gray-900">
                        <td class="py-2">${window.t('total_liabilities')}</td>
                        <td class="py-2 text-right">$${totalLiabilities.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2 text-right">${totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="bg-gray-50/50 font-bold"><td class="py-2" colspan="3">【${window.t('equity')}】</td></tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">├ ${window.t('paid_in_capital')}</td>
                        <td class="py-1.5 text-right">$0.00</td>
                        <td class="py-1.5 text-right">0.00%</td>
                    </tr>
                    <tr class="text-gray-500">
                        <td class="py-1.5 pl-4">└ ${window.t('retained_earnings')}</td>
                        <td class="py-1.5 text-right">$${retainedEarnings.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-1.5 text-right">${totalAssets > 0 ? ((retainedEarnings / totalAssets) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="bg-emerald-50/50 font-bold text-emerald-900 border-t border-emerald-200">
                        <td class="py-2">${window.t('total_equity')}</td>
                        <td class="py-2 text-right">$${totalEquity.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2 text-right">${totalAssets > 0 ? ((totalEquity / totalAssets) * 100).toFixed(2) : 0}%</td>
                    </tr>
                    <tr class="bg-emerald-50/70 font-bold text-emerald-950 border-t-2 border-emerald-200">
                        <td class="py-2.5">${window.t('liabilities_equity')}</td>
                        <td class="py-2.5 text-right">$${(totalLiabilities + totalEquity).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-2.5 text-right">100.00%</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="mt-4 p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 flex justify-between items-center text-xs font-semibold text-emerald-800">
            <span>${window.t('issued_shares')}: ${issuedShares.toLocaleString('zh-TW')} ${window.t('shares')}</span>
            <span>${window.t('nav_per_share')}: $${navPerShare.toFixed(5)} TWD</span>
        </div>
    `;
}

async function initInvestorPortal() {
  const loading = document.getElementById('loading-state');
  const denied = document.getElementById('access-denied');
  const content = document.getElementById('investor-content');
  const guestView = document.getElementById('guest-view');
  const adminSetupNote = document.getElementById('admin-setup-note');
  const uidDisplay = document.getElementById('user-uid-display');
  uidDisplay?.addEventListener('click', () => {
    navigator.clipboard.writeText(uidDisplay.innerText);
    alert('Copied UID!');
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (loading) loading.classList.add('hidden');
      if (denied) denied.classList.remove('hidden');
      if (guestView) guestView.classList.remove('hidden');
      return;
    }
    if (uidDisplay) uidDisplay.textContent = user.uid;
    try {
      const fn = httpsCallable(functions, 'getDashboardData');
      const res = await fn({});
      const data = res?.data || {};
      const myRole = isAdminEmail(user.email) ? 'admin' : (data.role || '');
      if (myRole !== 'admin' && myRole !== 'investor') {
        if (loading) loading.classList.add('hidden');
        if (denied) denied.classList.remove('hidden');
        if (adminSetupNote) adminSetupNote.classList.remove('hidden');
        return;
      }
      if (loading) loading.classList.add('hidden');
      if (content) content.classList.remove('hidden');
      try { renderFinanceStatements(data); } catch (e) { console.warn('[InvestorPortal] renderFinanceStatements failed:', e); }
      await window.loadInvestorProfiles();
      await window.loadRevenuePolicies();
    } catch (err) {
      console.error('[InvestorPortal] init failed:', err);
      if (loading) loading.classList.add('hidden');
      if (denied) denied.classList.remove('hidden');
    }
  });
}
initInvestorPortal();
