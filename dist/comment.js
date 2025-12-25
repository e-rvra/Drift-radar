"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertSingleComment = upsertSingleComment;
const core = __importStar(require("@actions/core"));
async function upsertSingleComment(params) {
    const { octokit, owner, repo, issueNumber, body, tag } = params;
    const marker = tag.trim();
    const fullBody = `${marker}\n${body}\n`;
    // list comments and find existing
    const perPage = 100;
    let page = 1;
    let existingId = null;
    try {
        while (true) {
            const res = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
                owner,
                repo,
                issue_number: issueNumber,
                per_page: perPage,
                page
            });
            const items = res.data;
            for (const c of items) {
                const text = String(c.body ?? "");
                if (text.includes(marker)) {
                    existingId = Number(c.id);
                    break;
                }
            }
            if (existingId)
                break;
            if (items.length < perPage)
                break;
            page += 1;
        }
        if (existingId) {
            await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
                owner,
                repo,
                comment_id: existingId,
                body: fullBody
            });
        }
        else {
            await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
                owner,
                repo,
                issue_number: issueNumber,
                body: fullBody
            });
        }
    }
    catch (e) {
        // permissions-limited fallback: no crash
        core.info(`Unable to create/update PR comment (non-fatal). ${e?.message ?? String(e)}`);
    }
}
