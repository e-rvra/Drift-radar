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
const core = __importStar(require("@actions/core"));
const github_1 = require("./github");
const analyze_1 = require("./analyze");
const baseline_1 = require("./baseline");
const comment_1 = require("./comment");
const utils_1 = require("./utils");
function buildComment(params) {
    const { score, emoji, trendText, reviewMinutes, drivers, actions } = params;
    const title = "Drift Radar — Structural Risk Signal";
    const line = `Score: ${score}/100 ${emoji}   Trend: ${trendText}   Review Load: ~${reviewMinutes} min`;
    const driversBlock = "Main risk drivers:\n" +
        drivers.map((d) => `• ${d}`).join("\n");
    const actionsBlock = "Suggested actions:\n" +
        actions.map((a) => `• ${a}`).join("\n");
    return `${title}\n\n${line}\n\n${driversBlock}\n\n${actionsBlock}`;
}
async function run() {
    const token = core.getInput("github-token", { required: true });
    const mode = core.getInput("mode") || "analyze";
    const historyN = Number(core.getInput("history-prs") || "20");
    const tag = core.getInput("comment-tag") || "<!-- drift-radar -->";
    const pullOverrideStr = (core.getInput("pull-number") || "").trim();
    const pullOverride = pullOverrideStr ? Number(pullOverrideStr) : undefined;
    const octokit = (0, github_1.makeOctokit)(token);
    // Context: require PR unless refresh-baseline
    let ctx = null;
    try {
        ctx = (0, github_1.getContextOrThrow)(pullOverride);
    }
    catch (e) {
        if (mode === "refresh-baseline") {
            // baseline refresh without PR context is allowed
            const owner = require("@actions/github").context.repo.owner;
            const repo = require("@actions/github").context.repo.repo;
            const defaultBranch = require("@actions/github").context.payload?.repository?.default_branch || "main";
            ctx = { owner, repo, pullNumber: 0, defaultBranch };
        }
        else {
            throw e;
        }
    }
    if (!ctx)
        throw new Error("Unable to resolve context.");
    const { owner, repo, pullNumber, defaultBranch } = ctx;
    if (mode === "refresh-baseline") {
        core.info(`Mode: refresh-baseline (historyN=${historyN})`);
        const baseline = await (0, baseline_1.computeBaseline)(octokit, owner, repo, historyN);
        await (0, baseline_1.saveBaselineToCache)(defaultBranch, baseline);
        core.info(`Baseline refreshed. median=${baseline.baselineMedianScore ?? "n/a"} hotspots=${baseline.hotspotFiles.length}`);
        return;
    }
    // mode analyze: needs PR number
    if (!pullNumber || pullNumber <= 0) {
        core.info("No pull request number available. For workflow_dispatch, provide input 'pull-number'.");
        return;
    }
    // Load baseline from cache first; fallback to compute if missing
    let baseline = await (0, baseline_1.loadBaselineFromCache)(defaultBranch);
    if (!baseline || baseline.historyN !== historyN) {
        core.info(`Baseline cache miss or N changed; computing baseline from GitHub (historyN=${historyN}).`);
        try {
            baseline = await (0, baseline_1.computeBaseline)(octokit, owner, repo, historyN);
            await (0, baseline_1.saveBaselineToCache)(defaultBranch, baseline);
        }
        catch (e) {
            core.info(`Unable to compute baseline history (non-fatal): ${e?.message ?? String(e)}`);
            baseline = {
                computedAt: new Date().toISOString(),
                historyN,
                baselineMedianScore: null,
                hotspotFiles: []
            };
        }
    }
    const hotspotSet = new Set(baseline.hotspotFiles || []);
    // PR files
    let files;
    try {
        files = await (0, github_1.listPullFiles)(octokit, owner, repo, pullNumber);
    }
    catch (e) {
        core.info(`Unable to read PR files. ${e?.message ?? String(e)}`);
        return;
    }
    const res = (0, analyze_1.analyze)(files, hotspotSet);
    const baselineScore = baseline.baselineMedianScore;
    const trendText = baselineScore === null ? "n/a" : (0, utils_1.formatSigned)(res.scores.score - Math.round(baselineScore));
    // drivers labels already neutral
    const drivers = res.driversTop3.map((d) => d.label);
    // Permission-limited note (only if baseline missing)
    // Product constraint: keep comment clean, but we can reflect Trend: n/a already.
    const body = buildComment({
        score: res.scores.score,
        emoji: res.scores.verdictEmoji,
        trendText,
        reviewMinutes: res.scores.reviewMinutes,
        drivers,
        actions: res.suggestedActions
    });
    core.info(`Score=${res.scores.score} Trend=${trendText} Review=${res.scores.reviewMinutes}m Drivers=${drivers.join(" | ")}`);
    await (0, comment_1.upsertSingleComment)({
        octokit,
        owner,
        repo,
        issueNumber: pullNumber,
        body,
        tag
    });
}
run().catch((err) => {
    // explicit message, no crashy stack spam
    core.setFailed(err?.message ? String(err.message) : "Drift Radar failed.");
});
