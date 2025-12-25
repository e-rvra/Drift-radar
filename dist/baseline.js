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
exports.loadBaselineFromCache = loadBaselineFromCache;
exports.saveBaselineToCache = saveBaselineToCache;
exports.computeBaseline = computeBaseline;
const core = __importStar(require("@actions/core"));
const cache = __importStar(require("@actions/cache"));
const github_1 = require("./github");
const analyze_1 = require("./analyze");
const utils_1 = require("./utils");
const CACHE_PATH = ".drift-radar-cache";
const CACHE_FILE = `${CACHE_PATH}/baseline.json`;
function safeJsonParse(s) {
    try {
        return JSON.parse(s);
    }
    catch {
        return null;
    }
}
async function loadBaselineFromCache(defaultBranch) {
    try {
        const key = `drift-radar-baseline-${defaultBranch}`;
        await cache.restoreCache([CACHE_PATH], key);
        const fs = await Promise.resolve().then(() => __importStar(require("fs")));
        if (!fs.existsSync(CACHE_FILE))
            return null;
        const raw = fs.readFileSync(CACHE_FILE, "utf8");
        const parsed = safeJsonParse(raw);
        if (!parsed)
            return null;
        return parsed;
    }
    catch (e) {
        core.info(`Baseline cache restore failed (non-fatal): ${e?.message ?? String(e)}`);
        return null;
    }
}
async function saveBaselineToCache(defaultBranch, data) {
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    fs.mkdirSync(CACHE_PATH, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf8");
    const key = `drift-radar-baseline-${defaultBranch}`;
    try {
        await cache.saveCache([CACHE_PATH], key);
    }
    catch (e) {
        // cache save might fail (already exists), that's fine.
        core.info(`Baseline cache save failed (non-fatal): ${e?.message ?? String(e)}`);
    }
}
async function computeBaseline(octokit, owner, repo, historyN) {
    const merged = await (0, github_1.listMergedPulls)(octokit, owner, repo, historyN);
    if (merged.length === 0) {
        return {
            computedAt: new Date().toISOString(),
            historyN,
            baselineMedianScore: null,
            hotspotFiles: []
        };
    }
    // Hotspots: count file frequencies across merged PRs
    const freq = new Map();
    const scores = [];
    // Rate-limit friendly: hard cap how many PRs we fully expand if needed
    const toProcess = merged.slice(0, historyN);
    for (const prNumber of toProcess) {
        const files = await (0, github_1.listPullFiles)(octokit, owner, repo, prNumber);
        for (const f of files) {
            freq.set(f.filename, (freq.get(f.filename) ?? 0) + 1);
        }
        // Baseline score for this PR (trend baseline uses the same scoring model)
        // Hotspots for historical PR scoring: we don't want circular dependency.
        // Use empty hotspot set when scoring history.
        const res = (0, analyze_1.analyze)(files, new Set());
        scores.push(res.scores.score);
    }
    // Determine hotspots: threshold >= 3 occurrences OR top 10, whichever yields more signal.
    const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const top10 = entries.slice(0, 10).map(([p]) => p);
    const threshold = entries.filter(([, c]) => c >= 3).map(([p]) => p);
    const hotspotSet = new Set([...top10, ...threshold]);
    const baselineMedianScore = (0, utils_1.median)(scores);
    return {
        computedAt: new Date().toISOString(),
        historyN,
        baselineMedianScore,
        hotspotFiles: [...hotspotSet]
    };
}
