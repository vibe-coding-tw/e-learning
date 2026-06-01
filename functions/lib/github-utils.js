async function githubApiRequest(token, pathname, options = {}) {
    if (!token) {
        throw new Error("GITHUB_ORG_ADMIN_TOKEN is missing");
    }
    const url = `https://api.github.com${pathname}`;
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
    };
    const resp = await fetch(url, { ...options, headers });
    let body = null;
    try {
        body = await resp.json();
    } catch (_) {
        body = null;
    }
    return { ok: resp.ok, status: resp.status, body };
}

async function upsertGithubActionsVariable(token, { owner, repo, name, value }) {
    if (!owner || !repo || !name) return { ok: false, reason: "missing_params" };
    if (!token) return { ok: false, reason: "missing_token" };

    const body = { name, value: String(value ?? "") };
    const resp = await githubApiRequest(
        token,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/variables/${encodeURIComponent(name)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: body.value })
        }
    );
    if (resp.ok) return { ok: true, action: "updated" };
    if (resp.status === 404) {
        const createResp = await githubApiRequest(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/variables`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        );
        if (createResp.ok) return { ok: true, action: "created" };
        return { ok: false, status: createResp.status, body: createResp.body };
    }
    return { ok: false, status: resp.status, body: resp.body };
}

async function resolveGithubLoginFromFirebaseUid(admin, token, firebaseUid) {
    const userRecord = await admin.auth().getUser(firebaseUid);
    const provider = (userRecord.providerData || []).find(p => p.providerId === "github.com");
    if (!provider || !provider.uid) {
        return { githubProviderUid: null, githubLogin: null };
    }

    const providerUid = String(provider.uid);
    const userResp = await githubApiRequest(token, `/user/${encodeURIComponent(providerUid)}`);
    if (!userResp.ok || !userResp.body || !userResp.body.login) {
        return { githubProviderUid: providerUid, githubLogin: null };
    }
    return { githubProviderUid: providerUid, githubLogin: String(userResp.body.login) };
}

async function ensureGithubOrgMembership({ admin, token, firebaseUid, org }) {
    const { githubProviderUid, githubLogin } = await resolveGithubLoginFromFirebaseUid(admin, token, firebaseUid);
    if (!githubProviderUid || !githubLogin) {
        return { ok: false, state: "missing_github_identity", githubLogin: null, inviteSent: false, org };
    }

    const membershipResp = await githubApiRequest(token, `/orgs/${encodeURIComponent(org)}/memberships/${encodeURIComponent(githubLogin)}`);
    if (membershipResp.ok && membershipResp.body) {
        const state = String(membershipResp.body.state || "").toLowerCase();
        if (state === "active") {
            return { ok: true, state: "active", githubLogin, inviteSent: false, org };
        }
        if (state === "pending") {
            return { ok: false, state: "pending", githubLogin, inviteSent: false, org };
        }
    }

    let inviteSent = false;
    let inviteId = null;
    const inviteResp = await githubApiRequest(token, `/orgs/${encodeURIComponent(org)}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitee_id: Number(githubProviderUid), role: "direct_member" })
    });
    if (inviteResp.ok && inviteResp.body) {
        inviteSent = true;
        inviteId = inviteResp.body.id || null;
    }

    return {
        ok: false,
        state: inviteSent ? "invited" : "not_member",
        githubLogin,
        inviteSent,
        inviteId,
        org
    };
}

function extractHiddenSectionContent(html, sectionId) {
    if (!html || !sectionId) return "";

    const openTagRegex = new RegExp(`<section\\b[^>]*\\bid=["']${sectionId}["'][^>]*>`, 'i');
    const openMatch = openTagRegex.exec(html);
    if (!openMatch) return "";

    const sectionStart = openMatch.index;
    const tagContentStart = sectionStart + openMatch[0].length;

    let depth = 1;
    const sectionTagRegex = /<\/?section\b[^>]*>/gi;
    sectionTagRegex.lastIndex = tagContentStart;

    let match;
    while ((match = sectionTagRegex.exec(html)) !== null) {
        const tag = match[0];
        if (!tag.startsWith('</')) {
            depth++;
        } else {
            depth--;
            if (depth === 0) {
                return html.slice(tagContentStart, match.index).trim();
            }
        }
    }

    return "";
}

async function resolveAssignmentDocRefByUserAndUnit(db, userId, assignmentIdOrUnitId) {
    const raw = String(assignmentIdOrUnitId || "").trim();
    if (!raw) return null;

    const normalized = raw.replace(/\.html$/i, '');
    const exactDocId = `${userId}_${normalized}`;
    const exactRef = db.collection('assignments').doc(exactDocId);
    const exactDoc = await exactRef.get();
    if (exactDoc.exists) return exactRef;

    const unitCandidates = new Set([raw, normalized, `${normalized}.html`]);
    const baseQuery = db.collection('assignments').where('userId', '==', userId);
    const snapshot = await baseQuery.limit(200).get();
    if (snapshot.empty) return null;

    const matched = snapshot.docs.filter((d) => {
        const row = d.data() || {};
        const aid = String(row.assignmentId || '').trim();
        const uid = String(row.unitId || '').trim();
        const aidNorm = aid.replace(/\.html$/i, '');
        const uidNorm = uid.replace(/\.html$/i, '');
        return unitCandidates.has(aid) || unitCandidates.has(aidNorm) ||
            unitCandidates.has(uid) || unitCandidates.has(uidNorm);
    });

    if (matched.length === 0) return null;
    matched.sort((a, b) => {
        const aTs = (a.data().updatedAt?.toMillis?.() || a.data().submittedAt?.toMillis?.() || 0);
        const bTs = (b.data().updatedAt?.toMillis?.() || b.data().submittedAt?.toMillis?.() || 0);
        return bTs - aTs;
    });
    return matched[0].ref;
}

module.exports = {
    ensureGithubOrgMembership,
    extractHiddenSectionContent,
    resolveAssignmentDocRefByUserAndUnit,
    upsertGithubActionsVariable
};
