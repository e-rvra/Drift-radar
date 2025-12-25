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
exports.makeOctokit = makeOctokit;
exports.getContextOrThrow = getContextOrThrow;
exports.getPull = getPull;
exports.listPullFiles = listPullFiles;
exports.listMergedPulls = listMergedPulls;
const octokit_1 = require("octokit");
const github = __importStar(require("@actions/github"));
function makeOctokit(token) {
    return new octokit_1.Octokit({ auth: token });
}
function getContextOrThrow(pullNumberOverride) {
    const ctx = github.context;
    const owner = ctx.repo.owner;
    const repo = ctx.repo.repo;
    const pr = ctx.payload.pull_request;
    const pullNumber = pullNumberOverride ?? pr?.number;
    if (!owner || !repo)
        throw new Error("Missing repository context.");
    if (!pullNumber)
        throw new Error("No pull request in context. Provide input 'pull-number' for workflow_dispatch.");
    // defaultBranch might be on payload.repository
    const defaultBranch = ctx.payload?.repository?.default_branch || "main";
    return { owner, repo, pullNumber: Number(pullNumber), defaultBranch };
}
async function getPull(octokit, owner, repo, pullNumber) {
    const res = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: pullNumber
    });
    return res.data;
}
async function listPullFiles(octokit, owner, repo, pullNumber) {
    const perPage = 100;
    let page = 1;
    const out = [];
    while (true) {
        const res = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
            owner,
            repo,
            pull_number: pullNumber,
            per_page: perPage,
            page
        });
        const items = res.data;
        for (const it of items) {
            out.push({
                filename: String(it.filename),
                additions: Number(it.additions ?? 0),
                deletions: Number(it.deletions ?? 0)
            });
        }
        if (items.length < perPage)
            break;
        page += 1;
    }
    return out;
}
async function listMergedPulls(octokit, owner, repo, n) {
    // List closed PRs, filter merged.
    // Note: GitHub API doesn't support merged=true directly for pulls.list; we filter.
    const perPage = 50;
    let page = 1;
    const mergedNumbers = [];
    while (mergedNumbers.length < n) {
        const res = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
            owner,
            repo,
            state: "closed",
            sort: "updated",
            direction: "desc",
            per_page: perPage,
            page
        });
        const items = res.data;
        if (items.length === 0)
            break;
        for (const pr of items) {
            if (pr.merged_at)
                mergedNumbers.push(Number(pr.number));
            if (mergedNumbers.length >= n)
                break;
        }
        if (items.length < perPage)
            break;
        page += 1;
    }
    return mergedNumbers.slice(0, n);
}
